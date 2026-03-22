"""
Qwen priority scoring service.
Uses a Qwen instruct model to map complaint text into structured priority signals.
"""

from __future__ import annotations

import json
import re
import ast
from typing import Any, Dict

from config import (
    QWEN_PRIORITY_ENABLED,
    QWEN_PRIORITY_MAX_NEW_TOKENS,
    QWEN_PRIORITY_MODEL,
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
        self.generator = None
        self._load_error = ""

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

    def score_issue(self, text: str, category: str, ward: str) -> Dict[str, Any]:
        """
        Returns structured score hints from Qwen model.
        If unavailable/failing, returns used=False with fallback reason.
        """
        self._ensure_loaded()
        if self.generator is None:
            return {
                "used": False,
                "reason": self._load_error or "model_not_loaded",
            }

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

        try:
            out = self.generator(
                prompt,
                max_new_tokens=self.max_new_tokens,
                do_sample=False,
                temperature=0.0,
                return_full_text=False,
            )
            generated = out[0].get("generated_text", "") if out else ""
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
                "model": self.model_name,
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
        self._ensure_loaded()
        if self.generator is None:
            return {
                "used": False,
                "reason": self._load_error or "model_not_loaded",
            }

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

        try:
            out = self.generator(
                prompt,
                max_new_tokens=min(220, self.max_new_tokens),
                do_sample=False,
                temperature=0.0,
                return_full_text=False,
            )
            generated = out[0].get("generated_text", "") if out else ""
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
                        "model": self.model_name,
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
                "model": self.model_name,
            }
        except Exception as exc:
            return {
                "used": False,
                "reason": f"runtime_error: {exc}",
            }


qwen_priority_service = QwenPriorityService()
