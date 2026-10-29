import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.audit import AuditLog

client = TestClient(app)

def get_auth_headers(email: str, password: str = "password123"):
    fresh_client = TestClient(app)
    res = fresh_client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_list_students_pagination_and_masking():
    headers = get_auth_headers("asha.admin@apex.edu")
    res = client.get("/api/students?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) == 10
    
    # Verify APAAR masking in list view
    for item in data["items"]:
        masked = item["masked_apaar_id"]
        if item["has_apaar"]:
            assert masked.startswith("XXXX-XXXX-")
            assert len(masked) == 14

def test_list_students_search_and_filters():
    headers = get_auth_headers("asha.admin@apex.edu")
    
    # Search by partial name
    res = client.get("/api/students?search=Aarav", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 0
    assert any("Aarav" in s["full_name"] for s in items)

    # Filter by status (Must be one of Ready, Invalid Data, Needs Review)
    res_status = client.get("/api/students?status=Ready", headers=headers)
    assert res_status.status_code == 200
    for s in res_status.json()["items"]:
        assert s["status"] == "Ready"

def test_student_detail_drawer_view():
    headers = get_auth_headers("asha.admin@apex.edu")
    res_list = client.get("/api/students?page=1&page_size=1", headers=headers)
    first_id = res_list.json()["items"][0]["id"]

    res_detail = client.get(f"/api/students/{first_id}", headers=headers)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == first_id
    assert "validation_results" in detail
    assert "official_verification_notice" in detail
    assert "Official verification unavailable" in detail["official_verification_notice"]

def test_admin_create_and_validation_auto_run():
    headers = get_auth_headers("asha.admin@apex.edu")
    
    # Clean up any previous test record
    db = SessionLocal()
    try:
        db.query(Student).filter(Student.roll_number == "2026-CSE-999").delete()
        db.commit()
    finally:
        db.close()

    payload = {
        "roll_number": "2026-CSE-999",
        "full_name": "Test New Student",
        "apaar_id": "099988877766", # starts with 0
        "course_id": 1,
        "admission_year": 2026,
        "date_of_birth": "2005-09-09",
        "gender": "Male",
        "email": "test.new999@apex.edu",
        "phone": "9876543299"
    }
    res = client.post("/api/students", json=payload, headers=headers)
    assert res.status_code == 201
    student_id = res.json()["student_id"]

    # Verify audit log recorded without logging full APAAR
    db = SessionLocal()
    try:
        log = db.query(AuditLog).filter(
            AuditLog.action == "STUDENT_CREATED",
            AuditLog.target_id == str(student_id)
        ).first()
        assert log is not None
        assert "099988877766" not in log.details  # Critical: full APAAR never logged
        assert "XXXX-XXXX-7766" in log.details
    finally:
        db.close()

def test_officer_cannot_create_update_archive():
    headers = get_auth_headers("ravi.officer@apex.edu")
    
    # 1. Create attempt -> 403
    res_create = client.post("/api/students", json={
        "roll_number": "2026-CSE-888",
        "full_name": "Unauthorized Student",
        "course_id": 1,
        "admission_year": 2026
    }, headers=headers)
    assert res_create.status_code == 403
    assert "Only Institution Admins" in res_create.json()["detail"]

    # 2. Update attempt -> 403
    res_update = client.put("/api/students/1", json={"full_name": "Hacked Name"}, headers=headers)
    assert res_update.status_code == 403

    # 3. Archive attempt -> 403
    res_delete = client.delete("/api/students/1", headers=headers)
    assert res_delete.status_code == 403

def test_admin_update_and_archive_flow():
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    test_roll = f"2026-CSE-ARC-{uuid.uuid4().hex[:6]}"
    
    # Create a student to test update and archive
    res_create = client.post("/api/students", json={
        "roll_number": test_roll,
        "full_name": "Student To Archive",
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_headers)
    assert res_create.status_code == 201
    s_id = res_create.json()["student_id"]
    version = res_create.json()["version"]

    # Update with version
    res_update = client.put(f"/api/students/{s_id}", json={
        "full_name": "Student To Archive (Updated)",
        "version": version
    }, headers=admin_headers)
    assert res_update.status_code == 200
    assert res_update.json()["version"] == version + 1

    # Archive
    res_del = client.delete(f"/api/students/{s_id}", headers=admin_headers)
    assert res_del.status_code == 200
    assert "archived successfully" in res_del.json()["message"]

    # Confirm it does not show up in active student list
    res_check = client.get(f"/api/students?search={test_roll}", headers=admin_headers)
    assert res_check.status_code == 200
    assert res_check.json()["total"] == 0

def test_reveal_apaar_rbac_and_audit():
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    officer_headers = get_auth_headers("ravi.officer@apex.edu")

    # Get a student with APAAR in institution 1
    db = SessionLocal()
    student = None
    try:
        student = db.query(Student).filter(
            Student.institution_id == 1,
            Student.apaar_id.isnot(None),
            Student.apaar_id != "",
            Student.is_archived == False
        ).first()
        student_id = student.id
        full_apaar = student.apaar_id
    finally:
        db.close()

    # 1. Officer attempt -> 403 Forbidden (Only Admin can reveal)
    res_off = client.post(f"/api/students/{student_id}/reveal-apaar", headers=officer_headers)
    assert res_off.status_code == 403

    # 2. Admin reveal -> 200 OK + full APAAR returned
    res_adm = client.post(f"/api/students/{student_id}/reveal-apaar", headers=admin_headers)
    assert res_adm.status_code == 200
    data = res_adm.json()
    assert data["student_id"] == student_id
    assert data["apaar_id"] == full_apaar
    assert "Audit event logged" in data["warning"]

    # 3. Check AuditLog table for APAAR_REVEALED action
    db = SessionLocal()
    try:
        log = db.query(AuditLog).filter(
            AuditLog.action == "APAAR_REVEALED",
            AuditLog.target_id == str(student_id)
        ).order_by(AuditLog.created_at.desc()).first()
        assert log is not None
        assert "XXXX-XXXX-" in log.details  # Detail has masked version, not raw plaintext
        assert log.outcome == "SUCCESS"
    finally:
        db.close()

def test_optimistic_concurrency_locking():
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Find a valid student in institution 1
    db = SessionLocal()
    try:
        student = db.query(Student).filter(
            Student.institution_id == 1,
            Student.is_archived == False
        ).first()
        student_id = student.id
        current_version = student.version
    finally:
        db.close()

    # Stale version update -> 409 Conflict
    stale_version = current_version - 1 if current_version > 1 else current_version + 999
    res_conflict = client.put(f"/api/students/{student_id}", json={
        "full_name": "Conflict Update Attempt",
        "version": stale_version
    }, headers=admin_headers)
    assert res_conflict.status_code == 409
    assert "This record was changed by someone else" in res_conflict.json()["detail"]

    # Correct version update -> 200 OK and version increments
    res_ok = client.put(f"/api/students/{student_id}", json={
        "full_name": student.full_name,
        "version": current_version
    }, headers=admin_headers)
    assert res_ok.status_code == 200
    assert res_ok.json()["version"] == current_version + 1

def test_cross_institution_student_access_denied():
    # User in Institution 1 (Apex Institute)
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")

    # Find a student in Institution 2 (Beacon Institute)
    db = SessionLocal()
    try:
        student_inst2 = db.query(Student).filter(Student.institution_id == 2).first()
        student_id_inst2 = student_inst2.id
    finally:
        db.close()

    # Reading Institution 2 student -> 403 Forbidden
    res_get = client.get(f"/api/students/{student_id_inst2}", headers=admin_inst1)
    assert res_get.status_code == 403
    assert "Cross-institution access violation" in res_get.json()["detail"]

    # Updating Institution 2 student -> 403 Forbidden
    res_put = client.put(f"/api/students/{student_id_inst2}", json={"full_name": "Hack Name"}, headers=admin_inst1)
    assert res_put.status_code == 403

    # Revealing APAAR of Institution 2 student -> 403 Forbidden
    res_rev = client.post(f"/api/students/{student_id_inst2}/reveal-apaar", headers=admin_inst1)
    assert res_rev.status_code == 403
