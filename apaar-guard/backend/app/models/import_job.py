from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class ImportJob(Base):
    __tablename__ = "import_jobs"

    id = Column(String(50), primary_key=True, default=generate_uuid, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    filename = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)
    mapping_hash = Column(String(64), nullable=True, index=True)
    
    total_rows = Column(Integer, default=0, nullable=False)
    processed_rows = Column(Integer, default=0, nullable=False)
    created_rows = Column(Integer, default=0, nullable=False)
    updated_rows = Column(Integer, default=0, nullable=False)
    skipped_rows = Column(Integer, default=0, nullable=False)
    invalid_rows = Column(Integer, default=0, nullable=False)
    review_rows = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending, validating, completed, failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    errors = relationship("ImportJobError", back_populates="import_job", cascade="all, delete-orphan")
    user = relationship("User")

class ImportJobError(Base):
    __tablename__ = "import_job_errors"

    id = Column(Integer, primary_key=True, index=True)
    import_job_id = Column(String(50), ForeignKey("import_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    row_index = Column(Integer, nullable=False)
    field_name = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=False)
    raw_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    import_job = relationship("ImportJob", back_populates="errors")
