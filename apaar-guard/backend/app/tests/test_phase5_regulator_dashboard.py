import pytest
import uuid
import json
from starlette.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.institution import Institution
from app.models.course import Course
from app.models.intake import IntakeConfiguration
from app.models.review import ReviewCase
from app.models.duplicate import DuplicateAlert

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

def test_authorized_regulator_can_access_aggregate_metrics():
    """
    1. Authorized regulator can access overview aggregate metrics,
    institution-level summaries, and aggregate CSV export.
    """
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")

    # 1. Overview API
    res_ov = client.get("/api/regulator/overview?academic_year=2026", headers=reg_headers)
    assert res_ov.status_code == 200
    ov_data = res_ov.json()

    assert ov_data["total_institutions"] >= 3
    assert ov_data["total_active_students"] >= 1
    assert "total_approved_regular_intake" in ov_data
    assert "total_regular_enrolled" in ov_data
    assert "total_supernumerary_intake" in ov_data
    assert "total_supernumerary_enrolled" in ov_data
    assert "overall_regular_utilization" in ov_data
    assert "admission_categories" in ov_data
    assert "data_quality_summary" in ov_data
    assert "duplicate_review_summary" in ov_data
    assert "disclaimer" in ov_data

    # 2. Institution monitoring API
    res_inst = client.get("/api/regulator/institutions?academic_year=2026", headers=reg_headers)
    assert res_inst.status_code == 200
    inst_data = res_inst.json()
    assert inst_data["total_institutions"] >= 3
    assert len(inst_data["items"]) >= 3

    first_inst = inst_data["items"][0]
    assert "institution_name" in first_inst
    assert "institution_code" in first_inst
    assert "regular_utilization" in first_inst
    assert "admission_categories" in first_inst
    assert "status" in first_inst

    # 3. Aggregate CSV export
    res_exp = client.get("/api/regulator/export?academic_year=2026", headers=reg_headers)
    assert res_exp.status_code == 200
    assert "text/csv" in res_exp.headers.get("content-type", "")
    assert "Institution Code" in res_exp.text

def test_institution_admin_cannot_access_regulator_endpoints():
    """
    2. Institution admin cannot access regulator-only endpoints (403 Forbidden).
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    res1 = client.get("/api/regulator/overview", headers=admin_headers)
    assert res1.status_code == 403
    assert "Access denied" in res1.text

    res2 = client.get("/api/regulator/institutions", headers=admin_headers)
    assert res2.status_code == 403

    res3 = client.get("/api/regulator/export", headers=admin_headers)
    assert res3.status_code == 403

def test_verification_officer_cannot_access_regulator_endpoints():
    """
    3. Verification officer cannot access regulator-only endpoints (403 Forbidden).
    """
    officer_headers = get_auth_headers("ravi.officer@apex.edu")

    res1 = client.get("/api/regulator/overview", headers=officer_headers)
    assert res1.status_code == 403
    assert "Access denied" in res1.text

    res2 = client.get("/api/regulator/institutions", headers=officer_headers)
    assert res2.status_code == 403

def test_unauthenticated_requests_are_rejected():
    """
    4. Unauthenticated requests to regulator endpoints are rejected (401 Unauthorized).
    """
    res1 = client.get("/api/regulator/overview")
    assert res1.status_code == 401

    res2 = client.get("/api/regulator/institutions")
    assert res2.status_code == 401

    res3 = client.get("/api/regulator/export")
    assert res3.status_code == 401

def test_regulator_cannot_create_update_archive_or_reveal_students():
    """
    5. Regulator users do NOT have permission to create, edit, archive,
    reveal, or view single-tenant student-level records.
    """
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")

    # Cannot create student
    res_create = client.post("/api/students", json={
        "roll_number": f"REG-TEST-{uuid.uuid4().hex[:6]}",
        "full_name": "Regulator Test Student",
        "apaar_id": f"88{uuid.uuid4().int % 10000000000:010d}",
        "course_id": 1,
        "admission_year": 2026
    }, headers=reg_headers)
    assert res_create.status_code == 403

    # Cannot update student
    res_update = client.put("/api/students/1", json={"full_name": "Hacked Name"}, headers=reg_headers)
    assert res_update.status_code == 403

    # Cannot archive student
    res_delete = client.delete("/api/students/1", headers=reg_headers)
    assert res_delete.status_code == 403

    # Cannot reveal student APAAR
    res_reveal = client.post("/api/students/1/reveal-apaar", headers=reg_headers)
    assert res_reveal.status_code == 403

    # Cannot list student personal records
    res_list = client.get("/api/students", headers=reg_headers)
    assert res_list.status_code == 403

    # Cannot view single student detail
    res_detail = client.get("/api/students/1", headers=reg_headers)
    assert res_detail.status_code == 403

    # Cannot export student-level report
    res_report = client.get("/api/reports/export?report_type=student_summary", headers=reg_headers)
    assert res_report.status_code == 403

def test_student_level_pii_absent_from_regulator_responses():
    """
    6. Verify student-level personal identifiable information (PII) like
    student names, roll numbers, full APAAR IDs, emails, phones are absent.
    """
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")

    # 1. Overview API text check
    res_ov = client.get("/api/regulator/overview", headers=reg_headers)
    ov_str = res_ov.text
    assert "roll_number" not in ov_str
    assert "student_name" not in ov_str
    assert "apaar_id" not in ov_str
    assert "phone" not in ov_str
    assert "email" not in ov_str

    # 2. Institutions API text check
    res_inst = client.get("/api/regulator/institutions", headers=reg_headers)
    inst_str = res_inst.text
    assert "roll_number" not in inst_str
    assert "student_name" not in inst_str
    assert "phone" not in inst_str
    assert "email" not in inst_str

    # 3. Institution Courses drilldown check
    res_courses = client.get("/api/regulator/institutions/1/courses", headers=reg_headers)
    assert res_courses.status_code == 200
    course_str = res_courses.text
    assert "roll_number" not in course_str
    assert "student_name" not in course_str
    assert "apaar_id" not in course_str

def test_archived_students_excluded_from_active_student_counts():
    """
    7. Soft-archived students (is_archived == True) are strictly excluded
    from active student totals in regulator overview and institution metrics.
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")

    # Baseline active count
    res_init = client.get("/api/regulator/overview?academic_year=2026", headers=reg_headers)
    init_active = res_init.json()["total_active_students"]

    # Create active student
    roll = f"2026-ARCHREG-{uuid.uuid4().hex[:6]}"
    create_res = client.post("/api/students", json={
        "roll_number": roll,
        "full_name": "Active For Archive Test",
        "apaar_id": f"88{uuid.uuid4().int % 10000000000:010d}",
        "course_id": 1,
        "admission_year": 2026,
        "admission_category": "General",
        "is_supernumerary": False
    }, headers=admin_headers)
    assert create_res.status_code == 201
    s_id = create_res.json()["student_id"]

    # Check active count incremented
    res_post_create = client.get("/api/regulator/overview?academic_year=2026", headers=reg_headers)
    assert res_post_create.json()["total_active_students"] == init_active + 1

    # Soft archive the student
    del_res = client.delete(f"/api/students/{s_id}", headers=admin_headers)
    assert del_res.status_code == 200

    # Check active count decremented back
    res_post_archive = client.get("/api/regulator/overview?academic_year=2026", headers=reg_headers)
    assert res_post_archive.json()["total_active_students"] == init_active

def test_intake_and_supernumerary_metrics_match_phase4_definitions():
    """
    8. Regulator overview intake and supernumerary metrics strictly match
    Phase 4 definitions (regular utilization excludes supernumerary admissions).
    """
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")

    res = client.get("/api/regulator/overview?academic_year=2026", headers=reg_headers)
    assert res.status_code == 200
    d = res.json()

    approved_reg = d["total_approved_regular_intake"]
    enrolled_reg = d["total_regular_enrolled"]
    util = d["overall_regular_utilization"]

    if approved_reg > 0:
        expected_util = round((enrolled_reg / approved_reg * 100.0), 1)
        assert util == expected_util
    else:
        assert util == 0.0

    # Supernumerary enrollment is tracked separately
    assert d["total_supernumerary_enrolled"] >= 0
    assert d["total_supernumerary_intake"] >= 0

def test_admission_category_counts_use_canonical_phase4_categories():
    """
    9. Admission-category counts in regulator overview and institution metrics
    conform to canonical Phase 4 categories: General, NRI, OCI, Foreign National, Other.
    """
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")

    res = client.get("/api/regulator/overview?academic_year=2026", headers=reg_headers)
    assert res.status_code == 200
    cats = res.json()["admission_categories"]

    expected_keys = {"General", "NRI", "OCI", "Foreign National", "Other"}
    assert set(cats.keys()) == expected_keys
    assert sum(cats.values()) == res.json()["total_active_students"]

def test_duplicate_review_summaries_do_not_double_count():
    """
    10. Duplicate-review summaries match exact database counts without double-counting.
    """
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")

    res = client.get("/api/regulator/overview", headers=reg_headers)
    assert res.status_code == 200
    dup_summary = res.json()["duplicate_review_summary"]

    db = SessionLocal()
    try:
        actual_pending = db.query(ReviewCase).filter(ReviewCase.status == "Pending Review").count()
        actual_open_alerts = db.query(DuplicateAlert).filter(DuplicateAlert.status == "open").count()
        actual_cross = db.query(DuplicateAlert).filter(
            DuplicateAlert.status == "open",
            DuplicateAlert.alert_type == "cross_institution_apaar"
        ).count()

        assert dup_summary["pending_review_cases"] == actual_pending
        assert dup_summary["total_open_duplicate_alerts"] == actual_open_alerts
        assert dup_summary["cross_institution_collisions"] == actual_cross
    finally:
        db.close()

def test_existing_institution_isolation_remains_intact():
    """
    11. Existing single-tenant institution isolation remains completely intact:
    Institution 1 and Institution 2 admins can only see their own records.
    """
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")     # Inst 1
    admin_inst2 = get_auth_headers("suresh.admin@bnce.edu")   # Inst 2

    # Institution 1 dashboard
    d1 = client.get("/api/dashboard/metrics", headers=admin_inst1).json()
    # Institution 2 dashboard
    d2 = client.get("/api/dashboard/metrics", headers=admin_inst2).json()

    assert d1["kpis"]["total_students"] > 0
    assert d2["kpis"]["total_students"] > 0

    # Single-tenant intake
    i1 = client.get("/api/intake?academic_year=2026", headers=admin_inst1).json()
    i2 = client.get("/api/intake?academic_year=2026", headers=admin_inst2).json()

    assert i1["institution_id"] == 1
    assert i2["institution_id"] == 2
    assert {c["course_id"] for c in i1["items"]}.isdisjoint({c["course_id"] for c in i2["items"]})

def test_phase3_cross_institution_privacy_protections_intact():
    """
    12. Phase 3 cross-institution duplicate alerts preserve privacy:
    ReviewCase created for an institution never discloses other institution's student PII.
    """
    admin_inst1 = get_auth_headers("asha.admin@apex.edu")

    # Review cases for Institution 1
    cases_res = client.get("/api/review/cases", headers=admin_inst1)
    assert cases_res.status_code == 200
    cases = cases_res.json()
    assert isinstance(cases, list)

    for c in cases:
        # Every review case belongs strictly to Institution 1
        assert c["institution_id"] == 1
        # Masked APAAR format when APAAR exists
        if c.get("masked_apaar") and c["masked_apaar"] != "Not Assigned":
            assert "XXXX" in c["masked_apaar"]

def test_existing_dashboards_reports_and_apis_retain_expected_contracts():
    """
    13. Existing dashboards, intake monitoring, and reports APIs retain
    their expected JSON schemas and response contracts.
    """
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Dashboard metrics
    dash_res = client.get("/api/dashboard/metrics", headers=admin_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "kpis" in dash_data
    assert "status_distribution" in dash_data
    assert "course_breakdown" in dash_data

    # Intake
    intake_res = client.get("/api/intake", headers=admin_headers)
    assert intake_res.status_code == 200
    intake_data = intake_res.json()
    assert "total_approved_intake" in intake_data
    assert "category_totals" in intake_data
    assert "items" in intake_data

def test_empty_datasets_and_unconfigured_intake_handled_accurately():
    """
    14. Unpopulated or unconfigured academic years return clean 200 responses
    with 0 counts and 0.0% utilization, avoiding ZeroDivisionError or crashes.
    """
    reg_headers = get_auth_headers("rajesh.regulator@aicte.gov.in")

    # Query far future session with zero enrollment and zero intake
    res_empty = client.get("/api/regulator/overview?academic_year=2045", headers=reg_headers)
    assert res_empty.status_code == 200
    d = res_empty.json()

    assert d["total_active_students"] == 0
    assert d["total_regular_enrolled"] == 0
    assert d["total_approved_regular_intake"] == 0
    assert d["overall_regular_utilization"] == 0.0

    # Institutions list for unconfigured year
    res_inst = client.get("/api/regulator/institutions?academic_year=2045", headers=reg_headers)
    assert res_inst.status_code == 200
    items = res_inst.json()["items"]
    for it in items:
        assert it["status"] == "Configuration Missing"
        assert it["approved_regular_intake"] == 0
        assert it["regular_utilization"] == 0.0
