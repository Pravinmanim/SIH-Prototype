from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List
from pydantic import BaseModel, Field, field_validator

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.course import Course
from app.models.student import Student
from app.models.intake import IntakeConfiguration
from app.services.validation.engine import compute_aggregate_intake_alerts
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/intake", tags=["Intake Monitoring"])

class IntakeUpdateRequest(BaseModel):
    course_id: int
    academic_year: int
    approved_intake: int
    notes: str = ""
    source: str = "Entered by institution admin"

    @field_validator("course_id")
    @classmethod
    def validate_course_id(cls, v):
        if not v or v < 1:
            raise ValueError("Select a valid course.")
        return v

    @field_validator("academic_year")
    @classmethod
    def validate_academic_year(cls, v):
        if v < 2000 or v > 2030:
            raise ValueError("Select a valid academic year.")
        return v

    @field_validator("approved_intake")
    @classmethod
    def validate_approved_intake(cls, v):
        if v is None or not isinstance(v, int) or v < 1:
            raise ValueError("Enter a valid whole-number intake capacity.")
        return v

@router.get("")
def list_intake_monitoring(
    academic_year: int = 2026,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inst_id = current_user.institution_id

    courses = db.query(Course).filter(Course.institution_id == inst_id).order_by(Course.code).all()
    intakes = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.institution_id == inst_id,
        IntakeConfiguration.academic_year == academic_year
    ).all()
    intake_by_course = {i.course_id: i for i in intakes}

    # Fast group-by aggregate query
    counts_rows = db.query(Student.course_id, func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.admission_year == academic_year,
        Student.is_archived == False
    ).group_by(Student.course_id).all()
    student_counts = {cid: cnt for cid, cnt in counts_rows}

    total_enrolled = sum(student_counts.values())

    rows = []
    total_approved = 0

    for c in courses:
        config = intake_by_course.get(c.id)
        enrolled = student_counts.get(c.id, 0)
        approved = config.approved_intake if config else 0
        total_approved += approved

        if not config or approved <= 0:
            status_label = "Configuration Missing"
            utilization = 0.0
            remaining = 0
        else:
            remaining = approved - enrolled
            utilization = round((enrolled / approved * 100.0), 1)
            if enrolled > approved:
                status_label = "Exceeds Capacity"
            elif utilization >= 90.0:
                status_label = "Near Capacity"
            else:
                status_label = "Within Capacity"

        rows.append({
            "course_id": c.id,
            "course_code": c.code,
            "course_name": c.name,
            "academic_year": academic_year,
            "approved_intake": approved,
            "current_count": enrolled,
            "remaining_capacity": remaining,
            "utilization_percent": utilization,
            "status": status_label,
            "missing_alert": "Intake configuration is missing. Configure the capacity to calculate utilization." if (not config or approved <= 0) else None,
            "has_config": bool(config),
            "source": config.source if config else "None",
            "notes": config.notes if config else None,
            "updated_at": config.updated_at.isoformat() if config and config.updated_at else None
        })

    overall_util = round((total_enrolled / total_approved * 100.0), 1) if total_approved > 0 else 0.0
    aggregate_alerts = compute_aggregate_intake_alerts(db, inst_id, academic_year)

    return {
        "institution_id": inst_id,
        "academic_year": academic_year,
        "total_approved_intake": total_approved,
        "total_enrolled_students": total_enrolled,
        "overall_utilization": overall_util,
        "items": rows,
        "aggregate_alerts": aggregate_alerts,
        "disclaimer": "Locally configured value, not official AICTE data."
    }

@router.post("")
def set_course_intake(
    req: IntakeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    course = db.query(Course).filter(
        Course.id == req.course_id,
        Course.institution_id == current_user.institution_id
    ).first()
    if not course:
        raise HTTPException(status_code=400, detail="Select a valid course.")

    config = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.institution_id == current_user.institution_id,
        IntakeConfiguration.course_id == req.course_id,
        IntakeConfiguration.academic_year == req.academic_year
    ).first()

    old_val = config.approved_intake if config else None

    if config:
        config.approved_intake = req.approved_intake
        config.notes = req.notes
        config.source = req.source or "Entered by institution admin"
        config.updated_by_user_id = current_user.id
    else:
        config = IntakeConfiguration(
            institution_id=current_user.institution_id,
            course_id=req.course_id,
            academic_year=req.academic_year,
            approved_intake=req.approved_intake,
            source=req.source or "Entered by institution admin",
            notes=req.notes,
            updated_by_user_id=current_user.id
        )
        db.add(config)

    db.commit()
    db.refresh(config)

    record_audit_log(
        db=db,
        action="INTAKE_CONFIG_UPDATED",
        target_type="INTAKE_CONFIGURATION",
        target_id=str(config.id),
        outcome="SUCCESS",
        details={
            "course": course.code,
            "year": req.academic_year,
            "previous_intake": old_val,
            "new_intake": req.approved_intake,
            "source": config.source
        },
        user=current_user
    )

    return {
        "message": f"Approved intake for {course.code} ({req.academic_year}) set to {req.approved_intake}.",
        "config_id": config.id,
        "approved_intake": config.approved_intake,
        "source": config.source
    }
