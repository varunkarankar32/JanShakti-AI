"""
NLP Service — Text Classification & Entity Extraction
Uses TF-IDF + SGDClassifier for complaint categorization.
Falls back to keyword-based classification if no trained model is available.
"""

import os
import re
import joblib
from typing import Dict, List, Optional, Tuple
from config import CLASSIFIER_MODEL_PATH


try:
    from transformers import pipeline as hf_pipeline
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    print("[NLP] transformers not installed — zero-shot model unavailable")


# Category keywords for fallback classification
CATEGORY_KEYWORDS = {
    "Water Supply": ["water", "pipe", "leak", "tap", "supply", "paani", "borewell", "tanker", "drinking water", "contamination", "pipeline", "burst", "water pipe", "water line", "low pressure", "no water"],
    "Roads & Potholes": ["road", "pothole", "crack", "asphalt", "tar", "highway", "footpath", "divider", "speed breaker", "cave-in", "sinkhole", "damaged road"],
    "Drainage": ["drain", "drainage", "flood", "waterlogging", "water logging", "clog", "sewer", "sewage", "overflow", "overflowing", "nallah", "nala", "gutter", "manhole", "stagnant", "blocked drain", "block drain", "choked drain", "storm water"],
    "Electricity": ["electricity", "power", "streetlight", "light", "wiring", "transformer", "outage", "cutoff", "bijli", "voltage", "pole", "cable", "short circuit"],
    "Garbage & Sanitation": ["garbage", "waste", "trash", "dump", "sanitation", "dirty", "filth", "kachra", "bin", "collection", "smell", "mosquito", "clean", "sweeping"],
    "Safety & Security": ["safety", "crime", "theft", "accident", "fight", "police", "danger", "unsafe", "robbery", "assault", "harassment", "stray dog", "illegal"],
    "Public Health": ["health", "hospital", "clinic", "disease", "illness", "doctor", "medicine", "epidemic", "dengue", "malaria", "fever", "infection"],
    "Education": ["school", "education", "teacher", "student", "classroom", "midday meal", "library", "anganwadi", "hostel"],
    "Public Transport": ["bus", "transport", "auto", "rickshaw", "station", "route", "schedule", "fare", "overcrowding"],
}

CATEGORY_LABELS = [
    "Water Supply",
    "Roads & Potholes",
    "Drainage",
    "Electricity",
    "Garbage & Sanitation",
    "Safety & Security",
    "Public Health",
    "Education",
    "Public Transport",
    "Others",
]

# Urgency keywords
URGENCY_KEYWORDS = {
    "critical": ["emergency", "danger", "collapse", "gas leak", "fire", "flood", "accident", "children at risk", "hospital", "electrocution", "death", "life-threatening"],
    "high": ["burst", "blocked", "overflow", "broken", "urgent", "3 days", "week", "repeated", "school zone", "ambulance"],
    "medium": ["not working", "damaged", "complaint", "issue", "problem", "request"],
    "low": ["repaint", "beautification", "suggestion", "minor", "cosmetic", "improvement"],
}


class NLPService:
    def __init__(
        self,
        model_path: str = CLASSIFIER_MODEL_PATH,
        zero_shot_model_name: str = "typeform/distilbert-base-uncased-mnli",
    ):
        self.model = None
        self.vectorizer = None
        self.model_path = model_path
        self.zero_shot_classifier = None
        self.zero_shot_model_name = os.getenv("NLP_ZERO_SHOT_MODEL", zero_shot_model_name)
        self._load_model()

    def _load_model(self):
        """Load local model first, then fallback to a pretrained zero-shot model."""
        try:
            if os.path.exists(self.model_path):
                bundle = joblib.load(self.model_path)
                self.model = bundle["model"]
                self.vectorizer = bundle["vectorizer"]
                print(f"[NLP] Loaded trained classifier from {self.model_path}")
                return
        except Exception as e:
            print(f"[NLP] Error loading local model: {e}")

        if HF_AVAILABLE:
            try:
                self.zero_shot_classifier = hf_pipeline(
                    "zero-shot-classification",
                    model=self.zero_shot_model_name,
                    device=-1,
                )
                print(f"[NLP] Loaded pretrained zero-shot model: {self.zero_shot_model_name}")
                return
            except Exception as e:
                print(f"[NLP] Error loading zero-shot model: {e}")

        print("[NLP] Using keyword-based classifier fallback")

    def classify(self, text: str) -> Tuple[str, float]:
        """
        Classify complaint text into a category.
        Returns (category, confidence).
        """
        text_lower = text.lower()
        keyword_scores = self._keyword_scores(text_lower)
        keyword_label, keyword_confidence = self._best_keyword_guess(keyword_scores)

        # Try ML model first
        if self.model and self.vectorizer:
            try:
                features = self.vectorizer.transform([text_lower])
                prediction = self.model.predict(features)[0]
                proba = self.model.predict_proba(features)
                confidence = float(max(proba[0]))
                return prediction, confidence
            except Exception as e:
                print(f"[NLP] ML prediction error: {e}")

        # Zero-shot pretrained fallback
        if self.zero_shot_classifier:
            try:
                result = self.zero_shot_classifier(
                    text[:1024],
                    candidate_labels=CATEGORY_LABELS,
                    hypothesis_template="This complaint is about {}.",
                    multi_label=False,
                )
                label = result["labels"][0]
                confidence = float(result["scores"][0])

                # Resolve common civic-domain conflicts (for example Drainage vs Water Supply)
                # by blending zero-shot confidence with explicit keyword signals.
                if keyword_label:
                    if label == keyword_label:
                        return label, max(confidence, keyword_confidence)

                    if keyword_confidence >= 0.72 or confidence < 0.62:
                        return keyword_label, max(keyword_confidence, confidence * 0.9)

                if confidence >= 0.35:
                    return label, confidence
            except Exception as e:
                print(f"[NLP] Zero-shot prediction error: {e}")

        # Keyword-based fallback
        if keyword_label:
            return keyword_label, keyword_confidence

        return "Others", 0.3

    def _keyword_scores(self, text_lower: str) -> Dict[str, float]:
        scores: Dict[str, float] = {}
        for category, keywords in CATEGORY_KEYWORDS.items():
            score = 0.0
            for kw in keywords:
                normalized_kw = kw.strip().lower()
                if not normalized_kw:
                    continue

                if " " in normalized_kw:
                    if normalized_kw in text_lower:
                        score += 1.4
                    continue

                if re.search(rf"\b{re.escape(normalized_kw)}\b", text_lower):
                    score += 1.0

            if score > 0:
                scores[category] = score

        return scores

    def _best_keyword_guess(self, scores: Dict[str, float]) -> Tuple[Optional[str], float]:
        if not scores:
            return None, 0.0

        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        best_label, best_score = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else 0.0
        margin = max(0.0, best_score - second_score)

        confidence = 0.35 + min(best_score, 6.0) * 0.08 + min(margin, 4.0) * 0.06
        return best_label, round(min(confidence, 0.95), 4)

    def extract_entities(self, text: str) -> Dict:
        """
        Extract entities like location, issue type, duration from text.
        """
        text_lower = text.lower()
        entities: Dict = {}

        # Extract ward references
        ward_match = re.search(r'ward\s*(\d+)', text_lower)
        if ward_match:
            entities["ward"] = f"Ward {ward_match.group(1)}"

        # Extract sector references
        sector_match = re.search(r'sector\s*(\d+)', text_lower)
        if sector_match:
            entities["location"] = f"Sector {sector_match.group(1)}"

        # Extract duration mentions
        duration_match = re.search(r'(\d+)\s*(day|days|week|weeks|month|months|hour|hours)', text_lower)
        if duration_match:
            entities["duration"] = f"{duration_match.group(1)} {duration_match.group(2)}"

        # Extract landmarks
        landmark_patterns = [
            r'(?:near|opposite|opp\.?|behind|next to|beside|front of)\s+([A-Za-z\s]+)',
        ]
        for pattern in landmark_patterns:
            match = re.search(pattern, text_lower)
            if match:
                entities["landmark"] = match.group(1).strip()[:50]
                break

        # Detect language (basic heuristic)
        hindi_chars = len(re.findall(r'[\u0900-\u097F]', text))
        if hindi_chars > 5:
            entities["detected_language"] = "Hindi"
        elif any(w in text_lower for w in ["ba", "baa", "gail", "raha", "hai"]):
            entities["detected_language"] = "Bhojpuri"
        else:
            entities["detected_language"] = "English"

        return entities

    def extract_keywords(self, text: str) -> List[str]:
        """Extract important keywords from text."""
        text_lower = text.lower()
        keywords = []
        for category, kws in CATEGORY_KEYWORDS.items():
            for kw in kws:
                if kw in text_lower and kw not in keywords:
                    keywords.append(kw)
        return keywords[:10]

    def assess_urgency(self, text: str) -> Tuple[str, float]:
        """
        Determine urgency level from text content.
        Returns (level, score 0-100).
        """
        text_lower = text.lower()

        for kw in URGENCY_KEYWORDS["critical"]:
            if kw in text_lower:
                return "critical", 95.0

        for kw in URGENCY_KEYWORDS["high"]:
            if kw in text_lower:
                return "high", 75.0

        for kw in URGENCY_KEYWORDS["medium"]:
            if kw in text_lower:
                return "medium", 50.0

        return "low", 25.0


# Singleton
nlp_service = NLPService()
