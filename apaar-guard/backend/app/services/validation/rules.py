import re
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.services.validation.base import BaseValidationRule, ValidationResultDTO

def normalize_apaar(apaar: Optional[str]) -> str:
    """Normalizes APAAR ID string by stripping spaces and hyphens for comparison only."""
    if not apaar:
        return ""
    return str(apaar).strip().replace("-", "").replace(" ", "")

def normalize_name(name: Optional[str]) -> str:
    """Normalizes name for similarity comparison: lowercase, remove special chars and extra spaces."""
    if not name:
        return ""
    clean = re.sub(r"[^a-zA-Z\s]", "", str(name).lower())
    return " ".join(clean.split())

def compute_issue_fingerprint(rule_id: str, student_id: int, fields_dict: Dict[str, Any]) -> str:
    """
    Computes fingerprint = hash(rule_id + student_id + normalized values of fields involved).
    Used to track human review decisions across recurring validation runs.
    """
    sorted_items = sorted((k, str(v or "").strip().lower()) for k, v in fields_dict.items())
    raw_str = f"{rule_id}|{student_id}|{sorted_items}"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

class RequiredFieldsRule(BaseValidationRule):
    rule_id = "R1_REQUIRED_FIELDS"
    name = "Required Fields Verification"
    severity = "error"

    def evaluate(self, context: Dict[str, Any]) -> List[ValidationResultDTO]:
        student = context.get("student")
        results = []
        required_fields = [
            ("roll_number", "Roll Number", student.roll_number if hasattr(student, "roll_number") else student.get("roll_number")),
            ("full_name", "Student Full Name", student.full_name if hasattr(student, "full_name") else student.get("full_name")),
            ("admission_year", "Admission Year", student.admission_year if hasattr(student, "admission_year") else student.get("admission_year")),
            ("course_id", "Course Reference", student.course_id if hasattr(student, "course_id") else student.get("course_id")),
        ]

        for field_key, field_label, value in required_fields:
            if value is None or (isinstance(value, str) and not value.strip()):
                results.append(ValidationResultDTO(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    severity="error",
                    status="failed",
                    message=f"Mandatory field '{field_label}' is missing or blank.",
                    affected_field=field_key,
                    suggested_action=f"Provide a valid {field_label} in student profile.",
                    rule_version=self.rule_version
                ))

        if not results:
            results.append(ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="info",
                status="passed",
                message="All mandatory fields are present.",
                affected_field=None,
                suggested_action=None,
                rule_version=self.rule_version
            ))
        return results

class ApaarFormatRule(BaseValidationRule):
    rule_id = "R2_APAAR_FORMAT"
    name = "APAAR ID Format Validation"
    severity = "error"

    def evaluate(self, context: Dict[str, Any]) -> List[ValidationResultDTO]:
        student = context.get("student")
        raw_apaar = student.apaar_id if hasattr(student, "apaar_id") else student.get("apaar_id")
        
        # If blank/empty, it's a warning (Needs Review), not an error
        if raw_apaar is None or not str(raw_apaar).strip():
            return [ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="warning",
                status="failed",
                message="APAAR ID is missing for this student record.",
                affected_field="apaar_id",
                suggested_action="Collect 12-digit APAAR ID from DigiLocker/ABC portal.",
                rule_version=self.rule_version
            )]

        apaar_str = str(raw_apaar).strip()
        # APAAR must be exactly 12 digits (preserving leading zeroes)
        if not re.fullmatch(r"^\d{12}$", apaar_str):
            if not apaar_str.isdigit():
                msg = f"APAAR ID contains non-numeric characters: '{apaar_str}'."
            elif len(apaar_str) < 12:
                msg = f"APAAR ID has only {len(apaar_str)} digits; exactly 12 digits are required."
            else:
                msg = f"APAAR ID has {len(apaar_str)} digits; exactly 12 digits are required."

            return [ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="error",
                status="failed",
                message=f"Invalid APAAR format: {msg}",
                affected_field="apaar_id",
                suggested_action="Check the official ABC ID card and enter the exact 12-digit numeric identifier.",
                rule_version=self.rule_version
            )]

        return [ValidationResultDTO(
            rule_id=self.rule_id,
            rule_name=self.name,
            severity="info",
            status="passed",
            message="APAAR ID conforms to standard 12-digit format. (Note: format check is not official verification).",
            affected_field="apaar_id",
            suggested_action=None,
            rule_version=self.rule_version
        )]

class ExactDuplicateApaarRule(BaseValidationRule):
    rule_id = "R3_EXACT_DUPLICATE_APAAR"
    name = "Exact Duplicate APAAR ID Check"
    severity = "warning"  # Warning severity routes to 'Needs Review' per Section 3a

    def evaluate(self, context: Dict[str, Any]) -> List[ValidationResultDTO]:
        student = context.get("student")
        raw_apaar = student.apaar_id if hasattr(student, "apaar_id") else student.get("apaar_id")
        current_id = student.id if hasattr(student, "id") else student.get("id")
        existing_students = context.get("existing_students", [])

        normalized = normalize_apaar(raw_apaar)
        # Empty values never count as duplicates
        if not normalized:
            return [ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="info",
                status="passed",
                message="No duplicate check executed because APAAR ID is absent.",
                affected_field="apaar_id",
                suggested_action=None,
                rule_version=self.rule_version
            )]

        matching_records = []
        for other in existing_students:
            other_id = other.id if hasattr(other, "id") else other.get("id")
            if current_id and other_id == current_id:
                continue
            other_apaar = other.apaar_id if hasattr(other, "apaar_id") else other.get("apaar_id")
            if normalize_apaar(other_apaar) == normalized:
                other_roll = other.roll_number if hasattr(other, "roll_number") else other.get("roll_number")
                other_name = other.full_name if hasattr(other, "full_name") else other.get("full_name")
                matching_records.append((other_roll, other_name))

        if matching_records:
            match_desc = ", ".join([f"{r} ({n})" for r, n in matching_records[:3]])
            return [ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="warning",
                status="failed",
                message=f"APAAR ID matches another record in the institution: {match_desc}.",
                affected_field="apaar_id",
                suggested_action="Review both student records in the Verification Centre to determine if this is an administrative entry error.",
                rule_version=self.rule_version
            )]

        # Check for cross-institution collision if valid 12-digit format
        cross_collision_found = False
        if len(normalized) == 12 and normalized.isdigit():
            db = context.get("db")
            current_inst = student.institution_id if hasattr(student, "institution_id") else student.get("institution_id")
            if db and current_inst:
                from sqlalchemy import func
                from app.models.student import Student
                q = db.query(Student).filter(
                    Student.institution_id != current_inst,
                    Student.is_archived == False,
                    (
                        (Student.apaar_id == normalized) |
                        (func.replace(func.replace(Student.apaar_id, "-", ""), " ", "") == normalized)
                    )
                )
                if current_id:
                    q = q.filter(Student.id != current_id)
                if q.first():
                    cross_collision_found = True

            cross_students = context.get("cross_institution_students", [])
            for cs in cross_students:
                cs_id = cs.id if hasattr(cs, "id") else cs.get("id")
                if current_id and cs_id == current_id:
                    continue
                cs_inst = cs.institution_id if hasattr(cs, "institution_id") else cs.get("institution_id")
                cs_archived = cs.is_archived if hasattr(cs, "is_archived") else cs.get("is_archived", False)
                if cs_archived or (current_inst and cs_inst == current_inst):
                    continue
                cs_apaar = cs.apaar_id if hasattr(cs, "apaar_id") else cs.get("apaar_id")
                if normalize_apaar(cs_apaar) == normalized:
                    cross_collision_found = True
                    break

        if cross_collision_found:
            return [ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="warning",
                status="failed",
                message="Potential cross-institution APAAR collision detected with another registered institution.",
                affected_field="apaar_id",
                suggested_action="Review case in Verification Centre. Verify student's original physical identity documents locally. (Note: Collision alert is not proof of fraud).",
                rule_version=self.rule_version
            )]

        return [ValidationResultDTO(
            rule_id=self.rule_id,
            rule_name=self.name,
            severity="info",
            status="passed",
            message="No identical APAAR ID detected in institution records.",
            affected_field="apaar_id",
            suggested_action=None,
            rule_version=self.rule_version
        )]

class DuplicateRollNumberRule(BaseValidationRule):
    rule_id = "R4_DUPLICATE_ROLL_NUMBER"
    name = "Duplicate Roll Number Check"
    severity = "warning"  # Warning severity routes to 'Needs Review' per Section 3a

    def evaluate(self, context: Dict[str, Any]) -> List[ValidationResultDTO]:
        student = context.get("student")
        current_roll = str(student.roll_number if hasattr(student, "roll_number") else student.get("roll_number", "")).strip().lower()
        current_year = student.admission_year if hasattr(student, "admission_year") else student.get("admission_year")
        current_inst = student.institution_id if hasattr(student, "institution_id") else student.get("institution_id")
        current_id = student.id if hasattr(student, "id") else student.get("id")
        existing_students = context.get("existing_students", [])

        if not current_roll:
            return []

        colliding_records = []
        for other in existing_students:
            other_id = other.id if hasattr(other, "id") else other.get("id")
            if current_id and other_id == current_id:
                continue
            other_inst = other.institution_id if hasattr(other, "institution_id") else other.get("institution_id")
            other_year = other.admission_year if hasattr(other, "admission_year") else other.get("admission_year")
            other_roll = str(other.roll_number if hasattr(other, "roll_number") else other.get("roll_number", "")).strip().lower()

            # Scoped to same institution + admission year
            if other_inst == current_inst and other_year == current_year and other_roll == current_roll:
                other_name = other.full_name if hasattr(other, "full_name") else other.get("full_name")
                colliding_records.append((other.roll_number if hasattr(other, "roll_number") else other.get("roll_number"), other_name))

        if colliding_records:
            match_desc = ", ".join([f"{r} ({n})" for r, n in colliding_records[:3]])
            return [ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="warning",
                status="failed",
                message=f"Roll number already assigned to another student in admission year {current_year}: {match_desc}.",
                affected_field="roll_number",
                suggested_action="Assign a distinct roll number or verify whether this record is an unintentional re-entry.",
                rule_version=self.rule_version
            )]

        return [ValidationResultDTO(
            rule_id=self.rule_id,
            rule_name=self.name,
            severity="info",
            status="passed",
            message="Roll number is unique for this institution and admission year.",
            affected_field="roll_number",
            suggested_action=None,
            rule_version=self.rule_version
        )]

class AcademicConsistencyRule(BaseValidationRule):
    rule_id = "R5_ACADEMIC_CONSISTENCY"
    name = "Academic Consistency Check"
    severity = "error"

    def evaluate(self, context: Dict[str, Any]) -> List[ValidationResultDTO]:
        student = context.get("student")
        results = []
        current_year = datetime.now(timezone.utc).year
        admission_year = student.admission_year if hasattr(student, "admission_year") else student.get("admission_year")
        course_id = student.course_id if hasattr(student, "course_id") else student.get("course_id")
        valid_course_ids = context.get("valid_course_ids", set())

        if admission_year:
            try:
                ay = int(admission_year)
                if ay < 2000 or ay > current_year + 2:
                    results.append(ValidationResultDTO(
                        rule_id=self.rule_id,
                        rule_name=self.name,
                        severity="error",
                        status="failed",
                        message=f"Admission year {ay} is out of allowable range (2000 - {current_year + 2}).",
                        affected_field="admission_year",
                        suggested_action="Enter the valid 4-digit admission academic year.",
                        rule_version=self.rule_version
                    ))
            except ValueError:
                results.append(ValidationResultDTO(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    severity="error",
                    status="failed",
                    message="Admission year must be a valid 4-digit integer.",
                    affected_field="admission_year",
                    suggested_action="Correct the admission year format.",
                    rule_version=self.rule_version
                ))

        if course_id and course_id not in valid_course_ids:
            results.append(ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="error",
                status="failed",
                message="Referenced course code does not exist in institution catalog.",
                affected_field="course_id",
                suggested_action="Select an approved course from the institution's active course list.",
                rule_version=self.rule_version
            ))

        if not results:
            results.append(ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="info",
                status="passed",
                message="Academic parameters and course affiliations are consistent.",
                affected_field=None,
                suggested_action=None,
                rule_version=self.rule_version
            ))

        return results

class PossibleDuplicateRule(BaseValidationRule):
    rule_id = "R6_POSSIBLE_DUPLICATE"
    name = "Possible Duplicate Heuristic Check"
    severity = "warning"

    def evaluate(self, context: Dict[str, Any]) -> List[ValidationResultDTO]:
        student = context.get("student")
        current_name = normalize_name(student.full_name if hasattr(student, "full_name") else student.get("full_name"))
        current_dob = student.date_of_birth if hasattr(student, "date_of_birth") else student.get("date_of_birth")
        current_id = student.id if hasattr(student, "id") else student.get("id")
        current_inst = student.institution_id if hasattr(student, "institution_id") else student.get("institution_id")
        existing_students = context.get("existing_students", [])

        if not current_name or not current_dob:
            return []

        suspected = []
        for other in existing_students:
            other_id = other.id if hasattr(other, "id") else other.get("id")
            if current_id and other_id == current_id:
                continue
            other_inst = other.institution_id if hasattr(other, "institution_id") else other.get("institution_id")
            if other_inst != current_inst:
                continue

            other_name = normalize_name(other.full_name if hasattr(other, "full_name") else other.get("full_name"))
            other_dob = other.date_of_birth if hasattr(other, "date_of_birth") else other.get("date_of_birth")

            if current_name == other_name and current_dob == other_dob:
                other_roll = other.roll_number if hasattr(other, "roll_number") else other.get("roll_number")
                suspected.append(other_roll)

        if suspected:
            return [ValidationResultDTO(
                rule_id=self.rule_id,
                rule_name=self.name,
                severity="warning",
                status="failed",
                message=f"Possible duplicate candidate: identical student name and date of birth matches record(s): {', '.join(suspected)}.",
                affected_field="full_name",
                suggested_action="Review matching profiles side-by-side in Verification Centre. (Similarity is not proof of identity).",
                rule_version=self.rule_version
            )]

        return [ValidationResultDTO(
            rule_id=self.rule_id,
            rule_name=self.name,
            severity="info",
            status="passed",
            message="No heuristic similarity matches found for student name and date of birth.",
            affected_field=None,
            suggested_action=None,
            rule_version=self.rule_version
        )]
