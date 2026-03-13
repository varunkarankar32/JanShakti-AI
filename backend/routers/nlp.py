"""
NLP Router — Text classification and entity extraction endpoints.
"""

from fastapi import APIRouter
from models.schemas import NLPClassifyRequest, NLPClassifyResponse
from services.nlp_service import nlp_service

router = APIRouter(prefix="/nlp", tags=["NLP"])


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
