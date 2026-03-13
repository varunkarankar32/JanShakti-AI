"""
Sentiment Analysis Service
Uses Hugging Face transformers for BERT-based sentiment classification.
Falls back to keyword-based sentiment if model cannot be loaded.
"""

import re
from typing import Dict, Tuple

# Try to load transformers
try:
    from transformers import pipeline as hf_pipeline
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    print("[Sentiment] transformers not installed — using keyword-based fallback")


# Keyword-based sentiment
POSITIVE_WORDS = [
    "thank", "thanks", "good", "great", "excellent", "fixed", "repaired", "resolved",
    "happy", "satisfied", "wonderful", "amazing", "appreciate", "grateful", "improved",
    "clean", "working", "done", "success", "fast", "quick", "helpful",
]

NEGATIVE_WORDS = [
    "broken", "damaged", "worst", "terrible", "angry", "frustrated", "disgusting",
    "horrible", "pathetic", "corruption", "fraud", "useless", "waste", "dangerous",
    "sick", "suffering", "ignored", "neglected", "lying", "fake", "scam", "death",
    "filthy", "stinking", "complain", "nothing happened", "no response",
]


class SentimentService:
    def __init__(self, model_name: str = "distilbert-base-uncased-finetuned-sst-2-english"):
        self.model_name = model_name
        self.classifier = None
        self._load_model()

    def _load_model(self):
        if HF_AVAILABLE:
            try:
                self.classifier = hf_pipeline(
                    "sentiment-analysis",
                    model=self.model_name,
                    device=-1,  # CPU
                )
                print(f"[Sentiment] Loaded model: {self.model_name}")
            except Exception as e:
                print(f"[Sentiment] Cannot load model: {e} — using keyword fallback")

    def analyze(self, text: str) -> Dict:
        """
        Analyze sentiment of text.
        Returns: {sentiment, confidence, scores}
        """
        # Try ML model
        if self.classifier:
            try:
                result = self.classifier(text[:512])[0]
                label = result["label"].lower()
                confidence = float(result["score"])

                if label == "positive":
                    sentiment = "positive"
                elif label == "negative":
                    sentiment = "negative"
                else:
                    sentiment = "neutral"

                return {
                    "sentiment": sentiment,
                    "confidence": confidence,
                    "scores": {
                        "positive": confidence if sentiment == "positive" else 1 - confidence,
                        "negative": confidence if sentiment == "negative" else 1 - confidence,
                        "neutral": 0.1,
                    },
                }
            except Exception as e:
                print(f"[Sentiment] ML error: {e}")

        # Keyword fallback
        return self._keyword_sentiment(text)

    def _keyword_sentiment(self, text: str) -> Dict:
        text_lower = text.lower()

        pos_count = sum(1 for w in POSITIVE_WORDS if w in text_lower)
        neg_count = sum(1 for w in NEGATIVE_WORDS if w in text_lower)
        total = pos_count + neg_count

        if total == 0:
            return {
                "sentiment": "neutral",
                "confidence": 0.5,
                "scores": {"positive": 0.3, "negative": 0.3, "neutral": 0.4},
            }

        pos_ratio = pos_count / total
        neg_ratio = neg_count / total

        if pos_ratio > 0.6:
            sentiment = "positive"
            confidence = min(0.5 + pos_ratio * 0.4, 0.9)
        elif neg_ratio > 0.6:
            sentiment = "negative"
            confidence = min(0.5 + neg_ratio * 0.4, 0.9)
        else:
            sentiment = "neutral"
            confidence = 0.5

        return {
            "sentiment": sentiment,
            "confidence": confidence,
            "scores": {
                "positive": round(pos_ratio, 3),
                "negative": round(neg_ratio, 3),
                "neutral": round(max(0, 1 - pos_ratio - neg_ratio), 3),
            },
        }


# Singleton
sentiment_service = SentimentService()
