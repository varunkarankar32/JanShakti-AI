from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# === Complaint Schemas ===

class ComplaintCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = None
    ward: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    citizen_name: Optional[str] = None
    citizen_phone: Optional[str] = None
    citizen_language: Optional[str] = "en"
    image_path: Optional[str] = None
    audio_path: Optional[str] = None
    input_mode: str = "text"


class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    rating: Optional[int] = None
    feedback: Optional[str] = None


class ComplaintResponse(BaseModel):
    id: int
    ticket_id: str
    title: str
    description: str
    category: str
    ward: str
    location: Optional[str]
    priority: str
    ai_score: float
    urgency_score: float
    impact_score: float
    recurrence_score: float
    sentiment_score: float
    ai_category: Optional[str]
    ai_breakdown: Optional[dict] = None
    ai_explanation: Optional[str] = None
    ai_model_version: Optional[str] = None
    score_source: Optional[str] = None
    status: str
    input_mode: str
    assigned_to: Optional[str]
    created_at: Optional[datetime]
    rating: Optional[int]

    class Config:
        from_attributes = True


# === NLP Schemas ===

class NLPClassifyRequest(BaseModel):
    text: str
    language: str = "en"


class NLPClassifyResponse(BaseModel):
    category: str
    confidence: float
    entities: dict
    keywords: List[str]


# === Priority Schemas ===

class PriorityScoreRequest(BaseModel):
    text: str
    category: str
    ward: str
    recurrence_count: int = 0
    social_mentions: int = 0


class PriorityScoreResponse(BaseModel):
    score: float
    priority: str
    urgency: float
    impact: float
    recurrence: float
    sentiment: float
    score_source: Optional[str] = None
    sentiment_label: Optional[str] = None
    sentiment_confidence: Optional[float] = None
    starvation_bonus: Optional[float] = None
    response_time: str
    model_version: Optional[str] = None
    weights: Optional[dict] = None
    breakdown: Optional[dict] = None
    explanation: str


# === Sentiment Schemas ===

class SentimentRequest(BaseModel):
    text: str


class SentimentResponse(BaseModel):
    sentiment: str
    confidence: float
    scores: dict


# === Vision Schemas ===

class VisionDetectionResponse(BaseModel):
    detections: List[dict]
    category: str
    severity: str
    confidence: float


# === Speech Schemas ===

class SpeechTranscriptionResponse(BaseModel):
    text: str
    language: str
    duration: float
    confidence: float


# === Report Schemas ===

class ReportRequest(BaseModel):
    ward: str
    date_from: Optional[str] = None
    date_to: Optional[str] = None


class ReportResponse(BaseModel):
    report_text: str
    ward: str
    period: str
    stats: dict


# === Dashboard Schemas ===

class DashboardStatsResponse(BaseModel):
    total_complaints: int
    resolution_rate: float
    avg_response_days: float
    satisfaction: float
    trust_index: float
    complaints_today: int
    resolved_today: int
    p0_active: int
    pending_verification: int
    category_distribution: List[dict]
    trend_data: List[dict]
    ward_heat_data: List[dict]
    alerts: List[dict]
    action_queue: List[dict]
