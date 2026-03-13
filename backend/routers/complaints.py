"""
Complaints Router — CRUD operations for citizen complaints.
Auto-classifies, scores, and tracks complaints.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
import json
import uuid
import os

from database import get_db
from models.complaint import Complaint, ComplaintStatus, PriorityLevel, InputMode
from models.schemas import ComplaintCreate, ComplaintUpdate, ComplaintResponse
from services.nlp_service import nlp_service
from services.priority_engine import priority_engine
from services.sentiment_service import sentiment_service
from config import UPLOAD_DIR

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.post("/", response_model=ComplaintResponse)
def create_complaint(complaint: ComplaintCreate, db: Session = Depends(get_db)):
    """
    Create a new complaint with AI auto-classification and priority scoring.
    """
    # Generate ticket ID
    ticket_id = f"TKT-{uuid.uuid4().hex[:6].upper()}"

    # AI: Classify complaint
    ai_category, ai_confidence = nlp_service.classify(complaint.description)
    entities = nlp_service.extract_entities(complaint.description)
    keywords = nlp_service.extract_keywords(complaint.description)

    # Use AI category if user didn't specify
    category = complaint.category if complaint.category else ai_category

    # AI: Calculate priority score
    priority_result = priority_engine.calculate_score(
        text=complaint.description,
        category=category,
        ward=complaint.ward,
        recurrence_count=0,
        social_mentions=0,
    )

    # AI: Sentiment analysis
    sentiment_result = sentiment_service.analyze(complaint.description)

    # Map priority string to enum
    priority_level = PriorityLevel(priority_result["priority"])
    input_mode = InputMode(complaint.input_mode) if complaint.input_mode in [e.value for e in InputMode] else InputMode.TEXT

    db_complaint = Complaint(
        ticket_id=ticket_id,
        title=complaint.title,
        description=complaint.description,
        category=category,
        ward=complaint.ward,
        location=complaint.location or entities.get("location", ""),
        latitude=complaint.latitude,
        longitude=complaint.longitude,
        citizen_name=complaint.citizen_name,
        citizen_phone=complaint.citizen_phone,
        priority=priority_level,
        ai_score=priority_result["score"],
        urgency_score=priority_result["urgency"],
        impact_score=priority_result["impact"],
        recurrence_score=priority_result["recurrence"],
        sentiment_score=priority_result["sentiment"],
        ai_category=ai_category,
        ai_entities=json.dumps(entities),
        status=ComplaintStatus.OPEN,
        input_mode=input_mode,
    )

    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)

    return db_complaint


@router.get("/")
def list_complaints(
    ward: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List complaints with optional filters."""
    query = db.query(Complaint)

    if ward:
        query = query.filter(Complaint.ward == ward)
    if category:
        query = query.filter(Complaint.category == category)
    if priority:
        query = query.filter(Complaint.priority == priority)
    if status:
        query = query.filter(Complaint.status == status)

    total = query.count()
    complaints = query.order_by(desc(Complaint.created_at)).offset(offset).limit(limit).all()

    return {
        "total": total,
        "complaints": [
            {
                "id": c.id,
                "ticket_id": c.ticket_id,
                "title": c.title,
                "description": c.description,
                "category": c.category,
                "ward": c.ward,
                "priority": c.priority.value if c.priority else "P3",
                "ai_score": c.ai_score,
                "status": c.status.value if c.status else "open",
                "input_mode": c.input_mode.value if c.input_mode else "text",
                "assigned_to": c.assigned_to,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "rating": c.rating,
            }
            for c in complaints
        ],
    }


@router.get("/{ticket_id}")
def get_complaint(ticket_id: str, db: Session = Depends(get_db)):
    """Get a single complaint by ticket ID."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    return {
        "id": complaint.id,
        "ticket_id": complaint.ticket_id,
        "title": complaint.title,
        "description": complaint.description,
        "category": complaint.category,
        "ward": complaint.ward,
        "location": complaint.location,
        "priority": complaint.priority.value,
        "ai_score": complaint.ai_score,
        "urgency_score": complaint.urgency_score,
        "impact_score": complaint.impact_score,
        "recurrence_score": complaint.recurrence_score,
        "sentiment_score": complaint.sentiment_score,
        "ai_category": complaint.ai_category,
        "ai_entities": json.loads(complaint.ai_entities) if complaint.ai_entities else {},
        "status": complaint.status.value,
        "input_mode": complaint.input_mode.value,
        "assigned_to": complaint.assigned_to,
        "created_at": complaint.created_at.isoformat() if complaint.created_at else None,
        "resolved_at": complaint.resolved_at.isoformat() if complaint.resolved_at else None,
        "rating": complaint.rating,
        "feedback": complaint.feedback,
    }


@router.patch("/{ticket_id}")
def update_complaint(ticket_id: str, update: ComplaintUpdate, db: Session = Depends(get_db)):
    """Update complaint status, assignment, or feedback."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if update.status:
        complaint.status = ComplaintStatus(update.status)
        if update.status == "resolved":
            from datetime import datetime
            complaint.resolved_at = datetime.now()
    if update.assigned_to:
        complaint.assigned_to = update.assigned_to
        if complaint.status == ComplaintStatus.OPEN:
            complaint.status = ComplaintStatus.ASSIGNED
    if update.rating is not None:
        complaint.rating = update.rating
    if update.feedback:
        complaint.feedback = update.feedback

    db.commit()
    db.refresh(complaint)

    return {"status": "updated", "ticket_id": ticket_id}
