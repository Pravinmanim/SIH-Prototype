from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, field_validator

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_officer_or_admin
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
    supernumerary_intake: Optional[int] = 0
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

    @field_validator("supernumerary_intake")
    @classmethod
    def validate_supernumerary_intake(cls, v):
        if v is not None:
            if not isinstance(v, int) or v < 0:
                raise ValueError("Enter a valid non-negative whole number for supernumerary intake.")
        return v or 0

@router.get("")
def list_intake_monitoring(
    academic_year: int = 2026,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer_or_admin)
):
    inst_id = current_user.institution_id

    courses = db.query(Course).filter(Course.institution_id == inst_id).order_by(Course.code).all()
    intakes = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.institution_id == inst_id,
        IntakeConfiguration.academic_year == academic_year
    ).all()
    intake_by_course = {i.course_id: i for i in intakes}

    # 1. Total counts by course
    counts_rows = db.query(Student.course_id, func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.admission_year == academic_year,
        Student.is_archived == False
    ).group_by(Student.course_id).all()
    total_counts_by_course = {cid: cnt for cid, cnt in counts_rows}

    # 2. Supernumerary vs Regular counts by course
    super_rows = db.query(Student.course_id, Student.is_supernumerary, func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.admission_year == academic_year,
        Student.is_archived == False
    ).group_by(Student.course_id, Student.is_supernumerary).all()

    regular_counts_by_course = {}
    super_counts_by_course = {}
    for cid, is_sup, cnt in super_rows:
        if is_sup:
            super_counts_by_course[cid] = super_counts_by_course.get(cid, 0) + cnt
        else:
            regular_counts_by_course[cid] = regular_counts_by_course.get(cid, 0) + cnt

    # 3. Category counts by course
    cat_rows = db.query(Student.course_id, Student.admission_category, func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.admission_year == academic_year,
        Student.is_archived == False
    ).group_by(Student.course_id, Student.admission_category).all()

    categories_by_course = {}
    for cid, cat, cnt in cat_rows:
        c_name = cat or "General"
        if c_name == "FN":
            c_name = "Foreign National"
        categories_by_course.setdefault(cid, {})[c_name] = categories_by_course.setdefault(cid, {}).get(c_name, 0) + cnt

    total_enrolled = sum(total_counts_by_course.values())
    total_regular = sum(regular_counts_by_course.values())
    total_supernumerary = sum(super_counts_by_course.values())

    # Institution-wide category totals
    inst_cat_totals = {
        "General": 0,
        "NRI": 0,
        "OCI": 0,
        "Foreign National": 0,
        "Other": 0
    }
    for cid_cats in categories_by_course.values():
        for c_k, c_v in cid_cats.items():
            if c_k in inst_cat_totals:
                inst_cat_totals[c_k] += c_v
            else:
                inst_cat_totals["Other"] += c_v

    rows = []
    total_approved = 0
    total_approved_supernumerary = 0

    for c in courses:
        config = intake_by_course.get(c.id)
        enrolled = total_counts_by_course.get(c.id, 0)
        reg_enrolled = regular_counts_by_course.get(c.id, 0)
        sup_enrolled = super_counts_by_course.get(c.id, 0)

        approved = config.approved_intake if config else 0
        super_intake = config.supernumerary_intake if config else 0

        total_approved += approved
        total_approved_supernumerary += super_intake

        c_cats = categories_by_course.get(c.id, {})
        category_breakdown = {
            "General": c_cats.get("General", 0),
            "NRI": c_cats.get("NRI", 0),
            "OCI": c_cats.get("OCI", 0),
            "Foreign National": c_cats.get("Foreign National", 0),
            "Other": c_cats.get("Other", 0)
        }

        if not config or approved <= 0:
            status_label = "Configuration Missing"
            utilization = 0.0
            remaining = 0
            warning_msg = None
        else:
            remaining = approved - reg_enrolled
            utilization = round((reg_enrolled / approved * 100.0), 1)
            if reg_enrolled > approved:
                status_label = "Exceeds Capacity"
                warning_msg = f"Regular enrollment ({reg_enrolled}) exceeds approved intake ({approved}) by {reg_enrolled - approved} seats."
            elif utilization >= 90.0:
                status_label = "Near Capacity"
                warning_msg = f"Course is near capacity at {utilization}% ({reg_enrolled}/{approved})."
            else:
                status_label = "Within Capacity"
                warning_msg = None

        rows.append({
            "course_id": c.id,
            "course_code": c.code,
            "course_name": c.name,
            "academic_year": academic_year,
            "approved_intake": approved,
            "supernumerary_intake": super_intake,
            "current_count": enrolled,
            "enrolled_regular": reg_enrolled,
            "enrolled_supernumerary": sup_enrolled,
            "remaining_capacity": remaining,
            "utilization_percent": utilization,
            "status": status_label,
            "warning": warning_msg,
            "categories": category_breakdown,
            "missing_alert": "Intake configuration is missing. Configure the capacity to calculate utilization." if (not config or approved <= 0) else None,
            "has_config": bool(config),
            "source": config.source if config else "None",
            "notes": config.notes if config else None,
            "updated_at": config.updated_at.isoformat() if config and config.updated_at else None
        })

    overall_util = round((total_regular / total_approved * 100.0), 1) if total_approved > 0 else 0.0
    aggregate_alerts = compute_aggregate_intake_alerts(db, inst_id, academic_year)

    return {
        "institution_id": inst_id,
        "academic_year": academic_year,
        "total_approved_intake": total_approved,
        "total_supernumerary_intake": total_approved_supernumerary,
        "total_enrolled_students": total_enrolled,
        "total_regular_enrolled": total_regular,
        "total_supernumerary_enrolled": total_supernumerary,
        "category_totals": inst_cat_totals,
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
    old_super = config.supernumerary_intake if config else None

    if config:
        config.approved_intake = req.approved_intake
        if req.supernumerary_intake is not None:
            config.supernumerary_intake = max(0, req.supernumerary_intake)
        config.notes = req.notes
        config.source = req.source or "Entered by institution admin"
        config.updated_by_user_id = current_user.id
    else:
        config = IntakeConfiguration(
            institution_id=current_user.institution_id,
            course_id=req.course_id,
            academic_year=req.academic_year,
            approved_intake=req.approved_intake,
            supernumerary_intake=max(0, req.supernumerary_intake or 0),
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
            "previous_supernumerary": old_super,
            "new_supernumerary": config.supernumerary_intake,
            "source": config.source
        },
        user=current_user
    )

    return {
        "message": f"Approved intake for {course.code} ({req.academic_year}) set to {req.approved_intake}.",
        "config_id": config.id,
        "approved_intake": config.approved_intake,
        "supernumerary_intake": config.supernumerary_intake,
        "source": config.source
    }
