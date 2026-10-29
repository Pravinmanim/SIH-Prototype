import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.course import Course
from app.models.intake import IntakeConfiguration
from app.models.review import ReviewCase
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
from app.services.validation.engine import compute_aggregate_intake_alerts, validation_engine
from app.services.verification.official_service import official_verification_service

client = TestClient(app)

def test_apaar_format_rule():
    rule = ApaarFormatRule()
    
    # Valid 12 digits
    res = rule.evaluate({"student": {"apaar_id": "123456789012"}})
    assert len(res) == 1
    assert res[0].status == "passed"
    
    # Valid with leading zero (preserved string)
    res_zero = rule.evaluate({"student": {"apaar_id": "012345678901"}})
    assert res_zero[0].status == "passed"
    
    # Invalid length (8 digits)
    res_short = rule.evaluate({"student": {"apaar_id": "12345678"}})
    assert res_short[0].status == "failed"
    assert res_short[0].severity == "error"
    assert "8 digits" in res_short[0].message
    
    # Invalid non-numeric
    res_alpha = rule.evaluate({"student": {"apaar_id": "1234ABCD9999"}})
    assert res_alpha[0].status == "failed"
    assert "non-numeric" in res_alpha[0].message

    # Empty / None APAAR is warning, not error
    res_empty = rule.evaluate({"student": {"apaar_id": ""}})
    assert res_empty[0].status == "failed"
    assert res_empty[0].severity == "warning"
    assert "missing" in res_empty[0].message

def test_empty_apaar_never_counts_as_duplicate():
    rule = ExactDuplicateApaarRule()
    context = {
        "student": {"id": 1, "apaar_id": "", "roll_number": "R-01"},
        "existing_students": [
            {"id": 2, "apaar_id": "", "roll_number": "R-02"},
            {"id": 3, "apaar_id": None, "roll_number": "R-03"},
            {"id": 4, "apaar_id": "123456789012", "roll_number": "R-04"},
        ]
    }
    res = rule.evaluate(context)
    assert res[0].status == "passed"
    assert "absent" in res[0].message

def test_exact_duplicate_apaar_warning():
    rule = ExactDuplicateApaarRule()
    context = {
        "student": {"id": 1, "apaar_id": "998877665544", "roll_number": "R-01"},
        "existing_students": [
            {"id": 2, "apaar_id": "998877665544", "roll_number": "R-02", "full_name": "Other Student"},
        ]
    }
    res = rule.evaluate(context)
    assert res[0].status == "failed"
    assert res[0].severity == "warning"  # Per Corrections v2: duplicate routes to Needs Review
    assert "matches another record" in res[0].message

def test_duplicate_roll_number_same_vs_diff_institution():
    rule = DuplicateRollNumberRule()
    
    # Same institution & same admission year -> WARNING (routes to Needs Review)
    ctx_same = {
        "student": {"id": 1, "institution_id": 1, "admission_year": 2026, "roll_number": "2026-CSE-001"},
        "existing_students": [
            {"id": 2, "institution_id": 1, "admission_year": 2026, "roll_number": "2026-CSE-001", "full_name": "Student A"}
        ]
    }
    res_same = rule.evaluate(ctx_same)
    assert res_same[0].status == "failed"
    assert res_same[0].severity == "warning"
    assert "already assigned" in res_same[0].message

    # Different institution -> VALID (different institutions are NOT duplicates)
    ctx_diff = {
        "student": {"id": 1, "institution_id": 1, "admission_year": 2026, "roll_number": "2026-CSE-001"},
        "existing_students": [
            {"id": 2, "institution_id": 2, "admission_year": 2026, "roll_number": "2026-CSE-001", "full_name": "Student B"}
        ]
    }
    res_diff = rule.evaluate(ctx_diff)
    assert res_diff[0].status == "passed"

def test_possible_duplicate_heuristic():
    rule = PossibleDuplicateRule()
    
    # Same name and DOB in same institution -> warning flagged
    ctx = {
        "student": {"id": 1, "institution_id": 1, "full_name": "Aditya Sharma", "date_of_birth": "2005-05-12"},
        "existing_students": [
            {"id": 2, "institution_id": 1, "full_name": "ADITYA  SHARMA", "date_of_birth": "2005-05-12", "roll_number": "R-10"}
        ]
    }
    res = rule.evaluate(ctx)
    assert res[0].status == "failed"
    assert res[0].severity == "warning"
    assert "Possible duplicate candidate" in res[0].message

def test_issue_fingerprint_generation():
    fp1 = compute_issue_fingerprint("R3_EXACT_DUPLICATE_APAAR", 10, {"apaar_id": "123456789012"})
    fp2 = compute_issue_fingerprint("R3_EXACT_DUPLICATE_APAAR", 10, {"apaar_id": "123456789012"})
    fp_different = compute_issue_fingerprint("R3_EXACT_DUPLICATE_APAAR", 10, {"apaar_id": "999999999999"})
    
    assert fp1 == fp2
    assert fp1 != fp_different
    assert len(fp1) == 64  # SHA-256 hex length

def test_aggregate_intake_monitoring_boundary():
    db = SessionLocal()
    try:
        alerts = compute_aggregate_intake_alerts(db, institution_id=1, academic_year=2026)
        assert isinstance(alerts, list)
        
        # Verify aggregate alerts NEVER alter individual student validation status
        # Students in institution 1 should only have valid 3 statuses: Ready, Invalid Data, Needs Review
        students = db.query(Student).filter(Student.institution_id == 1, Student.is_archived == False).all()
        for s in students:
            assert s.status in ["Ready", "Invalid Data", "Needs Review"]
    finally:
        db.close()

def test_official_verification_boundary_stub():
    res = official_verification_service.verify_student_apaar("123456789012", "Test Student", "2005-01-01")
    assert res["status"] == "unavailable"
    assert res["verified"] is False
    assert "Official verification unavailable. Local checks are not official verification." in res["message"]
    assert "A valid 12-digit format does not prove the ID exists" in res["notice"]

def test_api_validation_run_endpoint():
    login_res = client.post("/api/auth/login", json={
        "email": "asha.admin@apex.edu",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    
    # Run validation
    run_res = client.post("/api/validation/run", headers={"Authorization": f"Bearer {token}"})
    assert run_res.status_code == 200
    data = run_res.json()
    assert data["status"] == "success"
    assert "counts" in data
    assert data["counts"]["total"] > 0
    assert "Official verification unavailable" in data["disclaimer"]

    # Results summary
    summary_res = client.get("/api/validation/results", headers={"Authorization": f"Bearer {token}"})
    assert summary_res.status_code == 200
    s_data = summary_res.json()
    assert s_data["total_active_students"] > 0
    assert len(s_data["rules"]) > 0
