from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Enum as SqlEnum
from sqlalchemy.sql import func
from database import Base
import enum


class PriorityLevel(str, enum.Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class ComplaintStatus(str, enum.Enum):
    OPEN = "open"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    VERIFICATION = "verification"
    RESOLVED = "resolved"


class InputMode(str, enum.Enum):
    TEXT = "text"
    VOICE = "voice"
    PHOTO = "photo"


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticket_id = Column(String, unique=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    ward = Column(String, nullable=False)
    location = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Citizen Info
    citizen_user_id = Column(Integer, nullable=True, index=True)
    citizen_name = Column(String, nullable=True)
    citizen_phone = Column(String, nullable=True)
    citizen_language = Column(String, nullable=True, default="en")

    # AI Fields
    priority = Column(SqlEnum(PriorityLevel), default=PriorityLevel.P3)
    ai_score = Column(Float, default=0.0)
    urgency_score = Column(Float, default=0.0)
    impact_score = Column(Float, default=0.0)
    recurrence_score = Column(Float, default=0.0)
    sentiment_score = Column(Float, default=0.0)
    ai_category = Column(String, nullable=True)  # AI-classified category
    ai_entities = Column(Text, nullable=True)     # JSON of extracted entities
    ai_breakdown = Column(Text, nullable=True)    # JSON of AI scoring components/weights
    ai_explanation = Column(Text, nullable=True)  # Human-readable AI scoring rationale
    ai_model_version = Column(String, nullable=True)

    # AI Risk Assessment (Gemini-powered, investor-visible)
    ai_risk_score = Column(Float, nullable=True)       # 0-100 risk score from Gemini
    ai_risk_level = Column(String, nullable=True)       # Critical/High/Medium/Low
    ai_risk_factors = Column(Text, nullable=True)       # JSON array of risk factors
    ai_risk_reasoning = Column(Text, nullable=True)     # AI reasoning text

    # Status
    status = Column(SqlEnum(ComplaintStatus), default=ComplaintStatus.OPEN)
    input_mode = Column(SqlEnum(InputMode), default=InputMode.TEXT)
    assigned_to = Column(String, nullable=True)
    assigned_authority = Column(String, nullable=True)
    authority_email = Column(String, nullable=True)
    leader_note = Column(Text, nullable=True)
    authority_response = Column(Text, nullable=True)
    citizen_update = Column(Text, nullable=True)

    # Media
    image_path = Column(String, nullable=True)
    audio_path = Column(String, nullable=True)
    ai_detection_result = Column(Text, nullable=True)  # JSON from YOLO

    # Verification
    before_photo = Column(String, nullable=True)
    after_photo = Column(String, nullable=True)
    verification_status = Column(String, nullable=True)
    before_meta = Column(Text, nullable=True)
    after_meta = Column(Text, nullable=True)
    verification_score = Column(Float, nullable=True)
    verification_confidence = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Citizen Feedback
    rating = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)


class SocialPost(Base):
    __tablename__ = "social_posts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    platform = Column(String, nullable=False)  # Twitter, Facebook, WhatsApp
    content = Column(Text, nullable=False)
    location = Column(String, nullable=True)
    sentiment = Column(String, nullable=True)  # positive, negative, neutral
    sentiment_confidence = Column(Float, nullable=True)
    engagement = Column(Integer, default=0)
    is_misinfo = Column(String, default="false")
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


class ComplaintActivity(Base):
    __tablename__ = "complaint_activities"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    complaint_id = Column(Integer, index=True, nullable=False)
    ticket_id = Column(String, index=True, nullable=False)
    actor_role = Column(String, nullable=False)  # citizen, authority, leader, system
    actor_name = Column(String, nullable=True)
    action = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WardStats(Base):
    __tablename__ = "ward_stats"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ward = Column(String, nullable=False)
    total_complaints = Column(Integer, default=0)
    resolved = Column(Integer, default=0)
    in_progress = Column(Integer, default=0)
    avg_resolution_days = Column(Float, default=0.0)
    satisfaction = Column(Float, default=0.0)
    positive_sentiment = Column(Float, default=0.0)
    neutral_sentiment = Column(Float, default=0.0)
    negative_sentiment = Column(Float, default=0.0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
