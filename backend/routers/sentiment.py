"""
Sentiment Router — Sentiment analysis endpoint.
"""

from fastapi import APIRouter
from models.schemas import SentimentRequest, SentimentResponse
from services.sentiment_service import sentiment_service

router = APIRouter(prefix="/sentiment", tags=["Sentiment"])


@router.post("/analyze", response_model=SentimentResponse)
def analyze_sentiment(request: SentimentRequest):
    """
    Analyze sentiment of text using BERT model or keyword fallback.
    Returns: sentiment (positive/negative/neutral), confidence, scores.
    """
    result = sentiment_service.analyze(request.text)
    return SentimentResponse(**result)
