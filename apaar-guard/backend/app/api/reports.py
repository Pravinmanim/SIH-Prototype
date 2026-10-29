from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
import io
import pandas as pd
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_officer_or_admin
from app.models.user import User
from app.models.student import Student
from app.models.validation import ValidationResult
from app.models.duplicate import DuplicateAlert
from app.models.intake import IntakeConfiguration
from app.models.review import ReviewCase
from app.models.import_job import ImportJob
from app.schemas.student import mask_apaar_id
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/reports", tags=["Reports & Export"])

@router.get("/export")
def export_csv_report(
    report_type: str = Query("student_summary", description="Type of report to export"),
    course_id: Optional[int] = Query(None),
    admission_year: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer_or_admin)
):
    inst_id = current_user.institution_id
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    applied_filters = []

    rows = []
    filename = f"report_{report_type}_{now_str}.csv"

    if report_type == "student_summary":
        query = db.query(Student).filter(
            Student.institution_id == inst_id,
            Student.is_archived == False
        )
        if course_id:
            query = query.filter(Student.course_id == course_id)
            applied_filters.append(f"CourseID={course_id}")
        if admission_year:
            query = query.filter(Student.admission_year == admission_year)
            applied_filters.append(f"Year={admission_year}")
        if status_filter and status_filter != "ALL":
            query = query.filter(Student.status == status_filter)
            applied_filters.append(f"Status={status_filter}")

        students = query.order_by(Student.roll_number).all()
        for s in students:
            rows.append({
                "Roll Number": s.roll_number,
                "Student Name": s.full_name,
                "Masked APAAR ID": mask_apaar_id(s.apaar_id),
                "Course Code": s.course.code if s.course else "",
                "Admission Year": s.admission_year,
                "Gender": s.gender or "",
                "Date of Birth": s.date_of_birth or "",
                "Local Status": s.status,
                "Official Verification Notice": "Local checks only; official verification unavailable"
            })
        filename = f"students_summary_{now_str}.csv"

    elif report_type == "validation_issues":
        results = db.query(ValidationResult).join(Student).filter(
            Student.institution_id == inst_id,
            Student.is_archived == False,
            ValidationResult.status == "failed"
        ).all()
        for r in results:
            rows.append({
                "Roll Number": r.student.roll_number,
                "Student Name": r.student.full_name,
                "Rule ID": r.rule_id,
                "Rule Name": r.rule_name,
                "Severity": r.severity,
                "Failure Message": r.message,
                "Affected Field": r.affected_field,
                "Suggested Action": r.suggested_action
            })
        filename = f"validation_issues_{now_str}.csv"

    elif report_type == "duplicate_alerts":
        alerts = db.query(DuplicateAlert).filter(
            DuplicateAlert.institution_id == inst_id
        ).all()
        for a in alerts:
            s1 = a.student_1
            s2 = a.student_2
            rows.append({
                "Alert ID": a.id,
                "Alert Type": a.alert_type,
                "Student 1 Roll": s1.roll_number if s1 else "",
                "Student 1 Name": s1.full_name if s1 else "",
                "Student 2 Roll": s2.roll_number if s2 else "",
                "Student 2 Name": s2.full_name if s2 else "",
                "Matching Fields": a.matching_fields,
                "Similarity Score": a.similarity_score,
                "Status": a.status,
                "Resolution Notes": a.resolution_notes or ""
            })
        filename = f"duplicate_alerts_{now_str}.csv"

    elif report_type == "intake_utilization":
        intakes = db.query(IntakeConfiguration).filter(
            IntakeConfiguration.institution_id == inst_id
        ).all()
        for i in intakes:
            count = db.query(Student).filter(
                Student.institution_id == inst_id,
                Student.course_id == i.course_id,
                Student.admission_year == i.academic_year,
                Student.is_archived == False
            ).count()
            util = round((count / i.approved_intake * 100.0), 1) if i.approved_intake > 0 else 0.0
            rows.append({
                "Course": i.course.code if i.course else "",
                "Academic Year": i.academic_year,
                "Approved Intake": i.approved_intake,
                "Enrolled Count": count,
                "Remaining": i.approved_intake - count,
                "Utilization %": util,
                "Status": "Exceeds Capacity" if count > i.approved_intake else "Near Capacity" if util >= 90 else "Within Capacity"
            })
        filename = f"intake_utilization_{now_str}.csv"

    elif report_type == "review_activity":
        cases = db.query(ReviewCase).filter(
            ReviewCase.institution_id == inst_id
        ).all()
        for c in cases:
            rows.append({
                "Case ID": c.id,
                "Roll Number": c.student.roll_number if c.student else "",
                "Reason Flagged": c.reason,
                "Severity": c.severity,
                "Current Status": c.status,
                "Resolution Summary": c.resolution_summary or "",
                "Resolved At": c.resolved_at.isoformat() if c.resolved_at else "",
                "Created At": c.created_at.isoformat()
            })
        filename = f"review_activity_{now_str}.csv"

    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type '{report_type}'.")

    # Generate CSV with metadata comment at top
    output = io.StringIO()
    filter_desc = "; ".join(applied_filters) if applied_filters else "None"
    output.write(f"# APAAR Guard Export: {report_type}\n")
    output.write(f"# Institution: {current_user.institution.name if current_user.institution else inst_id}\n")
    output.write(f"# Generated At: {datetime.now(timezone.utc).isoformat()}\n")
    output.write(f"# Filters Applied: {filter_desc}\n")
    output.write(f"# Notice: Official verification unavailable. Local checks only.\n")

    df = pd.DataFrame(rows)
    df.to_csv(output, index=False)

    # Record Audit Log
    record_audit_log(
        db=db,
        action="REPORT_EXPORTED",
        target_type="REPORT",
        target_id=report_type,
        outcome="SUCCESS",
        details={
            "report_type": report_type,
            "rows_exported": len(rows),
            "filters": filter_desc
        },
        user=current_user
    )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Report-Type": report_type,
            "X-Rows-Count": str(len(rows))
        }
    )

