import hashlib
import io
import json
import pandas as pd
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.models.student import Student
from app.models.course import Course
from app.models.import_job import ImportJob, ImportJobError
from app.services.validation.engine import validation_engine
from app.services.validation.rules import normalize_apaar, normalize_name
from app.services.audit_service import record_audit_log
from app.schemas.student import (
    validate_full_name,
    validate_indian_phone,
    validate_email_format,
    validate_dob_calendar
)

FIELD_SYNONYMS = {
    "roll_number": ["roll", "roll_number", "rollno", "roll_no", "registration_no", "reg_no", "student_id"],
    "full_name": ["name", "student_name", "full_name", "candidate_name", "student"],
    "apaar_id": ["apaar", "apaar_id", "abc_id", "apaar_number", "aadhaar_apaar", "apaar_no"],
    "course_code": ["course", "course_code", "branch", "program", "department", "degree"],
    "admission_year": ["year", "admission_year", "batch", "joining_year", "academic_year"],
    "date_of_birth": ["dob", "date_of_birth", "birth_date", "birthdate"],
    "gender": ["gender", "sex"],
    "email": ["email", "email_address", "student_email", "mail"],
    "phone": ["phone", "mobile", "contact", "contact_number", "mobile_no"],
}

REQUIRED_IMPORT_FIELDS = ["roll_number", "full_name", "course_code", "admission_year"]

def compute_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def compute_mapping_hash(mapping: Dict[str, str]) -> str:
    sorted_pairs = sorted((str(k), str(v)) for k, v in mapping.items())
    return hashlib.sha256(json.dumps(sorted_pairs).encode("utf-8")).hexdigest()

def auto_suggest_mapping(headers: List[str]) -> Dict[str, Optional[str]]:
    mapping = {}
    normalized_headers = {str(h).strip().lower().replace(" ", "_"): h for h in headers}

    for std_field, synonyms in FIELD_SYNONYMS.items():
        matched = None
        for syn in synonyms:
            if syn in normalized_headers:
                matched = normalized_headers[syn]
                break
        if not matched:
            for norm_h, original_h in normalized_headers.items():
                if any(syn in norm_h for syn in synonyms):
                    matched = original_h
                    break
        mapping[std_field] = matched
    return mapping

def parse_file_to_df(content: bytes, filename: str) -> pd.DataFrame:
    fname = filename.lower()
    if fname.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False)
    elif fname.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content), dtype=str, keep_default_na=False)
    else:
        raise ValueError("Unsupported file format. Please upload a valid .csv or .xlsx file.")
    return df

def validate_and_stage_import(
    db: Session,
    institution_id: int,
    df: pd.DataFrame,
    mapping: Dict[str, str]
) -> Dict[str, Any]:
    unmapped = [req for req in REQUIRED_IMPORT_FIELDS if not mapping.get(req)]
    if unmapped:
        raise ValueError(f"Required fields not mapped: {', '.join(unmapped)}.")

    courses = db.query(Course).filter(Course.institution_id == institution_id).all()
    course_map = {c.code.strip().upper(): c.id for c in courses}

    existing_students = db.query(Student).filter(
        Student.institution_id == institution_id,
        Student.is_archived == False
    ).all()
    existing_rolls = {(s.admission_year, s.roll_number.strip().lower()): s for s in existing_students}
    existing_apaars = {normalize_apaar(s.apaar_id): s for s in existing_students if s.apaar_id}

    total_rows = len(df)
    if total_rows > 5000:
        raise ValueError("File exceeds maximum limit of 5,000 rows. Please split the batch.")

    parsed_rows = []
    seen_file_rolls = set()
    seen_file_apaars = set()

    summary = {
        "total_rows": total_rows,
        "valid_count": 0,
        "invalid_count": 0,
        "duplicate_count": 0,
        "needs_review_count": 0,
        "preview_rows": [],
        "errors": [],
        "update_candidates": []
    }

    for idx, row in df.iterrows():
        row_num = idx + 2
        row_errors = []
        is_duplicate = False
        needs_review = False

        roll = str(row.get(mapping.get("roll_number", ""), "")).strip()
        name = str(row.get(mapping.get("full_name", ""), "")).strip()
        apaar = str(row.get(mapping.get("apaar_id", ""), "")).strip()
        course_str = str(row.get(mapping.get("course_code", ""), "")).strip().upper()
        year_str = str(row.get(mapping.get("admission_year", ""), "")).strip()
        dob = str(row.get(mapping.get("date_of_birth", ""), "")).strip()
        gender = str(row.get(mapping.get("gender", ""), "")).strip()
        email = str(row.get(mapping.get("email", ""), "")).strip()
        phone = str(row.get(mapping.get("phone", ""), "")).strip()

        if not roll:
            row_errors.append("Roll number is required and cannot be blank.")
        elif len(roll) > 100:
            row_errors.append("Roll number cannot exceed 100 characters.")

        if not name:
            row_errors.append("Student full name is required.")
        else:
            try:
                validate_full_name(name, required=True)
            except ValueError as ve:
                row_errors.append(f"Student name '{name}': {str(ve)}")

        if not course_str:
            row_errors.append("Course code is required.")
        elif course_str not in course_map:
            row_errors.append(f"Course '{course_str}' does not exist in institution catalog.")

        adm_year = 0
        if not year_str:
            row_errors.append("Admission year is required.")
        else:
            try:
                adm_year = int(year_str)
                current_year = datetime.now(timezone.utc).year
                if adm_year < 2000 or adm_year > current_year + 2:
                    row_errors.append(f"Admission year {adm_year} is out of allowable range (2000 - {current_year + 2}).")
            except ValueError:
                row_errors.append(f"Admission year '{year_str}' must be a 4-digit number.")

        if phone:
            try:
                validate_indian_phone(phone, required=False)
            except ValueError as ve:
                row_errors.append(f"Mobile number '{phone}': {str(ve)}")

        if email:
            try:
                validate_email_format(email, required=False)
            except ValueError as ve:
                row_errors.append(f"Email '{email}': {str(ve)}")

        if dob:
            try:
                validate_dob_calendar(dob)
            except ValueError as ve:
                row_errors.append(f"Date of birth '{dob}': {str(ve)}")

        norm_apaar = normalize_apaar(apaar)
        if norm_apaar:
            if not norm_apaar.isdigit():
                row_errors.append(f"APAAR ID contains non-numeric characters: '{apaar}'.")
            elif len(norm_apaar) != 12:
                row_errors.append(f"APAAR ID has {len(norm_apaar)} digits; exactly 12 digits required.")
        else:
            needs_review = True

        if norm_apaar:
            if norm_apaar in seen_file_apaars:
                row_errors.append(f"APAAR ID '{apaar}' appears multiple times in this uploaded file.")
                is_duplicate = True
            elif norm_apaar in existing_apaars:
                peer = existing_apaars[norm_apaar]
                row_errors.append(f"APAAR ID '{apaar}' matches existing student record: {peer.roll_number} ({peer.full_name}).")
                is_duplicate = True
            seen_file_apaars.add(norm_apaar)

        existing_match = None
        if roll and adm_year:
            roll_key = (adm_year, roll.lower())
            if roll_key in seen_file_rolls:
                row_errors.append(f"Roll number '{roll}' is duplicated within this file for admission year {adm_year}.")
                is_duplicate = True
            elif roll_key in existing_rolls:
                existing_match = existing_rolls[roll_key]
                row_errors.append(f"Roll number '{roll}' already belongs to student {existing_match.full_name} for admission year {adm_year}.")
                is_duplicate = True
            seen_file_rolls.add(roll_key)

        row_status = "valid"
        if row_errors:
            if is_duplicate:
                row_status = "duplicate"
                summary["duplicate_count"] += 1
                if existing_match:
                    summary["update_candidates"].append({
                        "roll_number": roll,
                        "current_name": existing_match.full_name,
                        "new_name": name,
                        "current_apaar": existing_match.apaar_id,
                        "new_apaar": apaar
                    })
            else:
                row_status = "invalid"
                summary["invalid_count"] += 1
            
            for err in row_errors:
                summary["errors"].append({
                    "row_index": row_num,
                    "field_name": "general",
                    "error_message": err,
                    "raw_data": f"Roll: {roll}, Name: {name}, APAAR: {apaar}"
                })
        elif needs_review:
            row_status = "needs_review"
            summary["needs_review_count"] += 1
        else:
            summary["valid_count"] += 1

        row_data = {
            "row_index": row_num,
            "roll_number": roll,
            "full_name": name,
            "apaar_id": apaar,
            "course_id": course_map.get(course_str),
            "course_code": course_str,
            "admission_year": adm_year,
            "date_of_birth": dob,
            "gender": gender,
            "email": email,
            "phone": phone,
            "status": row_status,
            "errors": row_errors
        }
        parsed_rows.append(row_data)

    summary["preview_rows"] = parsed_rows[:10]
    return {
        "summary": summary,
        "rows": parsed_rows
    }

def commit_import_job(
    db: Session,
    institution_id: int,
    user_id: int,
    filename: str,
    file_hash: str,
    mapping_hash: str,
    rows: List[Dict[str, Any]],
    options: Dict[str, Any]
) -> ImportJob:
    # Idempotency check with mapping hash (Section 7):
    existing_job = db.query(ImportJob).filter(
        ImportJob.institution_id == institution_id,
        ImportJob.file_hash == file_hash,
        ImportJob.mapping_hash == mapping_hash,
        ImportJob.status == "completed"
    ).first()

    if existing_job and not options.get("force_reimport", False):
        raise ValueError(
            f"This file was already imported on {existing_job.completed_at.strftime('%Y-%m-%d %H:%M UTC')} "
            f"(Job {existing_job.id}). Re-uploading the same file does not create duplicate records."
        )

    job = ImportJob(
        institution_id=institution_id,
        user_id=user_id,
        filename=filename,
        file_hash=file_hash,
        mapping_hash=mapping_hash,
        total_rows=len(rows),
        processed_rows=0,
        created_rows=0,
        updated_rows=0,
        skipped_rows=0,
        invalid_rows=0,
        review_rows=0,
        status="validating"
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    skip_duplicates = options.get("skip_duplicates", True)
    update_existing = options.get("update_existing", False)

    created_count = 0
    updated_count = 0
    skipped_count = 0
    invalid_count = 0
    review_count = 0

    try:
        # Atomic transaction per import
        for r in rows:
            job.processed_rows += 1
            row_errors = r.get("errors", [])

            if row_errors:
                if r["status"] == "duplicate":
                    if skip_duplicates and not update_existing:
                        skipped_count += 1
                        continue
                    elif update_existing:
                        existing_s = db.query(Student).filter(
                            Student.institution_id == institution_id,
                            Student.admission_year == r["admission_year"],
                            Student.roll_number == r["roll_number"]
                        ).first()
                        if existing_s:
                            existing_s.full_name = r["full_name"]
                            if r["apaar_id"]:
                                existing_s.apaar_id = r["apaar_id"]
                            if r["date_of_birth"]:
                                existing_s.date_of_birth = r["date_of_birth"]
                            if r["email"]:
                                existing_s.email = r["email"]
                            if r["phone"]:
                                existing_s.phone = r["phone"]
                            existing_s.version += 1
                            updated_count += 1
                            continue

                invalid_count += 1
                for err in row_errors:
                    db.add(ImportJobError(
                        import_job_id=job.id,
                        row_index=r["row_index"],
                        field_name="general",
                        error_message=err,
                        raw_data=json.dumps(r)
                    ))
                continue

            # Valid record (Validation status is Ready or Needs Review)
            new_student = Student(
                institution_id=institution_id,
                course_id=r["course_id"],
                apaar_id=r["apaar_id"] if r["apaar_id"] else None,
                roll_number=r["roll_number"],
                full_name=r["full_name"],
                date_of_birth=r["date_of_birth"] if r["date_of_birth"] else None,
                gender=r["gender"] if r["gender"] else None,
                admission_year=r["admission_year"],
                email=r["email"] if r["email"] else None,
                phone=r["phone"] if r["phone"] else None,
                status="Ready" if r["status"] == "valid" else "Needs Review",
                version=1
            )
            db.add(new_student)
            created_count += 1
            if r["status"] == "needs_review":
                review_count += 1

        job.created_rows = created_count
        job.updated_rows = updated_count
        job.skipped_rows = skipped_count
        job.invalid_rows = invalid_count
        job.review_rows = review_count
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(job)

        # Re-run institution validation engine to ensure clean consistency and alerts
        validation_engine.run_for_institution(db, institution_id)

        record_audit_log(
            db=db,
            action="BULK_IMPORT_COMPLETED",
            target_type="IMPORT_JOB",
            target_id=job.id,
            outcome="SUCCESS",
            details={
                "filename": filename,
                "created": created_count,
                "updated": updated_count,
                "skipped": skipped_count,
                "invalid": invalid_count
            },
            institution_id=institution_id
        )

        return job

    except Exception as exc:
        db.rollback()
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        raise exc
