from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from datetime import datetime, timezone
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_name = Column(String(255), nullable=False)
    actor_role = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False, index=True)
    target_type = Column(String(100), nullable=False)
    target_id = Column(String(100), nullable=True)
    outcome = Column(String(20), default="SUCCESS", nullable=False)  # SUCCESS, FAILURE
    details = Column(Text, nullable=True)  # JSON string or structured summary (masked, no passwords or full APAARs)
    ip_address = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

