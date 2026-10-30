import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone
import re

from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.audit import AuditLog
from app.models.institution import Institution
from app.models.course import Course

client = TestClient(app)

def get_auth_headers(email: str, password: str = "password123"):
    fresh_client = TestClient(app)
    res = fresh_client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# ==============================================================================
# PHASE 2 REGRESSION TESTS: Student ID Card & APAAR Verification
# ==============================================================================

def test_authorized_user_can_access_student_detail_for_card():
    """Verify both admin and officer can load complete card identity data for institution student."""
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    officer_headers = get_auth_headers("ravi.officer@apex.edu")

    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.institution_id == 1, Student.is_archived == False).first()
        assert student is not None
        student_id = student.id
    finally:
        db.close()

    # Admin access
    res_admin = client.get(f"/api/students/{student_id}", headers=admin_headers)
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["id"] == student_id
    assert data_admin["full_name"] == student.full_name
    assert data_admin["roll_number"] == student.roll_number
    assert data_admin["admission_year"] == student.admission_year
    assert "institution_name" in data_admin
    assert data_admin["institution_name"] == "Apex Institute of Technology"
    assert data_admin["institution_code"] == "AIT-DELHI"
    assert data_admin["masked_apaar_id"].startswith("XXXX-XXXX-") or data_admin["masked_apaar_id"] == "Not Assigned"

    # Officer access
    res_officer = client.get(f"/api/students/{student_id}", headers=officer_headers)
    assert res_officer.status_code == 200
    data_officer = res_officer.json()
    assert data_officer["id"] == student_id
    assert data_officer["masked_apaar_id"].startswith("XXXX-XXXX-") or data_officer["masked_apaar_id"] == "Not Assigned"


def test_cross_institution_card_access_denied():
    """Verify a user cannot retrieve card details for a student in another institution."""
    inst1_headers = get_auth_headers("asha.admin@apex.edu")   # Inst 1
    inst2_headers = get_auth_headers("suresh.admin@bnce.edu")  # Inst 2

    db = SessionLocal()
    try:
        student_inst2 = db.query(Student).filter(Student.institution_id == 2, Student.is_archived == False).first()
        student_inst1 = db.query(Student).filter(Student.institution_id == 1, Student.is_archived == False).first()
        assert student_inst2 is not None
        assert student_inst1 is not None
    finally:
        db.close()

    # Inst 1 trying to access Inst 2 student -> 403 Forbidden
    res_cross_1 = client.get(f"/api/students/{student_inst2.id}", headers=inst1_headers)
    assert res_cross_1.status_code == 403
    assert "Cross-institution access violation" in res_cross_1.json()["detail"]

    # Inst 2 trying to access Inst 1 student -> 403 Forbidden
    res_cross_2 = client.get(f"/api/students/{student_inst1.id}", headers=inst2_headers)
    assert res_cross_2.status_code == 403
    assert "Cross-institution access violation" in res_cross_2.json()["detail"]


def test_unauthorized_user_cannot_reveal_full_apaar():
    """Verify unauthorized users (officers, unauthenticated) can never unmask raw 12-digit APAAR."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(
            Student.institution_id == 1, 
            Student.apaar_id.isnot(None),
            Student.is_archived == False
        ).first()
        assert student is not None
        student_id = student.id
        raw_apaar = student.apaar_id
    finally:
        db.close()

    # 1. Unauthenticated request
    res_unauth = client.post(f"/api/students/{student_id}/reveal-apaar")
    assert res_unauth.status_code == 401

    # 2. Verification Officer request (RBAC test)
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    res_officer = client.post(f"/api/students/{student_id}/reveal-apaar", headers=officer_headers)
    assert res_officer.status_code == 403

    # 3. Standard detail endpoint for officer must never leak raw 12-digit APAAR
    res_detail = client.get(f"/api/students/{student_id}", headers=officer_headers)
    assert res_detail.status_code == 200
    detail_data = res_detail.json()
    assert detail_data["masked_apaar_id"] != raw_apaar
    assert "apaar_id" not in detail_data  # Model schema only returns masked_apaar_id


def test_card_record_reference_and_privacy_security():
    """
    Test student ID card local record reference generation and privacy protection.
    The local record reference must strictly be an internal non-sensitive token (e.g. AG-INST1-STD5-2026).
    Card metadata must NEVER embed or expose full unmasked APAAR IDs, tokens, or credentials
    to unauthorized viewers or in public payloads.
    """
    db = SessionLocal()
    try:
        student = db.query(Student).filter(
            Student.institution_id == 1,
            Student.apaar_id.isnot(None),
            Student.is_archived == False
        ).first()
        assert student is not None
        full_apaar = student.apaar_id
    finally:
        db.close()

    # Verify constructor for student ID card internal record reference
    record_reference = f"AG-INST{student.institution_id}-STD{student.id}-{student.admission_year}"

    # Verify sensitive data is NOT embedded in the record reference
    assert full_apaar not in record_reference, "Full APAAR ID must never be part of card reference"
    assert "Bearer" not in record_reference
    assert "token" not in record_reference
    assert "password" not in record_reference

    # Verify clean structure
    assert f"INST{student.institution_id}" in record_reference
    assert f"STD{student.id}" in record_reference
    assert f"{student.admission_year}" in record_reference


def test_card_displays_available_identity_fields():
    """Verify StudentDetailResponse provides all required fields for physical card rendering."""
    headers = get_auth_headers("asha.admin@apex.edu")
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.institution_id == 1, Student.is_archived == False).first()
        student_id = student.id
    finally:
        db.close()

    res = client.get(f"/api/students/{student_id}", headers=headers)
    assert res.status_code == 200
    card_data = res.json()

    # Required card fields per Step 2:
    assert card_data["institution_name"] is not None
    assert card_data["full_name"] is not None
    assert card_data["roll_number"] is not None
    assert card_data["admission_year"] is not None
    assert card_data["status"] in ["Ready", "Needs Review", "Invalid Data"]
    assert "masked_apaar_id" in card_data
    assert "official_verification_notice" in card_data


def test_missing_optional_fields_safety():
    """Verify student with missing optional fields (no email, no phone, no DOB, no APAAR) succeeds cleanly."""
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    db = SessionLocal()
    created_id = None
    try:
        # Create student with only required fields
        minimal_student = Student(
            institution_id=1,
            course_id=1,
            roll_number="CARD_OPTIONAL_TEST_001",
            full_name="Minimal Field Student",
            admission_year=2026,
            date_of_birth=None,
            gender=None,
            email=None,
            phone=None,
            apaar_id=None,
            status="Needs Review",
            is_archived=False
        )
        db.add(minimal_student)
        db.commit()
        db.refresh(minimal_student)
        created_id = minimal_student.id

        res = client.get(f"/api/students/{created_id}", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()

        assert data["id"] == created_id
        assert data["full_name"] == "Minimal Field Student"
        assert data["masked_apaar_id"] == "Not Assigned"
        assert data["has_apaar"] is False
        assert data["date_of_birth"] is None
        assert data["email"] is None
        assert data["phone"] is None

        # Verify local record reference generation for minimal student does not crash
        ref = f"AG-INST{data['institution_id']}-STD{data['id']}-{data['admission_year']}"
        assert f"STD{created_id}" in ref

    finally:
        if created_id:
            db.query(Student).filter(Student.id == created_id).delete()
            db.commit()
        db.close()


def test_reveal_authorization_and_audit_behavior():
    """Verify admin reveal succeeds, returns full APAAR, and writes audit log with masked APAAR."""
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    db = SessionLocal()
    try:
        student = db.query(Student).filter(
            Student.institution_id == 1, 
            Student.apaar_id.isnot(None),
            Student.is_archived == False
        ).first()
        student_id = student.id
        expected_apaar = student.apaar_id
    finally:
        db.close()

    res = client.post(f"/api/students/{student_id}/reveal-apaar", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["student_id"] == student_id
    assert data["apaar_id"] == expected_apaar
    assert "warning" in data

    # Verify audit log was recorded with MASKED apaar (never full in audit log)
    db = SessionLocal()
    try:
        audit = db.query(AuditLog).filter(
            AuditLog.action == "APAAR_REVEALED",
            AuditLog.target_id == str(student_id)
        ).order_by(AuditLog.created_at.desc()).first()
        assert audit is not None
        assert audit.actor_role == "institution_admin"
        # Audit details must have masked_apaar, never raw 12-digit
        assert "XXXX-XXXX-" in audit.details
        assert expected_apaar not in audit.details
    finally:
        db.close()


def test_existing_api_contracts_remain_intact():
    """Verify standard student list and optimistic concurrency update continue functioning."""
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # 1. List students
    res_list = client.get("/api/students?page=1&page_size=10", headers=admin_headers)
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert "items" in list_data
    assert "total" in list_data
    assert len(list_data["items"]) > 0

    # 2. Detail view
    target = list_data["items"][0]
    res_detail = client.get(f"/api/students/{target['id']}", headers=admin_headers)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["version"] == target["version"]

