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
    "Traffic Light": "Electricity",
    "Damaged Wall": "Safety & Security",
    "Fallen Tree": "Safety & Security",
    "Infrastructure Issue": "Roads & Potholes",
    "Unknown": "Others",
}

CATEGORY_DESCRIPTION_TEMPLATES = {
    "Roads & Potholes": "The uploaded photo indicates road surface damage that is affecting safe movement.",
    "Garbage & Sanitation": "The uploaded photo indicates garbage/sanitation buildup that may create hygiene and odor problems.",
    "Water Supply": "The uploaded photo indicates a water supply infrastructure issue that may impact service availability.",
    "Drainage": "The uploaded photo indicates drainage blockage or overflow that can cause waterlogging.",
    "Electricity": "The uploaded photo indicates an electrical infrastructure fault that can affect public safety.",
    "Safety & Security": "The uploaded photo indicates a public safety concern that needs urgent field inspection.",
    "Others": "The uploaded photo indicates an infrastructure issue that requires municipal inspection.",
}

FILENAME_HINT_TO_CATEGORY = {
    "street": "Electricity",
    "light": "Electricity",
    "lamp": "Electricity",
    "pole": "Electricity",
    "garbage": "Garbage & Sanitation",
    "trash": "Garbage & Sanitation",
    "waste": "Garbage & Sanitation",
    "pipe": "Water Supply",
    "leak": "Water Supply",
    "water": "Drainage",
    "drain": "Drainage",
    "sewer": "Drainage",
    "road": "Roads & Potholes",
    "pothole": "Roads & Potholes",
    "tree": "Safety & Security",
    "wall": "Safety & Security",
}

SEVERITY_HINTS = {
    "critical": "This appears critical and should be attended immediately.",
    "high": "This appears high severity and should be prioritized.",
    "medium": "This appears medium severity and should be scheduled soon.",
    "low": "This appears low severity but still requires action.",
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

    def _category_hint_from_image_name(self, image_name: Optional[str]) -> Optional[str]:
        if not image_name:
            return None
        lowered = str(image_name).lower()
        for token, category in FILENAME_HINT_TO_CATEGORY.items():
            if token in lowered:
                return category
        return None

    def _format_detected_objects(self, vision_result: Dict[str, Any]) -> str:
        detections = vision_result.get("detections") or []
        labels = []
        for detection in detections:
            cls_name = str(detection.get("class", "")).replace("_", " ").strip().lower()
            if cls_name and cls_name not in labels:
                labels.append(cls_name)
        return ", ".join(labels[:3])

    def _build_image_only_description(
        self,
        vision_result: Dict[str, Any],
        mapped_category: str,
    ) -> str:
        detected_category = str(vision_result.get("category", "Infrastructure Issue") or "Infrastructure Issue")
        severity = str(vision_result.get("severity", "medium") or "medium").lower()
        confidence = float(vision_result.get("confidence", 0.0) or 0.0)

        template = CATEGORY_DESCRIPTION_TEMPLATES.get(
            mapped_category,
            CATEGORY_DESCRIPTION_TEMPLATES["Others"],
        )
        severity_hint = SEVERITY_HINTS.get(severity, SEVERITY_HINTS["medium"])
        object_hint = self._format_detected_objects(vision_result)

        description = (
            f"{template} "
            f"AI visual analysis suggests {detected_category.lower()} with {severity} severity "
            f"(confidence {confidence:.0%}). {severity_hint}"
        )

        if object_hint:
            description += f" Visible cues: {object_hint}."

        return self.refine_complaint_statement(description)

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
        image_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        vision_result = vision_service.detect(image_bytes, image_name=image_name)
        detected_category = vision_result.get("category", "Unknown")
        mapped_category = VISION_TO_CATEGORY.get(detected_category, "Others")

        image_only_mode = not (caption and caption.strip())
        filename_hint_category = self._category_hint_from_image_name(image_name)

        if image_only_mode and filename_hint_category and filename_hint_category != mapped_category:
            mapped_category = filename_hint_category
            # Keep visual confidence/severity but align semantic label with filename hint.
            vision_result = dict(vision_result)
            vision_result["category"] = filename_hint_category

        if not image_only_mode:
            base_text = caption.strip()
        else:
            base_text = self._build_image_only_description(vision_result, mapped_category)

        extracted = self.extract_from_text(
            text=base_text,
            ward_hint=ward_hint,
            category_hint=mapped_category,
            source="photo",
        )
        extracted["ai_detection_result"] = vision_result
        extracted["generated_from_image_only"] = image_only_mode
        extracted["image_problem_description"] = base_text
        extracted["filename_hint_category"] = filename_hint_category
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
            raise ValueError(
                speech_result.get("error")
                or "Could not transcribe a meaningful complaint from audio"
            )

        extracted = self.extract_from_text(
            text=transcript,
            ward_hint=ward_hint,
            source="voice",
        )
        extracted["transcript"] = transcript
        extracted["speech"] = speech_result
        return extracted


complaint_extraction_service = ComplaintExtractionService()
