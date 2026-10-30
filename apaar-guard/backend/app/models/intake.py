from sqlalchemy import Column, Integer, String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class IntakeConfiguration(Base, TimestampMixin):
    __tablename__ = "intake_configurations"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_year = Column(Integer, nullable=False, index=True)
    approved_intake = Column(Integer, nullable=False)
    supernumerary_intake = Column(Integer, default=0, nullable=False)
    source = Column(String(255), default="Entered by institution admin", nullable=False)
    notes = Column(Text, nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("institution_id", "course_id", "academic_year", name="uq_inst_course_year_intake"),
    )

    institution = relationship("Institution", back_populates="intake_configs")
    course = relationship("Course", back_populates="intake_configs")
    updated_by = relationship("User", foreign_keys=[updated_by_user_id])
