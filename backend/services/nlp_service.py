"""
NLP Service — Text Classification & Entity Extraction
Uses TF-IDF + SGDClassifier for complaint categorization.
Falls back to keyword-based classification if no trained model is available.
"""

import os
import re
import json
import joblib
from typing import Dict, List, Tuple


# Category keywords for fallback classification
CATEGORY_KEYWORDS = {
    "Water Supply": ["water", "pipe", "leak", "tap", "supply", "paani", "nala", "drain", "sewage", "borewell", "tanker", "drinking water", "contamination", "pipeline", "burst"],
    "Roads & Potholes": ["road", "pothole", "crack", "asphalt", "tar", "highway", "footpath", "divider", "speed breaker", "cave-in", "sinkhole", "damaged road"],
    "Drainage": ["drain", "drainage", "flood", "waterlogging", "clog", "sewer", "overflow", "nallah", "gutter", "manhole", "stagnant"],
    "Electricity": ["electricity", "power", "streetlight", "light", "wiring", "transformer", "outage", "cutoff", "bijli", "voltage", "pole", "cable", "short circuit"],
    "Garbage & Sanitation": ["garbage", "waste", "trash", "dump", "sanitation", "dirty", "filth", "kachra", "bin", "collection", "smell", "mosquito", "clean", "sweeping"],
    "Safety & Security": ["safety", "crime", "theft", "accident", "fight", "police", "danger", "unsafe", "robbery", "assault", "harassment", "stray dog", "illegal"],
    "Public Health": ["health", "hospital", "clinic", "disease", "illness", "doctor", "medicine", "epidemic", "dengue", "malaria", "fever", "infection"],
    "Education": ["school", "education", "teacher", "student", "classroom", "midday meal", "library", "anganwadi", "hostel"],
    "Public Transport": ["bus", "transport", "auto", "rickshaw", "station", "route", "schedule", "fare", "overcrowding"],
}

# Urgency keywords
URGENCY_KEYWORDS = {
    "critical": ["emergency", "danger", "collapse", "gas leak", "fire", "flood", "accident", "children at risk", "hospital", "electrocution", "death", "life-threatening"],
    "high": ["burst", "blocked", "overflow", "broken", "urgent", "3 days", "week", "repeated", "school zone", "ambulance"],
    "medium": ["not working", "damaged", "complaint", "issue", "problem", "request"],
    "low": ["repaint", "beautification", "suggestion", "minor", "cosmetic", "improvement"],
}


class NLPService:
    def __init__(self, model_path: str = "ml/weights/classifier.pkl"):
        self.model = None
        self.vectorizer = None
        self.model_path = model_path
        self._load_model()

    def _load_model(self):
        """Try to load a trained model; fall back to keyword-based."""
        try:
            if os.path.exists(self.model_path):
                bundle = joblib.load(self.model_path)
                self.model = bundle["model"]
                self.vectorizer = bundle["vectorizer"]
                print(f"[NLP] Loaded trained classifier from {self.model_path}")
            else:
                print("[NLP] No trained model found — using keyword-based classifier")
        except Exception as e:
            print(f"[NLP] Error loading model: {e} — using keyword-based classifier")

    def classify(self, text: str) -> Tuple[str, float]:
        """
        Classify complaint text into a category.
        Returns (category, confidence).
        """
        text_lower = text.lower()

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

        # Keyword-based fallback
        scores = {}
        for category, keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                scores[category] = score

        if scores:
            best_cat = max(scores, key=scores.get)  # type: ignore
            confidence = min(scores[best_cat] / 5.0, 0.95)
            return best_cat, confidence

        return "Others", 0.3

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
