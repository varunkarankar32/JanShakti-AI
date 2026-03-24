from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from database import Base


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    advisory_type = Column(String, nullable=False, default="public_notice")
    priority = Column(String, nullable=False, default="medium")
    ward = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    cta_text = Column(String, nullable=True)
    cta_link = Column(String, nullable=True)
    is_published = Column(Boolean, nullable=False, default=True)
    created_by_user_id = Column(Integer, nullable=True)
    created_by_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
