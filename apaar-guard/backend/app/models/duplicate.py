from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class DuplicateAlert(Base, TimestampMixin):
    __tablename__ = "duplicate_alerts"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id_1 = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id_2 = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False)  # 'exact_apaar', 'roll_number', 'possible_match'
    matching_fields = Column(Text, nullable=False)  # JSON string of matching fields
    similarity_score = Column(Float, default=1.0, nullable=False)
    status = Column(String(50), default="open", nullable=False)  # 'open', 'resolved', 'false_positive'
    resolution_notes = Column(Text, nullable=True)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    student_1 = relationship("Student", foreign_keys=[student_id_1])
    student_2 = relationship("Student", foreign_keys=[student_id_2])
    resolved_by = relationship("User", foreign_keys=[resolved_by_user_id])

