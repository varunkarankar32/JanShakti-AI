"""
Dashboard Router — Aggregated stats for leader's dashboard.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.complaint import Complaint, ComplaintStatus, PriorityLevel
from models.user import User
from database import get_db
from routers.auth import get_current_leader
from datetime import datetime, timedelta, timezone
from services.priority_engine import priority_engine
from services.civic_intelligence_service import civic_intelligence_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


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


def _category_color(category: str) -> str:
    colors = {
        "Water Supply": "#2563EB",
        "Roads & Potholes": "#EA580C",
        "Drainage": "#0891B2",
        "Electricity": "#CA8A04",
        "Garbage & Sanitation": "#16A34A",
        "Safety & Security": "#DC2626",
        "Public Health": "#6D28D9",
        "Education": "#0D9488",
        "Public Transport": "#9333EA",
    }
    return colors.get(category, "#64748B")


def _avg_resolution_days(db: Session) -> float:
    resolved_rows = (
        db.query(Complaint.created_at, Complaint.resolved_at)
        .filter(Complaint.status == ComplaintStatus.RESOLVED)
        .filter(Complaint.created_at.isnot(None), Complaint.resolved_at.isnot(None))
        .all()
    )
    if not resolved_rows:
        return 0.0

    durations = [
        (row.resolved_at - row.created_at).total_seconds() / 86400.0
        for row in resolved_rows
        if row.resolved_at and row.created_at
    ]
    return round(sum(durations) / len(durations), 2) if durations else 0.0


def _trend_data(db: Session, weeks: int = 8):
    now = datetime.now(timezone.utc)
    result = []

    for idx in range(weeks):
        start = now - timedelta(days=7 * (weeks - idx))
        end = now - timedelta(days=7 * (weeks - idx - 1))

        complaints_count = (
            db.query(Complaint)
            .filter(Complaint.created_at >= start)
            .filter(Complaint.created_at < end)
            .count()
        )
        resolved_count = (
            db.query(Complaint)
            .filter(Complaint.resolved_at.isnot(None))
            .filter(Complaint.resolved_at >= start)
            .filter(Complaint.resolved_at < end)
            .count()
        )
        avg_rating = (
            db.query(func.avg(Complaint.rating))
            .filter(Complaint.rating.isnot(None))
            .filter(Complaint.resolved_at.isnot(None))
            .filter(Complaint.resolved_at >= start)
            .filter(Complaint.resolved_at < end)
            .scalar()
        )

        result.append(
            {
                "week": f"W{idx + 1}",
                "complaints": complaints_count,
                "resolved": resolved_count,
                "satisfaction": round(float(avg_rating), 2) if avg_rating else 0.0,
                "from": start.date().isoformat(),
                "to": end.date().isoformat(),
            }
        )

    return result


def _build_alerts(
    total: int,
    resolution_rate: float,
    complaints_today: int,
    resolved_today: int,
    p0_active: int,
    pending_verification: int,
    worst_ward: str,
    worst_ward_count: int,
    starvation_watch: dict,
):
    alerts = []
    if p0_active > 0:
        alerts.append(
            {
                "type": "critical",
                "icon": "🚨",
                "message": f"{p0_active} P0 critical complaints need immediate response.",
                "time": "now",
            }
        )

    if pending_verification >= 5:
        alerts.append(
            {
                "type": "warning",
                "icon": "⚠️",
                "message": f"Verification backlog is high ({pending_verification}). Clear proof checks.",
                "time": "now",
            }
        )

    if complaints_today > max(2, resolved_today * 2):
        alerts.append(
            {
                "type": "warning",
                "icon": "📈",
                "message": "New complaint inflow is outpacing resolutions today.",
                "time": "today",
            }
        )

    if worst_ward_count >= 8:
        alerts.append(
            {
                "type": "critical" if worst_ward_count >= 12 else "warning",
                "icon": "🗺️",
                "message": f"{worst_ward} is a hotspot with {worst_ward_count} unresolved complaints.",
                "time": "now",
            }
        )

    if total > 0 and resolution_rate < 55:
        alerts.append(
            {
                "type": "info",
                "icon": "📊",
                "message": f"Resolution rate is {resolution_rate}%. Trigger escalation playbook.",
                "time": "this week",
            }
        )

    if starvation_watch.get("unresponded_72h", 0) > 0:
        alerts.append(
            {
                "type": "critical",
                "icon": "⏳",
                "message": (
                    f"{starvation_watch['unresponded_72h']} complaints are stale for over 72h. "
                    "Auto-priority escalation applied."
                ),
                "time": "now",
            }
        )

    if not alerts:
        alerts.append(
            {
                "type": "success",
                "icon": "✅",
                "message": "System is stable. No immediate operational risks detected.",
                "time": "now",
            }
        )

    return alerts[:6]


def _trust_index(resolution_rate: float, avg_rating: float, avg_response_days: float, p0_active: int) -> float:
    resolution_component = min(100.0, resolution_rate)
    rating_component = min(100.0, max(0.0, (avg_rating / 5.0) * 100.0))
    response_component = max(0.0, 100.0 - (avg_response_days * 12.0))
    critical_penalty = min(25.0, p0_active * 2.0)

    score = (resolution_component * 0.45) + (rating_component * 0.30) + (response_component * 0.25) - critical_penalty
    return round(max(0.0, min(100.0, score)), 1)


def _compose_dashboard_payload(db: Session):
    total = db.query(Complaint).count()
    resolved = db.query(Complaint).filter(Complaint.status == ComplaintStatus.RESOLVED).count()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)

    complaints_today = db.query(Complaint).filter(Complaint.created_at >= today_start).count()
    resolved_today = db.query(Complaint).filter(
        Complaint.status == ComplaintStatus.RESOLVED,
        Complaint.resolved_at >= today_start,
    ).count()
    p0_active = db.query(Complaint).filter(
        Complaint.priority == PriorityLevel.P0,
        Complaint.status != ComplaintStatus.RESOLVED,
    ).count()
    pending_verification = db.query(Complaint).filter(
        Complaint.status == ComplaintStatus.VERIFICATION,
    ).count()

    # Average rating
    avg_rating_result = db.query(func.avg(Complaint.rating)).filter(Complaint.rating.isnot(None)).scalar()
    avg_rating = float(avg_rating_result) if avg_rating_result else 0.0
    avg_response_days = _avg_resolution_days(db)

    # Category distribution
    category_counts = (
        db.query(Complaint.category, func.count(Complaint.id))
        .group_by(Complaint.category)
        .all()
    )
    category_distribution = [
        {"name": cat, "value": count, "color": _category_color(cat)}
        for cat, count in category_counts
    ]

    # Ward heat data
    ward_counts = (
        db.query(Complaint.ward, func.count(Complaint.id))
        .filter(Complaint.status != ComplaintStatus.RESOLVED)
        .group_by(Complaint.ward)
        .order_by(func.count(Complaint.id).desc())
        .all()
    )
    ward_heat_data = [
        {"ward": ward, "complaints": count, "severity": "high" if count > 10 else "medium" if count > 5 else "low"}
        for ward, count in ward_counts
    ]
    worst_ward = ward_heat_data[0]["ward"] if ward_heat_data else "Ward 1"
    worst_ward_count = ward_heat_data[0]["complaints"] if ward_heat_data else 0

    # Top pending complaints as action queue
    urgent_complaints = (
        db.query(Complaint)
        .filter(Complaint.status != ComplaintStatus.RESOLVED)
        .order_by(Complaint.ai_score.desc(), Complaint.created_at.desc())
        .limit(200)
        .all()
    )

    ranked_urgent = []
    for c in urgent_complaints:
        effective_score, effective_priority, starvation_bonus, unresponded_hours = _effective_priority_snapshot(c)
        ranked_urgent.append(
            {
                "complaint": c,
                "effective_score": effective_score,
                "effective_priority": effective_priority,
                "starvation_bonus": starvation_bonus,
                "unresponded_hours": unresponded_hours,
            }
        )

    ranked_urgent.sort(
        key=lambda x: (
            x["effective_score"],
            x["starvation_bonus"],
            x["complaint"].created_at.timestamp() if x["complaint"].created_at else 0.0,
        ),
        reverse=True,
    )

    action_queue = [
        {
            "rank": i + 1,
            "task": row["complaint"].title,
            "category": row["complaint"].category,
            "priority": row["effective_priority"],
            "ticket_id": row["complaint"].ticket_id,
            "effective_score": row["effective_score"],
            "starvation_bonus": row["starvation_bonus"],
            "unresponded_hours": round(row["unresponded_hours"], 1),
        }
        for i, row in enumerate(ranked_urgent[:15])
    ]

    trend_data = _trend_data(db, weeks=8)
    resolution_rate = round((resolved / total * 100) if total > 0 else 0, 1)
    trust_index = _trust_index(resolution_rate, avg_rating, avg_response_days, p0_active)
    all_complaints = db.query(Complaint).order_by(Complaint.created_at.desc()).limit(500).all()
    starvation_watch = civic_intelligence_service.starvation_watch(all_complaints)
    proactive_announcements = civic_intelligence_service.proactive_announcements(all_complaints)
    ward_drives = civic_intelligence_service.ward_drives(all_complaints)
    misinfo_alerts = civic_intelligence_service.misinfo_alerts(all_complaints)
    fact_checks = civic_intelligence_service.fact_checks(all_complaints)
    alerts = _build_alerts(
        total=total,
        resolution_rate=resolution_rate,
        complaints_today=complaints_today,
        resolved_today=resolved_today,
        p0_active=p0_active,
        pending_verification=pending_verification,
        worst_ward=worst_ward,
        worst_ward_count=worst_ward_count,
        starvation_watch=starvation_watch,
    )

    return {
        "total_complaints": total,
        "resolution_rate": resolution_rate,
        "avg_response_days": avg_response_days,
        "satisfaction": round(avg_rating, 1),
        "trust_index": trust_index,
        "complaints_today": complaints_today,
        "resolved_today": resolved_today,
        "p0_active": p0_active,
        "pending_verification": pending_verification,
        "category_distribution": category_distribution,
        "trend_data": trend_data,
        "ward_heat_data": ward_heat_data,
        "alerts": alerts,
        "action_queue": action_queue,
        "starvation_watch": starvation_watch,
        "proactive_announcements": proactive_announcements,
        "ward_drives": ward_drives,
        "misinfo_alerts": misinfo_alerts,
        "fact_checks": fact_checks,
    }


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_leader),
):
    """
    Leader-only operational dashboard data with action queue and alerts.
    """
    return _compose_dashboard_payload(db)


@router.get("/public-analytics")
def get_public_analytics(db: Session = Depends(get_db)):
    """
    Public analytics endpoint used by showcase pages.
    Excludes privileged action metadata while exposing live KPIs.
    """
    payload = _compose_dashboard_payload(db)
    payload["action_queue"] = payload.get("action_queue", [])[:3]
    return payload


@router.get("/intelligence")
def get_civic_intelligence(db: Session = Depends(get_db)):
    """Public intelligence feed: proactive advisories, ward drives, and rumor fact-checks."""
    payload = _compose_dashboard_payload(db)
    return {
        "proactive_announcements": payload.get("proactive_announcements", []),
        "ward_drives": payload.get("ward_drives", []),
        "misinfo_alerts": payload.get("misinfo_alerts", []),
        "fact_checks": payload.get("fact_checks", []),
        "starvation_watch": payload.get("starvation_watch", {}),
    }


@router.get("/social-pulse")
async def get_social_pulse(db: Session = Depends(get_db)):
    """
    🧠 Gemini 2.5 Flash — AI Social Sentiment Intelligence.
    Analyzes complaint patterns to generate social-media-like sentiment report.
    """
    from services.gemini_ai_service import gemini_ai_service

    all_complaints = (
        db.query(Complaint)
        .order_by(Complaint.created_at.desc())
        .limit(100)
        .all()
    )

    complaint_summaries = [
        f"[{c.category or 'General'}] {c.ward or 'Unknown'}: {(c.description or c.title or '')[:120]}"
        for c in all_complaints[:25]
    ]

    total = len(all_complaints)
    resolved = sum(1 for c in all_complaints if c.status == ComplaintStatus.RESOLVED)
    p0 = sum(1 for c in all_complaints if c.priority == PriorityLevel.P0)
    open_count = sum(1 for c in all_complaints if c.status == ComplaintStatus.OPEN)

    ward_stats = {
        "total_complaints": total,
        "resolved": resolved,
        "open": open_count,
        "p0_active": p0,
        "resolution_rate": round((resolved / total * 100) if total > 0 else 0, 1),
    }

    result = await gemini_ai_service.analyze_social_sentiment(
        complaint_summaries=complaint_summaries,
        ward_stats=ward_stats,
    )

    return result


@router.get("/trust-indicators")
def get_trust_indicators(db: Session = Depends(get_db)):
    """
    Public Trust Indicators — 5 trust metrics computed from complaint data.
    """
    total = db.query(Complaint).count()
    resolved = db.query(Complaint).filter(Complaint.status == ComplaintStatus.RESOLVED).count()
    p0_active = db.query(Complaint).filter(
        Complaint.priority == PriorityLevel.P0,
        Complaint.status != ComplaintStatus.RESOLVED,
    ).count()

    avg_rating_result = db.query(func.avg(Complaint.rating)).filter(Complaint.rating.isnot(None)).scalar()
    avg_rating = float(avg_rating_result) if avg_rating_result else 3.5

    avg_response_days = _avg_resolution_days(db)
    resolution_rate = round((resolved / total * 100) if total > 0 else 0, 1)

    # 1. Response Quality (based on authority responses)
    with_response = db.query(Complaint).filter(
        Complaint.authority_response.isnot(None),
    ).count()
    response_quality = round(min(100, (with_response / max(1, total)) * 100 * 1.5), 1)

    # 2. Resolution Speed (inverse of avg days)
    resolution_speed = round(max(0, 100 - (avg_response_days * 10)), 1)

    # 3. Transparency (complaints with updates/feedback)
    with_updates = db.query(Complaint).filter(
        (Complaint.citizen_update.isnot(None)) | (Complaint.leader_note.isnot(None))
    ).count()
    transparency = round(min(100, (with_updates / max(1, total)) * 100 * 2), 1)

    # 4. Citizen Satisfaction (from ratings)
    satisfaction = round(min(100, (avg_rating / 5.0) * 100), 1)

    # 5. Escalation Risk (inverse of P0 ratio)
    p0_ratio = p0_active / max(1, total)
    escalation_risk = round(max(0, 100 - (p0_ratio * 500)), 1)

    # Overall trust score
    overall = round(
        response_quality * 0.20 +
        resolution_speed * 0.20 +
        transparency * 0.15 +
        satisfaction * 0.25 +
        escalation_risk * 0.20,
        1
    )

    return {
        "overall_trust_score": overall,
        "indicators": [
            {"name": "Response Quality", "score": response_quality, "icon": "📋", "color": "#3b82f6"},
            {"name": "Resolution Speed", "score": resolution_speed, "icon": "⚡", "color": "#22c55e"},
            {"name": "Transparency", "score": transparency, "icon": "🔍", "color": "#8b5cf6"},
            {"name": "Citizen Satisfaction", "score": satisfaction, "icon": "😊", "color": "#f59e0b"},
            {"name": "Escalation Risk", "score": escalation_risk, "icon": "🛡️", "color": "#ef4444"},
        ],
        "resolution_rate": resolution_rate,
        "avg_response_days": avg_response_days,
        "total_complaints": total,
        "resolved": resolved,
        "p0_active": p0_active,
    }


@router.post("/governance-intelligence")
async def analyze_governance_intelligence(
    tweets: list[dict] | None = None,
    region: str = "Municipal Region",
    db: Session = Depends(get_db),
):
    """
    🧠 Gemini 2.5 Flash — Full Governance Intelligence Analysis from social media posts.
    Covers: issue detection, sentiment, urgency scoring, viral detection, misinformation check,
    geo-tag inference, actionable insights, AI public responses, and leader summary.
    If no tweets provided, generates simulated tweets from complaint data.
    """
    from services.gemini_ai_service import gemini_ai_service

    if not tweets:
        # Generate simulated tweets from recent complaint data
        recent = (
            db.query(Complaint)
            .order_by(Complaint.created_at.desc())
            .limit(30)
            .all()
        )
        tweets = []
        for i, c in enumerate(recent):
            desc = (c.description or c.title or "civic issue")[:120]
            ward = c.ward or "Unknown"
            cat = c.category or "General"
            tweets.append({
                "text": f"{desc} — problem in {ward} ({cat}) needs urgent attention! @municipalcorp",
                "username": f"citizen_{i+1}",
                "timestamp": (c.created_at.isoformat() if c.created_at else "recent"),
                "location": ward,
            })

    if not tweets:
        return {"success": False, "error": "No social media data available"}

    result = await gemini_ai_service.analyze_governance_intelligence(
        tweets=tweets,
        region=region,
    )

    return result
