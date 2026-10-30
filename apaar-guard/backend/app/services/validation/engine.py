import json
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone

from app.models.student import Student
from app.models.course import Course
from app.models.intake import IntakeConfiguration
from app.models.validation import ValidationResult
from app.models.duplicate import DuplicateAlert
from app.models.review import ReviewCase, ReviewNote
from app.services.validation.base import ValidationResultDTO
from app.services.validation.rules import (
    RequiredFieldsRule,
    ApaarFormatRule,
    ExactDuplicateApaarRule,
    DuplicateRollNumberRule,
    AcademicConsistencyRule,
    PossibleDuplicateRule,
    normalize_apaar,
    normalize_name,
    compute_issue_fingerprint
)
from app.services.audit_service import record_audit_log

class ValidationEngine:
    def __init__(self):
        # Student-level rules (R1 to R6). Intake is handled at aggregate level only (Section 4).
        self.rules = [
            RequiredFieldsRule(),
            ApaarFormatRule(),
            ExactDuplicateApaarRule(),
            DuplicateRollNumberRule(),
            AcademicConsistencyRule(),
            PossibleDuplicateRule(),
        ]

    def _build_context(self, db: Session, institution_id: int) -> Dict[str, Any]:
        students = db.query(Student).filter(
            Student.institution_id == institution_id,
            Student.is_archived == False
        ).all()

        courses = db.query(Course).filter(Course.institution_id == institution_id).all()
        valid_course_ids = {c.id for c in courses}

        return {
            "db": db,
            "institution_id": institution_id,
            "existing_students": students,
            "valid_course_ids": valid_course_ids,
        }

    def validate_single_record(self, student: Student, context: Dict[str, Any]) -> Tuple[List[ValidationResultDTO], str]:
        record_context = dict(context)
        record_context["student"] = student

        results: List[ValidationResultDTO] = []
        for rule in self.rules:
            rule_results = rule.evaluate(record_context)
            results.extend(rule_results)

        # Derive 3-state validation status (Section 3a):
        # Precedence: Invalid Data > Needs Review > Ready
        has_error = any(r.status == "failed" and r.severity == "error" for r in results)
        has_warning = any(r.status == "failed" and r.severity == "warning" for r in results)

        if has_error:
            derived_status = "Invalid Data"
        elif has_warning:
            derived_status = "Needs Review"
        else:
            derived_status = "Ready"

        return results, derived_status

    def run_for_institution(self, db: Session, institution_id: int) -> Dict[str, Any]:
        context = self._build_context(db, institution_id)
        students = context["existing_students"]

        # Clear existing ValidationResult records for active students
        student_ids = [s.id for s in students]
        if student_ids:
            db.query(ValidationResult).filter(ValidationResult.student_id.in_(student_ids)).delete(synchronize_session=False)
            db.commit()

        counts = {
            "total": len(students),
            "ready": 0,
            "invalid_data": 0,
            "needs_review": 0,
        }

        # Active review cases index by (student_id, rule_id)
        active_cases = db.query(ReviewCase).filter(
            ReviewCase.institution_id == institution_id
        ).all()
        cases_by_student_rule: Dict[Tuple[int, str], List[ReviewCase]] = {}
        for c in active_cases:
            key = (c.student_id, c.reason)
            cases_by_student_rule.setdefault(key, []).append(c)

        seen_apaars: Dict[str, Student] = {}
        seen_rolls: Dict[Tuple[int, str], Student] = {}
        seen_heuristics: Dict[Tuple[str, str], Student] = {}

        # Set of fingerprints active in current run
        current_run_fingerprints = set()

        for student in students:
            results, new_status = self.validate_single_record(student, context)
            student.status = new_status
            
            # Status count
            if new_status == "Ready":
                counts["ready"] += 1
            elif new_status == "Invalid Data":
                counts["invalid_data"] += 1
            elif new_status == "Needs Review":
                counts["needs_review"] += 1

            # Persist ValidationResult records
            for r in results:
                db.add(ValidationResult(
                    student_id=student.id,
                    rule_id=r.rule_id,
                    rule_name=r.rule_name,
                    severity=r.severity,
                    status=r.status,
                    message=r.message,
                    affected_field=r.affected_field,
                    suggested_action=r.suggested_action,
                    rule_version=r.rule_version
                ))

            # 1. Exact APAAR Duplicate
            norm_apaar = normalize_apaar(student.apaar_id)
            if norm_apaar:
                if norm_apaar in seen_apaars:
                    peer = seen_apaars[norm_apaar]
                    fp = compute_issue_fingerprint("R3_EXACT_DUPLICATE_APAAR", student.id, {"apaar_id": norm_apaar})
                    current_run_fingerprints.add(fp)
                    self._sync_review_case(
                        db=db,
                        institution_id=institution_id,
                        student=student,
                        peer=peer,
                        rule_id="R3_EXACT_DUPLICATE_APAAR",
                        fingerprint=fp,
                        alert_type="exact_apaar",
                        fields=["apaar_id"],
                        reason=f"Exact duplicate APAAR ID matched with student {peer.roll_number}",
                        severity="high"
                    )
                else:
                    seen_apaars[norm_apaar] = student

                    # Check for potential cross-institution duplicate collision
                    if len(norm_apaar) == 12 and norm_apaar.isdigit():
                        cross_peer = db.query(Student).filter(
                            Student.institution_id != institution_id,
                            Student.is_archived == False,
                            (
                                (Student.apaar_id == norm_apaar) |
                                (func.replace(func.replace(Student.apaar_id, "-", ""), " ", "") == norm_apaar)
                            )
                        )
                        if student.id:
                            cross_peer = cross_peer.filter(Student.id != student.id)
                        cross_peer = cross_peer.first()

                        if cross_peer:
                            fp = compute_issue_fingerprint("R3_CROSS_INSTITUTION_APAAR", student.id, {"apaar_id": norm_apaar})
                            current_run_fingerprints.add(fp)
                            self._sync_review_case(
                                db=db,
                                institution_id=institution_id,
                                student=student,
                                peer=cross_peer,
                                rule_id="R3_CROSS_INSTITUTION_APAAR",
                                fingerprint=fp,
                                alert_type="cross_institution_apaar",
                                fields=["apaar_id"],
                                reason="Potential cross-institution APAAR duplicate detected with another registered institution",
                                severity="high"
                            )
                            # Also sync case in the other institution's queue so both institutions can review
                            peer_fp = compute_issue_fingerprint("R3_CROSS_INSTITUTION_APAAR", cross_peer.id, {"apaar_id": norm_apaar})
                            self._sync_review_case(
                                db=db,
                                institution_id=cross_peer.institution_id,
                                student=cross_peer,
                                peer=student,
                                rule_id="R3_CROSS_INSTITUTION_APAAR",
                                fingerprint=peer_fp,
                                alert_type="cross_institution_apaar",
                                fields=["apaar_id"],
                                reason="Potential cross-institution APAAR duplicate detected with another registered institution",
                                severity="high"
                            )
                            if cross_peer.status == "Ready":
                                cross_peer.status = "Needs Review"

            # 2. Duplicate Roll Number (same inst + admission year)
            roll_key = (student.admission_year, student.roll_number.strip().lower())
            if roll_key in seen_rolls:
                peer = seen_rolls[roll_key]
                fp = compute_issue_fingerprint("R4_DUPLICATE_ROLL_NUMBER", student.id, {"roll_number": roll_key[1], "admission_year": roll_key[0]})
                current_run_fingerprints.add(fp)
                self._sync_review_case(
                    db=db,
                    institution_id=institution_id,
                    student=student,
                    peer=peer,
                    rule_id="R4_DUPLICATE_ROLL_NUMBER",
                    fingerprint=fp,
                    alert_type="roll_number",
                    fields=["roll_number", "admission_year"],
                    reason=f"Duplicate roll number in admission year {student.admission_year} with {peer.roll_number}",
                    severity="high"
                )
            else:
                seen_rolls[roll_key] = student

            # 3. Possible Duplicate (normalized name + DOB)
            norm_nm = normalize_name(student.full_name)
            if norm_nm and student.date_of_birth:
                heur_key = (norm_nm, student.date_of_birth)
                if heur_key in seen_heuristics:
                    peer = seen_heuristics[heur_key]
                    fp = compute_issue_fingerprint("R6_POSSIBLE_DUPLICATE", student.id, {"name": norm_nm, "dob": student.date_of_birth})
                    current_run_fingerprints.add(fp)
                    self._sync_review_case(
                        db=db,
                        institution_id=institution_id,
                        student=student,
                        peer=peer,
                        rule_id="R6_POSSIBLE_DUPLICATE",
                        fingerprint=fp,
                        alert_type="possible_match",
                        fields=["full_name", "date_of_birth"],
                        reason=f"High name and DOB similarity with student {peer.roll_number}",
                        severity="medium"
                    )
                else:
                    seen_heuristics[heur_key] = student

        # Auto-resolve "Correction Requested" cases whose issue is no longer found (Section 3c)
        correction_cases = db.query(ReviewCase).filter(
            ReviewCase.institution_id == institution_id,
            ReviewCase.status == "Correction Requested"
        ).all()

        for c in correction_cases:
            if c.fingerprint not in current_run_fingerprints:
                c.status = "Resolved"
                c.resolved_at = datetime.now(timezone.utc)
                c.resolution_summary = "Re-validation passed: Issue no longer detected by validation rules."
                db.add(ReviewNote(
                    review_case_id=c.id,
                    note_text="System auto-resolved: Re-validation passed cleanly.",
                    action_taken="resolved"
                ))
                record_audit_log(
                    db=db,
                    action="REVIEW_CASE_AUTO_RESOLVED",
                    target_type="REVIEW_CASE",
                    target_id=str(c.id),
                    outcome="SUCCESS",
                    details={"reason": "Re-validation passed", "actor": "system"},
                    institution_id=institution_id
                )

        db.commit()
        return counts

    def _sync_review_case(
        self,
        db: Session,
        institution_id: int,
        student: Student,
        peer: Student,
        rule_id: str,
        fingerprint: str,
        alert_type: str,
        fields: List[str],
        reason: str,
        severity: str
    ):
        """
        Implements Section 3c interaction rules:
        - Issue found, no case with same fingerprint -> create case (Pending Review).
        - Case is False Positive and fingerprint unchanged -> stay False Positive (no new alert).
        - Case is False Positive/Resolved and field values changed -> create new case linked via reopened_from_id.
        - Case is Resolved but same fingerprint reappears -> reopen to Pending Review with note.
        """
        # Ensure DuplicateAlert
        alert = db.query(DuplicateAlert).filter(
            DuplicateAlert.institution_id == institution_id,
            ((DuplicateAlert.student_id_1 == peer.id) & (DuplicateAlert.student_id_2 == student.id)) |
            ((DuplicateAlert.student_id_1 == student.id) & (DuplicateAlert.student_id_2 == peer.id))
        ).first()

        if not alert:
            alert = DuplicateAlert(
                institution_id=institution_id,
                student_id_1=peer.id,
                student_id_2=student.id,
                alert_type=alert_type,
                matching_fields=json.dumps(fields),
                similarity_score=1.0 if alert_type != "possible_match" else 0.85,
                status="open"
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)

        # Check existing cases for this student and rule
        existing_cases = db.query(ReviewCase).filter(
            ReviewCase.institution_id == institution_id,
            ReviewCase.student_id == student.id,
            ReviewCase.reason.ilike(f"%{rule_id[:2]}%") | ReviewCase.reason.ilike(f"%{alert_type}%")
        ).order_by(ReviewCase.created_at.desc()).all()

        matching_fp_case = next((c for c in existing_cases if c.fingerprint == fingerprint), None)

        if matching_fp_case:
            # Case exists with same fingerprint
            if matching_fp_case.status == "False Positive":
                # Stays False Positive (suppressed, do not overwrite)
                return
            elif matching_fp_case.status == "Resolved":
                # Reopen to Pending Review
                matching_fp_case.status = "Pending Review"
                db.add(ReviewNote(
                    review_case_id=matching_fp_case.id,
                    note_text="System re-opened case: duplicate identifier reappeared on re-validation.",
                    action_taken="reopened"
                ))
            # If already Pending Review, In Progress, or Correction Requested, preserve human state
            return

        # Fingerprint changed or no case exists
        previous_case = existing_cases[0] if existing_cases else None
        new_case = ReviewCase(
            institution_id=institution_id,
            student_id=student.id,
            duplicate_alert_id=alert.id,
            fingerprint=fingerprint,
            reopened_from_id=previous_case.id if previous_case else None,
            reason=reason,
            severity=severity,
            status="Pending Review"
        )
        db.add(new_case)
        db.commit()

    def sync_student_cross_institution_collision(self, db: Session, student: Student) -> Optional[Student]:
        """
        Checks if a valid, normalized APAAR ID exists in another institution.
        If a collision is found:
        - Syncs DuplicateAlert and ReviewCase for the student's institution.
        - Syncs DuplicateAlert and ReviewCase for the peer's institution.
        - Updates student status to 'Needs Review' if currently 'Ready'.
        - Updates peer status to 'Needs Review' if currently 'Ready'.
        - Returns the peer Student record.
        """
        if not student or student.is_archived or not student.apaar_id:
            return None

        norm_apaar = normalize_apaar(student.apaar_id)
        if not norm_apaar or len(norm_apaar) != 12 or not norm_apaar.isdigit():
            return None

        cross_peer = db.query(Student).filter(
            Student.institution_id != student.institution_id,
            Student.is_archived == False,
            (
                (Student.apaar_id == norm_apaar) |
                (func.replace(func.replace(Student.apaar_id, "-", ""), " ", "") == norm_apaar)
            )
        )
        if student.id:
            cross_peer = cross_peer.filter(Student.id != student.id)
        cross_peer = cross_peer.first()

        if not cross_peer:
            return None

        # 1. Sync review case for student in their institution
        fp = compute_issue_fingerprint("R3_CROSS_INSTITUTION_APAAR", student.id, {"apaar_id": norm_apaar})
        self._sync_review_case(
            db=db,
            institution_id=student.institution_id,
            student=student,
            peer=cross_peer,
            rule_id="R3_CROSS_INSTITUTION_APAAR",
            fingerprint=fp,
            alert_type="cross_institution_apaar",
            fields=["apaar_id"],
            reason="Potential cross-institution APAAR duplicate detected with another registered institution",
            severity="high"
        )

        # 2. Sync review case for peer in their institution
        peer_fp = compute_issue_fingerprint("R3_CROSS_INSTITUTION_APAAR", cross_peer.id, {"apaar_id": norm_apaar})
        self._sync_review_case(
            db=db,
            institution_id=cross_peer.institution_id,
            student=cross_peer,
            peer=student,
            rule_id="R3_CROSS_INSTITUTION_APAAR",
            fingerprint=peer_fp,
            alert_type="cross_institution_apaar",
            fields=["apaar_id"],
            reason="Potential cross-institution APAAR duplicate detected with another registered institution",
            severity="high"
        )

        if student.status == "Ready":
            student.status = "Needs Review"
        if cross_peer.status == "Ready":
            cross_peer.status = "Needs Review"

        db.commit()
        return cross_peer

# Aggregate-level intake evaluation (Section 4)
def compute_aggregate_intake_alerts(db: Session, institution_id: int, academic_year: int = 2026) -> List[Dict[str, Any]]:
    courses = db.query(Course).filter(Course.institution_id == institution_id).all()
    intakes = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.institution_id == institution_id,
        IntakeConfiguration.academic_year == academic_year
    ).all()
    intake_by_course = {i.course_id: i for i in intakes}

    from sqlalchemy import func
    enrolled_counts = dict(
        db.query(Student.course_id, func.count(Student.id)).filter(
            Student.institution_id == institution_id,
            Student.admission_year == academic_year,
            Student.is_archived == False
        ).group_by(Student.course_id).all()
    )

    regular_counts = dict(
        db.query(Student.course_id, func.count(Student.id)).filter(
            Student.institution_id == institution_id,
            Student.admission_year == academic_year,
            Student.is_archived == False,
            Student.is_supernumerary == False
        ).group_by(Student.course_id).all()
    )

    super_counts = dict(
        db.query(Student.course_id, func.count(Student.id)).filter(
            Student.institution_id == institution_id,
            Student.admission_year == academic_year,
            Student.is_archived == False,
            Student.is_supernumerary == True
        ).group_by(Student.course_id).all()
    )

    alerts = []
    for c in courses:
        cfg = intake_by_course.get(c.id)
        enrolled = enrolled_counts.get(c.id, 0)
        reg_enrolled = regular_counts.get(c.id, 0)
        sup_enrolled = super_counts.get(c.id, 0)
        approved = cfg.approved_intake if cfg else 0

        if not cfg:
            alerts.append({
                "course_id": c.id,
                "course_code": c.code,
                "course_name": c.name,
                "academic_year": academic_year,
                "enrolled_count": enrolled,
                "regular_count": reg_enrolled,
                "supernumerary_count": sup_enrolled,
                "approved_intake": 0,
                "status": "Configuration Missing",
                "message": f"Course {c.code} has no approved intake configuration for batch {academic_year}."
            })
        elif approved <= 0:
            alerts.append({
                "course_id": c.id,
                "course_code": c.code,
                "course_name": c.name,
                "academic_year": academic_year,
                "enrolled_count": enrolled,
                "regular_count": reg_enrolled,
                "supernumerary_count": sup_enrolled,
                "approved_intake": 0,
                "status": "Configuration Missing",
                "message": f"Configured intake for {c.code} is zero."
            })
        else:
            util = (reg_enrolled / approved) * 100.0
            if reg_enrolled > approved:
                alerts.append({
                    "course_id": c.id,
                    "course_code": c.code,
                    "course_name": c.name,
                    "academic_year": academic_year,
                    "enrolled_count": enrolled,
                    "regular_count": reg_enrolled,
                    "supernumerary_count": sup_enrolled,
                    "approved_intake": approved,
                    "utilization_percent": round(util, 1),
                    "status": "Exceeds Capacity",
                    "message": f"Course {c.code} regular enrollment ({reg_enrolled}) exceeds approved intake ({approved}) by {reg_enrolled - approved} seats ({util:.1f}%)."
                })
            elif util >= 90.0:
                alerts.append({
                    "course_id": c.id,
                    "course_code": c.code,
                    "course_name": c.name,
                    "academic_year": academic_year,
                    "enrolled_count": enrolled,
                    "regular_count": reg_enrolled,
                    "supernumerary_count": sup_enrolled,
                    "approved_intake": approved,
                    "utilization_percent": round(util, 1),
                    "status": "Near Capacity",
                    "message": f"Course {c.code} is near capacity at {util:.1f}% ({reg_enrolled}/{approved})."
                })

    return alerts

validation_engine = ValidationEngine()
