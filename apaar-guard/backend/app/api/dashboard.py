from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, or_
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import require_officer_or_admin
from app.models.user import User
from app.models.student import Student
from app.models.course import Course
from app.models.intake import IntakeConfiguration
from app.models.duplicate import DuplicateAlert
from app.models.review import ReviewCase, ReviewNote
from app.models.import_job import ImportJob

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# Standard established AICTE academic session for prototype
DEFAULT_ACADEMIC_YEAR = 2026

@router.get("/metrics")
def get_dashboard_metrics(
    academic_year: Optional[int] = Query(None, description="Optional academic year session filter (2000-2050)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer_or_admin)
):
    inst_id = current_user.institution_id

    # Validate academic year if explicitly supplied
    if academic_year is not None:
        if academic_year < 2000 or academic_year > 2050:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Academic year must be between 2000 and 2050."
            )

    selected_year = academic_year if academic_year is not None else DEFAULT_ACADEMIC_YEAR

    # 1. Total active students (Fast SQL COUNT)
    # If explicit academic_year is requested, filter by that admission_year;
    # otherwise preserve default all-active-records behavior.
    student_filter = [
        Student.institution_id == inst_id,
        Student.is_archived == False
    ]
    if academic_year is not None:
        student_filter.append(Student.admission_year == selected_year)

    total_students = db.query(func.count(Student.id)).filter(*student_filter).scalar() or 0

    # 2. Status counts (Fast SQL GROUP BY)
    status_rows = db.query(Student.status, func.count(Student.id)).filter(
        *student_filter
    ).group_by(Student.status).all()

    status_dict = {st: cnt for st, cnt in status_rows}
    ready_count = status_dict.get("Ready", 0)
    invalid_count = status_dict.get("Invalid Data", 0)
    needs_review_count = status_dict.get("Needs Review", 0)

    # 3. Potential Duplicates (Section 10):
    review_case_filter = [
        ReviewCase.institution_id == inst_id,
        ReviewCase.status.in_(["Pending Review", "In Progress", "Correction Requested"])
    ]
    if academic_year is not None:
        review_case_filter.append(
            ReviewCase.student.has(Student.admission_year == selected_year)
        )

    potential_duplicate_students = db.query(func.count(distinct(ReviewCase.student_id))).filter(
        *review_case_filter
    ).scalar() or 0

    open_alert_count = db.query(func.count(DuplicateAlert.id)).filter(
        DuplicateAlert.institution_id == inst_id,
        DuplicateAlert.status == "open"
    ).scalar() or 0

    # 4. Intake Monitoring & Scopes for selected academic year:
    courses = db.query(Course).filter(Course.institution_id == inst_id).all()
    intakes = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.institution_id == inst_id,
        IntakeConfiguration.academic_year == selected_year
    ).all()
    intake_by_course = {i.course_id: i for i in intakes}

    # Group students by course for selected academic year
    enrolled_by_course_rows = db.query(Student.course_id, func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.admission_year == selected_year,
        Student.is_archived == False
    ).group_by(Student.course_id).all()
    enrolled_by_course = {cid: cnt for cid, cnt in enrolled_by_course_rows}

    # Regular vs Supernumerary counts by course
    super_rows = db.query(Student.course_id, Student.is_supernumerary, func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.admission_year == selected_year,
        Student.is_archived == False
    ).group_by(Student.course_id, Student.is_supernumerary).all()

    regular_by_course = {}
    super_by_course = {}
    for cid, is_sup, cnt in super_rows:
        if is_sup:
            super_by_course[cid] = super_by_course.get(cid, 0) + cnt
        else:
            regular_by_course[cid] = regular_by_course.get(cid, 0) + cnt

    # Category counts
    cat_rows = db.query(Student.admission_category, func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.admission_year == selected_year,
        Student.is_archived == False
    ).group_by(Student.admission_category).all()
    category_breakdown = {"General": 0, "NRI": 0, "OCI": 0, "Foreign National": 0, "Other": 0}
    for cat, cnt in cat_rows:
        cat_key = cat or "General"
        if cat_key == "FN":
            cat_key = "Foreign National"
        if cat_key in category_breakdown:
            category_breakdown[cat_key] += cnt
        else:
            category_breakdown["Other"] += cnt

    total_configured_intake = 0
    enrolled_in_configured_scopes = 0
    scopes_missing_config = 0

    course_data = []
    for c in courses:
        cfg = intake_by_course.get(c.id)
        enrolled = enrolled_by_course.get(c.id, 0)
        reg_enrolled = regular_by_course.get(c.id, 0)
        sup_enrolled = super_by_course.get(c.id, 0)
        approved = cfg.approved_intake if cfg else 0
        super_intake = cfg.supernumerary_intake if cfg else 0

        if cfg and approved > 0:
            total_configured_intake += approved
            enrolled_in_configured_scopes += reg_enrolled
            util = round((reg_enrolled / approved * 100.0), 1)
            status_label = "Exceeds Capacity" if reg_enrolled > approved else "Near Capacity" if util >= 90.0 else "Within Capacity"
        else:
            scopes_missing_config += 1
            util = 0.0
            status_label = "Configuration Missing"

        course_data.append({
            "course_id": c.id,
            "course_name": c.name,
            "course_code": c.code,
            "enrolled_count": enrolled,
            "regular_count": reg_enrolled,
            "supernumerary_count": sup_enrolled,
            "approved_intake": approved,
            "supernumerary_intake": super_intake,
            "utilization_percent": util,
            "status": status_label
        })

    intake_utilization = 0.0
    if total_configured_intake > 0:
        intake_utilization = round((enrolled_in_configured_scopes / total_configured_intake * 100.0), 1)

    # 5. Status distribution for chart
    status_distribution = [
        {"name": "Ready", "value": ready_count, "color": "#15803D"},
        {"name": "Needs Review", "value": needs_review_count, "color": "#B45309"},
        {"name": "Invalid Data", "value": invalid_count, "color": "#B91C1C"},
    ]

    # 6. Recent import jobs (limited to 5)
    recent_imports = db.query(ImportJob).filter(
        ImportJob.institution_id == inst_id
    ).order_by(ImportJob.created_at.desc()).limit(5).all()

    import_list = []
    for j in recent_imports:
        import_list.append({
            "id": j.id,
            "filename": j.filename,
            "total_rows": j.total_rows,
            "created_rows": j.created_rows,
            "invalid_rows": j.invalid_rows,
            "status": j.status,
            "created_at": j.created_at.isoformat()
        })

    # 7. Recent review activity (limited to 5)
    recent_notes = db.query(ReviewNote).join(ReviewCase).filter(
        ReviewCase.institution_id == inst_id
    ).order_by(ReviewNote.created_at.desc()).limit(5).all()

    activity_list = []
    for rn in recent_notes:
        activity_list.append({
            "id": rn.id,
            "action": rn.action_taken,
            "note": rn.note_text,
            "actor": rn.author.full_name if rn.author else "Officer",
            "student_roll": rn.review_case.student.roll_number if rn.review_case and rn.review_case.student else "—",
            "timestamp": rn.created_at.isoformat()
        })

    return {
        "academic_year": selected_year,
        "kpis": {
            "total_students": total_students,
            "ready_count": ready_count,
            "invalid_count": invalid_count,
            "needs_review_count": needs_review_count,
            "potential_duplicates": potential_duplicate_students,
            "open_alert_count": open_alert_count,
            "intake_utilization": intake_utilization,
            "total_approved_intake": total_configured_intake,
            "scopes_missing_config": scopes_missing_config,
            "total_regular_enrolled": sum(regular_by_course.values()),
            "total_supernumerary_enrolled": sum(super_by_course.values()),
            "category_breakdown": category_breakdown
        },
        "status_distribution": status_distribution,
        "course_breakdown": course_data,
        "recent_imports": import_list,
        "recent_activity": activity_list,
        "official_verification_notice": "Official verification unavailable. Local checks are not official verification."
    }
