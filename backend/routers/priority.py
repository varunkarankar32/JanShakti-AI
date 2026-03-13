"""
Priority Router — AI priority scoring endpoint.
"""

from fastapi import APIRouter
from models.schemas import PriorityScoreRequest, PriorityScoreResponse
from services.priority_engine import priority_engine

router = APIRouter(prefix="/priority", tags=["Priority"])


@router.post("/score", response_model=PriorityScoreResponse)
def calculate_priority(request: PriorityScoreRequest):
    """
    Calculate AI priority score using the weighted formula:
    Score = Urgency(40%) + Impact(30%) + Recurrence(20%) + Sentiment(10%)
    """
    result = priority_engine.calculate_score(
        text=request.text,
        category=request.category,
        ward=request.ward,
        recurrence_count=request.recurrence_count,
        social_mentions=request.social_mentions,
    )

    return PriorityScoreResponse(**result)
