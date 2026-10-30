from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class StudentConsent(Base):
    __tablename__ = "student_consents"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Explicit status: 'not_recorded', 'granted', 'withdrawn'
    status = Column(String(50), default="not_recorded", nullable=False, index=True)
    
    # Workflow designation: staff-recorded workflow vs student direct
    consent_type = Column(String(50), default="staff_recorded", nullable=False)
    notice_version = Column(String(50), default="v1.0", nullable=False)
    notes = Column(String(500), nullable=True)
    
    # Actor who recorded the status
    recorded_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    recorded_by_name = Column(String(255), nullable=True)
    recorded_by_role = Column(String(50), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_student_consents_inst_status", "institution_id", "status"),
    )

    student = relationship("Student", back_populates="consent")
    institution = relationship("Institution")
    recorded_by = relationship("User")
    events = relationship("StudentConsentEvent", back_populates="consent", cascade="all, delete-orphan", order_by="desc(StudentConsentEvent.id)")


class StudentConsentEvent(Base):
    __tablename__ = "student_consent_events"

    id = Column(Integer, primary_key=True, index=True)
    consent_id = Column(Integer, ForeignKey("student_consents.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)  # 'RECORDED', 'WITHDRAWN'
    consent_type = Column(String(50), default="staff_recorded", nullable=False)
    notice_version = Column(String(50), default="v1.0", nullable=False)
    notes = Column(String(500), nullable=True)
    
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(255), nullable=True)
    actor_role = Column(String(50), nullable=True)
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    __table_args__ = (
        Index("ix_consent_events_student", "student_id", "timestamp"),
        Index("ix_consent_events_institution", "institution_id", "timestamp"),
    )

    consent = relationship("StudentConsent", back_populates="events")
