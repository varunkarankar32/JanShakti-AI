"""
Priority Router — AI priority scoring endpoint.
"""

from fastapi import APIRouter
from models.schemas import PriorityScoreRequest, PriorityScoreResponse
from services.priority_engine import priority_engine
from services.qwen_priority_service import qwen_priority_service

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


@router.get("/qwen-status")
def qwen_status(probe: bool = False):
    """Return Qwen provider/runtime status for diagnostics without exposing secrets."""
    status = qwen_priority_service.get_runtime_status()

    if probe:
        probe_result = qwen_priority_service.score_issue(
            text="Streetlight outage causing safety issue at night",
            category="Electricity",
            ward="Ward 1",
        )
        latest = qwen_priority_service.get_runtime_status()
        status["last"] = latest.get("last", {})
        status["local"] = latest.get("local", status.get("local", {}))
        status["probe"] = {
            "used": bool(probe_result.get("used")),
            "model": str(probe_result.get("model") or ""),
            "reason": str(probe_result.get("reason") or ""),
        }

    return status
