from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, or_
from typing import Dict, Any, List

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.course import Course
from app.models.intake import IntakeConfiguration
from app.models.duplicate import DuplicateAlert
from app.models.review import ReviewCase, ReviewNote
from app.models.import_job import ImportJob

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/metrics")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inst_id = current_user.institution_id

    # 1. Total active students (Fast SQL COUNT)
    total_students = db.query(func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.is_archived == False
    ).scalar() or 0

    # 2. Status counts (Fast SQL GROUP BY)
    # Statuses: Ready, Invalid Data, Needs Review (Section 10)
    status_rows = db.query(Student.status, func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.is_archived == False
    ).group_by(Student.status).all()

    status_dict = {st: cnt for st, cnt in status_rows}
    ready_count = status_dict.get("Ready", 0)
    invalid_count = status_dict.get("Invalid Data", 0)
    needs_review_count = status_dict.get("Needs Review", 0)

    # 3. Potential Duplicates (Section 10):
    # DISTINCT students linked to an open duplicate alert / open review case
    # Open statuses: Pending Review, In Progress, Correction Requested
    potential_duplicate_students = db.query(func.count(distinct(ReviewCase.student_id))).filter(
        ReviewCase.institution_id == inst_id,
        ReviewCase.status.in_(["Pending Review", "In Progress", "Correction Requested"])
    ).scalar() or 0

    open_alert_count = db.query(func.count(DuplicateAlert.id)).filter(
        DuplicateAlert.institution_id == inst_id,
        DuplicateAlert.status == "open"
    ).scalar() or 0

    # 4. Intake Monitoring & Scopes (Section 10):
    courses = db.query(Course).filter(Course.institution_id == inst_id).all()
    intakes = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.institution_id == inst_id,
        IntakeConfiguration.academic_year == 2026
    ).all()
    intake_by_course = {i.course_id: i for i in intakes}

    # Group students by course for 2026
    enrolled_by_course_rows = db.query(Student.course_id, func.count(Student.id)).filter(
        Student.institution_id == inst_id,
        Student.admission_year == 2026,
        Student.is_archived == False
    ).group_by(Student.course_id).all()
    enrolled_by_course = {cid: cnt for cid, cnt in enrolled_by_course_rows}

    total_configured_intake = 0
    enrolled_in_configured_scopes = 0
    scopes_missing_config = 0

    course_data = []
    for c in courses:
        cfg = intake_by_course.get(c.id)
        enrolled = enrolled_by_course.get(c.id, 0)
        approved = cfg.approved_intake if cfg else 0

        if cfg and approved > 0:
            total_configured_intake += approved
            enrolled_in_configured_scopes += enrolled
            util = round((enrolled / approved * 100.0), 1)
            status_label = "Exceeds Capacity" if enrolled > approved else "Near Capacity" if util >= 90.0 else "Within Capacity"
        else:
            scopes_missing_config += 1
            util = 0.0
            status_label = "Configuration Missing"

        course_data.append({
            "course_id": c.id,
            "course_name": c.name,
            "course_code": c.code,
            "enrolled_count": enrolled,
            "approved_intake": approved,
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
        "kpis": {
            "total_students": total_students,
            "ready_count": ready_count,
            "invalid_count": invalid_count,
            "needs_review_count": needs_review_count,
            "potential_duplicates": potential_duplicate_students,
            "open_alert_count": open_alert_count,
            "intake_utilization": intake_utilization,
            "total_approved_intake": total_configured_intake,
            "scopes_missing_config": scopes_missing_config
        },
        "status_distribution": status_distribution,
        "course_breakdown": course_data,
        "recent_imports": import_list,
        "recent_activity": activity_list,
        "official_verification_notice": "Official verification unavailable. Local checks are not official verification."
    }
