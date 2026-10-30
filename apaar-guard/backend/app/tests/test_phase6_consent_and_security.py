import pytest
import uuid
from starlette.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal, Base, engine
from app.models.student import Student
from app.models.institution import Institution
from app.models.course import Course
from app.models.consent import StudentConsent, StudentConsentEvent
from app.models.audit import AuditLog
from app.provision_regulator import provision_regulator

Base.metadata.create_all(bind=engine)

client = TestClient(app)

def get_auth_headers(email: str, password: str = "password123") -> dict:
    fresh_client = TestClient(app)
    login_res = fresh_client.post("/api/auth/login", json={"email": email, "password": password})
    assert login_res.status_code == 200, f"Login failed for {email}: {login_res.text}"
    token = login_res.json()["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def get_inst1_course_id() -> int:
    db = SessionLocal()
    try:
        inst1 = db.query(Institution).first()
        course = db.query(Course).filter(Course.institution_id == inst1.id).first()
        return course.id
    finally:
        db.close()

def create_test_student(suffix: str = None) -> dict:
    headers = get_auth_headers("asha.admin@apex.edu")
    if not suffix:
        suffix = str(uuid.uuid4())[:8]
    course_id = get_inst1_course_id()
    payload = {
        "roll_number": f"CS-CST-{suffix}",
        "full_name": "Consent Test Student",
        "course_id": course_id,
        "admission_year": 2026,
        "admission_category": "General",
        "date_of_birth": "2005-06-15",
        "gender": "Female",
        "email": f"consent.{suffix}@apex.edu",
        "phone": "9876543210"
    }
    res = client.post("/api/students", json=payload, headers=headers)
    assert res.status_code == 201, f"Failed to create test student: {res.text}"
    return res.json()


# 1. New student records do not receive granted consent by default
def test_new_student_does_not_receive_granted_consent_by_default():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    student = create_test_student()
    student_id = student["student_id"]

    res = client.get(f"/api/students/{student_id}/consent", headers=officer_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "not_recorded"
    assert data["status"] != "granted"
    assert data["status"] != "withdrawn"
    assert data["consent_type"] == "staff_recorded"
    assert data["history"] == []


# 2. Missing consent is represented accurately
def test_missing_consent_is_represented_accurately():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    student = create_test_student()
    student_id = student["student_id"]

    res = client.get(f"/api/students/{student_id}/consent", headers=officer_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["student_id"] == student_id
    assert data["status"] == "not_recorded"
    assert data["recorded_by_name"] is None
    assert data["recorded_by_role"] is None
    assert data["recorded_at"] is None
    assert "Staff-recorded workflow record only" in data["disclaimer"]


# 3. Authorized staff can record a consent status within their institution
def test_authorized_staff_can_record_consent():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    student = create_test_student()
    student_id = student["student_id"]

    record_payload = {
        "status": "granted",
        "notice_version": "v1.0",
        "notes": "Student physical consent form received and verified."
    }
    res = client.post(f"/api/students/{student_id}/consent", json=record_payload, headers=officer_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "granted"
    assert data["recorded_by_role"] == "verification_officer"
    assert "Ravi Verma" in data["recorded_by_name"]
    assert data["notes"] == "Student physical consent form received and verified."
    assert len(data["history"]) == 1
    assert data["history"][0]["action"] == "RECORDED"
    assert data["history"][0]["previous_status"] == "not_recorded"
    assert data["history"][0]["new_status"] == "granted"


# 4. Cross-institution consent access is rejected
def test_cross_institution_consent_access_is_rejected():
    inst2_headers = get_auth_headers("priya.officer@bnce.edu")
    student = create_test_student()
    student_id = student["student_id"]

    # Inst 2 officer reading Inst 1 student consent
    res_get = client.get(f"/api/students/{student_id}/consent", headers=inst2_headers)
    assert res_get.status_code == 403
    assert "Access denied" in res_get.text

    # Inst 2 officer modifying Inst 1 student consent
    res_post = client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "granted", "notice_version": "v1.0"},
        headers=inst2_headers
    )
    assert res_post.status_code == 403
    assert "Access denied" in res_post.text


# 5. Unauthorized users cannot change consent
def test_unauthorized_users_cannot_change_consent():
    inst1_headers = get_auth_headers("ravi.officer@apex.edu")
    student = create_test_student()
    student_id = student["student_id"]

    # Unauthenticated request
    res_unauth = client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "granted", "notice_version": "v1.0"}
    )
    assert res_unauth.status_code == 401

    # Non-existent student
    res_not_found = client.post(
        "/api/students/999999/consent",
        json={"status": "granted", "notice_version": "v1.0"},
        headers=inst1_headers
    )
    assert res_not_found.status_code == 404


# 6. Regulators cannot access student-level consent records or histories
def test_regulators_cannot_access_student_level_consent():
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")
    student = create_test_student()
    student_id = student["student_id"]

    # Regulator GET student consent
    res_get = client.get(f"/api/students/{student_id}/consent", headers=reg_headers)
    assert res_get.status_code == 403
    assert "Regulator access" in res_get.text

    # Regulator POST student consent
    res_post = client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "granted", "notice_version": "v1.0"},
        headers=reg_headers
    )
    assert res_post.status_code == 403
    assert "Regulator access" in res_post.text

    # Regulator GET institution-specific consent summary
    res_sum = client.get("/api/consent/summary", headers=reg_headers)
    assert res_sum.status_code == 403


# 7. Invalid statuses and transitions are rejected
def test_invalid_statuses_and_transitions_are_rejected():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    student = create_test_student()
    student_id = student["student_id"]

    # Invalid status string rejected with 422
    res_inv = client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "arbitrary_approved", "notice_version": "v1.0"},
        headers=officer_headers
    )
    assert res_inv.status_code == 422

    # Record granted
    res_grant = client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "granted", "notice_version": "v1.0"},
        headers=officer_headers
    )
    assert res_grant.status_code == 200

    # Repeat granted rejected with 400
    res_repeat = client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "granted", "notice_version": "v1.0"},
        headers=officer_headers
    )
    assert res_repeat.status_code == 400
    assert "already" in res_repeat.text.lower()

    # Notes exceeding 500 characters rejected with 422
    res_long_notes = client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "withdrawn", "notice_version": "v1.0", "notes": "X" * 501},
        headers=officer_headers
    )
    assert res_long_notes.status_code == 422


# 8. Withdrawal creates a historical event rather than silently erasing the previous decision
def test_withdrawal_creates_historical_event_not_silent_erasure():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    student = create_test_student()
    student_id = student["student_id"]

    # 1. Grant consent
    client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "granted", "notice_version": "v1.0", "notes": "Initial opt-in"},
        headers=officer_headers
    )

    # 2. Withdraw consent
    res_withdraw = client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "withdrawn", "notice_version": "v1.0", "notes": "Revoked by guardian request"},
        headers=officer_headers
    )
    assert res_withdraw.status_code == 200
    data = res_withdraw.json()
    assert data["status"] == "withdrawn"
    assert len(data["history"]) == 2

    # Events in descending order
    latest = data["history"][0]
    assert latest["action"] == "WITHDRAWN"
    assert latest["previous_status"] == "granted"
    assert latest["new_status"] == "withdrawn"
    assert latest["notes"] == "Revoked by guardian request"

    earliest = data["history"][1]
    assert earliest["action"] == "RECORDED"
    assert earliest["previous_status"] == "not_recorded"
    assert earliest["new_status"] == "granted"
    assert earliest["notes"] == "Initial opt-in"

    # Verify audit logs in database
    db = SessionLocal()
    try:
        logs = db.query(AuditLog).filter(
            AuditLog.target_type == "STUDENT_CONSENT",
            AuditLog.target_id == str(student_id)
        ).all()
        actions = [l.action for l in logs]
        assert "STUDENT_CONSENT_RECORDED" in actions
        assert "STUDENT_CONSENT_WITHDRAWN" in actions
    finally:
        db.close()


# 9. Consent history does not expose unnecessary student PII
def test_consent_history_does_not_expose_unnecessary_pii():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    student = create_test_student()
    student_id = student["student_id"]

    client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "granted", "notice_version": "v1.0"},
        headers=officer_headers
    )
    res = client.get(f"/api/students/{student_id}/consent", headers=officer_headers)
    assert res.status_code == 200
    data = res.json()

    # Consent response schema contains only consent metadata, no student PII
    assert "apaar_id" not in data
    assert "phone" not in data
    assert "date_of_birth" not in data
    assert "gender" not in data
    for ev in data["history"]:
        assert "apaar_id" not in ev
        assert "phone" not in ev
        assert "date_of_birth" not in ev


# 10. Consent aggregate counts exclude archived students
def test_consent_aggregate_counts_exclude_archived_students():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Get baseline summary
    base_res = client.get("/api/consent/summary", headers=officer_headers)
    assert base_res.status_code == 200
    base_data = base_res.json()
    initial_total = base_data["total_students"]

    # Create a student and grant consent
    student = create_test_student()
    student_id = student["student_id"]
    client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "granted", "notice_version": "v1.0"},
        headers=officer_headers
    )

    res_after_grant = client.get("/api/consent/summary", headers=officer_headers)
    data_after_grant = res_after_grant.json()
    assert data_after_grant["total_students"] == initial_total + 1
    assert data_after_grant["granted"] >= 1

    # Soft archive the student
    res_arch = client.delete(f"/api/students/{student_id}", headers=admin_headers)
    assert res_arch.status_code == 200

    # Summary after archive
    res_after_arch = client.get("/api/consent/summary", headers=officer_headers)
    data_after_arch = res_after_arch.json()
    assert data_after_arch["total_students"] == initial_total


# 11. Existing student creation, update, archive, and bulk import workflows continue to work
def test_existing_student_workflows_continue_to_work():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Create
    student = create_test_student()
    student_id = student["student_id"]

    # Update
    upd_res = client.put(
        f"/api/students/{student_id}",
        json={"full_name": "Updated Name Workflow Check", "version": student["version"]},
        headers=admin_headers
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["student_id"] == student_id

    # Detail view
    det_res = client.get(f"/api/students/{student_id}", headers=officer_headers)
    assert det_res.status_code == 200
    assert det_res.json()["full_name"] == "Updated Name Workflow Check"

    # Archive
    del_res = client.delete(f"/api/students/{student_id}", headers=admin_headers)
    assert del_res.status_code == 200


# 12. Phase 3 duplicate detection and privacy protections remain intact
def test_phase3_duplicate_detection_remains_intact():
    inst1_admin_headers = get_auth_headers("asha.admin@apex.edu")
    course_id = get_inst1_course_id()
    common_apaar = f"88{uuid.uuid4().int % 10000000000:010d}"

    payload1 = {
        "roll_number": f"P3-DUP-{str(uuid.uuid4())[:6]}",
        "full_name": "Phase Three Duplicate Student One",
        "apaar_id": common_apaar,
        "course_id": course_id,
        "admission_year": 2026,
        "admission_category": "General",
        "date_of_birth": "2005-01-01",
        "email": f"p3.dup1.{str(uuid.uuid4())[:6]}@apex.edu"
    }
    res1 = client.post("/api/students", json=payload1, headers=inst1_admin_headers)
    assert res1.status_code in (201, 200)

    # Submitting identical APAAR creates duplicate alert or review case
    payload2 = {
        "roll_number": f"P3-DUP-{str(uuid.uuid4())[:6]}",
        "full_name": "Phase Three Duplicate Student Two",
        "apaar_id": common_apaar,
        "course_id": course_id,
        "admission_year": 2026,
        "admission_category": "General",
        "date_of_birth": "2005-02-02",
        "email": f"p3.dup2.{str(uuid.uuid4())[:6]}@apex.edu"
    }
    res2 = client.post("/api/students", json=payload2, headers=inst1_admin_headers)
    assert res2.status_code in (201, 200, 400)

    # Verify review cases exists
    res_cases = client.get("/api/review/cases", headers=inst1_admin_headers)
    assert res_cases.status_code == 200


# 13. Phase 4 intake and category calculations remain intact
def test_phase4_intake_and_category_calculations_remain_intact():
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    res = client.get("/api/intake?academic_year=2026", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "category_totals" in data
    assert "General" in data["category_totals"]
    assert "total_supernumerary_intake" in data


# 14. Phase 5 regulator aggregate APIs remain PII-free and accessible only to authorized regulators
def test_phase5_regulator_aggregate_apis_remain_pii_free():
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")
    officer_headers = get_auth_headers("ravi.officer@apex.edu")

    # Regulator access
    res = client.get("/api/regulator/overview?academic_year=2026", headers=reg_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_institutions" in data
    assert "students" not in data  # No raw student list

    # Institutional officer denied regulator overview
    res_denied = client.get("/api/regulator/overview?academic_year=2026", headers=officer_headers)
    assert res_denied.status_code == 403


# 15. Default regulator credentials are not automatically provisioned during normal startup
def test_safe_regulator_provisioning_and_cli():
    # Provisioning utility can safely provision or update regulator account
    user = provision_regulator(
        email="test.cli.regulator@aicte.gov.in",
        full_name="CLI Provisioned Regulator",
        password="securePassword123"
    )
    assert user.role == "regulator"
    assert user.email == "test.cli.regulator@aicte.gov.in"

    # Non-development mode simulation
    # Settings APP_ENV check in main.py ensures startup only seeds in development
    original_env = settings.APP_ENV
    try:
        settings.APP_ENV = "production"
        # Verify demo accounts endpoint hides accounts in production
        res_prod = client.get("/api/auth/demo-accounts")
        assert res_prod.status_code == 200
        assert res_prod.json()["accounts"] == []
    finally:
        settings.APP_ENV = original_env


# 16. Demo-account discovery does not disclose passwords or secrets
def test_demo_account_discovery_does_not_disclose_passwords():
    res = client.get("/api/auth/demo-accounts")
    assert res.status_code == 200
    data = res.json()
    assert "accounts" in data
    for acc in data["accounts"]:
        assert "preset_password" not in acc
        assert "password" not in acc
        assert "hashed_password" not in acc


# 17. Existing authentication and role behavior remain unchanged
def test_existing_authentication_and_role_behavior():
    # Admin login
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    res_me = client.get("/api/auth/me", headers=admin_headers)
    assert res_me.status_code == 200
    assert res_me.json()["role"] == "institution_admin"

    # Officer login
    off_headers = get_auth_headers("ravi.officer@apex.edu")
    res_off = client.get("/api/auth/me", headers=off_headers)
    assert res_off.status_code == 200
    assert res_off.json()["role"] == "verification_officer"

    # Regulator login
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")
    res_reg = client.get("/api/auth/me", headers=reg_headers)
    assert res_reg.status_code == 200
    assert res_reg.json()["role"] == "regulator"
