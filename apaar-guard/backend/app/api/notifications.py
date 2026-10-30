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
from app.models.duplicate import DuplicateAlert

router = APIRouter(prefix="/notifications", tags=["Notification Centre"])

@router.get("")
def get_live_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inst_id = current_user.institution_id
    now = datetime.now(timezone.utc)
    notifications = []

    # 1. Pending Review Cases (canonical status: "Pending Review")
    pending_reviews = db.query(ReviewCase).filter(
        ReviewCase.institution_id == inst_id,
        ReviewCase.status == "Pending Review"
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

    # 2. Duplicate Alerts (open duplicate alerts for current institution)
    duplicate_count = db.query(DuplicateAlert).filter(
        DuplicateAlert.institution_id == inst_id,
        DuplicateAlert.status == "open"
    ).count()

    if duplicate_count > 0:
        notifications.append({
            "id": "notif-duplicates",
            "type": "DUPLICATES_FLAGGED",
            "title": "Duplicate Records Detected",
            "message": f"{duplicate_count} duplicate alert{'s' if duplicate_count != 1 else ''} identified with matching APAAR IDs or roll numbers.",
            "severity": "warning",
            "link": "/verification",
            "timestamp": now.isoformat(),
            "count": duplicate_count
        })

    # 3. Invalid Student Records (active records failing validation)
    invalid_count = db.query(Student).filter(
        Student.institution_id == inst_id,
        Student.status == "Invalid Data",
        Student.is_archived == False
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

    # 4. Intake Capacity Alerts (active non-archived students per course)
    intake_configs = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.institution_id == inst_id
    ).all()

    for config in intake_configs:
        enrolled = db.query(Student).filter(
            Student.institution_id == inst_id,
            Student.course_id == config.course_id,
            Student.admission_year == config.academic_year,
            Student.is_archived == False
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

    # 5. Recent Bulk Import Jobs (using valid ImportJob fields)
    recent_jobs = db.query(ImportJob).filter(
        ImportJob.institution_id == inst_id
    ).order_by(ImportJob.created_at.desc()).limit(3).all()

    for job in recent_jobs:
        job_status = (job.status or "").lower()
        if job_status == "failed":
            error_msg = "Validation or file processing error"
            if job.errors and len(job.errors) > 0:
                first_err = job.errors[0]
                error_msg = first_err.error_message or error_msg
            notifications.append({
                "id": f"notif-job-failed-{job.id}",
                "type": "IMPORT_FAILED",
                "title": "Bulk Import Failed",
                "message": f"Batch file '{job.filename}' failed during processing: {error_msg}.",
                "severity": "danger",
                "link": "/import",
                "timestamp": job.created_at.isoformat() if job.created_at else now.isoformat()
            })
        elif job_status == "completed" and (job.invalid_rows or 0) > 0:
            created = job.created_rows or 0
            invalid = job.invalid_rows or 0
            notifications.append({
                "id": f"notif-job-partial-{job.id}",
                "type": "IMPORT_PARTIAL",
                "title": "Bulk Import Completed with Rejections",
                "message": f"'{job.filename}': {created} imported, {invalid} rows rejected.",
                "severity": "info",
                "link": "/import",
                "timestamp": job.created_at.isoformat() if job.created_at else now.isoformat()
            })

    return {
        "unread_count": len(notifications),
        "total_count": len(notifications),
        "notifications": notifications
    }

