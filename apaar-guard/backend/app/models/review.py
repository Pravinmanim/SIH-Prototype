from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base
from app.models.base import TimestampMixin

# Allowed state machine transitions
ALLOWED_CASE_TRANSITIONS = {
    "Pending Review": ["In Progress", "Correction Requested", "Resolved", "False Positive"],
    "In Progress": ["Correction Requested", "Resolved", "False Positive"],
    "Correction Requested": ["In Progress", "Resolved"],
    "Resolved": ["Pending Review"],
    "False Positive": ["Pending Review"],
}

class ReviewCase(Base, TimestampMixin):
    __tablename__ = "review_cases"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    duplicate_alert_id = Column(Integer, ForeignKey("duplicate_alerts.id", ondelete="SET NULL"), nullable=True)
    
    # Hash fingerprint: hash(rule_id + student_id + normalized field values)
    fingerprint = Column(String(64), nullable=False, index=True)
    reopened_from_id = Column(Integer, ForeignKey("review_cases.id", ondelete="SET NULL"), nullable=True)

    reason = Column(String(255), nullable=False)
    severity = Column(String(20), default="medium", nullable=False)  # critical, high, medium, low
    
    # Status: 'Pending Review', 'In Progress', 'Correction Requested', 'Resolved', 'False Positive'
    status = Column(String(50), default="Pending Review", nullable=False, index=True)
    
    assigned_to_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_summary = Column(Text, nullable=True)

    student = relationship("Student", back_populates="review_cases")
    duplicate_alert = relationship("DuplicateAlert")
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_user_id])
    notes = relationship("ReviewNote", back_populates="review_case", cascade="all, delete-orphan", order_by="desc(ReviewNote.created_at)")
    reopened_from = relationship("ReviewCase", remote_side=[id], foreign_keys=[reopened_from_id])

class ReviewNote(Base):
    __tablename__ = "review_notes"

    id = Column(Integer, primary_key=True, index=True)
    review_case_id = Column(Integer, ForeignKey("review_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note_text = Column(Text, nullable=False)
    action_taken = Column(String(50), nullable=False)  # 'note_added', 'correction_requested', 'issue_confirmed', 'false_positive', 'resolved', 'reopened'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    review_case = relationship("ReviewCase", back_populates="notes")
    author = relationship("User")
