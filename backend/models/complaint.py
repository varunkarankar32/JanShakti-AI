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
    citizen_name = Column(String, nullable=True)
    citizen_phone = Column(String, nullable=True)

    # AI Fields
    priority = Column(SqlEnum(PriorityLevel), default=PriorityLevel.P3)
    ai_score = Column(Float, default=0.0)
    urgency_score = Column(Float, default=0.0)
    impact_score = Column(Float, default=0.0)
    recurrence_score = Column(Float, default=0.0)
    sentiment_score = Column(Float, default=0.0)
    ai_category = Column(String, nullable=True)  # AI-classified category
    ai_entities = Column(Text, nullable=True)     # JSON of extracted entities

    # Status
    status = Column(SqlEnum(ComplaintStatus), default=ComplaintStatus.OPEN)
    input_mode = Column(SqlEnum(InputMode), default=InputMode.TEXT)
    assigned_to = Column(String, nullable=True)

    # Media
    image_path = Column(String, nullable=True)
    audio_path = Column(String, nullable=True)
    ai_detection_result = Column(Text, nullable=True)  # JSON from YOLO

    # Verification
    before_photo = Column(String, nullable=True)
    after_photo = Column(String, nullable=True)
    verification_status = Column(String, nullable=True)

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
