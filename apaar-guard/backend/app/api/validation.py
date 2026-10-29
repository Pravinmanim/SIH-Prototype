from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from app.core.database import get_db
from app.core.dependencies import get_current_user, verify_institution_access
from app.models.user import User
from app.models.student import Student
from app.models.validation import ValidationResult
from app.services.validation.engine import validation_engine
from app.services.verification.official_service import official_verification_service
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/validation", tags=["Validation Engine"])

@router.post("/run")
def trigger_validation_run(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    counts = validation_engine.run_for_institution(db, current_user.institution_id)
    
    record_audit_log(
        db=db,
        action="VALIDATION_BATCH_RUN",
        target_type="INSTITUTION",
        target_id=str(current_user.institution_id),
        outcome="SUCCESS",
        details=counts,
        user=current_user
    )

    return {
        "status": "success",
        "message": "Local validation and duplicate detection completed successfully.",
        "counts": counts,
        "disclaimer": "Official verification unavailable. Local checks are not official verification."
    }

@router.get("/results")
def get_validation_results_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve all validation results for active students of current institution
    students = db.query(Student).filter(
        Student.institution_id == current_user.institution_id,
        Student.is_archived == False
    ).all()
    student_ids = [s.id for s in students]

    results = db.query(ValidationResult).filter(
        ValidationResult.student_id.in_(student_ids)
    ).all()

    total_checks = len(results)
    passed_checks = sum(1 for r in results if r.status == "passed")
    failed_checks = sum(1 for r in results if r.status == "failed")
    error_count = sum(1 for r in results if r.status == "failed" and r.severity == "error")
    warning_count = sum(1 for r in results if r.status == "failed" and r.severity == "warning")

    # Group failures by rule
    rule_breakdown: Dict[str, Dict[str, Any]] = {}
    for r in results:
        if r.status == "failed":
            if r.rule_id not in rule_breakdown:
                rule_breakdown[r.rule_id] = {
                    "rule_id": r.rule_id,
                    "rule_name": r.rule_name,
                    "severity": r.severity,
                    "failure_count": 0,
                    "sample_message": r.message
                }
            rule_breakdown[r.rule_id]["failure_count"] += 1

    return {
        "institution_id": current_user.institution_id,
        "total_active_students": len(students),
        "total_checks": total_checks,
        "passed_checks": passed_checks,
        "failed_checks": failed_checks,
        "error_count": error_count,
        "warning_count": warning_count,
        "rules": list(rule_breakdown.values()),
        "official_verification": {
            "available": False,
            "status": "unavailable",
            "message": "Official verification unavailable. Local checks are not official verification."
        }
    }

@router.get("/student/{student_id}")
def get_student_validation_results(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    verify_institution_access(student.institution_id, current_user)

    results = db.query(ValidationResult).filter(
        ValidationResult.student_id == student_id
    ).all()

    return {
        "student_id": student.id,
        "roll_number": student.roll_number,
        "status": student.status,
        "results": results,
        "official_verification": {
            "available": False,
            "status": "unavailable",
            "message": "Official verification unavailable. Local checks are not official verification."
        }
    }

@router.get("/official-verify/{student_id}")
def check_official_verification_stub(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    verify_institution_access(student.institution_id, current_user)

    # Call official verification stub
    return official_verification_service.verify_student_apaar(
        apaar_id=student.apaar_id or "",
        student_name=student.full_name,
        dob=student.date_of_birth
    )

