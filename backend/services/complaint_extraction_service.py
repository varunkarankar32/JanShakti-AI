"""
Complaint Extraction Service
Builds structured complaint payloads from text, image, and voice inputs.
"""

from typing import Any, Dict, Optional
import re

from services.nlp_service import nlp_service
from services.speech_service import speech_service
from services.vision_service import vision_service


VISION_TO_CATEGORY = {
    "Pothole": "Roads & Potholes",
    "Road Crack": "Roads & Potholes",
    "Road Damage": "Roads & Potholes",
    "Garbage Dump": "Garbage & Sanitation",
    "Broken Pipe": "Water Supply",
    "Waterlogging": "Drainage",
    "Broken Streetlight": "Electricity",
    "Damaged Wall": "Safety & Security",
    "Fallen Tree": "Safety & Security",
    "Infrastructure Issue": "Roads & Potholes",
    "Unknown": "Others",
}


class ComplaintExtractionService:
    def _normalize_text(self, text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").strip())

    def refine_complaint_statement(self, text: str) -> str:
        """Clean noisy transcript text and convert it into a complaint-ready statement."""
        cleaned = self._normalize_text(text)
        if not cleaned:
            return ""

        filler_patterns = [
            r"\b(uh+|um+|hmm+|mmm+)\b",
            r"\b(sir|madam|please listen|hello)\b",
        ]
        for pattern in filler_patterns:
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

        cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,")
        if not cleaned:
            return ""

        cleaned = cleaned[0].upper() + cleaned[1:] if len(cleaned) > 1 else cleaned.upper()
        if cleaned[-1] not in ".!?":
            cleaned += "."

        return cleaned

    def _build_title(self, statement: str, fallback_category: str) -> str:
        short = statement[:80].strip()
        if not short:
            short = f"Complaint related to {fallback_category}"
        return short

    def extract_from_text(
        self,
        text: str,
        ward_hint: Optional[str] = None,
        category_hint: Optional[str] = None,
        source: str = "text",
    ) -> Dict[str, Any]:
        normalized = self._normalize_text(text)
        if len(normalized) < 5:
            raise ValueError("Complaint text is too short")

        statement = self.refine_complaint_statement(normalized)
        category_pred, category_conf = nlp_service.classify(statement)
        entities = nlp_service.extract_entities(statement)
        keywords = nlp_service.extract_keywords(statement)
        urgency_level, urgency_score = nlp_service.assess_urgency(statement)

        category = category_hint or category_pred
        ward = ward_hint or entities.get("ward") or "Ward 1"

        return {
            "title": self._build_title(statement, category),
            "description": statement,
            "category": category,
            "ward": ward,
            "location": entities.get("location") or entities.get("landmark") or "",
            "input_mode": source,
            "ai": {
                "category": category_pred,
                "category_confidence": round(float(category_conf), 4),
                "entities": entities,
                "keywords": keywords,
                "urgency_level": urgency_level,
                "urgency_score": urgency_score,
            },
        }

    def extract_from_image(
        self,
        image_bytes: bytes,
        caption: Optional[str] = None,
        ward_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        vision_result = vision_service.detect(image_bytes)
        detected_category = vision_result.get("category", "Unknown")
        mapped_category = VISION_TO_CATEGORY.get(detected_category, "Others")

        if caption and caption.strip():
            base_text = caption.strip()
        else:
            severity = vision_result.get("severity", "medium")
            conf = float(vision_result.get("confidence", 0.0) or 0.0)
            base_text = (
                f"Issue visible in submitted image: {detected_category}. "
                f"Severity appears {severity} with confidence {conf:.0%}."
            )

        extracted = self.extract_from_text(
            text=base_text,
            ward_hint=ward_hint,
            category_hint=mapped_category,
            source="photo",
        )
        extracted["ai_detection_result"] = vision_result
        return extracted

    def extract_from_voice(
        self,
        audio_bytes: bytes,
        file_extension: str = "ogg",
        ward_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        speech_result = speech_service.transcribe(audio_bytes, file_extension)
        transcript = self._normalize_text(speech_result.get("text", ""))
        if len(transcript) < 5:
            raise ValueError("Could not transcribe a meaningful complaint from audio")

        extracted = self.extract_from_text(
            text=transcript,
            ward_hint=ward_hint,
            source="voice",
        )
        extracted["transcript"] = transcript
        extracted["speech"] = speech_result
        return extracted


complaint_extraction_service = ComplaintExtractionService()
