from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_officer_or_admin
from app.models.user import User
from app.models.student import Student
from app.models.consent import StudentConsent, StudentConsentEvent
from app.schemas.consent import (
    ConsentStatusUpdate,
    StudentConsentResponse,
    ConsentEventResponse,
    ConsentSummaryResponse
)
from app.services.audit_service import record_audit_log

router = APIRouter(tags=["Student Consent & Privacy"])

@router.get("/students/{student_id}/consent", response_model=StudentConsentResponse)
def get_student_consent(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve current consent status and audit history for a specific student.
    Enforces strict tenant isolation and denies access to national regulators.
    """
    if current_user.role == "regulator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regulator access to student-level consent records is prohibited."
        )

    if current_user.role not in ("institution_admin", "verification_officer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to access student consent records."
        )

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student or student.is_archived:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found."
        )

    if student.institution_id != current_user.institution_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Student belongs to another institution."
        )

    consent = db.query(StudentConsent).filter(StudentConsent.student_id == student.id).first()
    if not consent:
        return StudentConsentResponse(
            student_id=student.id,
            institution_id=student.institution_id,
            status="not_recorded",
            consent_type="staff_recorded",
            notice_version="v1.0",
            notes=None,
            recorded_by_name=None,
            recorded_by_role=None,
            recorded_at=None,
            history=[]
        )

    consent_events = db.query(StudentConsentEvent).filter(
        StudentConsentEvent.consent_id == consent.id
    ).order_by(StudentConsentEvent.id.desc()).all()

    history_items = [
        ConsentEventResponse(
            id=ev.id,
            previous_status=ev.previous_status,
            new_status=ev.new_status,
            action=ev.action,
            consent_type=ev.consent_type,
            notice_version=ev.notice_version,
            notes=ev.notes,
            actor_name=ev.actor_name,
            actor_role=ev.actor_role,
            timestamp=ev.timestamp
        )
        for ev in consent_events
    ]

    return StudentConsentResponse(
        student_id=student.id,
        institution_id=student.institution_id,
        status=consent.status,
        consent_type=consent.consent_type,
        notice_version=consent.notice_version,
        notes=consent.notes,
        recorded_by_name=consent.recorded_by_name,
        recorded_by_role=consent.recorded_by_role,
        recorded_at=consent.updated_at or consent.created_at,
        history=history_items
    )


@router.post("/students/{student_id}/consent", response_model=StudentConsentResponse)
def record_student_consent(
    student_id: int,
    payload: ConsentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Record or update consent status for a student record.
    Enforces valid state transitions, audit logging, and tenant isolation.
    """
    if current_user.role == "regulator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regulator access to record student consent is prohibited."
        )

    if current_user.role not in ("institution_admin", "verification_officer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to record student consent."
        )

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student or student.is_archived:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found."
        )

    if student.institution_id != current_user.institution_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Cannot record consent for another institution."
        )

    consent = db.query(StudentConsent).filter(StudentConsent.student_id == student.id).first()
    current_status = consent.status if consent else "not_recorded"
    new_status = payload.status

    if current_status == new_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Consent status is already '{new_status}'."
        )

    action = "RECORDED" if new_status == "granted" else "WITHDRAWN"

    if not consent:
        consent = StudentConsent(
            student_id=student.id,
            institution_id=student.institution_id,
            status=new_status,
            consent_type="staff_recorded",
            notice_version=payload.notice_version,
            notes=payload.notes,
            recorded_by_user_id=current_user.id,
            recorded_by_name=current_user.full_name,
            recorded_by_role=current_user.role
        )
        db.add(consent)
        db.flush()
    else:
        consent.status = new_status
        consent.notice_version = payload.notice_version
        consent.notes = payload.notes
        consent.recorded_by_user_id = current_user.id
        consent.recorded_by_name = current_user.full_name
        consent.recorded_by_role = current_user.role

    event = StudentConsentEvent(
        consent_id=consent.id,
        student_id=student.id,
        institution_id=student.institution_id,
        previous_status=current_status,
        new_status=new_status,
        action=action,
        consent_type="staff_recorded",
        notice_version=payload.notice_version,
        notes=payload.notes,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role
    )
    db.add(event)

    # Immutable Audit Log
    audit_action = "STUDENT_CONSENT_RECORDED" if new_status == "granted" else "STUDENT_CONSENT_WITHDRAWN"
    record_audit_log(
        db=db,
        action=audit_action,
        target_type="STUDENT_CONSENT",
        target_id=str(student.id),
        outcome="SUCCESS",
        user=current_user,
        details={
            "previous_status": current_status,
            "new_status": new_status,
            "notice_version": payload.notice_version,
            "consent_type": "staff_recorded"
        }
    )

    db.commit()
    db.refresh(consent)

    consent_events = db.query(StudentConsentEvent).filter(
        StudentConsentEvent.consent_id == consent.id
    ).order_by(StudentConsentEvent.id.desc()).all()

    history_items = [
        ConsentEventResponse(
            id=ev.id,
            previous_status=ev.previous_status,
            new_status=ev.new_status,
            action=ev.action,
            consent_type=ev.consent_type,
            notice_version=ev.notice_version,
            notes=ev.notes,
            actor_name=ev.actor_name,
            actor_role=ev.actor_role,
            timestamp=ev.timestamp
        )
        for ev in consent_events
    ]

    return StudentConsentResponse(
        student_id=student.id,
        institution_id=student.institution_id,
        status=consent.status,
        consent_type=consent.consent_type,
        notice_version=consent.notice_version,
        notes=consent.notes,
        recorded_by_name=consent.recorded_by_name,
        recorded_by_role=consent.recorded_by_role,
        recorded_at=consent.updated_at or consent.created_at,
        history=history_items
    )


@router.get("/consent/summary", response_model=ConsentSummaryResponse)
def get_institution_consent_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns aggregate counts of student consent statuses for the authenticated institution.
    Excludes archived student records. Regulators cannot access institution-specific consent summary.
    """
    if current_user.role == "regulator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regulator access to institution consent summary is prohibited."
        )

    if current_user.role not in ("institution_admin", "verification_officer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized."
        )

    total_active_students = db.query(Student).filter(
        Student.institution_id == current_user.institution_id,
        Student.is_archived == False
    ).count()

    status_counts = (
        db.query(StudentConsent.status, func.count(StudentConsent.id))
        .join(Student, Student.id == StudentConsent.student_id)
        .filter(
            Student.institution_id == current_user.institution_id,
            Student.is_archived == False
        )
        .group_by(StudentConsent.status)
        .all()
    )

    counts = {st: ct for st, ct in status_counts}
    granted = counts.get("granted", 0)
    withdrawn = counts.get("withdrawn", 0)
    recorded = granted + withdrawn
    not_recorded = max(0, total_active_students - recorded)

    return ConsentSummaryResponse(
        institution_id=current_user.institution_id,
        total_students=total_active_students,
        granted=granted,
        withdrawn=withdrawn,
        not_recorded=not_recorded
    )
