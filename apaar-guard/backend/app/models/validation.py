from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class ValidationResult(Base):
    __tablename__ = "validation_results"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(String(50), nullable=False, index=True)
    rule_name = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)  # 'error', 'warning', 'info'
    status = Column(String(20), nullable=False)    # 'passed', 'failed'
    message = Column(Text, nullable=False)
    affected_field = Column(String(100), nullable=True)
    suggested_action = Column(Text, nullable=True)
    rule_version = Column(String(20), default="1.0", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    student = relationship("Student", back_populates="validation_results")

