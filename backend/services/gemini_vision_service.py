"""
Gemini Vision Service.
Uses Gemini image understanding to classify civic issue category from a photo.
"""

from __future__ import annotations

import base64
import json
import re
import ast
from typing import Any, Dict, Optional

import httpx

from config import (
    GEMINI_API_KEY,
    GEMINI_API_URL,
    GEMINI_MODEL,
    GEMINI_TIMEOUT,
    GEMINI_VISION_ENABLED,
)


VALID_CATEGORIES = {
    "Roads & Potholes",
    "Garbage & Sanitation",
    "Water Supply",
    "Drainage",
    "Electricity",
    "Safety & Security",
    "Others",
}


def _guess_mime_type(image_name: Optional[str]) -> str:
    lowered = str(image_name or "").lower()
    if lowered.endswith(".png"):
        return "image/png"
    if lowered.endswith(".webp"):
        return "image/webp"
    if lowered.endswith(".gif"):
        return "image/gif"
    return "image/jpeg"


def _extract_json(text: str) -> Dict[str, Any]:
    if not text:
        return {}

    raw = text.replace("```json", "").replace("```", "").strip()
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return {}

    candidate = match.group(0)
    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return {}

    return {}


def _extract_json_relaxed(text: str) -> Dict[str, Any]:
    payload = _extract_json(text)
    if payload:
        return payload

    if not text:
        return {}

    raw = str(text).strip().replace("```json", "").replace("```", "")
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}

    candidate = raw[start : end + 1].strip()
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    try:
        parsed = ast.literal_eval(candidate)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    return {}


def _infer_category_from_text(raw_text: str) -> Optional[str]:
    text = str(raw_text or "").lower()
    keyword_map = {
        "Roads & Potholes": ["pothole", "road", "crack", "asphalt", "road damage"],
        "Garbage & Sanitation": ["garbage", "trash", "waste", "dump", "sanitation"],
        "Water Supply": ["pipe", "water supply", "leak", "broken pipe", "tap"],
        "Drainage": ["drain", "drainage", "waterlogging", "overflow", "sewer"],
        "Electricity": ["streetlight", "street light", "electric", "pole", "power"],
        "Safety & Security": ["fallen tree", "unsafe", "hazard", "wall", "danger"],
    }

    for category, keywords in keyword_map.items():
        if any(keyword in text for keyword in keywords):
            return category
    return None


class GeminiVisionService:
    def __init__(self):
        self.enabled = GEMINI_VISION_ENABLED
        self.api_key = str(GEMINI_API_KEY or "").strip()
        self.api_url = str(GEMINI_API_URL or "").strip().rstrip("/")
        self.model = str(GEMINI_MODEL or "gemini-1.5-flash").strip()
        self.timeout = max(10, int(GEMINI_TIMEOUT or 30))
        self.last_error = ""

    def classify_issue(self, image_bytes: bytes, image_name: Optional[str] = None) -> Dict[str, Any]:
        if not self.enabled:
            return {"used": False, "reason": "gemini_disabled"}
        if not self.api_key:
            return {"used": False, "reason": "gemini_api_key_missing"}
        if not self.api_url:
            return {"used": False, "reason": "gemini_api_url_missing"}

        prompt = (
            "Classify this civic complaint image into exactly one category. "
            "Return strict JSON only with keys: category, issue_label, confidence, reason.\n"
            "Valid category values: Roads & Potholes, Garbage & Sanitation, Water Supply, Drainage, Electricity, Safety & Security, Others.\n"
            "Rules: No markdown, no extra keys. Keep issue_label short like pothole, road_crack, broken_pipe, streetlight_failure."
        )

        mime_type = _guess_mime_type(image_name)
        image_b64 = base64.b64encode(image_bytes).decode("ascii")

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": image_b64,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0,
                "maxOutputTokens": 512,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }

        endpoint = f"{self.api_url}/{self.model}:generateContent?key={self.api_key}"

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(endpoint, json=payload)
            if response.status_code >= 400:
                reason = f"gemini_http_{response.status_code}"
                self.last_error = reason
                return {"used": False, "reason": reason}

            data = response.json()
            candidates = data.get("candidates") or []
            if not candidates:
                self.last_error = "gemini_no_candidates"
                return {"used": False, "reason": "gemini_no_candidates"}

            parts = ((candidates[0].get("content") or {}).get("parts") or [])
            text_chunks = [str(p.get("text", "")) for p in parts if isinstance(p, dict) and p.get("text")]
            raw_text = "\n".join(text_chunks).strip()
            parsed = _extract_json_relaxed(raw_text)
            if not parsed:
                inferred = _infer_category_from_text(raw_text)
                if inferred:
                    self.last_error = ""
                    return {
                        "used": True,
                        "category": inferred,
                        "issue_label": "infrastructure_issue",
                        "confidence": 0.62,
                        "reason": "parsed_from_unstructured_gemini_text",
                        "model": self.model,
                    }

                self.last_error = "gemini_invalid_json"
                return {"used": False, "reason": "gemini_invalid_json"}

            category = str(parsed.get("category", "")).strip()
            if category not in VALID_CATEGORIES:
                self.last_error = "gemini_invalid_category"
                return {"used": False, "reason": "gemini_invalid_category"}

            issue_label = str(parsed.get("issue_label", "infrastructure_issue")).strip() or "infrastructure_issue"
            reason = str(parsed.get("reason", "")).strip()[:180]

            try:
                confidence = float(parsed.get("confidence", 0.65))
            except Exception:
                confidence = 0.65
            confidence = max(0.0, min(1.0, confidence))

            self.last_error = ""
            return {
                "used": True,
                "category": category,
                "issue_label": issue_label,
                "confidence": round(confidence, 3),
                "reason": reason,
                "model": self.model,
            }
        except Exception as exc:
            reason = f"gemini_error: {str(exc)[:160]}"
            self.last_error = reason
            return {"used": False, "reason": reason}


# Singleton
gemini_vision_service = GeminiVisionService()
