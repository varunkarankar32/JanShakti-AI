"""
Auth Router — Signup, Login, role-specific logins, and current user endpoints.
Uses JWT tokens and PBKDF2-SHA256 hashing.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import secrets
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_db
from models.user import User
from config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["Auth"])

security = HTTPBearer(auto_error=False)
PBKDF2_ITERATIONS = 120_000


# --- Schemas ---

class SignupRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthorityCreateRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    role: str


# --- Helpers ---

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    digest_b64 = base64.urlsafe_b64encode(digest).decode("utf-8")
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest_b64}"


def verify_password(plain: str, hashed: str) -> bool:
    try:
        algorithm, iterations, salt, digest_b64 = hashed.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        computed = hashlib.pbkdf2_hmac(
            "sha256",
            plain.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        )
        expected = base64.urlsafe_b64decode(digest_b64.encode("utf-8"))
        return hmac.compare_digest(computed, expected)
    except Exception:
        return False


def create_token(user_id: int, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "email": email, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.is_active is False:
        raise HTTPException(status_code=403, detail="Account is inactive")
    return user


def get_current_leader(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.role or "citizen") != "leader":
        raise HTTPException(status_code=403, detail="Leader access required")
    return current_user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.role or "citizen") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def get_current_authority(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.role or "citizen") != "authority":
        raise HTTPException(status_code=403, detail="Authority access required")
    return current_user


def get_current_leader_or_authority(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role or "citizen"
    if role not in {"leader", "authority"}:
        raise HTTPException(status_code=403, detail="Leader or authority access required")
    return current_user


def _auth_payload(user: User) -> dict:
    return {
        "token": create_token(user.id, user.email, user.role or "citizen"),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role or "citizen",
        },
    }


def _touch_last_login(db: Session, user: User) -> None:
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()


# --- Endpoints ---

@router.post("/signup", response_model=AuthResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    """Register a new citizen account."""
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=req.name,
        email=req.email,
        phone=req.phone,
        role="citizen",
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _auth_payload(user)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    _touch_last_login(db, user)
    return _auth_payload(user)


@router.post("/leader/login", response_model=AuthResponse)
def leader_login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login endpoint that only allows leader accounts."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user or (user.role or "citizen") != "leader" or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid leader credentials")

    _touch_last_login(db, user)
    return _auth_payload(user)


@router.post("/authority/login", response_model=AuthResponse)
def authority_login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login endpoint that only allows authority accounts."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user or (user.role or "citizen") != "authority" or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid authority credentials")

    _touch_last_login(db, user)
    return _auth_payload(user)


@router.post("/admin/login", response_model=AuthResponse)
def admin_login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login endpoint that only allows admin accounts."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user or (user.role or "citizen") != "admin" or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    if user.is_active is False:
        raise HTTPException(status_code=403, detail="Admin account is inactive")

    _touch_last_login(db, user)
    return _auth_payload(user)


@router.post("/authority/create")
def create_authority_user(
    req: AuthorityCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_leader),
):
    """Leader-only endpoint to create authority users."""
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=req.name,
        email=req.email,
        phone=req.phone,
        role="authority",
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
    }


@router.get("/authority/list")
def list_authority_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_leader),
):
    """Leader-only endpoint to list all authority accounts."""
    rows = (
        db.query(User)
        .filter(User.role == "authority")
        .order_by(User.name.asc())
        .all()
    )

    return {
        "count": len(rows),
        "authorities": [
            {
                "id": row.id,
                "name": row.name,
                "email": row.email,
                "phone": row.phone,
                "role": row.role,
            }
            for row in rows
        ],
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role or "citizen",
    }
