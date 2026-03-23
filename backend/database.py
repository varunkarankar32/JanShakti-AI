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
)

logger = logging.getLogger(__name__)

IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine_kwargs = {"pool_pre_ping": True}
if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL-specific: fast connection timeout + pool recycling
    engine_kwargs["connect_args"] = {"connect_timeout": 10}
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_user_role_column():
    # Lightweight migration for existing SQLite DBs created before role support.
    if not IS_SQLITE:
        return

    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result.fetchall()]
        if "role" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'citizen'"))
            conn.commit()


def _ensure_complaint_workflow_columns():
    # Lightweight migration for existing SQLite DBs before workflow fields.
    if not IS_SQLITE:
        return

    required_columns = {
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


def init_db():
    """Initialize database tables on startup.
    Catches connection errors so the app can still start even if the DB
    is temporarily unavailable (e.g. Supabase project paused).
    """
    try:
        Base.metadata.create_all(bind=engine)
        if IS_SQLITE:
            _ensure_user_role_column()
            _ensure_complaint_workflow_columns()
        _seed_default_leader()
        _seed_default_authority()
        logger.info("[DB] Database initialized successfully")
    except OperationalError as exc:
        logger.error(
            "[DB] ⚠️  Could not connect to database — the app will start but "
            "database-dependent endpoints will fail until connectivity is restored.\n"
            "    Error: %s",
            exc,
        )
    except Exception as exc:
        logger.error("[DB] Unexpected error during init: %s", exc)
