"""
Announcements Router — Leader advisories and public notices for homepage display.
"""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.announcement import Announcement
from models.user import User
from routers.auth import get_current_leader

router = APIRouter(prefix="/announcements", tags=["Announcements"])


class AnnouncementCreateRequest(BaseModel):
    title: str
    message: str
    advisory_type: str = "public_notice"
    priority: str = "medium"
    ward: Optional[str] = None
    image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    publish_now: bool = True


def _default_announcements():
    return [
        {
            "title": "Heatwave Advisory: Stay Hydrated",
            "message": "Temperatures are expected to cross 42C this week. Avoid afternoon outdoor exposure,"
            " use ORS, and check in on elderly neighbors.",
            "advisory_type": "public_health",
            "priority": "high",
            "ward": "All Wards",
            "image_url": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
            "cta_text": "View Heat Safety Tips",
            "cta_link": "https://www.ndma.gov.in/Natural-Hazards/Heat-Wave",
        },
        {
            "title": "Monsoon Drain Clearance Drive",
            "message": "Pre-monsoon desilting and drain cleaning starts from Monday. Please avoid dumping solid waste in roadside drains.",
            "advisory_type": "infrastructure",
            "priority": "medium",
            "ward": "All Wards",
            "image_url": "https://images.unsplash.com/photo-1502303756762-a8d7dca6f96d?auto=format&fit=crop&w=1200&q=80",
            "cta_text": "See Ward Schedule",
            "cta_link": "https://urbanindia.gov.in/",
        },
        {
            "title": "Rumor Alert: Water Supply Not Discontinued",
            "message": "A viral message claiming complete water shutdown is false. Routine supply remains active."
            " Report misinformation through the citizen portal.",
            "advisory_type": "fact_check",
            "priority": "high",
            "ward": "All Wards",
            "image_url": "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80",
            "cta_text": "Report Misinformation",
            "cta_link": "/citizen",
        },
        {
            "title": "Citizen Advice: Emergency Escalation",
            "message": "If an issue involves fire, gas leak, electrocution, or flooding risk, mention 'emergency' in the complaint title for immediate triage.",
            "advisory_type": "advice",
            "priority": "medium",
            "ward": "All Wards",
            "image_url": "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=1200&q=80",
            "cta_text": "File Emergency Complaint",
            "cta_link": "/citizen",
        },
    ]


def _serialize(row: Announcement):
    return {
        "id": row.id,
        "title": row.title,
        "message": row.message,
        "advisory_type": row.advisory_type,
        "priority": row.priority,
        "ward": row.ward,
        "image_url": row.image_url,
        "cta_text": row.cta_text,
        "cta_link": row.cta_link,
        "is_published": bool(row.is_published),
        "created_by_name": row.created_by_name,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _seed_defaults_if_empty(db: Session):
    existing = db.query(Announcement).count()
    if existing > 0:
        return

    for item in _default_announcements():
        db.add(
            Announcement(
                title=item["title"],
                message=item["message"],
                advisory_type=item["advisory_type"],
                priority=item["priority"],
                ward=item.get("ward"),
                image_url=item.get("image_url"),
                cta_text=item.get("cta_text"),
                cta_link=item.get("cta_link"),
                is_published=True,
                created_by_name="System Advisory Desk",
            )
        )
    db.commit()


@router.get("/public")
def list_public_announcements(limit: int = 6, db: Session = Depends(get_db)):
    _seed_defaults_if_empty(db)

    rows = (
        db.query(Announcement)
        .filter(Announcement.is_published.is_(True))
        .order_by(Announcement.created_at.desc())
        .limit(max(1, min(limit, 20)))
        .all()
    )
    return {"announcements": [_serialize(row) for row in rows]}


@router.get("/leader/manage")
def list_leader_announcements(
    limit: int = 30,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_leader),
):
    _seed_defaults_if_empty(db)

    rows = (
        db.query(Announcement)
        .order_by(Announcement.created_at.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )
    return {"announcements": [_serialize(row) for row in rows]}


@router.post("")
def create_announcement(
    req: AnnouncementCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_leader),
):
    row = Announcement(
        title=req.title.strip(),
        message=req.message.strip(),
        advisory_type=req.advisory_type.strip() or "public_notice",
        priority=req.priority.strip() or "medium",
        ward=req.ward.strip() if req.ward else None,
        image_url=req.image_url.strip() if req.image_url else None,
        cta_text=req.cta_text.strip() if req.cta_text else None,
        cta_link=req.cta_link.strip() if req.cta_link else None,
        is_published=bool(req.publish_now),
        created_by_user_id=current_user.id,
        created_by_name=current_user.name,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)
