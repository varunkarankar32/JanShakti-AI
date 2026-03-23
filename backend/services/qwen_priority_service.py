"""
Qwen priority scoring service.
Uses a Qwen instruct model to map complaint text into structured priority signals.
"""

from __future__ import annotations

import json
import re
import ast
from typing import Any, Dict, Optional, Tuple

import httpx

from config import (
    QWEN_PRIORITY_ENABLED,
    QWEN_PRIORITY_MAX_NEW_TOKENS,
    QWEN_PRIORITY_MODEL,
    QWEN_API_PROVIDER,
    QWEN_API_URL,
    QWEN_API_KEY,
    QWEN_API_MODEL,
    QWEN_API_TIMEOUT,
    QWEN_API_REFERER,
    QWEN_API_TITLE,
)

try:
    from transformers import pipeline as hf_pipeline
    HF_AVAILABLE = True
except Exception:
    HF_AVAILABLE = False


def _clamp(value: Any, low: float, high: float, default: float) -> float:
    try:
        parsed = float(value)
        return max(low, min(high, parsed))
    except Exception:
        return default


def _extract_json_block(text: str) -> Dict[str, Any]:
    if not text:
        return {}

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return {}

    raw = match.group(0)
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _extract_json_payload_relaxed(text: str) -> Dict[str, Any]:
    """Try harder to parse Qwen output that may include markdown fences or relaxed JSON."""
    if not text:
        return {}

    raw = str(text).strip()
    if not raw:
        return {}

    # Remove markdown fences when present.
    raw = raw.replace("```json", "").replace("```", "").strip()

    payload = _extract_json_block(raw)
    if payload:
        return payload

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}

    candidate = raw[start : end + 1].strip()

    # Common cleanup: trailing commas before } or ]
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # Some models emit Python-like dicts using single quotes.
    try:
        parsed = ast.literal_eval(candidate)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    return {}


def _extract_first_line(text: str) -> str:
    if not text:
        return ""
    cleaned = str(text).strip()
    if not cleaned:
        return ""
    return cleaned.splitlines()[0].strip()


def _extract_field_from_text(text: str, field: str) -> str:
    if not text:
        return ""

    # JSON-style key
    m = re.search(rf'"{re.escape(field)}"\s*:\s*"([^"]+)"', text, flags=re.IGNORECASE)
    if m:
        return m.group(1).strip()

    # Python-style key
    m = re.search(rf"'{re.escape(field)}'\s*:\s*'([^']+)'", text, flags=re.IGNORECASE)
    if m:
        return m.group(1).strip()

    return ""


class QwenPriorityService:
    def __init__(self):
        self.enabled = QWEN_PRIORITY_ENABLED
        self.model_name = QWEN_PRIORITY_MODEL
        self.max_new_tokens = max(96, QWEN_PRIORITY_MAX_NEW_TOKENS)
        self.api_provider = str(QWEN_API_PROVIDER or "auto").strip().lower()
        self.api_url = str(QWEN_API_URL or "").strip()
        self.api_key = str(QWEN_API_KEY or "").strip()
        self.api_model = str(QWEN_API_MODEL or "").strip() or self.model_name
        self.api_timeout = max(10, int(QWEN_API_TIMEOUT or 45))
        self.api_referer = str(QWEN_API_REFERER or "").strip()
        self.api_title = str(QWEN_API_TITLE or "JanShakti-AI").strip()
        self.generator = None
        self._load_error = ""
        self.last_error = ""
        self.last_provider = ""
        self.last_model_used = ""

    def _prefer_api(self) -> bool:
        if self.api_provider == "openrouter":
            return True
        if self.api_provider == "local":
            return False
        return bool(self.api_key)

    def _generate_with_openrouter(self, prompt: str, max_new_tokens: int) -> Tuple[bool, str, str]:
        if not self.api_key:
            return False, "", "openrouter_missing_api_key"
        if not self.api_url:
            return False, "", "openrouter_missing_api_url"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.api_referer:
            headers["HTTP-Referer"] = self.api_referer
        if self.api_title:
            headers["X-Title"] = self.api_title

        payload = {
            "model": self.api_model,
            "messages": [
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
            "max_tokens": int(max_new_tokens),
        }

        try:
            with httpx.Client(timeout=self.api_timeout) as client:
                response = client.post(self.api_url, headers=headers, json=payload)
            if response.status_code >= 400:
                return False, "", f"openrouter_http_{response.status_code}"

            data = response.json()
            choices = data.get("choices") or []
            if not choices:
                return False, "", "openrouter_empty_choices"

            message = choices[0].get("message") or {}
            content = message.get("content", "")
            if isinstance(content, list):
                text_chunks = []
                for chunk in content:
                    if isinstance(chunk, dict) and chunk.get("type") == "text":
                        text_chunks.append(str(chunk.get("text", "")))
                content = "\n".join(text_chunks)

            generated = str(content or "").strip()
            if not generated:
                return False, "", "openrouter_empty_content"

            return True, generated, ""
        except Exception as exc:
            return False, "", f"openrouter_error: {str(exc)[:160]}"

    def _ensure_loaded(self):
        if not self.enabled:
            self._load_error = "disabled"
            return

        if self.generator is not None:
            return

        if not HF_AVAILABLE:
            self._load_error = "transformers unavailable"
            return

        try:
            self.generator = hf_pipeline(
                "text-generation",
                model=self.model_name,
                device=-1,
            )
            print(f"[QwenPriority] Loaded model: {self.model_name}")
        except Exception as exc:
            self._load_error = str(exc)
            self.generator = None
            print(f"[QwenPriority] Failed to load model: {exc}")

    def _generate(self, prompt: str, max_new_tokens: int) -> Tuple[bool, str, str, str]:
        """Generate text and return: (ok, generated_text, model_used, failure_reason)."""
        provider_error = ""

        if self._prefer_api():
            ok, generated, reason = self._generate_with_openrouter(prompt, max_new_tokens)
            if ok:
                self.last_provider = "openrouter"
                self.last_model_used = self.api_model
                self.last_error = ""
                return True, generated, self.api_model, ""
            provider_error = reason

        self._ensure_loaded()
        if self.generator is None:
            reason = self._load_error or "model_not_loaded"
            if provider_error:
                reason = f"{provider_error}; local_fallback_failed: {reason}"
            self.last_provider = "local"
            self.last_model_used = ""
            self.last_error = reason
            return False, "", "", reason

        try:
            out = self.generator(
                prompt,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                temperature=0.0,
                return_full_text=False,
            )
            generated = out[0].get("generated_text", "") if out else ""
            if not generated:
                self.last_provider = "local"
                self.last_model_used = self.model_name
                self.last_error = "empty_local_generation"
                return False, "", "", "empty_local_generation"
            self.last_provider = "local"
            self.last_model_used = self.model_name
            self.last_error = ""
            return True, generated, self.model_name, ""
        except Exception as exc:
            reason = f"runtime_error: {exc}"
            if provider_error:
                reason = f"{provider_error}; local_runtime_error: {exc}"
            self.last_provider = "local"
            self.last_model_used = self.model_name
            self.last_error = reason
            return False, "", "", reason

    def get_runtime_status(self) -> Dict[str, Any]:
        local_available = bool(HF_AVAILABLE)
        local_loaded = self.generator is not None

        return {
            "enabled": self.enabled,
            "provider_mode": self.api_provider,
            "prefer_api": self._prefer_api(),
            "api": {
                "configured": bool(self.api_key),
                "url": self.api_url,
                "model": self.api_model,
                "timeout": self.api_timeout,
            },
            "local": {
                "available": local_available,
                "loaded": local_loaded,
                "model": self.model_name,
                "load_error": self._load_error,
            },
            "last": {
                "provider": self.last_provider,
                "model": self.last_model_used,
                "error": self.last_error,
            },
        }

    def score_issue(self, text: str, category: str, ward: str) -> Dict[str, Any]:
        """
        Returns structured score hints from Qwen model.
        If unavailable/failing, returns used=False with fallback reason.
        """
        prompt = (
            "You are a civic complaint triage model. "
            "Given complaint text, output only strict JSON with this schema:\n"
            "{\n"
            "  \"urgency\": number 0-100,\n"
            "  \"impact\": number 0-100,\n"
            "  \"sentiment_label\": \"negative\"|\"neutral\"|\"positive\",\n"
            "  \"sentiment_score\": number 0-100 where higher means more public frustration/negative pressure,\n"
            "  \"confidence\": number 0-1,\n"
            "  \"reasoning\": short single-line explanation\n"
            "}\n"
            "No markdown, no prose, JSON only.\n\n"
            f"Category: {category}\n"
            f"Ward: {ward}\n"
            f"Complaint: {text}\n"
        )

        ok, generated, model_used, reason = self._generate(prompt, self.max_new_tokens)
        if not ok:
            return {
                "used": False,
                "reason": reason or "model_not_loaded",
            }

        try:
            payload = _extract_json_block(generated)

            if not payload:
                return {"used": False, "reason": "invalid_qwen_output"}

            sentiment_label = str(payload.get("sentiment_label", "neutral")).strip().lower()
            if sentiment_label not in {"negative", "neutral", "positive"}:
                sentiment_label = "neutral"

            urgency = _clamp(payload.get("urgency"), 0.0, 100.0, 50.0)
            impact = _clamp(payload.get("impact"), 0.0, 100.0, 50.0)
            sentiment_score = _clamp(payload.get("sentiment_score"), 0.0, 100.0, 45.0)
            confidence = _clamp(payload.get("confidence"), 0.0, 1.0, 0.5)
            reasoning = str(payload.get("reasoning", "")).strip()[:220]

            return {
                "used": True,
                "urgency": round(urgency, 1),
                "impact": round(impact, 1),
                "sentiment_label": sentiment_label,
                "sentiment_score": round(sentiment_score, 1),
                "confidence": round(confidence, 3),
                "reasoning": reasoning,
                "model": model_used,
            }
        except Exception as exc:
            return {
                "used": False,
                "reason": f"runtime_error: {exc}",
            }

    def write_image_complaint(
        self,
        mapped_category: str,
        detected_category: str,
        severity: str,
        confidence: float,
        visible_cues: str,
        ward_hint: str,
    ) -> Dict[str, Any]:
        """Generate a concise citizen-friendly complaint description from image analysis."""
        prompt = (
            "You rewrite municipal image-analysis signals into one short complaint statement.\n"
            "Return strict JSON only:\n"
            "{\n"
            "  \"complaint_text\": \"single paragraph, 1-2 sentences, plain citizen language\",\n"
            "  \"urgency_note\": \"very short reason for urgency\"\n"
            "}\n"
            "Rules: no markdown, no bullet list, no extra keys, no disclaimers.\n"
            "Do not invent address, city, ZIP code, landmark, or person name.\n"
            "Use only the provided detected signals and keep it about the civic issue.\n\n"
            f"Ward: {ward_hint}\n"
            f"Mapped category: {mapped_category}\n"
            f"Detected category: {detected_category}\n"
            f"Severity: {severity}\n"
            f"Confidence: {round(float(confidence or 0.0), 3)}\n"
            f"Visible cues: {visible_cues or 'not specified'}\n"
        )

        max_tokens = min(220, self.max_new_tokens)
        ok, generated, model_used, reason = self._generate(prompt, max_tokens)
        if not ok:
            return {
                "used": False,
                "reason": reason or "model_not_loaded",
            }

        try:
            payload = _extract_json_payload_relaxed(generated)
            if not payload:
                # Salvage useful text even if JSON format is imperfect.
                complaint_text = _extract_field_from_text(generated, "complaint_text")
                if not complaint_text:
                    complaint_text = _extract_first_line(generated)

                complaint_text = re.sub(r"^json\s*", "", complaint_text, flags=re.IGNORECASE).strip()
                complaint_text = complaint_text.strip('"\' ')

                if len(complaint_text) >= 20:
                    return {
                        "used": True,
                        "complaint_text": complaint_text[:380],
                        "urgency_note": "",
                        "model": model_used,
                    }

                return {"used": False, "reason": "invalid_qwen_output"}

            complaint_text = str(payload.get("complaint_text", "")).strip()
            urgency_note = _extract_first_line(str(payload.get("urgency_note", "")))
            if not complaint_text:
                return {"used": False, "reason": "empty_qwen_complaint_text"}

            return {
                "used": True,
                "complaint_text": complaint_text[:380],
                "urgency_note": urgency_note[:140],
                "model": model_used,
            }
        except Exception as exc:
            return {
                "used": False,
                "reason": f"runtime_error: {exc}",
            }


qwen_priority_service = QwenPriorityService()
