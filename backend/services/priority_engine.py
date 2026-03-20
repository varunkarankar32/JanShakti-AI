"""
Priority Engine — AI-Powered Complaint Priority Scoring
Formula: Score = (Urgency × 0.4) + (Impact × 0.3) + (Recurrence × 0.2) + (Sentiment × 0.1)
Score 0-100 → P0 (Critical), P1 (High), P2 (Medium), P3 (Routine)
"""

from typing import Dict, Tuple
from services.nlp_service import nlp_service


PRIORITY_MAP = {
    "P0": {"label": "CRITICAL", "response": "< 1 hour", "color": "#DC2626", "min_score": 85},
    "P1": {"label": "HIGH", "response": "< 6 hours", "color": "#EA580C", "min_score": 65},
    "P2": {"label": "MEDIUM", "response": "< 48 hours", "color": "#CA8A04", "min_score": 40},
    "P3": {"label": "ROUTINE", "response": "< 2 weeks", "color": "#16A34A", "min_score": 0},
}

# Category base impact scores
CATEGORY_IMPACT = {
    "Water Supply": 75,
    "Roads & Potholes": 65,
    "Drainage": 70,
    "Electricity": 60,
    "Garbage & Sanitation": 55,
    "Safety & Security": 85,
    "Public Health": 90,
    "Education": 50,
    "Public Transport": 45,
    "Others": 35,
}


class PriorityEngine:
    def calculate_starvation_bonus(self, unresponded_hours: float = 0.0) -> float:
        """Escalate stale, unresponded complaints to prevent starvation in queues."""
        hours = max(0.0, float(unresponded_hours or 0.0))
        if hours >= 168:
            return 35.0
        if hours >= 96:
            return 26.0
        if hours >= 48:
            return 18.0
        if hours >= 24:
            return 12.0
        if hours >= 6:
            return 6.0
        return 0.0

    def score_to_priority(self, score: float) -> str:
        return self._score_to_priority(score)

    def calculate_score(
        self,
        text: str,
        category: str,
        ward: str,
        recurrence_count: int = 0,
        social_mentions: int = 0,
        unresponded_hours: float = 0.0,
    ) -> Dict:
        """
        Calculate AI priority score using the weighted formula.
        Returns detailed scoring breakdown.
        """

        # 1. Urgency Score (40% weight)
        urgency_level, urgency_score = nlp_service.assess_urgency(text)

        # 2. Impact Score (30% weight)
        base_impact = CATEGORY_IMPACT.get(category, 35)
        # Boost impact if near schools, hospitals, main roads
        impact_boost = 0
        text_lower = text.lower()
        if any(w in text_lower for w in ["school", "hospital", "college", "market", "temple"]):
            impact_boost += 15
        if any(w in text_lower for w in ["main road", "highway", "national", "state"]):
            impact_boost += 10
        if any(w in text_lower for w in ["children", "elderly", "patients", "pregnant"]):
            impact_boost += 20
        impact_score = min(base_impact + impact_boost, 100)

        # 3. Recurrence Score (20% weight)
        if recurrence_count >= 5:
            recurrence_score = 95.0
        elif recurrence_count >= 3:
            recurrence_score = 75.0
        elif recurrence_count >= 2:
            recurrence_score = 55.0
        elif recurrence_count >= 1:
            recurrence_score = 35.0
        else:
            recurrence_score = 10.0

        # 4. Sentiment Score (10% weight)
        if social_mentions >= 50:
            sentiment_score = 90.0
        elif social_mentions >= 20:
            sentiment_score = 70.0
        elif social_mentions >= 5:
            sentiment_score = 50.0
        else:
            sentiment_score = 20.0

        # FINAL SCORE
        base_score = (
            urgency_score * 0.4
            + impact_score * 0.3
            + recurrence_score * 0.2
            + sentiment_score * 0.1
        )
        starvation_bonus = self.calculate_starvation_bonus(unresponded_hours)
        final_score = round(min(100.0, base_score + starvation_bonus), 1)

        # Map to priority level
        priority = self._score_to_priority(final_score)
        priority_info = PRIORITY_MAP[priority]

        # Build explanation
        explanation = self._build_explanation(
            urgency_level, urgency_score, impact_score, recurrence_count,
            recurrence_score, social_mentions, sentiment_score, final_score, priority,
            starvation_bonus, unresponded_hours,
        )

        return {
            "score": final_score,
            "priority": priority,
            "urgency": urgency_score,
            "impact": impact_score,
            "recurrence": recurrence_score,
            "sentiment": sentiment_score,
            "starvation_bonus": starvation_bonus,
            "response_time": priority_info["response"],
            "explanation": explanation,
        }

    def _score_to_priority(self, score: float) -> str:
        if score >= 85:
            return "P0"
        elif score >= 65:
            return "P1"
        elif score >= 40:
            return "P2"
        return "P3"

    def _build_explanation(
        self, urgency_level, urgency_score, impact_score, recurrence_count,
        recurrence_score, social_mentions, sentiment_score, final_score, priority,
        starvation_bonus, unresponded_hours,
    ) -> str:
        parts = []
        parts.append(f"Urgency: {urgency_level.upper()} ({urgency_score}/100, weight 40%)")
        parts.append(f"Impact: {impact_score}/100 (weight 30%)")
        parts.append(f"Recurrence: {recurrence_count} prior reports -> {recurrence_score}/100 (weight 20%)")
        parts.append(f"Social Sentiment: {social_mentions} mentions -> {sentiment_score}/100 (weight 10%)")
        if starvation_bonus > 0:
            parts.append(
                f"Starvation Guard: +{starvation_bonus} boost for {round(unresponded_hours, 1)}h unresponded"
            )
        parts.append(f"FINAL: {final_score} -> {priority} ({PRIORITY_MAP[priority]['label']})")
        parts.append(f"Target Response: {PRIORITY_MAP[priority]['response']}")
        return " | ".join(parts)


# Singleton
priority_engine = PriorityEngine()
