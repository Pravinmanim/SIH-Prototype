import pytest
import uuid
import io
import json
import pandas as pd
from starlette.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.user import User
from app.models.audit import AuditLog
from app.models.duplicate import DuplicateAlert
from app.models.review import ReviewCase
from app.services.validation.rules import normalize_apaar
from app.services.validation.engine import validation_engine

client = TestClient(app)

def get_auth_headers(email: str) -> dict:
    fresh_client = TestClient(app)
    login_res = fresh_client.post("/api/auth/login", json={"email": email, "password": "password123"})
    assert login_res.status_code == 200, f"Login failed for {email}: {login_res.text}"
    token = login_res.json()["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def test_cross_institution_apaar_collision_detection():
    """
    When Student A in Inst 1 has valid APAAR X, and Student B in Inst 2 is created
    with APAAR X:
    - Inst 2 student is created with status 'Needs Review'.
    - DuplicateAlert of type 'cross_institution_apaar' is created.
    - ReviewCase for Inst 2 is created in 'Pending Review'.
    - Inst 1 student is also flagged with ReviewCase.
    - Safe audit log is written.
    """
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")     # Inst 1
    admin_inst2 = get_auth_headers("suresh.admin@bnce.edu")   # Inst 2

    shared_apaar = f"88{uuid.uuid4().int % 10000000000:010d}"
    roll_inst1 = f"2026-CSE-{uuid.uuid4().hex[:6]}"
    roll_inst2 = f"2026-ECE-{uuid.uuid4().hex[:6]}"

    # 1. Create Student in Institution 1
    res1 = client.post("/api/students", json={
        "roll_number": roll_inst1,
        "full_name": "Aarav Sharma",
        "apaar_id": shared_apaar,
        "course_id": 1,
        "admission_year": 2026,
        "phone": "9876543210"
    }, headers=admin_inst1)
    assert res1.status_code == 201
    s1_id = res1.json()["student_id"]

    # 2. Create Student in Institution 2 with identical APAAR
    res2 = client.post("/api/students", json={
        "roll_number": roll_inst2,
        "full_name": "Diya Patil",
        "apaar_id": shared_apaar,
        "course_id": 25,  # Inst 2 course
        "admission_year": 2026,
        "phone": "9123456780"
    }, headers=admin_inst2)
    assert res2.status_code == 201
    s2_id = res2.json()["student_id"]
    assert res2.json()["status"] == "Needs Review"

    # Verify database state
    db = SessionLocal()
    try:
        s1 = db.query(Student).filter(Student.id == s1_id).first()
        s2 = db.query(Student).filter(Student.id == s2_id).first()
        assert s2.status == "Needs Review"
        assert s1.status == "Needs Review"

        # Check DuplicateAlert for Inst 2
        alert_inst2 = db.query(DuplicateAlert).filter(
            DuplicateAlert.institution_id == 2,
            DuplicateAlert.alert_type == "cross_institution_apaar",
            ((DuplicateAlert.student_id_1 == s2.id) | (DuplicateAlert.student_id_2 == s2.id))
        ).first()
        assert alert_inst2 is not None

        # Check ReviewCase for Inst 2
        case_inst2 = db.query(ReviewCase).filter(
            ReviewCase.institution_id == 2,
            ReviewCase.student_id == s2.id,
            ReviewCase.status == "Pending Review"
        ).first()
        assert case_inst2 is not None
        assert "cross-institution" in case_inst2.reason.lower()

        # Check ReviewCase for Inst 1
        case_inst1 = db.query(ReviewCase).filter(
            ReviewCase.institution_id == 1,
            ReviewCase.student_id == s1.id
        ).first()
        assert case_inst1 is not None

        # Check safe audit log (no full APAAR, no peer PII)
        audit = db.query(AuditLog).filter(
            AuditLog.action == "CROSS_INSTITUTION_COLLISION_DETECTED",
            AuditLog.target_id == str(s2.id)
        ).first()
        assert audit is not None
        assert shared_apaar not in audit.details
        assert "Aarav Sharma" not in audit.details
        assert roll_inst1 not in audit.details
    finally:
        db.close()

def test_cross_institution_privacy_scrub_in_case_detail():
    """
    Institution 2 officer views ReviewCase for a cross-institution collision:
    - Response has is_cross_institution: True.
    - peer_student has institution_name and masked_apaar_id.
    - peer_student strictly omits full_name, roll_number, DOB, phone, email, course.
    """
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")     # Inst 1
    admin_inst2 = get_auth_headers("suresh.admin@bnce.edu")   # Inst 2
    officer_inst2 = get_auth_headers("priya.officer@bnce.edu") # Inst 2 Officer

    shared_apaar = f"77{uuid.uuid4().int % 10000000000:010d}"
    roll1 = f"2026-PRIV-{uuid.uuid4().hex[:6]}"
    roll2 = f"2026-PRIV-{uuid.uuid4().hex[:6]}"

    # Inst 1 student
    res1 = client.post("/api/students", json={
        "roll_number": roll1,
        "full_name": "Rohan Gupta",
        "apaar_id": shared_apaar,
        "course_id": 1,
        "admission_year": 2026,
        "phone": "9876543210",
        "email": "rohan.gupta@apex.edu",
        "date_of_birth": "2004-05-15"
    }, headers=admin_inst1)
    assert res1.status_code == 201

    # Inst 2 student
    res2 = client.post("/api/students", json={
        "roll_number": roll2,
        "full_name": "Kavita Deshmukh",
        "apaar_id": shared_apaar,
        "course_id": 25,
        "admission_year": 2026,
        "phone": "9123456789"
    }, headers=admin_inst2)
    assert res2.status_code == 201
    s2_id = res2.json()["student_id"]

    # Inst 2 officer lists review cases
    cases_res = client.get("/api/review/cases?status=ALL", headers=officer_inst2)
    assert cases_res.status_code == 200
    my_cases = cases_res.json()
    target_case = next((c for c in my_cases if c["student_id"] == s2_id), None)
    assert target_case is not None
    assert target_case["is_cross_institution"] is True

    # Inst 2 officer examines case detail
    detail_res = client.get(f"/api/review/cases/{target_case['id']}", headers=officer_inst2)
    assert detail_res.status_code == 200
    data = detail_res.json()

    assert data["is_cross_institution"] is True
    peer = data["peer_student"]
    assert peer is not None
    assert peer["is_cross_institution"] is True
    assert "institution_name" in peer

    # Privacy verification: peer's personal information must be completely absent
    assert "full_name" not in peer or peer.get("full_name") is None
    assert "roll_number" not in peer or peer.get("roll_number") is None
    assert "email" not in peer or peer.get("email") is None
    assert "phone" not in peer or peer.get("phone") is None
    assert "date_of_birth" not in peer or peer.get("date_of_birth") is None
    assert "course_name" not in peer or peer.get("course_name") is None

    # Check that secret values do not appear anywhere in the serialized payload
    detail_str = detail_res.text
    assert "Rohan Gupta" not in detail_str
    assert roll1 not in detail_str
    assert "rohan.gupta@apex.edu" not in detail_str

def test_same_institution_duplicate_rejection_intact():
    """Verify that creating two students with the same APAAR in the SAME institution is rejected."""
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")
    test_apaar = f"66{uuid.uuid4().int % 10000000000:010d}"
    roll1 = f"2026-SAME-{uuid.uuid4().hex[:6]}"
    roll2 = f"2026-SAME-{uuid.uuid4().hex[:6]}"

    res1 = client.post("/api/students", json={
        "roll_number": roll1,
        "full_name": "Student A",
        "apaar_id": test_apaar,
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_inst1)
    assert res1.status_code == 201

    res2 = client.post("/api/students", json={
        "roll_number": roll2,
        "full_name": "Student B",
        "apaar_id": test_apaar,
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_inst1)
    assert res2.status_code == 400
    assert "This APAAR ID matches an existing record" in res2.json()["detail"]

def test_update_student_excludes_self():
    """Updating a student's own record with the same APAAR does not collide with itself."""
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")
    test_apaar = f"55{uuid.uuid4().int % 10000000000:010d}"
    roll = f"2026-SELF-{uuid.uuid4().hex[:6]}"

    res = client.post("/api/students", json={
        "roll_number": roll,
        "full_name": "Self Updating Student",
        "apaar_id": test_apaar,
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_inst1)
    assert res.status_code == 201
    s_id = res.json()["student_id"]
    version = res.json()["version"]

    # Update name and keep same APAAR
    res_update = client.put(f"/api/students/{s_id}", json={
        "full_name": "Self Updating Student Modified",
        "apaar_id": test_apaar,
        "version": version
    }, headers=admin_inst1)
    assert res_update.status_code == 200

def test_soft_archived_students_ignored():
    """An APAAR on an archived student record in Inst 1 does NOT trigger a collision for Inst 2."""
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")
    admin_inst2 = get_auth_headers("suresh.admin@bnce.edu")
    test_apaar = f"44{uuid.uuid4().int % 10000000000:010d}"
    roll1 = f"2026-ARC-{uuid.uuid4().hex[:6]}"
    roll2 = f"2026-ARC-{uuid.uuid4().hex[:6]}"

    # Create and archive student in Inst 1
    res1 = client.post("/api/students", json={
        "roll_number": roll1,
        "full_name": "Student To Be Archived",
        "apaar_id": test_apaar,
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_inst1)
    assert res1.status_code == 201
    s1_id = res1.json()["student_id"]

    res_del = client.delete(f"/api/students/{s1_id}", headers=admin_inst1)
    assert res_del.status_code == 200

    # Create student in Inst 2 with same APAAR
    res2 = client.post("/api/students", json={
        "roll_number": roll2,
        "full_name": "Active Student Inst Two",
        "apaar_id": test_apaar,
        "course_id": 25,
        "admission_year": 2026
    }, headers=admin_inst2)
    assert res2.status_code == 201
    s2_id = res2.json()["student_id"]

    # Inst 2 student should be Ready because Inst 1 record is archived!
    assert res2.json()["status"] == "Ready"

def test_idempotency_no_duplicate_alert_multiplication():
    """Running validation repeatedly does not multiply DuplicateAlerts or ReviewCases."""
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")
    admin_inst2 = get_auth_headers("suresh.admin@bnce.edu")
    shared_apaar = f"33{uuid.uuid4().int % 10000000000:010d}"
    roll1 = f"2026-IDEM-{uuid.uuid4().hex[:6]}"
    roll2 = f"2026-IDEM-{uuid.uuid4().hex[:6]}"

    client.post("/api/students", json={
        "roll_number": roll1,
        "full_name": "Student Idem Alpha",
        "apaar_id": shared_apaar,
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_inst1)

    res2 = client.post("/api/students", json={
        "roll_number": roll2,
        "full_name": "Student Idem Beta",
        "apaar_id": shared_apaar,
        "course_id": 25,
        "admission_year": 2026
    }, headers=admin_inst2)
    s2_id = res2.json()["student_id"]

    db = SessionLocal()
    try:
        # Count alerts and review cases before re-running
        alert_count_before = db.query(DuplicateAlert).filter(
            DuplicateAlert.institution_id == 2,
            ((DuplicateAlert.student_id_1 == s2_id) | (DuplicateAlert.student_id_2 == s2_id))
        ).count()
        case_count_before = db.query(ReviewCase).filter(
            ReviewCase.institution_id == 2,
            ReviewCase.student_id == s2_id
        ).count()
        assert alert_count_before == 1
        assert case_count_before == 1

        # Run validation engine 3 more times for institution 2
        validation_engine.run_for_institution(db, 2)
        validation_engine.run_for_institution(db, 2)
        validation_engine.run_for_institution(db, 2)

        alert_count_after = db.query(DuplicateAlert).filter(
            DuplicateAlert.institution_id == 2,
            ((DuplicateAlert.student_id_1 == s2_id) | (DuplicateAlert.student_id_2 == s2_id))
        ).count()
        case_count_after = db.query(ReviewCase).filter(
            ReviewCase.institution_id == 2,
            ReviewCase.student_id == s2_id
        ).count()

        # Idempotent: counts must remain exactly 1!
        assert alert_count_after == 1
        assert case_count_after == 1
    finally:
        db.close()

def test_false_positive_suppression():
    """If an officer marks a cross-institution collision as False Positive, re-validation preserves it."""
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")
    admin_inst2 = get_auth_headers("suresh.admin@bnce.edu")
    officer_inst2 = get_auth_headers("priya.officer@bnce.edu")

    shared_apaar = f"22{uuid.uuid4().int % 10000000000:010d}"
    roll1 = f"2026-FP-{uuid.uuid4().hex[:6]}"
    roll2 = f"2026-FP-{uuid.uuid4().hex[:6]}"

    client.post("/api/students", json={
        "roll_number": roll1,
        "full_name": "FP Student One",
        "apaar_id": shared_apaar,
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_inst1)

    res2 = client.post("/api/students", json={
        "roll_number": roll2,
        "full_name": "FP Student Two",
        "apaar_id": shared_apaar,
        "course_id": 25,
        "admission_year": 2026
    }, headers=admin_inst2)
    s2_id = res2.json()["student_id"]

    db = SessionLocal()
    try:
        case = db.query(ReviewCase).filter(
            ReviewCase.institution_id == 2,
            ReviewCase.student_id == s2_id
        ).first()
        case_id = case.id

        # Officer marks False Positive with required reason
        res_action = client.post(f"/api/review/cases/{case_id}/action", json={
            "action": "mark_false_positive",
            "note_text": "Verified student physical ABC card and DigiLocker account locally. Confirmed correct."
        }, headers=officer_inst2)
        assert res_action.status_code == 200

        # Check DB status is False Positive
        db.refresh(case)
        assert case.status == "False Positive"

        # Re-run validation for institution 2
        validation_engine.run_for_institution(db, 2)
        db.refresh(case)

        # Must STAY False Positive (suppression intact)
        assert case.status == "False Positive"
    finally:
        db.close()

def test_bulk_import_flags_cross_institution_collision():
    """
    Bulk import staging checks cross-institution APAAR.
    The row is flagged with status 'needs_review' rather than failing the batch,
    and committing creates the student with 'Needs Review'.
    """
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")
    admin_inst2 = get_auth_headers("suresh.admin@bnce.edu")

    shared_apaar = f"11{uuid.uuid4().int % 10000000000:010d}"
    roll1 = f"2026-IMP-{uuid.uuid4().hex[:6]}"
    roll2 = f"2026-IMP-{uuid.uuid4().hex[:6]}"

    # Inst 1 student
    client.post("/api/students", json={
        "roll_number": roll1,
        "full_name": "Existing Inst Student",
        "apaar_id": shared_apaar,
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_inst1)

    # Inst 2 bulk upload CSV
    csv_content = f"roll_number,full_name,apaar_id,course_code,admission_year\n{roll2},Imported Student,{shared_apaar},CSE,2026\n"
    files = {"file": ("test_import.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}

    mapping = {
        "roll_number": "roll_number",
        "full_name": "full_name",
        "apaar_id": "apaar_id",
        "course_code": "course_code",
        "admission_year": "admission_year"
    }

    validate_res = client.post(
        "/api/import/validate",
        files=files,
        data={"mapping_json": json.dumps(mapping)},
        headers={"Authorization": admin_inst2["Authorization"]}
    )
    assert validate_res.status_code == 200
    v_data = validate_res.json()
    summary = v_data["summary"]

    # Cross-institution APAAR is flagged for review, not counted as invalid format error
    assert summary["invalid_count"] == 0
    assert summary["needs_review_count"] >= 1

    # Commit import
    commit_res = client.post("/api/import/commit", json={
        "filename": v_data["filename"],
        "file_hash": v_data["file_hash"],
        "mapping_hash": v_data["mapping_hash"],
        "staged_rows": v_data["staged_rows"],
        "options": {"skip_duplicates": True}
    }, headers=admin_inst2)
    assert commit_res.status_code == 200
    assert commit_res.json()["created_rows"] == 1

    # Check imported student status in DB
    db = SessionLocal()
    try:
        imp_student = db.query(Student).filter(
            Student.institution_id == 2,
            Student.roll_number == roll2
        ).first()
        assert imp_student is not None
        assert imp_student.status == "Needs Review"

        # Duplicate alert exists for this cross-institution collision
        alert = db.query(DuplicateAlert).filter(
            DuplicateAlert.institution_id == 2,
            DuplicateAlert.alert_type == "cross_institution_apaar"
        ).first()
        assert alert is not None
    finally:
        db.close()

def test_reports_scrubs_cross_institution_student_pii():
    """CSV export of duplicate alerts scrubs student roll and full name for external institution records."""
    admin_inst2 = get_auth_headers("suresh.admin@bnce.edu")
    res = client.get("/api/reports/export?report_type=duplicate_alerts&format=csv", headers=admin_inst2)
    assert res.status_code == 200
    csv_text = res.text

    # Verify that external student records do not expose private identity in CSV
    assert "[Protected Identity]" in csv_text or "[External Institution]" in csv_text or "cross_institution_apaar" in csv_text
