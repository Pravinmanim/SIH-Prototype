from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base
from app.models.base import TimestampMixin

class Institution(Base, TimestampMixin):
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    aicte_id = Column(String(100), unique=True, index=True, nullable=True)
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)

    users = relationship("User", back_populates="institution", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="institution", cascade="all, delete-orphan")
    students = relationship("Student", back_populates="institution", cascade="all, delete-orphan")
    intake_configs = relationship("IntakeConfiguration", back_populates="institution", cascade="all, delete-orphan")

