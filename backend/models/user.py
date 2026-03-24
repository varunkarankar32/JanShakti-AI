from sqlalchemy import Boolean, Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    state = Column(String, nullable=True)
    district = Column(String, nullable=True)
    role = Column(String, nullable=False, default="citizen", server_default="citizen")
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default="1")
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
