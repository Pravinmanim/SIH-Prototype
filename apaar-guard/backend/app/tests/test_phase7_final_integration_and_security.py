import pytest
import uuid
from starlette.testclient import TestClient

from app.main import app, ensure_schema_updates
from app.core.config import settings
from app.core.database import SessionLocal, Base, engine
from app.models.institution import Institution
from app.models.course import Course
from app.models.student import Student
from app.models.user import User
from app.models.intake import IntakeConfiguration
from app.models.duplicate import DuplicateAlert
from app.models.review import ReviewCase
from app.models.consent import StudentConsent, StudentConsentEvent
from app.models.audit import AuditLog
from app.provision_regulator import provision_regulator

Base.metadata.create_all(bind=engine)
ensure_schema_updates(engine)

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

def get_inst_course_id(institution_id: int = 1) -> int:
    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.institution_id == institution_id).first()
        assert course is not None, f"No course found for institution {institution_id}"
        return course.id
    finally:
        db.close()


# ==============================================================================
# SECTION 1: End-to-End Demonstration Workflow Verification
# ==============================================================================

def test_e2e_complete_demonstration_workflow():
    """
    Validates the end-to-end hackathon demonstration flow:
    1. Admin login
    2. Student creation with leading zero APAAR
    3. Masked APAAR and leading-zero preservation
    4. Duplicate detection
    5. Review case handling
    6. Intake and admission category monitoring
    7. Consent recording and history
    8. Student ID card & local record reference
    9. Verification officer RBAC
    10. Regulator aggregate-only access & strict student block
    """
    # 1. Log in as Institution Administrator
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # 2. Create student record with leading-zero APAAR (12 digits)
    apaar_with_leading_zeros = f"00{uuid.uuid4().int % 10000000000:010d}"
    roll = f"E2E-ROLL-{str(uuid.uuid4())[:6]}"
    course_id = get_inst_course_id(1)

    create_payload = {
        "roll_number": roll,
        "full_name": "Radhika Sharma",
        "apaar_id": apaar_with_leading_zeros,
        "course_id": course_id,
        "admission_year": 2026,
        "admission_category": "NRI",
        "is_supernumerary": True,
        "date_of_birth": "2005-04-12",
        "gender": "Female",
        "email": f"radhika.{str(uuid.uuid4())[:6]}@apex.edu",
        "phone": "9811223344"
    }

    create_res = client.post("/api/students", json=create_payload, headers=admin_headers)
    assert create_res.status_code == 201, f"Failed student creation: {create_res.text}"
    student_id = create_res.json()["student_id"]

    # 3. Verify APAAR string preservation and masking
    detail_res = client.get(f"/api/students/{student_id}", headers=admin_headers)
    assert detail_res.status_code == 200
    st_data = detail_res.json()
    assert st_data["masked_apaar_id"].startswith("XXXX")
    assert st_data["masked_apaar_id"].endswith(apaar_with_leading_zeros[-4:])
    assert st_data["apaar_length"] == 12
    assert st_data["admission_category"] == "NRI"
    assert st_data["is_supernumerary"] is True

    # Verify underlying DB preserves leading zeros as string
    db = SessionLocal()
    try:
        db_student = db.query(Student).filter(Student.id == student_id).first()
        assert db_student.apaar_id == apaar_with_leading_zeros
        assert isinstance(db_student.apaar_id, str)
        assert db_student.apaar_id.startswith("00")
    finally:
        db.close()

    # 4. Trigger duplicate alert using safe identical APAAR within same institution
    dup_payload = {
        "roll_number": f"DUP-{roll}",
        "full_name": "Radhika Sharma Duplicate",
        "apaar_id": apaar_with_leading_zeros,
        "course_id": course_id,
        "admission_year": 2026,
        "date_of_birth": "2005-04-12"
    }
    dup_res = client.post("/api/students", json=dup_payload, headers=admin_headers)
    assert dup_res.status_code == 400
    assert "matches an existing record" in dup_res.text or "duplicate" in dup_res.text.lower()

    # 5. Review verification cases
    cases_res = client.get("/api/review/cases", headers=admin_headers)
    assert cases_res.status_code == 200
    cases = cases_res.json()
    assert isinstance(cases, list)

    # 6. Intake, category totals, and supernumerary capacity
    intake_res = client.get("/api/intake?academic_year=2026", headers=admin_headers)
    assert intake_res.status_code == 200
    intake_data = intake_res.json()
    assert "total_approved_intake" in intake_data
    assert "total_supernumerary_intake" in intake_data
    assert "category_totals" in intake_data
    assert "NRI" in intake_data["category_totals"]

    # 7. Record staff-recorded consent and verify history
    consent_post = client.post(
        f"/api/students/{student_id}/consent",
        json={"status": "granted", "notice_version": "v1.0", "notes": "Verified declaration"},
        headers=admin_headers
    )
    assert consent_post.status_code == 200
    c_data = consent_post.json()
    assert c_data["status"] == "granted"
    assert len(c_data["history"]) == 1

    # 8. Student ID card data verification
    # Student detail has official verification disclaimer
    assert "Official verification unavailable" in st_data["official_verification_notice"]
    # Check reveal is audited
    reveal_res = client.post(f"/api/students/{student_id}/reveal-apaar", headers=admin_headers)
    assert reveal_res.status_code == 200
    assert reveal_res.json()["apaar_id"] == apaar_with_leading_zeros
    assert "Confidential APAAR ID accessed" in reveal_res.json()["warning"]

    # 9. Verification Officer RBAC
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    # Officer CAN view student details
    assert client.get(f"/api/students/{student_id}", headers=officer_headers).status_code == 200
    # Officer CANNOT create a student
    off_create = client.post("/api/students", json=create_payload, headers=officer_headers)
    assert off_create.status_code == 403
    # Officer CANNOT archive a student
    off_del = client.delete(f"/api/students/{student_id}", headers=officer_headers)
    assert off_del.status_code == 403

    # 10. Regulator aggregate-only access & strict student block
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")
    reg_ov = client.get("/api/regulator/overview?academic_year=2026", headers=reg_headers)
    assert reg_ov.status_code == 200
    # Regulator CANNOT access student record
    assert client.get(f"/api/students/{student_id}", headers=reg_headers).status_code == 403
    # Regulator CANNOT reveal APAAR
    assert client.post(f"/api/students/{student_id}/reveal-apaar", headers=reg_headers).status_code == 403
    # Regulator CANNOT access student consent
    assert client.get(f"/api/students/{student_id}/consent", headers=reg_headers).status_code == 403


# ==============================================================================
# SECTION 2: Authentication & Authorization Security Audit
# ==============================================================================

def test_unauthenticated_requests_strictly_rejected():
    endpoints = [
        ("GET", "/api/students"),
        ("GET", "/api/students/1"),
        ("POST", "/api/students"),
        ("GET", "/api/students/1/consent"),
        ("POST", "/api/students/1/consent"),
        ("GET", "/api/consent/summary"),
        ("GET", "/api/intake"),
        ("GET", "/api/dashboard/metrics"),
        ("GET", "/api/reports/export"),
        ("GET", "/api/review/cases"),
        ("GET", "/api/regulator/overview"),
        ("GET", "/api/regulator/institutions"),
    ]
    for method, path in endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={})
        assert res.status_code == 401, f"Endpoint {path} did not reject unauthenticated access: {res.status_code}"


def test_cross_institution_isolation_in_all_crud():
    inst1_admin = get_auth_headers("asha.admin@apex.edu")
    inst2_admin = get_auth_headers("suresh.admin@bnce.edu")

    # Create student in Inst 1
    course_id = get_inst_course_id(1)
    res = client.post("/api/students", json={
        "roll_number": f"TENANT-{str(uuid.uuid4())[:6]}",
        "full_name": "Tenant Test Student",
        "course_id": course_id,
        "admission_year": 2026,
        "date_of_birth": "2005-01-01"
    }, headers=inst1_admin)
    assert res.status_code == 201
    student_id = res.json()["student_id"]

    # Inst 2 admin cannot GET
    assert client.get(f"/api/students/{student_id}", headers=inst2_admin).status_code == 403
    # Inst 2 admin cannot PUT
    assert client.put(f"/api/students/{student_id}", json={"full_name": "Hacked"}, headers=inst2_admin).status_code == 403
    # Inst 2 admin cannot DELETE
    assert client.delete(f"/api/students/{student_id}", headers=inst2_admin).status_code == 403
    # Inst 2 admin cannot REVEAL
    assert client.post(f"/api/students/{student_id}/reveal-apaar", headers=inst2_admin).status_code == 403
    # Inst 2 admin cannot view CONSENT
    assert client.get(f"/api/students/{student_id}/consent", headers=inst2_admin).status_code == 403
    # Inst 2 admin cannot record CONSENT
    assert client.post(f"/api/students/{student_id}/consent", json={"status": "granted"}, headers=inst2_admin).status_code == 403


# ==============================================================================
# SECTION 3: Database & Schema Evolution Compatibility
# ==============================================================================

def test_schema_updates_are_idempotent():
    """Verify running ensure_schema_updates multiple times succeeds without schema corruption."""
    ensure_schema_updates(engine)
    ensure_schema_updates(engine)
    ensure_schema_updates(engine)

    db = SessionLocal()
    try:
        # Verify columns exist
        inst = db.query(Institution).first()
        assert inst is not None
        student = db.query(Student).first()
        if student:
            assert hasattr(student, "admission_category")
            assert hasattr(student, "is_supernumerary")
        intake = db.query(IntakeConfiguration).first()
        if intake:
            assert hasattr(intake, "supernumerary_intake")
    finally:
        db.close()


def test_cli_provision_regulator_utility():
    """Verify administrator CLI provisioning works safely and idempotently."""
    email = f"audit.regulator.{str(uuid.uuid4())[:6]}@aicte.gov.in"
    reg = provision_regulator(
        email=email,
        full_name="National Director AICTE",
        password="SecureRegulatoryPassword2026"
    )
    assert reg.role == "regulator"
    assert reg.full_name == "National Director AICTE"

    # Running again updates existing record
    reg_updated = provision_regulator(
        email=email,
        full_name="National Director AICTE (Updated)",
        password="SecureRegulatoryPassword2026"
    )
    assert reg_updated.id == reg.id
    assert reg_updated.full_name == "National Director AICTE (Updated)"


# ==============================================================================
# SECTION 4: Consent Integrity & Immutability Audit
# ==============================================================================

def test_consent_history_immutability_and_duplicate_prevention():
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    course_id = get_inst_course_id(1)

    # 1. Fresh student starts as not_recorded
    res = client.post("/api/students", json={
        "roll_number": f"CONS-{str(uuid.uuid4())[:6]}",
        "full_name": "Consent Audit Student",
        "course_id": course_id,
        "admission_year": 2026,
        "date_of_birth": "2005-02-02"
    }, headers=admin_headers)
    student_id = res.json()["student_id"]

    c_init = client.get(f"/api/students/{student_id}/consent", headers=admin_headers).json()
    assert c_init["status"] == "not_recorded"
    assert c_init["history"] == []

    # 2. Grant consent
    client.post(f"/api/students/{student_id}/consent", json={"status": "granted", "notes": "Event 1"}, headers=admin_headers)

    # 3. Duplicate submission rejected
    res_dup = client.post(f"/api/students/{student_id}/consent", json={"status": "granted"}, headers=admin_headers)
    assert res_dup.status_code == 400

    # 4. Withdraw consent
    client.post(f"/api/students/{student_id}/consent", json={"status": "withdrawn", "notes": "Event 2"}, headers=admin_headers)

    # 5. Re-affirm consent
    client.post(f"/api/students/{student_id}/consent", json={"status": "granted", "notes": "Event 3"}, headers=admin_headers)

    # 6. Verify history retains all 3 events in strict chronological sequence
    c_final = client.get(f"/api/students/{student_id}/consent", headers=admin_headers).json()
    assert c_final["status"] == "granted"
    assert len(c_final["history"]) == 3
    assert c_final["history"][0]["notes"] == "Event 3"
    assert c_final["history"][1]["notes"] == "Event 2"
    assert c_final["history"][2]["notes"] == "Event 1"


# ==============================================================================
# SECTION 5: Secret Protection & Demo Account Security
# ==============================================================================

def test_demo_accounts_zero_secret_leakage():
    res = client.get("/api/auth/demo-accounts")
    assert res.status_code == 200
    data = res.json()
    for acc in data["accounts"]:
        # Strict security rule: no credentials or secrets across API
        assert "password" not in acc
        assert "preset_password" not in acc
        assert "token" not in acc
        assert "secret" not in acc


def test_production_mode_disables_demo_accounts():
    original_env = settings.APP_ENV
    try:
        settings.APP_ENV = "production"
        res = client.get("/api/auth/demo-accounts")
        assert res.status_code == 200
        assert res.json()["accounts"] == []
    finally:
        settings.APP_ENV = original_env
