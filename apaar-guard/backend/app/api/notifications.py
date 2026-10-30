from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.review import ReviewCase
from app.models.student import Student
from app.models.intake import IntakeConfiguration
from app.models.import_job import ImportJob

router = APIRouter(prefix="/notifications", tags=["Notification Centre"])

@router.get("")
def get_live_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inst_id = current_user.institution_id
    now = datetime.now(timezone.utc)
    notifications = []

    # 1. Pending Review Cases
    pending_reviews = db.query(ReviewCase).filter(
        ReviewCase.institution_id == inst_id,
        ReviewCase.status == "PENDING_REVIEW"
    ).count()

    if pending_reviews > 0:
        notifications.append({
            "id": "notif-review-pending",
            "type": "REVIEW_PENDING",
            "title": "Pending Verification Reviews",
            "message": f"{pending_reviews} student record{'s' if pending_reviews != 1 else ''} flagged for officer determination.",
            "severity": "warning",
            "link": "/verification",
            "timestamp": now.isoformat(),
            "count": pending_reviews
        })

    # 2. Duplicate Alerts
    duplicate_count = db.query(Student).filter(
        Student.institution_id == inst_id,
        Student.status == "De-Duplicated"
    ).count()

    if duplicate_count > 0:
        notifications.append({
            "id": "notif-duplicates",
            "type": "DUPLICATES_FLAGGED",
            "title": "Duplicate Records Detected",
            "message": f"{duplicate_count} student record{'s' if duplicate_count != 1 else ''} identified with matching APAAR IDs or roll numbers.",
            "severity": "warning",
            "link": "/students?status=De-Duplicated",
            "timestamp": now.isoformat(),
            "count": duplicate_count
        })

    # 3. Invalid Student Records
    invalid_count = db.query(Student).filter(
        Student.institution_id == inst_id,
        Student.status == "Invalid Data"
    ).count()

    if invalid_count > 0:
        notifications.append({
            "id": "notif-invalid-records",
            "type": "INVALID_DATA",
            "title": "Data Format Errors Detected",
            "message": f"{invalid_count} student record{'s' if invalid_count != 1 else ''} failed 12-digit format or required field validation.",
            "severity": "danger",
            "link": "/students?status=Invalid Data",
            "timestamp": now.isoformat(),
            "count": invalid_count
        })

    # 4. Intake Capacity Alerts
    intake_configs = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.institution_id == inst_id
    ).all()

    for config in intake_configs:
        enrolled = db.query(Student).filter(
            Student.institution_id == inst_id,
            Student.course_id == config.course_id,
            Student.admission_year == config.academic_year,
            Student.status != "Archived"
        ).count()

        if config.approved_intake > 0:
            pct = round((enrolled / config.approved_intake) * 100, 1)
            course_name = config.course.code if config.course else f"Course #{config.course_id}"

            if pct >= 100:
                notifications.append({
                    "id": f"notif-intake-exceeded-{config.id}",
                    "type": "INTAKE_EXCEEDED",
                    "title": f"Intake Limit Exceeded: {course_name}",
                    "message": f"{course_name} ({config.academic_year}) enrollment is at {pct}% of approved AICTE capacity ({enrolled}/{config.approved_intake}).",
                    "severity": "danger",
                    "link": "/intake",
                    "timestamp": now.isoformat(),
                    "count": enrolled
                })
            elif pct >= 85:
                notifications.append({
                    "id": f"notif-intake-near-{config.id}",
                    "type": "INTAKE_WARNING",
                    "title": f"Intake Capacity Warning: {course_name}",
                    "message": f"{course_name} ({config.academic_year}) enrollment reached {pct}% of approved capacity ({enrolled}/{config.approved_intake}).",
                    "severity": "warning",
                    "link": "/intake",
                    "timestamp": now.isoformat(),
                    "count": enrolled
                })

    # 5. Recent Bulk Import Jobs
    recent_jobs = db.query(ImportJob).filter(
        ImportJob.institution_id == inst_id
    ).order_by(ImportJob.created_at.desc()).limit(3).all()

    for job in recent_jobs:
        if job.status == "FAILED":
            notifications.append({
                "id": f"notif-job-failed-{job.id}",
                "type": "IMPORT_FAILED",
                "title": "Bulk Import Failed",
                "message": f"Batch file '{job.filename}' failed during processing: {job.error_summary or 'Validation error'}.",
                "severity": "danger",
                "link": "/import",
                "timestamp": job.created_at.isoformat() if job.created_at else now.isoformat()
            })
        elif job.status == "COMPLETED" and (job.failed_rows or 0) > 0:
            notifications.append({
                "id": f"notif-job-partial-{job.id}",
                "type": "IMPORT_PARTIAL",
                "title": "Bulk Import Completed with Rejections",
                "message": f"'{job.filename}': {job.successful_rows} imported, {job.failed_rows} rows rejected.",
                "severity": "info",
                "link": "/import",
                "timestamp": job.created_at.isoformat() if job.created_at else now.isoformat()
            })

    return {
        "unread_count": len(notifications),
        "total_count": len(notifications),
        "notifications": notifications
    }

