"""
Complaints Router — CRUD and workflow operations for citizen complaints.
"""

from datetime import datetime
from typing import Optional
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from models.complaint import Complaint, ComplaintActivity, ComplaintStatus, PriorityLevel, InputMode
from models.schemas import ComplaintCreate, ComplaintUpdate, ComplaintResponse
from models.user import User
from routers.auth import get_current_user, get_current_leader
from services.nlp_service import nlp_service
from services.priority_engine import priority_engine
from services.sentiment_service import sentiment_service

router = APIRouter(prefix="/complaints", tags=["Complaints"])


class LeaderAssignRequest(BaseModel):
    authority_name: str
    assigned_team: Optional[str] = None
    leader_note: Optional[str] = None


class AuthorityResponseRequest(BaseModel):
    authority_name: str
    response: str
    mark_verification_ready: bool = False


class LeaderStatusRequest(BaseModel):
    status: str
    leader_note: Optional[str] = None


class LeaderResolveRequest(BaseModel):
    resolution_note: str
    citizen_update: Optional[str] = None


def _log_activity(
    db: Session,
    complaint: Complaint,
    actor_role: str,
    actor_name: Optional[str],
    action: str,
    note: Optional[str] = None,
):
    activity = ComplaintActivity(
        complaint_id=complaint.id,
        ticket_id=complaint.ticket_id,
        actor_role=actor_role,
        actor_name=actor_name,
        action=action,
        note=note,
    )
    db.add(activity)


def _activity_payload(db: Session, complaint_id: int):
    rows = (
        db.query(ComplaintActivity)
        .filter(ComplaintActivity.complaint_id == complaint_id)
        .order_by(ComplaintActivity.created_at.asc())
        .all()
    )
    return [
        {
            "actor_role": r.actor_role,
            "actor_name": r.actor_name,
            "action": r.action,
            "note": r.note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


def _parse_status(status_text: str) -> ComplaintStatus:
    try:
        return ComplaintStatus(status_text)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status value")


@router.post("", response_model=ComplaintResponse)
def create_complaint(
    complaint: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new complaint with AI auto-classification and priority scoring."""
    ticket_id = f"TKT-{uuid.uuid4().hex[:6].upper()}"

    ai_category, _ = nlp_service.classify(complaint.description)
    entities = nlp_service.extract_entities(complaint.description)

    category = complaint.category if complaint.category else ai_category
    priority_result = priority_engine.calculate_score(
        text=complaint.description,
        category=category,
        ward=complaint.ward,
        recurrence_count=0,
        social_mentions=0,
    )
    _ = sentiment_service.analyze(complaint.description)

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
        citizen_user_id=current_user.id,
        citizen_name=current_user.name,
        citizen_phone=current_user.phone or complaint.citizen_phone,
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
        citizen_update="Complaint received and queued for leader review.",
    )

    db.add(db_complaint)
    db.flush()
    _log_activity(
        db,
        db_complaint,
        actor_role="citizen",
        actor_name=current_user.name,
        action="complaint_created",
        note="Complaint submitted by citizen.",
    )
    db.commit()
    db.refresh(db_complaint)
    return db_complaint


@router.get("")
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
                "assigned_authority": c.assigned_authority,
                "citizen_update": c.citizen_update,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "rating": c.rating,
            }
            for c in complaints
        ],
    }


@router.get("/my")
def list_my_complaints(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get complaints filed by currently authenticated citizen."""
    complaints = (
        db.query(Complaint)
        .filter(Complaint.citizen_user_id == current_user.id)
        .order_by(desc(Complaint.created_at))
        .limit(limit)
        .all()
    )

    return {
        "total": len(complaints),
        "complaints": [
            {
                "ticket_id": c.ticket_id,
                "title": c.title,
                "category": c.category,
                "ward": c.ward,
                "priority": c.priority.value if c.priority else "P3",
                "status": c.status.value if c.status else "open",
                "assigned_authority": c.assigned_authority,
                "authority_response": c.authority_response,
                "citizen_update": c.citizen_update,
                "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
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
        "assigned_authority": complaint.assigned_authority,
        "leader_note": complaint.leader_note,
        "authority_response": complaint.authority_response,
        "citizen_update": complaint.citizen_update,
        "created_at": complaint.created_at.isoformat() if complaint.created_at else None,
        "resolved_at": complaint.resolved_at.isoformat() if complaint.resolved_at else None,
        "rating": complaint.rating,
        "feedback": complaint.feedback,
        "activity": _activity_payload(db, complaint.id),
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


@router.post("/{ticket_id}/leader/assign")
def leader_assign_authority(
    ticket_id: str,
    req: LeaderAssignRequest,
    db: Session = Depends(get_db),
    current_leader: User = Depends(get_current_leader),
):
    """Leader assigns complaint to authority/team and moves it to assigned."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.assigned_authority = req.authority_name.strip()
    if req.assigned_team:
        complaint.assigned_to = req.assigned_team.strip()
    complaint.leader_note = req.leader_note or complaint.leader_note
    complaint.status = ComplaintStatus.ASSIGNED
    complaint.citizen_update = f"Assigned to {complaint.assigned_authority}. Field team will start work soon."

    _log_activity(
        db,
        complaint,
        actor_role="leader",
        actor_name=current_leader.name,
        action="assigned_to_authority",
        note=req.leader_note or f"Assigned to {complaint.assigned_authority}",
    )
    db.commit()
    db.refresh(complaint)

    return {
        "ticket_id": complaint.ticket_id,
        "status": complaint.status.value,
        "assigned_authority": complaint.assigned_authority,
        "assigned_to": complaint.assigned_to,
        "citizen_update": complaint.citizen_update,
    }


@router.post("/{ticket_id}/authority/respond")
def authority_respond(
    ticket_id: str,
    req: AuthorityResponseRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_leader),
):
    """Record authority response and move complaint to in-progress or verification."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.authority_response = req.response
    complaint.assigned_authority = req.authority_name.strip()
    complaint.status = ComplaintStatus.VERIFICATION if req.mark_verification_ready else ComplaintStatus.IN_PROGRESS
    complaint.citizen_update = (
        "Authority completed work and sent response. Leader verification pending."
        if req.mark_verification_ready
        else "Authority has acknowledged and started work on your complaint."
    )

    _log_activity(
        db,
        complaint,
        actor_role="authority",
        actor_name=req.authority_name,
        action="authority_response",
        note=req.response,
    )
    db.commit()
    db.refresh(complaint)

    return {
        "ticket_id": complaint.ticket_id,
        "status": complaint.status.value,
        "authority_response": complaint.authority_response,
        "citizen_update": complaint.citizen_update,
    }


@router.post("/{ticket_id}/leader/status")
def leader_update_status(
    ticket_id: str,
    req: LeaderStatusRequest,
    db: Session = Depends(get_db),
    current_leader: User = Depends(get_current_leader),
):
    """Leader updates complaint stage (assigned / in_progress / verification)."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    new_status = _parse_status(req.status)
    if new_status == ComplaintStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Use leader/resolve endpoint to close complaint")

    complaint.status = new_status
    if req.leader_note:
        complaint.leader_note = req.leader_note

    status_message = {
        ComplaintStatus.ASSIGNED: "Leader assigned your complaint to the relevant authority.",
        ComplaintStatus.IN_PROGRESS: "Work is in progress on your complaint.",
        ComplaintStatus.VERIFICATION: "Work reported complete. Leader verification in progress.",
        ComplaintStatus.OPEN: "Complaint is open and under review.",
    }
    complaint.citizen_update = status_message.get(new_status, "Complaint status updated.")

    _log_activity(
        db,
        complaint,
        actor_role="leader",
        actor_name=current_leader.name,
        action="leader_status_update",
        note=req.leader_note or f"Status changed to {new_status.value}",
    )
    db.commit()
    db.refresh(complaint)

    return {
        "ticket_id": complaint.ticket_id,
        "status": complaint.status.value,
        "citizen_update": complaint.citizen_update,
    }


@router.post("/{ticket_id}/leader/resolve")
def leader_resolve_complaint(
    ticket_id: str,
    req: LeaderResolveRequest,
    db: Session = Depends(get_db),
    current_leader: User = Depends(get_current_leader),
):
    """Leader verifies resolution and marks complaint as resolved."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.status = ComplaintStatus.RESOLVED
    complaint.resolved_at = datetime.now()
    complaint.verification_status = "verified"
    complaint.leader_note = req.resolution_note
    complaint.citizen_update = req.citizen_update or (
        f"Leader verified resolution. Ticket {complaint.ticket_id} is now marked as solved."
    )

    _log_activity(
        db,
        complaint,
        actor_role="leader",
        actor_name=current_leader.name,
        action="leader_marked_resolved",
        note=req.resolution_note,
    )
    db.commit()
    db.refresh(complaint)

    return {
        "ticket_id": complaint.ticket_id,
        "status": complaint.status.value,
        "resolved_at": complaint.resolved_at.isoformat() if complaint.resolved_at else None,
        "citizen_update": complaint.citizen_update,
    }