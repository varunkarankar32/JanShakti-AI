from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import DATABASE_URL, DEFAULT_LEADER_NAME, DEFAULT_LEADER_EMAIL, DEFAULT_LEADER_PASSWORD

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
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
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result.fetchall()]
        if "role" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'citizen'"))
            conn.commit()


def _ensure_complaint_workflow_columns():
    # Lightweight migration for existing SQLite DBs before workflow fields.
    required_columns = {
        "citizen_user_id": "INTEGER",
        "assigned_authority": "VARCHAR",
        "authority_email": "VARCHAR",
        "leader_note": "TEXT",
        "authority_response": "TEXT",
        "citizen_update": "TEXT",
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


def init_db():
    Base.metadata.create_all(bind=engine)
    _ensure_user_role_column()
    _ensure_complaint_workflow_columns()
    _seed_default_leader()
