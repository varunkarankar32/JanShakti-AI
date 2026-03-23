"""
Complaints Router — CRUD and workflow operations for citizen complaints.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
import json
import math
import os
import smtplib
import uuid
from email.message import EmailMessage
from urllib.parse import quote

import cv2
import numpy as np

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models.complaint import Complaint, ComplaintActivity, ComplaintStatus, PriorityLevel, InputMode
from models.schemas import ComplaintCreate, ComplaintUpdate, ComplaintResponse
from models.user import User
from routers.auth import (
    get_current_authority,
    get_current_leader,
    get_current_leader_or_authority,
    get_current_user,
)
from services.priority_engine import priority_engine
from services.complaint_extraction_service import complaint_extraction_service
from services.whatsapp_service import whatsapp_bot
from services.gemini_ai_service import gemini_ai_service
from config import SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_USE_TLS, UPLOAD_DIR

router = APIRouter(prefix="/complaints", tags=["Complaints"])


class LeaderAssignRequest(BaseModel):
    authority_name: str
    authority_email: Optional[str] = None
    assigned_team: Optional[str] = None
    leader_note: Optional[str] = None


class AuthorityResponseRequest(BaseModel):
    authority_name: Optional[str] = None
    response: str
    mark_verification_ready: bool = False


class AuthorityAcknowledgeRequest(BaseModel):
    note: Optional[str] = None


class AuthorityLeaderMessageRequest(BaseModel):
    message: str
    blocker: bool = False
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


SUPPORTED_LANGS = {"en", "hi", "hinglish"}
INCIDENT_STOP_WORDS = {
    "the", "and", "with", "from", "near", "this", "that", "issue", "complaint", "road", "ward",
    "for", "has", "have", "been", "not", "all", "due", "are", "was", "were", "our",
}


def _normalize_language(raw_lang: Optional[str]) -> str:
    if not raw_lang:
        return "en"
    lang = str(raw_lang).strip().lower()
    if lang in SUPPORTED_LANGS:
        return lang
    if lang.startswith("hi"):
        return "hi"
    return "en"


def _build_citizen_update(
    status: str,
    ticket_id: str,
    language: str,
    authority: Optional[str] = None,
    note: Optional[str] = None,
) -> str:
    lang = _normalize_language(language)
    authority_name = authority or "assigned team"

    updates = {
        "en": {
            "assigned": f"Ticket {ticket_id} is assigned to {authority_name}. Team mobilization has started.",
            "in_progress": f"Work is now in progress for ticket {ticket_id}. Field crew is active.",
            "verification": f"Work for ticket {ticket_id} is reported complete and is under leader verification.",
            "resolved": f"Leader verified completion. Ticket {ticket_id} is solved. Please share your rating.",
            "open": f"Ticket {ticket_id} is open and queued for triage.",
            "flagged": f"Ticket {ticket_id} was flagged in verification and requires rework by the authority.",
        },
        "hi": {
            "assigned": f"टिकट {ticket_id} को {authority_name} को सौंप दिया गया है। टीम काम शुरू कर रही है।",
            "in_progress": f"टिकट {ticket_id} पर कार्य प्रगति पर है। फील्ड टीम साइट पर काम कर रही है।",
            "verification": f"टिकट {ticket_id} का काम पूरा बताया गया है और अभी लीडर सत्यापन में है।",
            "resolved": f"लीडर ने कार्य सत्यापित कर दिया है। टिकट {ticket_id} अब हल हो चुका है। कृपया रेटिंग दें।",
            "open": f"टिकट {ticket_id} दर्ज हो गया है और प्राथमिक जांच के लिए कतार में है।",
            "flagged": f"टिकट {ticket_id} का सत्यापन संदिग्ध मिला। दोबारा कार्यवाही आवश्यक है।",
        },
        "hinglish": {
            "assigned": f"Ticket {ticket_id} ko {authority_name} ko assign kar diya gaya hai. Team nikal chuki hai.",
            "in_progress": f"Ticket {ticket_id} par kaam start ho gaya hai. Field team site par hai.",
            "verification": f"Ticket {ticket_id} ka kaam complete report hua hai, ab leader verification chal raha hai.",
            "resolved": f"Leader verification complete. Ticket {ticket_id} solve ho gaya. Please rating zaroor dein.",
            "open": f"Ticket {ticket_id} register ho gaya hai aur triage queue mein hai.",
            "flagged": f"Ticket {ticket_id} verification mein flag hua. Team ko rework karna hoga.",
        },
    }
    base = updates[lang].get(status, updates[lang]["open"])
    if note:
        return f"{base} Note: {note}"
    return base


def _safe_notify_citizen(complaint: Complaint, status: str, note: Optional[str] = None):
    message = _build_citizen_update(
        status=status,
        ticket_id=complaint.ticket_id,
        language=complaint.citizen_language or "en",
        authority=complaint.assigned_authority,
        note=note,
    )
    complaint.citizen_update = message

    if complaint.citizen_phone:
        try:
            whatsapp_bot.send_status_update(
                phone=complaint.citizen_phone,
                ticket_id=complaint.ticket_id,
                status=status,
                message=message,
            )
        except Exception:
            # Notification failures should not block complaint workflow updates.
            pass


def _save_verification_photo(ticket_id: str, stage: str, data: bytes, original_name: str) -> str:
    verification_dir = Path(UPLOAD_DIR) / "verification"
    verification_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(original_name or "").suffix.lower() or ".jpg"
    filename = f"{ticket_id}_{stage}_{uuid.uuid4().hex[:8]}{ext}"
    rel_path = (verification_dir / filename).as_posix()

    with open(rel_path, "wb") as f:
        f.write(data)

    return rel_path


def _save_citizen_media(data: bytes, original_name: str, media_kind: str) -> str:
    media_dir = Path(UPLOAD_DIR) / "citizen_media"
    media_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(original_name or "").suffix.lower()
    if not ext:
        ext = ".jpg" if media_kind == "image" else ".wav"

    filename = f"{media_kind}_{uuid.uuid4().hex[:12]}{ext}"
    rel_path = (media_dir / filename).as_posix()

    with open(rel_path, "wb") as f:
        f.write(data)

    return rel_path


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    raw = value.strip()
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)

    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _local_cluster_count(
    db: Session,
    ward: str,
    category: str,
    latitude: Optional[float],
    longitude: Optional[float],
    radius_m: float = 1200.0,
) -> int:
    """Estimate nearby unresolved complaint density for locality-level recurrence signal."""
    if latitude is None or longitude is None:
        return 0

    recent_rows = (
        db.query(Complaint)
        .filter(Complaint.ward == ward)
        .filter(Complaint.category == category)
        .filter(Complaint.status != ComplaintStatus.RESOLVED)
        .filter(Complaint.created_at >= datetime.now(timezone.utc) - timedelta(days=30))
        .filter(Complaint.latitude.isnot(None), Complaint.longitude.isnot(None))
        .all()
    )

    count = 0
    for row in recent_rows:
        if row.latitude is None or row.longitude is None:
            continue
        distance = _haversine_m(float(latitude), float(longitude), float(row.latitude), float(row.longitude))
        if distance <= radius_m:
            count += 1

    return count


def _score_source_from_breakdown(ai_breakdown: Optional[str]) -> str:
    if not ai_breakdown:
        return "heuristic_fallback"

    try:
        payload = json.loads(ai_breakdown)
    except Exception:
        return "heuristic_fallback"

    if payload.get("qwen_reasoning"):
        return "qwen"
    return "heuristic_fallback"


def _verification_explanation(complaint: Complaint) -> str:
    score = complaint.verification_score
    confidence = complaint.verification_confidence
    status = (complaint.verification_status or "pending_review").lower()

    if score is None:
        return (
            "Authority marked this issue complete and uploaded evidence. "
            "AI verification has not been run yet. Leader should run AI Verify before closing."
        )

    confidence_text = f" with confidence {round(float(confidence), 1)}%" if confidence is not None else ""
    if status == "verified":
        return (
            f"AI verification passed with score {round(float(score), 1)}/100{confidence_text}. "
            "Before/after evidence appears consistent for leader review."
        )

    if status == "flagged":
        return (
            f"AI verification flagged this evidence at {round(float(score), 1)}/100{confidence_text}. "
            "Leader should request rework or additional proof before resolution."
        )

    return (
        f"AI verification status is {status} at {round(float(score), 1)}/100{confidence_text}. "
        "Leader confirmation is still required."
    )


def _read_media_from_path(raw_path: Optional[str]) -> tuple[Optional[bytes], Optional[str]]:
    """Resolve and read a local media path saved in complaint payload."""
    if not raw_path:
        return None, None

    raw = str(raw_path).strip()
    if not raw:
        return None, None

    candidates = []
    p = Path(raw)
    candidates.append(p)
    candidates.append(Path(raw.lstrip("/")))
    candidates.append(Path(UPLOAD_DIR) / p.name)

    for candidate in candidates:
        try:
            if candidate.exists() and candidate.is_file():
                return candidate.read_bytes(), candidate.name
        except Exception:
            continue

    return None, None


def _compute_visual_change(before_path: str, after_path: str) -> dict:
    img_before = cv2.imread(before_path)
    img_after = cv2.imread(after_path)
    if img_before is None or img_after is None:
        raise ValueError("Unable to read verification images")

    resized_before = cv2.resize(img_before, (640, 480))
    resized_after = cv2.resize(img_after, (640, 480))

    gray_before = cv2.cvtColor(resized_before, cv2.COLOR_BGR2GRAY)
    gray_after = cv2.cvtColor(resized_after, cv2.COLOR_BGR2GRAY)

    abs_diff = cv2.absdiff(gray_before, gray_after)
    diff_ratio = float(np.mean(abs_diff)) / 255.0

    hist_before = cv2.calcHist([gray_before], [0], None, [64], [0, 256])
    hist_after = cv2.calcHist([gray_after], [0], None, [64], [0, 256])
    cv2.normalize(hist_before, hist_before)
    cv2.normalize(hist_after, hist_after)

    hist_corr = float(cv2.compareHist(hist_before, hist_after, cv2.HISTCMP_CORREL))
    hist_corr = max(-1.0, min(1.0, hist_corr))

    visual_change_score = max(0.0, min(100.0, (diff_ratio * 140.0) + ((1.0 - hist_corr) * 45.0)))
    min_dim = float(min(gray_before.shape[0], gray_before.shape[1]))
    confidence = 60.0 if min_dim < 240 else 75.0 if min_dim < 480 else 90.0

    return {
        "score": round(visual_change_score, 1),
        "confidence": round(confidence, 1),
        "difference_ratio": round(diff_ratio, 4),
        "histogram_similarity": round(hist_corr, 4),
    }


def _verification_summary(complaint: Complaint) -> dict:
    before_meta = json.loads(complaint.before_meta) if complaint.before_meta else {}
    after_meta = json.loads(complaint.after_meta) if complaint.after_meta else {}

    before_lat = before_meta.get("latitude")
    before_lon = before_meta.get("longitude")
    after_lat = after_meta.get("latitude")
    after_lon = after_meta.get("longitude")

    geo_distance_m = None
    geo_score = 25.0
    geotag_status = "missing"
    if before_lat is None and before_lon is None and complaint.latitude is not None and complaint.longitude is not None:
        before_lat = complaint.latitude
        before_lon = complaint.longitude

    if all(v is not None for v in [before_lat, before_lon, after_lat, after_lon]):
        geo_distance_m = _haversine_m(float(before_lat), float(before_lon), float(after_lat), float(after_lon))
        if geo_distance_m <= 50:
            geo_score = 100.0
            geotag_status = "matched"
        elif geo_distance_m <= 100:
            geo_score = 82.0
            geotag_status = "near_match"
        elif geo_distance_m <= 250:
            geo_score = 56.0
            geotag_status = "mismatch"
        else:
            geo_score = 20.0
            geotag_status = "mismatch"

    before_ts = _parse_iso_datetime(before_meta.get("captured_at") or before_meta.get("uploaded_at"))
    after_ts = _parse_iso_datetime(after_meta.get("captured_at") or after_meta.get("uploaded_at"))
    time_score = 60.0
    if before_ts and after_ts:
        delta_hours = (after_ts - before_ts).total_seconds() / 3600.0
        if delta_hours < 0:
            time_score = 10.0
        elif delta_hours <= 72:
            time_score = 100.0
        elif delta_hours <= 168:
            time_score = 85.0
        elif delta_hours <= 720:
            time_score = 62.0
        else:
            time_score = 35.0

    visual_result = _compute_visual_change(complaint.before_photo or "", complaint.after_photo or "")
    visual_score = float(visual_result["score"])

    final_score = round((visual_score * 0.55) + (geo_score * 0.25) + (time_score * 0.20), 1)
    confidence = round((float(visual_result["confidence"]) * 0.6) + (geo_score * 0.2) + (time_score * 0.2), 1)

    status = "verified" if final_score >= 72.0 and visual_score >= 25.0 else "flagged"
    reasons = []
    if geo_distance_m is not None and geo_distance_m > 100:
        reasons.append("location_mismatch")
    if geotag_status == "missing":
        reasons.append("geotag_missing")
    if visual_score < 25.0:
        reasons.append("low_visual_change")
    if time_score < 35.0:
        reasons.append("time_window_suspicious")

    return {
        "status": status,
        "verification_score": final_score,
        "verification_confidence": round(min(99.0, confidence), 1),
        "verification_engine": "cv_verification_v1",
        "verification_model": "opencv_diff_hist",
        "components": {
            "visual_score": round(visual_score, 1),
            "geo_score": round(geo_score, 1),
            "time_score": round(time_score, 1),
            "geo_distance_m": round(geo_distance_m, 1) if geo_distance_m is not None else None,
            "geotag_status": geotag_status,
            "visual_details": visual_result,
        },
        "reasons": reasons,
    }


def _incident_key(complaint: Complaint) -> str:
    tokens = [
        t
        for t in "".join(ch.lower() if ch.isalnum() else " " for ch in (complaint.title or "")).split()
        if len(t) > 2 and t not in INCIDENT_STOP_WORDS
    ]
    signature = " ".join(tokens[:6]) or "generic"
    return f"{complaint.ward}|{complaint.category}|{signature}"


def _is_authority_assigned(complaint: Complaint, current_user: User) -> bool:
    role = (current_user.role or "citizen").lower()
    if role == "leader":
        return True

    user_email = (current_user.email or "").strip().lower()
    user_name = (current_user.name or "").strip().lower()

    authority_email = (complaint.authority_email or "").strip().lower()
    assigned_authority = (complaint.assigned_authority or "").strip().lower()
    assigned_team = (complaint.assigned_to or "").strip().lower()

    if user_email and authority_email and user_email == authority_email:
        return True

    if user_name and user_name in {assigned_authority, assigned_team}:
        return True

    return False


def _ensure_authority_access(complaint: Complaint, current_user: User):
    if not _is_authority_assigned(complaint, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this complaint")


def _unresponded_hours(complaint: Complaint) -> float:
    if complaint.status not in {ComplaintStatus.OPEN, ComplaintStatus.ASSIGNED}:
        return 0.0
    if complaint.authority_response or complaint.leader_note:
        return 0.0
    if not complaint.created_at:
        return 0.0
    created = complaint.created_at if complaint.created_at.tzinfo else complaint.created_at.replace(tzinfo=timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - created).total_seconds() / 3600.0)


def _effective_priority_snapshot(complaint: Complaint):
    base_score = float(complaint.ai_score or 0.0)
    unresponded_hours = _unresponded_hours(complaint)
    starvation_bonus = priority_engine.calculate_starvation_bonus(unresponded_hours)
    effective_score = round(min(100.0, base_score + starvation_bonus), 1)
    effective_priority = priority_engine.score_to_priority(effective_score)
    return effective_score, effective_priority, starvation_bonus, unresponded_hours


def _apply_starvation_escalation(db: Session):
    active = (
        db.query(Complaint)
        .filter(Complaint.status != ComplaintStatus.RESOLVED)
        .all()
    )

    changed = False
    for complaint in active:
        effective_score, effective_priority, _, _ = _effective_priority_snapshot(complaint)
        if complaint.priority is None or complaint.priority.value != effective_priority:
            complaint.priority = PriorityLevel(effective_priority)
            changed = True

    if changed:
        db.commit()


def _background_enrich_complaint_media(complaint_id: int):
    """Run heavier image/audio understanding + Qwen scoring after complaint is registered."""
    db = SessionLocal()
    try:
        complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        if not complaint:
            return

        try:
            extracted = complaint_extraction_service.extract_from_text(
                text=complaint.description,
                ward_hint=complaint.ward,
                category_hint=complaint.category,
                source=complaint.input_mode.value if complaint.input_mode else "text",
            )
            refined_description = extracted.get("description") or complaint.description
            ai_meta = extracted.get("ai", {})
        except Exception:
            refined_description = complaint.description
            ai_meta = {}

        category = complaint.category
        media_context_notes = []

        image_bytes, image_name = _read_media_from_path(complaint.image_path)
        if image_bytes:
            try:
                image_extracted = complaint_extraction_service.extract_from_image(
                    image_bytes=image_bytes,
                    caption=refined_description,
                    ward_hint=complaint.ward,
                    image_name=image_name,
                )
                visual_statement = str(
                    image_extracted.get("image_problem_description") or image_extracted.get("description") or ""
                ).strip()
                if visual_statement:
                    media_context_notes.append(f"Image analysis: {visual_statement[:240]}")

                detection = image_extracted.get("ai_detection_result")
                if detection:
                    det_category = str(detection.get("category", "Unknown"))
                    det_severity = str(detection.get("severity", "unknown"))
                    det_conf = detection.get("confidence")
                    conf_text = f" ({round(float(det_conf) * 100, 1)}% conf)" if det_conf is not None else ""
                    media_context_notes.append(
                        f"Image detected {det_category} with {det_severity} severity{conf_text}."
                    )
                    ai_meta["image_detection"] = detection

                if image_extracted.get("category"):
                    category = str(image_extracted.get("category"))
            except Exception as exc:
                media_context_notes.append(f"Image analysis unavailable: {str(exc)[:120]}")

        audio_bytes, audio_name = _read_media_from_path(complaint.audio_path)
        if audio_bytes:
            try:
                ext = Path(audio_name or "voice.wav").suffix.lower().lstrip(".") or "wav"
                voice_extracted = complaint_extraction_service.extract_from_voice(
                    audio_bytes=audio_bytes,
                    file_extension=ext,
                    ward_hint=complaint.ward,
                )
                transcript = str(voice_extracted.get("transcript") or "").strip()
                if transcript:
                    media_context_notes.append(f"Audio transcript: {transcript[:280]}")
                speech_meta = voice_extracted.get("speech")
                if speech_meta:
                    ai_meta["speech"] = speech_meta
            except Exception as exc:
                media_context_notes.append(f"Audio transcription unavailable: {str(exc)[:120]}")

        scoring_text = refined_description
        if media_context_notes:
            media_block = "\n".join(f"- {note}" for note in media_context_notes)
            scoring_text = f"{refined_description}\n\nAI Media Context:\n{media_block}"
            ai_meta["media_context_notes"] = media_context_notes

        recurrence_count = (
            db.query(Complaint)
            .filter(Complaint.ward == complaint.ward)
            .filter(Complaint.category == category)
            .filter(Complaint.status != ComplaintStatus.RESOLVED)
            .filter(Complaint.created_at >= datetime.now(timezone.utc) - timedelta(days=30))
            .count()
        )
        local_cluster_count = _local_cluster_count(
            db=db,
            ward=complaint.ward,
            category=category,
            latitude=complaint.latitude,
            longitude=complaint.longitude,
        )

        priority_result = priority_engine.calculate_score(
            text=scoring_text,
            category=category,
            ward=complaint.ward,
            recurrence_count=recurrence_count,
            local_cluster_count=local_cluster_count,
            social_mentions=0,
            enable_qwen=True,
        )

        complaint.category = category
        complaint.description = (
            f"{refined_description}\n\nAI Media Summary: {media_context_notes[0]}"
            if media_context_notes
            else refined_description
        )
        complaint.priority = PriorityLevel(priority_result["priority"])
        complaint.ai_score = priority_result["score"]
        complaint.urgency_score = priority_result["urgency"]
        complaint.impact_score = priority_result["impact"]
        complaint.recurrence_score = priority_result["recurrence"]
        complaint.sentiment_score = priority_result["sentiment"]
        complaint.ai_category = ai_meta.get("category")
        complaint.ai_entities = json.dumps(ai_meta)
        complaint.ai_breakdown = json.dumps(priority_result.get("breakdown", {}))
        complaint.ai_explanation = priority_result.get("explanation")
        complaint.ai_model_version = priority_result.get("model_version")

        _log_activity(
            db,
            complaint,
            actor_role="system",
            actor_name="AI Engine",
            action="background_ai_enrichment_completed",
            note=f"score={complaint.ai_score}; priority={complaint.priority.value if complaint.priority else 'P3'}",
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@router.post("", response_model=ComplaintResponse)
def create_complaint(
    complaint: ComplaintCreate,
    background_tasks: BackgroundTasks,
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
    defer_media_ai = bool(complaint.image_path or complaint.audio_path)

    media_context_notes = []

    # Re-read citizen media from server storage so image/audio understanding is always
    # available for scoring, even if frontend submitted only a short placeholder text.
    image_bytes, image_name = (None, None)
    if not defer_media_ai:
        image_bytes, image_name = _read_media_from_path(complaint.image_path)
    if image_bytes and not defer_media_ai:
        try:
            image_extracted = complaint_extraction_service.extract_from_image(
                image_bytes=image_bytes,
                caption=refined_description,
                ward_hint=complaint.ward,
                image_name=image_name,
            )
            visual_statement = str(
                image_extracted.get("image_problem_description") or image_extracted.get("description") or ""
            ).strip()
            if visual_statement:
                media_context_notes.append(f"Image analysis: {visual_statement[:240]}")

            detection = image_extracted.get("ai_detection_result")
            if detection:
                det_category = str(detection.get("category", "Unknown"))
                det_severity = str(detection.get("severity", "unknown"))
                det_conf = detection.get("confidence")
                conf_text = f" ({round(float(det_conf) * 100, 1)}% conf)" if det_conf is not None else ""
                media_context_notes.append(
                    f"Image detected {det_category} with {det_severity} severity{conf_text}."
                )
                ai_meta["image_detection"] = detection

            if not complaint.category and image_extracted.get("category"):
                category = str(image_extracted.get("category"))
        except Exception as exc:
            media_context_notes.append(f"Image analysis unavailable: {str(exc)[:120]}")

    audio_bytes, audio_name = (None, None)
    if not defer_media_ai:
        audio_bytes, audio_name = _read_media_from_path(complaint.audio_path)
    if audio_bytes and not defer_media_ai:
        try:
            ext = Path(audio_name or "voice.wav").suffix.lower().lstrip(".") or "wav"
            voice_extracted = complaint_extraction_service.extract_from_voice(
                audio_bytes=audio_bytes,
                file_extension=ext,
                ward_hint=complaint.ward,
            )
            transcript = str(voice_extracted.get("transcript") or "").strip()
            if transcript:
                media_context_notes.append(f"Audio transcript: {transcript[:280]}")
            speech_meta = voice_extracted.get("speech")
            if speech_meta:
                ai_meta["speech"] = speech_meta
        except Exception as exc:
            media_context_notes.append(f"Audio transcription unavailable: {str(exc)[:120]}")

    scoring_text = refined_description
    if media_context_notes:
        media_block = "\n".join(f"- {note}" for note in media_context_notes)
        scoring_text = f"{refined_description}\n\nAI Media Context:\n{media_block}"
        ai_meta["media_context_notes"] = media_context_notes

        # Persist a concise written media explanation with the complaint content.
        refined_description = f"{refined_description}\n\nAI Media Summary: {media_context_notes[0]}"

    recurrence_count = (
        db.query(Complaint)
        .filter(Complaint.ward == complaint.ward)
        .filter(Complaint.category == category)
        .filter(Complaint.status != ComplaintStatus.RESOLVED)
        .filter(Complaint.created_at >= datetime.now(timezone.utc) - timedelta(days=30))
        .count()
    )
    local_cluster_count = _local_cluster_count(
        db=db,
        ward=complaint.ward,
        category=category,
        latitude=complaint.latitude,
        longitude=complaint.longitude,
    )

    priority_result = priority_engine.calculate_score(
        text=scoring_text,
        category=category,
        ward=complaint.ward,
        recurrence_count=recurrence_count,
        local_cluster_count=local_cluster_count,
        social_mentions=0,
        enable_qwen=not defer_media_ai,
    )

    if defer_media_ai:
        ai_meta["background_ai_processing"] = "queued"
        ai_meta["background_ai_processing_note"] = "Media understanding and Qwen re-scoring in progress"

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
        citizen_language=_normalize_language(complaint.citizen_language),
        image_path=complaint.image_path,
        audio_path=complaint.audio_path,
        priority=priority_level,
        ai_score=priority_result["score"],
        urgency_score=priority_result["urgency"],
        impact_score=priority_result["impact"],
        recurrence_score=priority_result["recurrence"],
        sentiment_score=priority_result["sentiment"],
        ai_category=ai_meta.get("category"),
        ai_entities=json.dumps(ai_meta),
        ai_breakdown=json.dumps(priority_result.get("breakdown", {})),
        ai_explanation=priority_result.get("explanation"),
        ai_model_version=priority_result.get("model_version"),
        status=ComplaintStatus.OPEN,
        input_mode=input_mode,
        citizen_update=_build_citizen_update(
            status="open",
            ticket_id=ticket_id,
            language=_normalize_language(complaint.citizen_language),
        ),
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

    if defer_media_ai:
        _log_activity(
            db,
            db_complaint,
            actor_role="system",
            actor_name="AI Engine",
            action="background_ai_enrichment_queued",
            note="Complaint registered instantly; media/Qwen enrichment queued.",
        )
        db.commit()
        background_tasks.add_task(_background_enrich_complaint_media, db_complaint.id)

    return {
        "id": db_complaint.id,
        "ticket_id": db_complaint.ticket_id,
        "title": db_complaint.title,
        "description": db_complaint.description,
        "category": db_complaint.category,
        "ward": db_complaint.ward,
        "location": db_complaint.location,
        "priority": db_complaint.priority.value if db_complaint.priority else "P3",
        "ai_score": db_complaint.ai_score,
        "urgency_score": db_complaint.urgency_score,
        "impact_score": db_complaint.impact_score,
        "recurrence_score": db_complaint.recurrence_score,
        "sentiment_score": db_complaint.sentiment_score,
        "ai_category": db_complaint.ai_category,
        "ai_breakdown": json.loads(db_complaint.ai_breakdown) if db_complaint.ai_breakdown else None,
        "ai_explanation": db_complaint.ai_explanation,
        "ai_model_version": db_complaint.ai_model_version,
        "score_source": _score_source_from_breakdown(db_complaint.ai_breakdown),
        "status": db_complaint.status.value if db_complaint.status else "open",
        "input_mode": db_complaint.input_mode.value if db_complaint.input_mode else "text",
        "assigned_to": db_complaint.assigned_to,
        "created_at": db_complaint.created_at,
        "rating": db_complaint.rating,
    }


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
    media_path = _save_citizen_media(image_bytes, image.filename or "image.jpg", "image")
    payload = complaint_extraction_service.extract_from_image(
        image_bytes=image_bytes,
        caption=caption or None,
        ward_hint=ward,
        image_name=image.filename,
    )
    payload["source_media_path"] = media_path
    payload["source_media_type"] = "image"
    return payload


@router.post("/extract/image-only")
async def extract_problem_from_image_only(
    image: UploadFile = File(...),
    ward: Optional[str] = Form(None),
):
    """Generate complaint description directly from image, without text caption."""
    image_bytes = await image.read()
    media_path = _save_citizen_media(image_bytes, image.filename or "image.jpg", "image")
    payload = complaint_extraction_service.extract_from_image(
        image_bytes=image_bytes,
        caption=None,
        ward_hint=ward,
        image_name=image.filename,
    )
    payload["source_media_path"] = media_path
    payload["source_media_type"] = "image"
    return payload


@router.post("/extract/voice")
async def extract_complaint_voice(
    audio: UploadFile = File(...),
    ward: Optional[str] = Form(None),
):
    """Transcribe voice input and convert it into a complaint statement."""
    audio_bytes = await audio.read()
    ext = audio.filename.split(".")[-1] if audio.filename and "." in audio.filename else "ogg"
    try:
        media_path = _save_citizen_media(audio_bytes, audio.filename or f"voice.{ext}", "audio")
        payload = complaint_extraction_service.extract_from_voice(
            audio_bytes=audio_bytes,
            file_extension=ext,
            ward_hint=ward,
        )
        payload["source_media_path"] = media_path
        payload["source_media_type"] = "audio"
        return payload
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class SmartFillRequest(BaseModel):
    text: str


class RiskAssessmentRequest(BaseModel):
    description: str
    category: str
    ward: str
    title: Optional[str] = None


@router.post("/ai/analyze-image")
async def ai_analyze_image(
    image: UploadFile = File(...),
    ward: Optional[str] = Form(None),
):
    """
    🧠 Gemini 2.5 Flash — Analyze civic issue image.
    Returns: description, category, severity, risk_score, risk_level, risk_factors.
    Auto-fills the complaint form from the uploaded photo.
    """
    image_bytes = await image.read()
    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="Image file is too small or empty")

    media_path = _save_citizen_media(image_bytes, image.filename or "image.jpg", "image")
    result = await gemini_ai_service.analyze_image(image_bytes, image_name=image.filename)
    result["source_media_path"] = media_path
    return result


@router.post("/ai/risk-assessment")
async def ai_risk_assessment(request: RiskAssessmentRequest):
    """
    🧠 Gemini 2.5 Flash — Generate investor-grade AI risk assessment.
    Returns: risk_score, risk_level, risk_factors, reasoning, urgency_hours, etc.
    """
    if not request.description or len(request.description.strip()) < 10:
        raise HTTPException(status_code=400, detail="Description too short for risk assessment")

    result = await gemini_ai_service.assess_risk(
        description=request.description,
        category=request.category,
        ward=request.ward,
        title=request.title,
    )
    return result


@router.post("/ai/smart-fill")
async def ai_smart_fill(request: SmartFillRequest):
    """
    🧠 Gemini 2.5 Flash — Enhance raw citizen text into a polished complaint.
    Returns: enhanced_description, auto-detected category & severity.
    """
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(status_code=400, detail="Text too short")

    result = await gemini_ai_service.smart_fill(request.text)
    return result


class GenerateCommunicationRequest(BaseModel):
    comm_type: str  # press_release | social_post | citizen_advisory | awareness_campaign
    ward: str = "All Wards"
    category: str = "General"
    context: str = ""
    total_complaints: int = 0
    resolved: int = 0
    pending: int = 0
    p0_active: int = 0


@router.post("/ai/generate-communication")
async def ai_generate_communication(request: GenerateCommunicationRequest):
    """
    🧠 Gemini 2.5 Flash — AI Public Communication Generator.
    Generates press releases, social media posts, citizen advisories, and awareness campaigns.
    """
    valid_types = {"press_release", "social_post", "citizen_advisory", "awareness_campaign"}
    if request.comm_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"comm_type must be one of: {valid_types}")

    stats = {
        "total_complaints": request.total_complaints,
        "resolved": request.resolved,
        "pending": request.pending,
        "p0_active": request.p0_active,
    }

    result = await gemini_ai_service.generate_public_communication(
        comm_type=request.comm_type,
        ward=request.ward,
        category=request.category,
        summary_stats=stats,
        context_text=request.context,
    )
    return result

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
    _apply_starvation_escalation(db)

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
            (lambda eff: {
                "id": c.id,
                "ticket_id": c.ticket_id,
                "title": c.title,
                "description": c.description,
                "category": c.category,
                "ward": c.ward,
                "priority": c.priority.value if c.priority else "P3",
                "ai_score": c.ai_score,
                "urgency_score": c.urgency_score,
                "impact_score": c.impact_score,
                "recurrence_score": c.recurrence_score,
                "sentiment_score": c.sentiment_score,
                "ai_explanation": c.ai_explanation,
                "ai_model_version": c.ai_model_version,
                "score_source": _score_source_from_breakdown(c.ai_breakdown),
                "ai_breakdown": json.loads(c.ai_breakdown) if c.ai_breakdown else None,
                "effective_ai_score": eff[0],
                "effective_priority": eff[1],
                "starvation_bonus": eff[2],
                "unresponded_hours": round(eff[3], 1),
                "status": c.status.value if c.status else "open",
                "input_mode": c.input_mode.value if c.input_mode else "text",
                "assigned_to": c.assigned_to,
                "assigned_authority": c.assigned_authority,
                "authority_email": c.authority_email,
                "authority_response": c.authority_response,
                "leader_note": c.leader_note,
                "citizen_update": c.citizen_update,
                "citizen_language": c.citizen_language,
                "image_path": c.image_path,
                "audio_path": c.audio_path,
                "verification_status": c.verification_status,
                "verification_score": c.verification_score,
                "verification_confidence": c.verification_confidence,
                "verification_engine": "cv_verification_v1" if c.verification_status else None,
                "verification_model": "opencv_diff_hist" if c.verification_status else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
                "rating": c.rating,
            })(_effective_priority_snapshot(c))
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
    _apply_starvation_escalation(db)

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
                "ai_score": c.ai_score,
                "urgency_score": c.urgency_score,
                "impact_score": c.impact_score,
                "recurrence_score": c.recurrence_score,
                "sentiment_score": c.sentiment_score,
                "ai_explanation": c.ai_explanation,
                "ai_model_version": c.ai_model_version,
                "score_source": _score_source_from_breakdown(c.ai_breakdown),
                "ai_breakdown": json.loads(c.ai_breakdown) if c.ai_breakdown else None,
                "status": c.status.value if c.status else "open",
                "effective_priority": _effective_priority_snapshot(c)[1],
                "effective_ai_score": _effective_priority_snapshot(c)[0],
                "assigned_authority": c.assigned_authority,
                "authority_email": c.authority_email,
                "authority_response": c.authority_response,
                "citizen_update": c.citizen_update,
                "citizen_language": c.citizen_language,
                "image_path": c.image_path,
                "audio_path": c.audio_path,
                "verification_status": c.verification_status,
                "verification_score": c.verification_score,
                "verification_confidence": c.verification_confidence,
                "verification_engine": "cv_verification_v1" if c.verification_status else None,
                "verification_model": "opencv_diff_hist" if c.verification_status else None,
                "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in complaints
        ],
    }


@router.get("/authority/my")
def list_authority_complaints(
    status: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_authority: User = Depends(get_current_authority),
):
    """Get complaints assigned to currently authenticated authority."""
    _apply_starvation_escalation(db)

    user_email = (current_authority.email or "").strip().lower()
    user_name = (current_authority.name or "").strip().lower()

    query = db.query(Complaint).filter(
        or_(
            func.lower(func.coalesce(Complaint.authority_email, "")) == user_email,
            func.lower(func.coalesce(Complaint.assigned_authority, "")) == user_name,
            func.lower(func.coalesce(Complaint.assigned_to, "")) == user_name,
        )
    )
    if status:
        query = query.filter(Complaint.status == status)

    complaints = query.order_by(desc(Complaint.created_at)).limit(max(1, min(limit, 250))).all()

    return {
        "total": len(complaints),
        "complaints": [
            {
                "ticket_id": c.ticket_id,
                "title": c.title,
                "description": c.description,
                "category": c.category,
                "ward": c.ward,
                "priority": c.priority.value if c.priority else "P3",
                "ai_score": c.ai_score,
                "urgency_score": c.urgency_score,
                "impact_score": c.impact_score,
                "recurrence_score": c.recurrence_score,
                "sentiment_score": c.sentiment_score,
                "ai_explanation": c.ai_explanation,
                "ai_model_version": c.ai_model_version,
                "score_source": _score_source_from_breakdown(c.ai_breakdown),
                "ai_breakdown": json.loads(c.ai_breakdown) if c.ai_breakdown else None,
                "effective_priority": _effective_priority_snapshot(c)[1],
                "effective_ai_score": _effective_priority_snapshot(c)[0],
                "status": c.status.value if c.status else "open",
                "assigned_authority": c.assigned_authority,
                "authority_email": c.authority_email,
                "leader_note": c.leader_note,
                "authority_response": c.authority_response,
                "citizen_update": c.citizen_update,
                "image_path": c.image_path,
                "audio_path": c.audio_path,
                "verification_status": c.verification_status,
                "verification_score": c.verification_score,
                "verification_confidence": c.verification_confidence,
                "verification_engine": "cv_verification_v1" if c.verification_status else None,
                "verification_model": "opencv_diff_hist" if c.verification_status else None,
                "before_photo": c.before_photo,
                "after_photo": c.after_photo,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            }
            for c in complaints
        ],
    }


@router.get("/leader/verification-requests")
def list_leader_verification_requests(
    limit: int = 50,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_leader),
):
    """Dedicated leader inbox for authority-marked completion and verification requests."""
    query = db.query(Complaint).filter(
        Complaint.status == ComplaintStatus.VERIFICATION,
        Complaint.after_photo.isnot(None),
    )

    if status:
        query = query.filter(func.lower(func.coalesce(Complaint.verification_status, "")) == status.strip().lower())

    complaints = query.order_by(desc(Complaint.created_at)).limit(max(1, min(limit, 200))).all()

    payload = []
    for c in complaints:
        payload.append(
            {
                "ticket_id": c.ticket_id,
                "title": c.title,
                "category": c.category,
                "ward": c.ward,
                "status": c.status.value if c.status else "verification",
                "priority": c.priority.value if c.priority else "P3",
                "effective_priority": _effective_priority_snapshot(c)[1],
                "effective_ai_score": _effective_priority_snapshot(c)[0],
                "assigned_authority": c.assigned_authority,
                "authority_email": c.authority_email,
                "authority_response": c.authority_response,
                "before_photo": c.before_photo,
                "after_photo": c.after_photo,
                "before_meta": json.loads(c.before_meta) if c.before_meta else None,
                "after_meta": json.loads(c.after_meta) if c.after_meta else None,
                "verification_status": c.verification_status,
                "verification_score": c.verification_score,
                "verification_confidence": c.verification_confidence,
                "verification_engine": "cv_verification_v1" if c.verification_status else None,
                "verification_model": "opencv_diff_hist" if c.verification_status else None,
                "verification_explanation": _verification_explanation(c),
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
        )

    return {
        "total": len(payload),
        "requests": payload,
    }


@router.get("/{ticket_id}")
def get_complaint(ticket_id: str, db: Session = Depends(get_db)):
    """Get a single complaint by ticket ID."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    eff_score, eff_priority, starvation_bonus, unresponded_hours = _effective_priority_snapshot(complaint)

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
        "effective_ai_score": eff_score,
        "effective_priority": eff_priority,
        "starvation_bonus": starvation_bonus,
        "unresponded_hours": round(unresponded_hours, 1),
        "urgency_score": complaint.urgency_score,
        "impact_score": complaint.impact_score,
        "recurrence_score": complaint.recurrence_score,
        "sentiment_score": complaint.sentiment_score,
        "ai_category": complaint.ai_category,
        "ai_entities": json.loads(complaint.ai_entities) if complaint.ai_entities else {},
        "ai_breakdown": json.loads(complaint.ai_breakdown) if complaint.ai_breakdown else None,
        "ai_explanation": complaint.ai_explanation,
        "ai_model_version": complaint.ai_model_version,
        "score_source": _score_source_from_breakdown(complaint.ai_breakdown),
        "status": complaint.status.value,
        "input_mode": complaint.input_mode.value,
        "assigned_to": complaint.assigned_to,
        "assigned_authority": complaint.assigned_authority,
        "authority_email": complaint.authority_email,
        "leader_note": complaint.leader_note,
        "authority_response": complaint.authority_response,
        "citizen_update": complaint.citizen_update,
        "citizen_language": complaint.citizen_language,
        "image_path": complaint.image_path,
        "audio_path": complaint.audio_path,
        "before_photo": complaint.before_photo,
        "after_photo": complaint.after_photo,
        "verification_status": complaint.verification_status,
        "verification_score": complaint.verification_score,
        "verification_confidence": complaint.verification_confidence,
        "verification_engine": "cv_verification_v1" if complaint.verification_status else None,
        "verification_model": "opencv_diff_hist" if complaint.verification_status else None,
        "before_meta": json.loads(complaint.before_meta) if complaint.before_meta else None,
        "after_meta": json.loads(complaint.after_meta) if complaint.after_meta else None,
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
            complaint.resolved_at = datetime.now(timezone.utc)
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
    _safe_notify_citizen(complaint, "assigned", req.leader_note)

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
    current_actor: User = Depends(get_current_leader_or_authority),
):
    """Record authority response and move complaint to in-progress or verification."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    _ensure_authority_access(complaint, current_actor)

    response_text = req.response.strip()
    if not response_text:
        raise HTTPException(status_code=400, detail="Response message cannot be empty")

    authority_name = (req.authority_name or current_actor.name or complaint.assigned_authority or "Authority").strip()
    if req.mark_verification_ready and not complaint.after_photo:
        raise HTTPException(status_code=400, detail="Upload after evidence before marking verification ready")

    complaint.authority_response = response_text
    complaint.assigned_authority = authority_name
    if (current_actor.role or "").lower() == "authority" and not complaint.authority_email:
        complaint.authority_email = current_actor.email
    complaint.status = ComplaintStatus.VERIFICATION if req.mark_verification_ready else ComplaintStatus.IN_PROGRESS
    _safe_notify_citizen(
        complaint,
        "verification" if req.mark_verification_ready else "in_progress",
        response_text,
    )

    _log_activity(
        db,
        complaint,
        actor_role="authority",
        actor_name=authority_name,
        action="authority_response",
        note=response_text,
    )
    db.commit()
    db.refresh(complaint)

    return {
        "ticket_id": complaint.ticket_id,
        "status": complaint.status.value,
        "authority_response": complaint.authority_response,
        "citizen_update": complaint.citizen_update,
    }


@router.post("/{ticket_id}/authority/acknowledge")
def authority_acknowledge(
    ticket_id: str,
    req: AuthorityAcknowledgeRequest,
    db: Session = Depends(get_db),
    current_authority: User = Depends(get_current_authority),
):
    """Authority acknowledges assigned complaint and starts field operation."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    _ensure_authority_access(complaint, current_authority)

    complaint.status = ComplaintStatus.IN_PROGRESS
    if not complaint.assigned_authority:
        complaint.assigned_authority = current_authority.name
    if not complaint.authority_email:
        complaint.authority_email = current_authority.email
    if req.note:
        complaint.authority_response = req.note

    _safe_notify_citizen(complaint, "in_progress", req.note or "Authority team acknowledged and mobilized.")
    _log_activity(
        db,
        complaint,
        actor_role="authority",
        actor_name=current_authority.name,
        action="authority_acknowledged",
        note=req.note or "Authority acknowledged assignment.",
    )
    db.commit()

    return {
        "ticket_id": complaint.ticket_id,
        "status": complaint.status.value,
        "authority_response": complaint.authority_response,
        "citizen_update": complaint.citizen_update,
    }


@router.post("/{ticket_id}/authority/message-leader")
def authority_message_leader(
    ticket_id: str,
    req: AuthorityLeaderMessageRequest,
    db: Session = Depends(get_db),
    current_authority: User = Depends(get_current_authority),
):
    """Authority sends structured update to leader and optionally requests verification."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    _ensure_authority_access(complaint, current_authority)

    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if req.mark_verification_ready and not complaint.after_photo:
        raise HTTPException(status_code=400, detail="Upload after evidence before requesting verification")

    complaint.authority_response = message
    if req.blocker:
        complaint.status = ComplaintStatus.ASSIGNED
        complaint.leader_note = f"Blocker from authority ({current_authority.name}): {message}"
    elif req.mark_verification_ready:
        complaint.status = ComplaintStatus.VERIFICATION
    else:
        complaint.status = ComplaintStatus.IN_PROGRESS

    _safe_notify_citizen(
        complaint,
        "verification" if req.mark_verification_ready else "in_progress",
        message,
    )
    _log_activity(
        db,
        complaint,
        actor_role="authority",
        actor_name=current_authority.name,
        action="authority_message_to_leader",
        note=message,
    )
    db.commit()

    return {
        "ticket_id": complaint.ticket_id,
        "status": complaint.status.value,
        "authority_response": complaint.authority_response,
        "leader_note": complaint.leader_note,
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
    _safe_notify_citizen(complaint, new_status.value, req.leader_note)

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
    complaint.resolved_at = datetime.now(timezone.utc)
    complaint.verification_status = "verified"
    complaint.leader_note = req.resolution_note
    if req.citizen_update:
        complaint.citizen_update = req.citizen_update
        if complaint.citizen_phone:
            try:
                whatsapp_bot.send_status_update(
                    phone=complaint.citizen_phone,
                    ticket_id=complaint.ticket_id,
                    status="resolved",
                    message=req.citizen_update,
                )
            except Exception:
                pass
    else:
        _safe_notify_citizen(complaint, "resolved", req.resolution_note)

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


@router.post("/{ticket_id}/verification/before")
async def upload_before_photo(
    ticket_id: str,
    photo: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    captured_at: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_actor: User = Depends(get_current_leader_or_authority),
):
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    _ensure_authority_access(complaint, current_actor)

    photo_bytes = await photo.read()
    if not photo_bytes:
        raise HTTPException(status_code=400, detail="Before photo is empty")

    rel_path = _save_verification_photo(ticket_id, "before", photo_bytes, photo.filename or "before.jpg")
    complaint.before_photo = rel_path
    complaint.before_meta = json.dumps(
        {
            "latitude": latitude,
            "longitude": longitude,
            "captured_at": captured_at,
            "uploaded_at": datetime.now().isoformat(),
            "uploaded_by": current_actor.name,
            "uploaded_by_role": (current_actor.role or "citizen"),
            "note": note,
        }
    )
    complaint.verification_status = complaint.verification_status or "pending"

    _log_activity(
        db,
        complaint,
        actor_role="leader" if (current_actor.role or "citizen") == "leader" else "authority",
        actor_name=current_actor.name,
        action="verification_before_uploaded",
        note=note or "Before image uploaded for proof-of-work.",
    )
    db.commit()

    return {
        "ticket_id": complaint.ticket_id,
        "stage": "before",
        "before_photo": complaint.before_photo,
        "verification_status": complaint.verification_status,
    }


@router.post("/{ticket_id}/verification/after")
async def upload_after_photo(
    ticket_id: str,
    photo: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    captured_at: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_actor: User = Depends(get_current_leader_or_authority),
):
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    _ensure_authority_access(complaint, current_actor)

    photo_bytes = await photo.read()
    if not photo_bytes:
        raise HTTPException(status_code=400, detail="After photo is empty")

    rel_path = _save_verification_photo(ticket_id, "after", photo_bytes, photo.filename or "after.jpg")
    complaint.after_photo = rel_path
    complaint.after_meta = json.dumps(
        {
            "latitude": latitude,
            "longitude": longitude,
            "captured_at": captured_at,
            "uploaded_at": datetime.now().isoformat(),
            "uploaded_by": current_actor.name,
            "uploaded_by_role": (current_actor.role or "citizen"),
            "note": note,
        }
    )
    complaint.verification_status = "pending_review"

    _log_activity(
        db,
        complaint,
        actor_role="leader" if (current_actor.role or "citizen") == "leader" else "authority",
        actor_name=current_actor.name,
        action="verification_after_uploaded",
        note=note or "After image uploaded for proof-of-work.",
    )
    db.commit()

    return {
        "ticket_id": complaint.ticket_id,
        "stage": "after",
        "after_photo": complaint.after_photo,
        "verification_status": complaint.verification_status,
    }


@router.post("/{ticket_id}/verification/run")
def run_verification(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_actor: User = Depends(get_current_leader_or_authority),
):
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    _ensure_authority_access(complaint, current_actor)
    if not complaint.before_photo or not complaint.after_photo:
        raise HTTPException(status_code=400, detail="Upload both before and after photos before running verification")

    if not os.path.exists(complaint.before_photo) or not os.path.exists(complaint.after_photo):
        raise HTTPException(status_code=400, detail="Verification photos are missing from storage")

    try:
        result = _verification_summary(complaint)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    complaint.verification_status = result["status"]
    complaint.verification_score = result["verification_score"]
    complaint.verification_confidence = result["verification_confidence"]

    if complaint.verification_status == "verified":
        complaint.status = ComplaintStatus.VERIFICATION
        _safe_notify_citizen(
            complaint,
            "verification",
            f"AI verification score {complaint.verification_score}/100.",
        )
    else:
        complaint.status = ComplaintStatus.IN_PROGRESS
        _safe_notify_citizen(
            complaint,
            "flagged",
            "Verification flagged; authority must rework and re-upload evidence.",
        )

    _log_activity(
        db,
        complaint,
        actor_role="leader" if (current_actor.role or "citizen") == "leader" else "authority",
        actor_name=current_actor.name,
        action="ai_verification_completed",
        note=f"status={complaint.verification_status}; score={complaint.verification_score}",
    )
    db.commit()

    return {
        "ticket_id": complaint.ticket_id,
        "verification_status": complaint.verification_status,
        "verification_score": complaint.verification_score,
        "verification_confidence": complaint.verification_confidence,
        "verification_engine": result.get("verification_engine"),
        "verification_model": result.get("verification_model"),
        "components": result["components"],
        "reasons": result["reasons"],
    }


@router.get("/{ticket_id}/verification")
def get_verification_details(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_actor: User = Depends(get_current_leader_or_authority),
):
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    _ensure_authority_access(complaint, current_actor)

    return {
        "ticket_id": complaint.ticket_id,
        "before_photo": complaint.before_photo,
        "after_photo": complaint.after_photo,
        "before_meta": json.loads(complaint.before_meta) if complaint.before_meta else None,
        "after_meta": json.loads(complaint.after_meta) if complaint.after_meta else None,
        "verification_status": complaint.verification_status,
        "verification_score": complaint.verification_score,
        "verification_confidence": complaint.verification_confidence,
        "verification_engine": "cv_verification_v1" if complaint.verification_status else None,
        "verification_model": "opencv_diff_hist" if complaint.verification_status else None,
    }


@router.get("/incidents/summary")
def incident_summary(
    window_hours: int = 168,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_leader),
):
    _apply_starvation_escalation(db)

    since = datetime.now(timezone.utc) - timedelta(hours=max(24, min(window_hours, 24 * 30)))
    complaints = (
        db.query(Complaint)
        .filter(Complaint.created_at >= since)
        .filter(Complaint.status != ComplaintStatus.RESOLVED)
        .order_by(desc(Complaint.ai_score))
        .all()
    )

    clusters = {}
    for complaint in complaints:
        key = _incident_key(complaint)
        if key not in clusters:
            clusters[key] = {
                "ward": complaint.ward,
                "category": complaint.category,
                "complaint_count": 0,
                "max_ai_score": 0.0,
                "tickets": [],
                "p0_count": 0,
            }

        cluster = clusters[key]
        cluster["complaint_count"] += 1
        cluster["max_ai_score"] = max(cluster["max_ai_score"], float(complaint.ai_score or 0.0))
        cluster["tickets"].append(complaint.ticket_id)
        if complaint.priority == PriorityLevel.P0:
            cluster["p0_count"] += 1

    ranked = []
    for key, cluster in clusters.items():
        risk_score = min(
            100.0,
            round(
                (cluster["max_ai_score"] * 0.55)
                + (cluster["complaint_count"] * 8.5)
                + (18.0 if cluster["p0_count"] > 0 else 0.0),
                1,
            ),
        )
        incident_id = f"INC-{abs(hash(key)) % 100000:05d}"
        ranked.append(
            {
                "incident_id": incident_id,
                "ward": cluster["ward"],
                "category": cluster["category"],
                "complaint_count": cluster["complaint_count"],
                "p0_count": cluster["p0_count"],
                "risk_score": risk_score,
                "severity": "critical" if risk_score >= 85 else "high" if risk_score >= 70 else "medium",
                "tickets": cluster["tickets"][:8],
            }
        )

    ranked.sort(key=lambda item: (item["risk_score"], item["complaint_count"]), reverse=True)
    return {
        "window_hours": window_hours,
        "total_active_complaints": len(complaints),
        "cluster_count": len(ranked),
        "incidents": ranked[: max(1, min(limit, 100))],
    }