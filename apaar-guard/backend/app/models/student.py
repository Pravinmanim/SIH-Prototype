from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Student(Base, TimestampMixin):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="RESTRICT"), nullable=True, index=True)
    
    # Critical: APAAR ID stored as string to preserve leading zeros
    apaar_id = Column(String(50), nullable=True, index=True)
    roll_number = Column(String(100), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(String(20), nullable=True)  # YYYY-MM-DD
    gender = Column(String(20), nullable=True)
    admission_year = Column(Integer, nullable=False, index=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    
    # Validation status (ONLY 3 values: 'Ready', 'Invalid Data', 'Needs Review')
    status = Column(String(50), default="Needs Review", nullable=False, index=True)
    
    # Concurrency control: optimistic locking version counter
    version = Column(Integer, default=1, nullable=False)

    # Soft archive
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    archived_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_students_inst_roll", "institution_id", "roll_number"),
        Index("ix_students_inst_status", "institution_id", "status"),
        Index("ix_students_inst_apaar", "institution_id", "apaar_id"),
        Index("ix_students_inst_year_course", "institution_id", "admission_year", "course_id"),
    )

    institution = relationship("Institution", back_populates="students")
    course = relationship("Course", back_populates="students")
    validation_results = relationship("ValidationResult", back_populates="student", cascade="all, delete-orphan")
    review_cases = relationship("ReviewCase", back_populates="student", cascade="all, delete-orphan")
