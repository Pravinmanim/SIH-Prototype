import pytest
import uuid
import io
import pandas as pd
from starlette.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.course import Course
from app.models.intake import IntakeConfiguration

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

def test_approved_intake_and_actual_enrolment_calculation():
    """
    Test setting approved intake and supernumerary quota on a course,
    verifying accurate regular enrolment and seat utilization reporting.
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Set intake for Course 1, Academic Year 2026
    intake_payload = {
        "course_id": 1,
        "academic_year": 2026,
        "approved_intake": 120,
        "supernumerary_intake": 15,
        "notes": "AICTE Approval 2026/AIT/120"
    }
    set_res = client.post("/api/intake", json=intake_payload, headers=admin_headers)
    assert set_res.status_code == 200

    # Query intake monitoring
    res = client.get("/api/intake?academic_year=2026", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    assert "total_approved_intake" in data
    assert "total_supernumerary_intake" in data
    assert "total_regular_enrolled" in data
    assert "total_supernumerary_enrolled" in data
    assert "category_totals" in data

    course_item = next((it for it in data["items"] if it["course_id"] == 1), None)
    assert course_item is not None
    assert course_item["approved_intake"] == 120
    assert course_item["supernumerary_intake"] == 15
    assert course_item["remaining_capacity"] == 120 - course_item["enrolled_regular"]
    assert course_item["utilization_percent"] >= 0

def test_category_wise_enrolment_counts():
    """
    Test student enrolment across admission categories: General, NRI, OCI, Foreign National, Other.
    Verifies that course-level breakdown and institution-wide totals reflect each category accurately.
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Enroll students in Course 2 with diverse admission categories
    categories = ["General", "NRI", "OCI", "Foreign National", "Other"]
    for cat in categories:
        roll = f"2026-CAT-{uuid.uuid4().hex[:6]}"
        apaar = f"88{uuid.uuid4().int % 10000000000:010d}"
        res = client.post("/api/students", json={
            "roll_number": roll,
            "full_name": f"Student {cat.replace(' ', '')}",
            "apaar_id": apaar,
            "course_id": 2,
            "admission_year": 2026,
            "admission_category": cat,
            "is_supernumerary": False
        }, headers=admin_headers)
        assert res.status_code == 201, f"Failed for category {cat}: {res.text}"

    # Verify intake report has category counts
    res = client.get("/api/intake?academic_year=2026", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    c2 = next((it for it in data["items"] if it["course_id"] == 2), None)
    assert c2 is not None
    assert c2["categories"]["NRI"] >= 1
    assert c2["categories"]["OCI"] >= 1
    assert c2["categories"]["Foreign National"] >= 1
    assert c2["categories"]["Other"] >= 1
    assert c2["categories"]["General"] >= 1

    # Verify institution-wide totals
    assert data["category_totals"]["NRI"] >= 1
    assert data["category_totals"]["OCI"] >= 1
    assert data["category_totals"]["Foreign National"] >= 1
    assert data["category_totals"]["Other"] >= 1

def test_supernumerary_count_handling_separated_from_regular():
    """
    Verify supernumerary students are tracked separately from regular students
    and do not consume approved intake regular capacity.
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Configure Course 3 with known approved intake
    client.post("/api/intake", json={
        "course_id": 3,
        "academic_year": 2026,
        "approved_intake": 60,
        "supernumerary_intake": 10,
        "notes": "Test Supernumerary Separation"
    }, headers=admin_headers)

    # Initial intake state for Course 3
    init_res = client.get("/api/intake?academic_year=2026", headers=admin_headers)
    c3_init = next(it for it in init_res.json()["items"] if it["course_id"] == 3)
    init_regular = c3_init["enrolled_regular"]
    init_super = c3_init["enrolled_supernumerary"]
    init_remaining = c3_init["remaining_capacity"]

    # 1. Enroll regular student
    res_reg = client.post("/api/students", json={
        "roll_number": f"2026-REG-{uuid.uuid4().hex[:6]}",
        "full_name": "Regular Student",
        "apaar_id": f"88{uuid.uuid4().int % 10000000000:010d}",
        "course_id": 3,
        "admission_year": 2026,
        "admission_category": "General",
        "is_supernumerary": False
    }, headers=admin_headers)
    assert res_reg.status_code == 201

    # 2. Enroll supernumerary student (NRI background, allocated supernumerary seat)
    res_sup = client.post("/api/students", json={
        "roll_number": f"2026-SUP-{uuid.uuid4().hex[:6]}",
        "full_name": "Supernumerary Student",
        "apaar_id": f"88{uuid.uuid4().int % 10000000000:010d}",
        "course_id": 3,
        "admission_year": 2026,
        "admission_category": "NRI",
        "is_supernumerary": True
    }, headers=admin_headers)
    assert res_sup.status_code == 201

    # Query intake again
    post_res = client.get("/api/intake?academic_year=2026", headers=admin_headers)
    c3_post = next(it for it in post_res.json()["items"] if it["course_id"] == 3)

    assert c3_post["enrolled_regular"] == init_regular + 1
    assert c3_post["enrolled_supernumerary"] == init_super + 1
    # Regular capacity decreased by exactly 1 regular student, not by supernumerary
    assert c3_post["remaining_capacity"] == init_remaining - 1

def test_missing_optional_category_defaults_to_general():
    """
    Verify creating or updating student without specifying admission_category
    or is_supernumerary defaults safely to General and False.
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    roll = f"2026-DEF-{uuid.uuid4().hex[:6]}"
    res = client.post("/api/students", json={
        "roll_number": roll,
        "full_name": "Default Student",
        "apaar_id": f"88{uuid.uuid4().int % 10000000000:010d}",
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_headers)
    assert res.status_code == 201
    s_id = res.json()["student_id"]

    # Verify detail response
    get_res = client.get(f"/api/students/{s_id}", headers=admin_headers)
    assert get_res.status_code == 200
    st_data = get_res.json()
    assert st_data["admission_category"] == "General"
    assert st_data["is_supernumerary"] is False

def test_invalid_admission_category_rejected_with_422():
    """
    Verify schema validation rejects invalid/unsupported admission categories with HTTP 422.
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # 1. Invalid category on create
    res_create = client.post("/api/students", json={
        "roll_number": f"2026-INV-{uuid.uuid4().hex[:6]}",
        "full_name": "Invalid Category Student",
        "apaar_id": f"88{uuid.uuid4().int % 10000000000:010d}",
        "course_id": 1,
        "admission_year": 2026,
        "admission_category": "ManagementQuotaVip"
    }, headers=admin_headers)
    assert res_create.status_code == 422
    assert "Supported:" in res_create.text

    # 2. Invalid category on update
    # Create valid student first
    valid_create = client.post("/api/students", json={
        "roll_number": f"2026-UP-{uuid.uuid4().hex[:6]}",
        "full_name": "Valid Student",
        "apaar_id": f"88{uuid.uuid4().int % 10000000000:010d}",
        "course_id": 1,
        "admission_year": 2026,
        "admission_category": "General"
    }, headers=admin_headers)
    assert valid_create.status_code == 201
    s_id = valid_create.json()["student_id"]

    res_update = client.put(f"/api/students/{s_id}", json={
        "admission_category": "IllegalCategoryXYZ"
    }, headers=admin_headers)
    assert res_update.status_code == 422

def test_archived_students_excluded_from_intake_and_category_counts():
    """
    Verify soft-archived student records are completely excluded from intake
    regular enrolment, supernumerary enrolment, and category totals.
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Create a student with category FN
    roll = f"2026-ARCH-{uuid.uuid4().hex[:6]}"
    res_create = client.post("/api/students", json={
        "roll_number": roll,
        "full_name": "Archival Test Student",
        "apaar_id": f"88{uuid.uuid4().int % 10000000000:010d}",
        "course_id": 4,
        "admission_year": 2026,
        "admission_category": "Foreign National",
        "is_supernumerary": False
    }, headers=admin_headers)
    assert res_create.status_code == 201
    s_id = res_create.json()["student_id"]

    # Intake count with student active
    res1 = client.get("/api/intake?academic_year=2026", headers=admin_headers)
    c4_before = next(it for it in res1.json()["items"] if it["course_id"] == 4)
    fn_before = c4_before["categories"]["Foreign National"]
    reg_before = c4_before["enrolled_regular"]

    # Soft archive the student
    del_res = client.delete(f"/api/students/{s_id}", headers=admin_headers)
    assert del_res.status_code == 200

    # Intake count after archival
    res2 = client.get("/api/intake?academic_year=2026", headers=admin_headers)
    c4_after = next(it for it in res2.json()["items"] if it["course_id"] == 4)

    assert c4_after["categories"]["Foreign National"] == fn_before - 1
    assert c4_after["enrolled_regular"] == reg_before - 1

def test_enrolment_exceeding_approved_intake_warning():
    """
    Verify when regular enrolment exceeds approved intake:
    - Status is 'Exceeds Capacity'
    - remaining_capacity is negative
    - Warning message describes the excess regular seats
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Set approved intake of 1 for Course 5
    client.post("/api/intake", json={
        "course_id": 5,
        "academic_year": 2026,
        "approved_intake": 1,
        "supernumerary_intake": 0,
        "notes": "Low capacity test"
    }, headers=admin_headers)

    # Enroll 2 regular students
    for _ in range(2):
        client.post("/api/students", json={
            "roll_number": f"2026-EXC-{uuid.uuid4().hex[:6]}",
            "full_name": "Excess Student",
            "apaar_id": f"88{uuid.uuid4().int % 10000000000:010d}",
            "course_id": 5,
            "admission_year": 2026,
            "admission_category": "General",
            "is_supernumerary": False
        }, headers=admin_headers)

    res = client.get("/api/intake?academic_year=2026", headers=admin_headers)
    c5 = next(it for it in res.json()["items"] if it["course_id"] == 5)

    assert c5["status"] == "Exceeds Capacity"
    assert c5["remaining_capacity"] < 0
    assert c5["warning"] is not None
    assert "exceeds approved intake" in c5["warning"]

def test_intake_and_category_institution_isolation():
    """
    Verify intake configurations and category metrics for Institution 1
    are strictly isolated from Institution 2.
    """
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")     # Inst 1
    admin_inst2 = get_auth_headers("suresh.admin@bnce.edu")   # Inst 2

    res1 = client.get("/api/intake?academic_year=2026", headers=admin_inst1)
    res2 = client.get("/api/intake?academic_year=2026", headers=admin_inst2)

    assert res1.status_code == 200
    assert res2.status_code == 200

    inst1_courses = {it["course_id"] for it in res1.json()["items"]}
    inst2_courses = {it["course_id"] for it in res2.json()["items"]}

    # No shared courses between the two institutions
    assert inst1_courses.isdisjoint(inst2_courses)
    assert res1.json()["institution_id"] == 1
    assert res2.json()["institution_id"] == 2

def test_bulk_import_with_admission_category_and_supernumerary():
    """
    Verify CSV bulk import accurately recognizes admission_category and is_supernumerary
    columns (and common synonyms) and commits them cleanly to student records.
    """
    import json
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    apaar_nri = f"88{uuid.uuid4().int % 10000000000:010d}"
    apaar_oci = f"88{uuid.uuid4().int % 10000000000:010d}"
    roll_nri = f"2026-IMP-NRI-{uuid.uuid4().hex[:6]}"
    roll_oci = f"2026-IMP-OCI-{uuid.uuid4().hex[:6]}"

    csv_content = f"""full_name,roll_number,apaar_id,course_code,admission_year,admission_category,is_supernumerary
Priya Rao,{roll_nri},{apaar_nri},CSE,2026,NRI,true
Vikram Patel,{roll_oci},{apaar_oci},CSE,2026,OCI,false
"""
    files = {
        "file": ("test_import_categories.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")
    }

    mapping = {
        "roll_number": "roll_number",
        "full_name": "full_name",
        "apaar_id": "apaar_id",
        "course_code": "course_code",
        "admission_year": "admission_year",
        "admission_category": "admission_category",
        "is_supernumerary": "is_supernumerary"
    }

    # 1. Validate staging
    val_res = client.post(
        "/api/import/validate",
        files=files,
        data={"mapping_json": json.dumps(mapping)},
        headers={"Authorization": admin_headers["Authorization"]}
    )
    assert val_res.status_code == 200, f"Validate failed: {val_res.text}"
    val_data = val_res.json()
    assert val_data["summary"]["valid_count"] >= 2

    # 2. Commit import
    commit_payload = {
        "filename": val_data["filename"],
        "file_hash": val_data["file_hash"],
        "mapping_hash": val_data["mapping_hash"],
        "staged_rows": val_data["staged_rows"],
        "options": {"duplicate_strategy": "flag"}
    }
    commit_res = client.post("/api/import/commit", json=commit_payload, headers=admin_headers)
    assert commit_res.status_code == 200, f"Commit failed: {commit_res.text}"
    assert commit_res.json()["created_rows"] >= 2

    # 3. Verify students have proper category and supernumerary flag
    st_res = client.get(f"/api/students?search={roll_nri}", headers=admin_headers)
    assert st_res.status_code == 200
    st_nri = st_res.json()["items"][0]
    assert st_nri["admission_category"] == "NRI"
    assert st_nri["is_supernumerary"] is True

    st_res2 = client.get(f"/api/students?search={roll_oci}", headers=admin_headers)
    assert st_res2.status_code == 200
    st_oci = st_res2.json()["items"][0]
    assert st_oci["admission_category"] == "OCI"
    assert st_oci["is_supernumerary"] is False

def test_dashboard_and_reports_category_supernumerary_contract():
    """
    Verify /dashboard/metrics and reports export endpoints return valid category
    and supernumerary metrics adhering to the API specification.
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # 1. Dashboard metrics
    dash_res = client.get("/api/dashboard/metrics", headers=admin_headers)
    assert dash_res.status_code == 200
    kpis = dash_res.json()["kpis"]
    assert "total_regular_enrolled" in kpis
    assert "total_supernumerary_enrolled" in kpis
    assert "category_breakdown" in kpis
    assert "General" in kpis["category_breakdown"]
    assert "NRI" in kpis["category_breakdown"]

    # 2. Reports export
    rep_res = client.get("/api/reports/export?report_type=intake_utilization&format=csv", headers=admin_headers)
    assert rep_res.status_code == 200
    csv_text = rep_res.text
    assert "Supernumerary Quota" in csv_text
    assert "Regular Enrolled" in csv_text
    assert "Supernumerary Enrolled" in csv_text
