"""
NLP Router — Text classification, entity extraction, and fact-check endpoints.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from models.schemas import NLPClassifyRequest, NLPClassifyResponse
from services.nlp_service import nlp_service
from services.news_verification_service import news_verification_service
from services.civic_intelligence_service import civic_intelligence_service

router = APIRouter(prefix="/nlp", tags=["NLP"])


class FactCheckRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=4000)
    region: str = Field(default="India", max_length=120)
    lookback_days: int = Field(default=7, ge=1, le=30)


@router.post("/classify", response_model=NLPClassifyResponse)
def classify_text(request: NLPClassifyRequest):
    """
    Classify complaint text into a category and extract entities.
    Uses trained ML model (if available) or keyword-based fallback.
    """
    category, confidence = nlp_service.classify(request.text)
    entities = nlp_service.extract_entities(request.text)
    keywords = nlp_service.extract_keywords(request.text)

    return NLPClassifyResponse(
        category=category,
        confidence=confidence,
        entities=entities,
        keywords=keywords,
    )


@router.post("/extract")
def extract_entities(request: NLPClassifyRequest):
    """Extract entities (location, duration, landmarks) from text."""
    entities = nlp_service.extract_entities(request.text)
    urgency_level, urgency_score = nlp_service.assess_urgency(request.text)

    return {
        "entities": entities,
        "urgency_level": urgency_level,
        "urgency_score": urgency_score,
    }


@router.post("/fact-check")
async def fact_check_claim(request: FactCheckRequest):
    """
    Hybrid rumor verification without Gemini dependency.
    Uses live news evidence + optional local NLI and falls back to civic rumor KB.
    """

    news_result = await news_verification_service.verify_claim(
        claim_text=request.text,
        region_hint=request.region,
        lookback_days=request.lookback_days,
    )

    if news_result.get("success"):
        return {
            "input": request.text,
            **news_result,
        }

    # Fallback: deterministic KB signals from civic intelligence.
    kb = civic_intelligence_service.fact_check_text(request.text)
    return {
        "input": request.text,
        "provider": "civic_kb_fallback",
        "claim": request.text,
        "verdict": kb.get("verdict", "No Known Rumor Match"),
        "confidence": float(kb.get("confidence", 0.0) or 0.0),
        "fact_summary": kb.get("fact", "Could not validate this claim at the moment."),
        "is_listed_last_week": False,
        "last_week_signal_summary": "Live news verification unavailable, served deterministic civic fallback.",
        "possible_fact_check_actions": [
            "Retry in 30-60 seconds to fetch fresh live news signals.",
            "Use exact keyword search on major national news sites.",
            "Treat the claim as unverified until at least two credible reports appear.",
        ],
        "sources": [],
        "ai_model": "Civic Rumor Rules",
        "fallback_reason": (
            f"Live verifier failed: {news_result.get('error', 'unknown')}"
        ),
    }
