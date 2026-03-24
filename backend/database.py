import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.exc import OperationalError
from config import (
    DATABASE_URL,
    DEFAULT_LEADER_NAME,
    DEFAULT_LEADER_EMAIL,
    DEFAULT_LEADER_PASSWORD,
    DEFAULT_AUTHORITY_NAME,
    DEFAULT_AUTHORITY_EMAIL,
    DEFAULT_AUTHORITY_PASSWORD,
    DEFAULT_ADMIN_NAME,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
)

logger = logging.getLogger(__name__)

FALLBACK_SQLITE_URL = "sqlite:///./janshakti.db"


def _build_engine(url: str):
    """Create a SQLAlchemy engine for the given URL."""
    is_sqlite = url.startswith("sqlite")
    kwargs = {"pool_pre_ping": True}
    if is_sqlite:
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["connect_args"] = {"connect_timeout": 10}
        kwargs["pool_recycle"] = 300
        kwargs["pool_size"] = 5
        kwargs["max_overflow"] = 10
    return create_engine(url, **kwargs), is_sqlite


# --- Build initial engine ---------------------------------------------------
_active_url = DATABASE_URL
engine, IS_SQLITE = _build_engine(_active_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def _switch_to_sqlite():
    """Fall back to a local SQLite database when PostgreSQL is unreachable."""
    global engine, SessionLocal, IS_SQLITE, _active_url  # noqa: PLW0603
    print("[DB] ⚠️  PostgreSQL unreachable — falling back to local SQLite database")
    _active_url = FALLBACK_SQLITE_URL
    engine, IS_SQLITE = _build_engine(FALLBACK_SQLITE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_user_columns_sqlite():
    if not IS_SQLITE:
        return
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result.fetchall()]
        if "state" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN state VARCHAR"))
        if "district" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN district VARCHAR"))
        if "role" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'citizen'"))
        if "is_active" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))
        if "last_login_at" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))
            conn.commit()


def _ensure_user_columns_postgres():
    if IS_SQLITE:
        return

    required_columns = {
        "state": "VARCHAR",
        "district": "VARCHAR",
        "role": "VARCHAR NOT NULL DEFAULT 'citizen'",
        "is_active": "BOOLEAN NOT NULL DEFAULT TRUE",
        "last_login_at": "TIMESTAMP WITH TIME ZONE",
    }

    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'users'"
        ))
        existing = {row[0] for row in result.fetchall()}

        for name, col_type in required_columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {col_type}"))
                print(f"[DB] Added missing column: users.{name}")

        conn.commit()


def _ensure_complaint_workflow_columns():
    if not IS_SQLITE:
        return

    required_columns = {
        "ai_risk_score": "FLOAT",
        "ai_risk_level": "VARCHAR",
        "ai_risk_factors": "TEXT",
        "ai_risk_reasoning": "TEXT",
        "ai_leader_brief": "TEXT",
        "citizen_user_id": "INTEGER",
        "citizen_language": "VARCHAR",
        "image_path": "VARCHAR",
        "audio_path": "VARCHAR",
        "assigned_authority": "VARCHAR",
        "authority_email": "VARCHAR",
        "leader_note": "TEXT",
        "authority_response": "TEXT",
        "citizen_update": "TEXT",
        "ai_breakdown": "TEXT",
        "ai_explanation": "TEXT",
        "ai_model_version": "VARCHAR",
        "before_meta": "TEXT",
        "after_meta": "TEXT",
        "verification_score": "FLOAT",
        "verification_confidence": "FLOAT",
    }

    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(complaints)"))
        columns = [row[1] for row in result.fetchall()]

        for name, col_type in required_columns.items():
            if name not in columns:
                conn.execute(text(f"ALTER TABLE complaints ADD COLUMN {name} {col_type}"))

        conn.commit()


def _seed_default_leader():
    from models.user import User
    from routers.auth import hash_password

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == DEFAULT_LEADER_EMAIL).first()
        if existing:
            if existing.role != "leader":
                existing.role = "leader"
                db.commit()
            return

        leader = User(
            name=DEFAULT_LEADER_NAME,
            email=DEFAULT_LEADER_EMAIL,
            phone=None,
            role="leader",
            hashed_password=hash_password(DEFAULT_LEADER_PASSWORD),
        )
        db.add(leader)
        db.commit()
        print(f"[Auth] Default leader ready: {DEFAULT_LEADER_EMAIL}")
    finally:
        db.close()


def _seed_default_authority():
    from models.user import User
    from routers.auth import hash_password

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == DEFAULT_AUTHORITY_EMAIL).first()
        if existing:
            if existing.role != "authority":
                existing.role = "authority"
                db.commit()
            return

        authority = User(
            name=DEFAULT_AUTHORITY_NAME,
            email=DEFAULT_AUTHORITY_EMAIL,
            phone=None,
            role="authority",
            hashed_password=hash_password(DEFAULT_AUTHORITY_PASSWORD),
        )
        db.add(authority)
        db.commit()
        print(f"[Auth] Default authority ready: {DEFAULT_AUTHORITY_EMAIL}")
    finally:
        db.close()


def _seed_default_admin():
    from models.user import User
    from routers.auth import hash_password

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == DEFAULT_ADMIN_EMAIL).first()
        if existing:
            changed = False
            if existing.role != "admin":
                existing.role = "admin"
                changed = True
            if existing.is_active is False:
                existing.is_active = True
                changed = True
            if changed:
                db.commit()
            return

        admin = User(
            name=DEFAULT_ADMIN_NAME,
            email=DEFAULT_ADMIN_EMAIL,
            phone=None,
            role="admin",
            hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[Auth] Default admin ready: {DEFAULT_ADMIN_EMAIL}")
    finally:
        db.close()


def init_db():
    """Initialize database tables. If PostgreSQL is unreachable,
    automatically fall back to a local SQLite database so the app
    can still start and serve requests."""
    try:
        Base.metadata.create_all(bind=engine)
    except (OperationalError, Exception) as exc:
        if not IS_SQLITE:
            print(f"[DB] PostgreSQL connection failed: {exc}")
            _switch_to_sqlite()
            # Retry with SQLite
            Base.metadata.create_all(bind=engine)
        else:
            raise

    try:
        if IS_SQLITE:
            _ensure_user_columns_sqlite()
            _ensure_complaint_workflow_columns()
        else:
            _ensure_user_columns_postgres()
            _ensure_pg_complaint_columns()
        _seed_default_admin()
        _seed_default_leader()
        _seed_default_authority()
        print(f"[DB] ✅ Database initialized successfully (using {'SQLite' if IS_SQLITE else 'PostgreSQL'})")
    except Exception as exc:
        print(f"[DB] Warning — seeding/migration issue (non-fatal): {exc}")


def _ensure_pg_complaint_columns():
    """Add any missing columns to the complaints table in PostgreSQL."""
    required_columns = {
        "ai_risk_score": "FLOAT",
        "ai_risk_level": "VARCHAR",
        "ai_risk_factors": "TEXT",
        "ai_risk_reasoning": "TEXT",
        "ai_leader_brief": "TEXT",
        "citizen_language": "VARCHAR",
        "image_path": "VARCHAR",
        "audio_path": "VARCHAR",
        "assigned_authority": "VARCHAR",
        "authority_email": "VARCHAR",
        "leader_note": "TEXT",
        "authority_response": "TEXT",
        "citizen_update": "TEXT",
        "ai_breakdown": "TEXT",
        "ai_explanation": "TEXT",
        "ai_model_version": "VARCHAR",
        "before_meta": "TEXT",
        "after_meta": "TEXT",
        "verification_score": "FLOAT",
        "verification_confidence": "FLOAT",
    }

    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'complaints'"
        ))
        existing = {row[0] for row in result.fetchall()}

        for name, col_type in required_columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE complaints ADD COLUMN {name} {col_type}"))
                print(f"[DB] Added missing column: complaints.{name}")

        conn.commit()

