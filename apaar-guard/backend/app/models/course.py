from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Course(Base, TimestampMixin):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    department = Column(String(255), nullable=True)
    duration_years = Column(Integer, default=4, nullable=False)

    __table_args__ = (
        UniqueConstraint("institution_id", "code", name="uq_institution_course_code"),
    )

    institution = relationship("Institution", back_populates="courses")
    students = relationship("Student", back_populates="course")
    intake_configs = relationship("IntakeConfiguration", back_populates="course", cascade="all, delete-orphan")

