"""
Admin Router
God-mode onboarding and identity management for leader/authority accounts.
"""

from datetime import datetime, timezone
from typing import List, Optional
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from routers.auth import get_current_admin, hash_password

router = APIRouter(prefix="/admin", tags=["Admin"])

ALLOWED_ROLES = {"authority", "leader", "admin", "citizen"}
ONBOARD_ROLES = {"authority", "leader", "admin"}


class UserCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=5, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=32)
    state: str = Field(..., min_length=2, max_length=120)
    district: str = Field(..., min_length=2, max_length=120)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(..., description="authority|leader|admin")


class BulkUserCreateRequest(BaseModel):
    users: List[UserCreateRequest] = Field(default_factory=list, max_length=250)


class UpdateRoleRequest(BaseModel):
    role: str = Field(..., description="authority|leader|admin|citizen")


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class ActivationRequest(BaseModel):
    is_active: bool


def _normalized_email(raw: str) -> str:
    email = (raw or "").strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    return email


def _serialize_user(row: User) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "email": row.email,
        "phone": row.phone,
        "state": row.state,
        "district": row.district,
        "role": row.role or "citizen",
        "is_active": bool(row.is_active if row.is_active is not None else True),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "last_login_at": row.last_login_at.isoformat() if row.last_login_at else None,
    }


@router.get("/onboarding/stats")
def onboarding_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active.isnot(False)).scalar() or 0

    role_rows = (
        db.query(User.role, func.count(User.id))
        .group_by(User.role)
        .all()
    )

    role_counts = {"citizen": 0, "authority": 0, "leader": 0, "admin": 0}
    for role, count in role_rows:
        normalized = (role or "citizen").strip().lower()
        role_counts[normalized] = int(count)

    recent = (
        db.query(User)
        .order_by(User.created_at.desc())
        .limit(8)
        .all()
    )

    return {
        "total_users": int(total_users),
        "active_users": int(active_users),
        "inactive_users": int(total_users) - int(active_users),
        "role_counts": role_counts,
        "recent_onboarded": [_serialize_user(u) for u in recent],
    }


@router.get("/users")
def list_users(
    role: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=120, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    query = db.query(User)

    if role:
        normalized_role = role.strip().lower()
        if normalized_role not in ALLOWED_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
        query = query.filter(func.lower(User.role) == normalized_role)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
                User.phone.ilike(pattern),
                User.role.ilike(pattern),
            )
        )

    rows = query.order_by(User.created_at.desc()).limit(limit).all()

    return {
        "count": len(rows),
        "users": [_serialize_user(row) for row in rows],
    }


@router.post("/users/create")
def create_user(
    req: UserCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    requested_role = req.role.strip().lower()
    if requested_role not in ONBOARD_ROLES:
        raise HTTPException(status_code=400, detail="Role must be authority, leader, or admin")

    email = _normalized_email(req.email)
    existing = db.query(User).filter(func.lower(User.email) == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=req.name.strip(),
        email=email,
        phone=(req.phone or "").strip() or None,
        state=req.state.strip(),
        district=req.district.strip(),
        role=requested_role,
        hashed_password=hash_password(req.password),
        is_active=True,
        last_login_at=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": f"{requested_role.title()} onboarded successfully by {admin.name}.",
        "user": _serialize_user(user),
    }


@router.post("/users/bulk-create")
def bulk_create_users(
    req: BulkUserCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if not req.users:
        raise HTTPException(status_code=400, detail="No users provided")

    created = []
    skipped = []

    for item in req.users:
        role = item.role.strip().lower()
        if role not in ONBOARD_ROLES:
            skipped.append({"email": item.email, "reason": f"invalid_role:{role}"})
            continue

        try:
            email = _normalized_email(item.email)
        except HTTPException as exc:
            skipped.append({"email": item.email, "reason": f"invalid_email:{exc.detail}"})
            continue

        exists = db.query(User).filter(func.lower(User.email) == email).first()
        if exists:
            skipped.append({"email": item.email, "reason": "email_exists"})
            continue

        user = User(
            name=item.name.strip(),
            email=email,
            phone=(item.phone or "").strip() or None,
            state=item.state.strip(),
            district=item.district.strip(),
            role=role,
            hashed_password=hash_password(item.password),
            is_active=True,
        )
        db.add(user)
        created.append(user)

    db.commit()

    for user in created:
        db.refresh(user)

    return {
        "message": f"Bulk onboarding complete by {admin.name}.",
        "created_count": len(created),
        "skipped_count": len(skipped),
        "created": [_serialize_user(user) for user in created],
        "skipped": skipped,
    }


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    req: UpdateRoleRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    new_role = req.role.strip().lower()
    if new_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id and new_role != "admin":
        raise HTTPException(status_code=400, detail="Admin cannot demote own account")

    user.role = new_role
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": f"Role updated to {new_role}",
        "user": _serialize_user(user),
    }


@router.patch("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    req: ResetPasswordRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(req.new_password)
    user.last_login_at = None
    db.add(user)
    db.commit()

    return {"message": "Password reset completed"}


@router.patch("/users/{user_id}/activation")
def set_user_activation(
    user_id: int,
    req: ActivationRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id and not req.is_active:
        raise HTTPException(status_code=400, detail="Admin cannot deactivate own account")

    user.is_active = bool(req.is_active)
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": f"User {'activated' if req.is_active else 'deactivated'}",
        "user": _serialize_user(user),
    }
