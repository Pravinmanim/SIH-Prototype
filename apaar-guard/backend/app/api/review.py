from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import json

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_officer_or_admin, verify_institution_access
from app.models.user import User
from app.models.student import Student
from app.models.review import ReviewCase, ReviewNote, ALLOWED_CASE_TRANSITIONS
from app.models.duplicate import DuplicateAlert
from app.schemas.student import mask_apaar_id
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/review", tags=["Verification Centre"])

ACTION_TO_STATUS = {
    "start_review": "In Progress",
    "request_correction": "Correction Requested",
    "mark_false_positive": "False Positive",
    "resolve": "Resolved",
    "reopen": "Pending Review"
}

@router.get("/cases")
def list_review_cases(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer_or_admin)
):
    query = db.query(ReviewCase).filter(
        ReviewCase.institution_id == current_user.institution_id
    )

    if status_filter and status_filter != "ALL":
        query = query.filter(ReviewCase.status == status_filter)
    if severity and severity != "ALL":
        query = query.filter(ReviewCase.severity == severity)

    cases = query.order_by(ReviewCase.created_at.desc()).all()

    items = []
    for c in cases:
        student = c.student
        is_cross = bool(c.duplicate_alert and c.duplicate_alert.alert_type == "cross_institution_apaar")
        items.append({
            "id": c.id,
            "institution_id": c.institution_id,
            "student_id": c.student_id,
            "student_name": student.full_name if student else "Unknown",
            "roll_number": student.roll_number if student else "N/A",
            "course_code": student.course.code if student and student.course else "—",
            "masked_apaar": mask_apaar_id(student.apaar_id) if student else "N/A",
            "fingerprint": c.fingerprint,
            "reopened_from_id": c.reopened_from_id,
            "reason": c.reason,
            "severity": c.severity,
            "status": c.status,
            "has_duplicate_alert": bool(c.duplicate_alert_id),
            "is_cross_institution": is_cross,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            "resolution_summary": c.resolution_summary
        })

    return items

@router.get("/cases/{case_id}")
def get_case_detail(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer_or_admin)
):
    case = db.query(ReviewCase).filter(ReviewCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Review case not found.")

    verify_institution_access(case.institution_id, current_user)

    student = case.student
    student_data = None
    if student:
        student_data = {
            "id": student.id,
            "roll_number": student.roll_number,
            "full_name": student.full_name,
            "course_name": student.course.name if student.course else None,
            "course_code": student.course.code if student.course else None,
            "masked_apaar_id": mask_apaar_id(student.apaar_id),
            "has_apaar": bool(student.apaar_id),
            "admission_year": student.admission_year,
            "date_of_birth": student.date_of_birth,
            "gender": student.gender,
            "email": student.email,
            "phone": student.phone,
            "status": student.status,
            "version": student.version
        }

    peer_data = None
    matching_fields = []
    is_cross_institution = False
    if case.duplicate_alert:
        dup = case.duplicate_alert
        is_cross_institution = (dup.alert_type == "cross_institution_apaar")
        peer_id = dup.student_id_1 if dup.student_id_2 == case.student_id else dup.student_id_2
        peer = db.query(Student).filter(Student.id == peer_id).first()
        if peer:
            if peer.institution_id != case.institution_id or is_cross_institution:
                is_cross_institution = True
                other_inst = peer.institution
                peer_data = {
                    "is_cross_institution": True,
                    "institution_name": other_inst.name if other_inst else "Another Registered Institution",
                    "institution_code": other_inst.code if other_inst else "OTHER",
                    "masked_apaar_id": mask_apaar_id(peer.apaar_id),
                    "has_apaar": bool(peer.apaar_id),
                    "status": "Potential Duplicate in Other Institution"
                }
            else:
                peer_data = {
                    "is_cross_institution": False,
                    "id": peer.id,
                    "roll_number": peer.roll_number,
                    "full_name": peer.full_name,
                    "course_name": peer.course.name if peer.course else None,
                    "course_code": peer.course.code if peer.course else None,
                    "masked_apaar_id": mask_apaar_id(peer.apaar_id),
                    "has_apaar": bool(peer.apaar_id),
                    "admission_year": peer.admission_year,
                    "date_of_birth": peer.date_of_birth,
                    "gender": peer.gender,
                    "email": peer.email,
                    "phone": peer.phone,
                    "status": peer.status,
                    "version": peer.version
                }
        try:
            matching_fields = json.loads(dup.matching_fields)
        except Exception:
            matching_fields = [dup.matching_fields]

    notes = []
    for n in case.notes:
        notes.append({
            "id": n.id,
            "note_text": n.note_text,
            "action_taken": n.action_taken,
            "author_name": n.author.full_name if n.author else "Officer",
            "created_at": n.created_at.isoformat()
        })

    boundary_notice = "Similarity or duplicate alert is not proof of identity or fraud. Verify official documents locally."
    if is_cross_institution:
        boundary_notice = "Potential cross-institution collision detected with another registered institution. Under tenant privacy regulations, student identity details from the other institution are withheld. Local physical document verification with the student is required."

    return {
        "case": {
            "id": case.id,
            "institution_id": case.institution_id,
            "reason": case.reason,
            "severity": case.severity,
            "status": case.status,
            "fingerprint": case.fingerprint,
            "reopened_from_id": case.reopened_from_id,
            "resolution_summary": case.resolution_summary,
            "resolved_at": case.resolved_at.isoformat() if case.resolved_at else None,
            "created_at": case.created_at.isoformat(),
            "is_cross_institution": is_cross_institution
        },
        "student": student_data,
        "peer_student": peer_data,
        "is_cross_institution": is_cross_institution,
        "matching_fields": matching_fields,
        "notes": notes,
        "boundary_notice": boundary_notice
    }

@router.post("/cases/{case_id}/action")
def submit_case_action(
    case_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer_or_admin)
):
    case = db.query(ReviewCase).filter(ReviewCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Review case not found.")

    verify_institution_access(case.institution_id, current_user)

    action = payload.get("action")
    note_text = payload.get("note_text", "").strip()

    if not action:
        raise HTTPException(status_code=400, detail="Action is required.")

    # Note only without status transition
    if action == "add_note":
        if not note_text:
            raise HTTPException(status_code=400, detail="Note text cannot be empty.")
        db_note = ReviewNote(
            review_case_id=case.id,
            user_id=current_user.id,
            note_text=note_text,
            action_taken="note_added"
        )
        db.add(db_note)
        db.commit()
        return {"message": "Note added successfully.", "case_status": case.status}

    # State machine transition
    target_status = ACTION_TO_STATUS.get(action)
    if not target_status:
        raise HTTPException(status_code=400, detail=f"Unsupported review action '{action}'.")

    # Enforce Allowed Transitions (Section 3b) -> 409 Conflict if illegal
    allowed = ALLOWED_CASE_TRANSITIONS.get(case.status, [])
    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Illegal transition from '{case.status}' to '{target_status}'. Allowed transitions: {', '.join(allowed)}."
        )

    # Mandatory reason for False Positive and Resolved
    if target_status in ["False Positive", "Resolved"] and not note_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A written justification reason is mandatory when transitioning to '{target_status}'."
        )

    now = datetime.now(timezone.utc)
    case.status = target_status

    if target_status in ["False Positive", "Resolved"]:
        case.resolved_at = now
        case.resolved_by_user_id = current_user.id
        case.resolution_summary = note_text
        if case.duplicate_alert:
            case.duplicate_alert.status = target_status.lower().replace(" ", "_")
            case.duplicate_alert.resolved_by_user_id = current_user.id
            case.duplicate_alert.resolution_notes = note_text

    db_note = ReviewNote(
        review_case_id=case.id,
        user_id=current_user.id,
        note_text=note_text or f"Status updated to '{target_status}'",
        action_taken=action
    )
    db.add(db_note)
    db.commit()

    # Audit log
    record_audit_log(
        db=db,
        action=f"REVIEW_CASE_TRANSITION_{target_status.upper().replace(' ', '_')}",
        target_type="REVIEW_CASE",
        target_id=str(case.id),
        outcome="SUCCESS",
        details={
            "previous_status": case.status,
            "new_status": target_status,
            "reason": note_text
        },
        user=current_user
    )

    return {
        "message": f"Case #{case.id} status transitioned to '{target_status}'.",
        "case_status": case.status
    }
