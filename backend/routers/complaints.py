"""
Complaints Router — CRUD and workflow operations for citizen complaints.
"""

from datetime import datetime
from typing import Optional
import json
import smtplib
import uuid
from email.message import EmailMessage
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from models.complaint import Complaint, ComplaintActivity, ComplaintStatus, PriorityLevel, InputMode
from models.schemas import ComplaintCreate, ComplaintUpdate, ComplaintResponse
from models.user import User
from routers.auth import get_current_user, get_current_leader
from services.priority_engine import priority_engine
from services.sentiment_service import sentiment_service
from services.complaint_extraction_service import complaint_extraction_service
from config import SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_USE_TLS

router = APIRouter(prefix="/complaints", tags=["Complaints"])


class LeaderAssignRequest(BaseModel):
    authority_name: str
    authority_email: Optional[str] = None
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


class LeaderAuthorityMailRequest(BaseModel):
    authority_name: str
    authority_email: str
    subject: Optional[str] = None
    message: Optional[str] = None


class ComplaintTextExtractRequest(BaseModel):
    text: str
    ward: Optional[str] = None
    category: Optional[str] = None


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


def _dispatch_mail(to_email: str, subject: str, body: str):
    # Use SMTP when configured; otherwise return a mailto fallback for local/dev use.
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        return {
            "delivered": False,
            "mode": "mailto_fallback",
            "mailto_url": f"mailto:{to_email}?subject={quote(subject)}&body={quote(body)}",
        }

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
        if SMTP_USE_TLS:
            smtp.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(msg)

    return {"delivered": True, "mode": "smtp"}


@router.post("", response_model=ComplaintResponse)
def create_complaint(
    complaint: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new complaint with AI auto-classification and priority scoring."""
    ticket_id = f"TKT-{uuid.uuid4().hex[:6].upper()}"

    try:
        extracted = complaint_extraction_service.extract_from_text(
            text=complaint.description,
            ward_hint=complaint.ward,
            category_hint=complaint.category,
            source=complaint.input_mode if complaint.input_mode else "text",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    refined_description = extracted["description"]
    category = complaint.category if complaint.category else extracted["category"]
    ai_meta = extracted.get("ai", {})

    priority_result = priority_engine.calculate_score(
        text=refined_description,
        category=category,
        ward=complaint.ward,
        recurrence_count=0,
        social_mentions=0,
    )
    _ = sentiment_service.analyze(refined_description)

    priority_level = PriorityLevel(priority_result["priority"])
    input_mode = InputMode(complaint.input_mode) if complaint.input_mode in [e.value for e in InputMode] else InputMode.TEXT

    db_complaint = Complaint(
        ticket_id=ticket_id,
        title=complaint.title,
        description=refined_description,
        category=category,
        ward=complaint.ward,
        location=complaint.location or extracted.get("location", ""),
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
        ai_category=ai_meta.get("category"),
        ai_entities=json.dumps(ai_meta),
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


@router.post("/extract/text")
def extract_complaint_text(request: ComplaintTextExtractRequest):
    """Extract structured complaint details from free-form text."""
    try:
        return complaint_extraction_service.extract_from_text(
            text=request.text,
            ward_hint=request.ward,
            category_hint=request.category,
            source="text",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/extract/image")
async def extract_complaint_image(
    image: UploadFile = File(...),
    caption: str = Form(""),
    ward: Optional[str] = Form(None),
):
    """Extract structured complaint details from an issue photo."""
    image_bytes = await image.read()
    return complaint_extraction_service.extract_from_image(
        image_bytes=image_bytes,
        caption=caption or None,
        ward_hint=ward,
    )


@router.post("/extract/voice")
async def extract_complaint_voice(
    audio: UploadFile = File(...),
    ward: Optional[str] = Form(None),
):
    """Transcribe voice input and convert it into a complaint statement."""
    audio_bytes = await audio.read()
    ext = audio.filename.split(".")[-1] if audio.filename and "." in audio.filename else "ogg"
    try:
        return complaint_extraction_service.extract_from_voice(
            audio_bytes=audio_bytes,
            file_extension=ext,
            ward_hint=ward,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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
                "authority_email": c.authority_email,
                "authority_response": c.authority_response,
                "leader_note": c.leader_note,
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
                "authority_email": c.authority_email,
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
        "authority_email": complaint.authority_email,
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
    complaint.authority_email = req.authority_email.strip() if req.authority_email else complaint.authority_email
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
        "authority_email": complaint.authority_email,
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


@router.post("/{ticket_id}/leader/mail-authority")
def leader_mail_authority(
    ticket_id: str,
    req: LeaderAuthorityMailRequest,
    db: Session = Depends(get_db),
    current_leader: User = Depends(get_current_leader),
):
    """Leader sends complaint context to authority via SMTP/mailto fallback."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    authority_name = req.authority_name.strip()
    authority_email = req.authority_email.strip().lower()
    if not authority_name or not authority_email:
        raise HTTPException(status_code=400, detail="Authority name and email are required")

    complaint.assigned_authority = authority_name
    complaint.authority_email = authority_email

    subject = req.subject or f"Action Required: {complaint.ticket_id} ({complaint.priority.value})"
    body = req.message or (
        f"Authority: {authority_name}\n"
        f"Ticket: {complaint.ticket_id}\n"
        f"Category: {complaint.category}\n"
        f"Ward: {complaint.ward}\n"
        f"Priority: {complaint.priority.value}\n"
        f"Status: {complaint.status.value}\n\n"
        f"Issue: {complaint.title}\n"
        f"Description: {complaint.description}\n\n"
        f"Leader: {current_leader.name}\n"
        f"Please acknowledge and share field response."
    )

    try:
        mail_result = _dispatch_mail(authority_email, subject, body)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to dispatch email: {exc}")

    _log_activity(
        db,
        complaint,
        actor_role="leader",
        actor_name=current_leader.name,
        action="authority_mail_sent",
        note=f"Mail sent to {authority_name} <{authority_email}> via {mail_result['mode']}",
    )
    db.commit()

    return {
        "ticket_id": complaint.ticket_id,
        "authority_name": authority_name,
        "authority_email": authority_email,
        "delivery": mail_result,
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

    if complaint.status == ComplaintStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Complaint is already resolved")

    if not complaint.assigned_authority:
        raise HTTPException(status_code=400, detail="Assign complaint to authority before resolving")

    if complaint.status not in (ComplaintStatus.IN_PROGRESS, ComplaintStatus.VERIFICATION, ComplaintStatus.ASSIGNED):
        raise HTTPException(status_code=400, detail="Complaint must be in assigned/in-progress/verification stage")

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