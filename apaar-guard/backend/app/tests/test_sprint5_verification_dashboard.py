import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.review import ReviewCase
from app.models.audit import AuditLog

client = TestClient(app)

def get_auth_headers(email: str, password: str = "password123"):
    fresh_client = TestClient(app)
    res = fresh_client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_dashboard_totals_equal_db_counts():
    headers = get_auth_headers("asha.admin@apex.edu")
    res = client.get("/api/dashboard/metrics", headers=headers)
    assert res.status_code == 200
    data = res.json()
    kpis = data["kpis"]

    db = SessionLocal()
    try:
        active_students = db.query(Student).filter(
            Student.institution_id == 1,
            Student.is_archived == False
        ).all()
        actual_total = len(active_students)
        actual_ready = sum(1 for s in active_students if s.status == "Ready")
        actual_invalid = sum(1 for s in active_students if s.status == "Invalid Data")
        actual_needs_review = sum(1 for s in active_students if s.status == "Needs Review")

        assert kpis["total_students"] == actual_total
        assert kpis["ready_count"] == actual_ready
        assert kpis["invalid_count"] == actual_invalid
        assert kpis["needs_review_count"] == actual_needs_review

        # Verify duplicate distinct student count per Section 10
        assert "potential_duplicates" in kpis
        assert "open_alert_count" in kpis
    finally:
        db.close()

def test_review_case_state_machine_and_student_status_independence():
    headers = get_auth_headers("ravi.officer@apex.edu")
    
    # 1. Get an open case in Institution 1
    res_cases = client.get("/api/review/cases?status=Pending Review", headers=headers)
    assert res_cases.status_code == 200
    cases = res_cases.json()
    
    # If no Pending Review, look for In Progress or reopen one
    if not cases:
        all_cases = client.get("/api/review/cases", headers=headers).json()
        assert len(all_cases) > 0
        target_case = all_cases[0]
        case_id = target_case["id"]
        # Reopen to Pending Review
        client.post(f"/api/review/cases/{case_id}/action", json={"action": "reopen", "note_text": "Reopening for test"}, headers=headers)
    else:
        target_case = cases[0]
        case_id = target_case["id"]

    student_id = target_case["student_id"]

    # 2. Transition: Pending Review -> In Progress (Valid)
    res_in_prog = client.post(f"/api/review/cases/{case_id}/action", json={
        "action": "start_review",
        "note_text": "Beginning investigation into potential matching records."
    }, headers=headers)
    assert res_in_prog.status_code == 200
    assert res_in_prog.json()["case_status"] == "In Progress"

    # 3. Missing reason for Resolved -> 400 Bad Request
    res_no_reason = client.post(f"/api/review/cases/{case_id}/action", json={
        "action": "resolve",
        "note_text": ""  # empty reason
    }, headers=headers)
    assert res_no_reason.status_code == 400
    assert "written justification reason is mandatory" in res_no_reason.json()["detail"]

    # 4. Valid Resolution with reason
    res_resolve = client.post(f"/api/review/cases/{case_id}/action", json={
        "action": "resolve",
        "note_text": "Verified matching physical record in institutional registrar archives. Identity is confirmed."
    }, headers=headers)
    assert res_resolve.status_code == 200
    assert res_resolve.json()["case_status"] == "Resolved"

    # 5. Check student status remains one of 3 valid states (Ready, Invalid Data, Needs Review) - NEVER "Resolved"!
    db = SessionLocal()
    try:
        s = db.query(Student).filter(Student.id == student_id).first()
        assert s.status in ["Ready", "Invalid Data", "Needs Review"]
        assert s.status != "Resolved"
        assert s.status != "Correction Requested"

        # Check Audit Log was written
        audit = db.query(AuditLog).filter(
            AuditLog.action == "REVIEW_CASE_TRANSITION_RESOLVED",
            AuditLog.target_id == str(case_id)
        ).first()
        assert audit is not None
        assert "registrar archives" in audit.details
    finally:
        db.close()

    # 6. Illegal Transition: Resolved -> In Progress returns 409 Conflict
    # Per Allowed Transitions, Resolved can ONLY transition to 'Pending Review' (reopen)
    res_illegal = client.post(f"/api/review/cases/{case_id}/action", json={
        "action": "start_review",
        "note_text": "Illegal transition attempt"
    }, headers=headers)
    assert res_illegal.status_code == 409
    assert "Illegal transition" in res_illegal.json()["detail"]

def test_cross_institution_review_access_denied():
    headers_inst1 = get_auth_headers("ravi.officer@apex.edu")

    # Find a review case belonging to Institution 2
    db = SessionLocal()
    try:
        case_inst2 = db.query(ReviewCase).filter(ReviewCase.institution_id == 2).first()
        case_id_inst2 = case_inst2.id if case_inst2 else None
    finally:
        db.close()

    if case_id_inst2:
        # Officer from Institution 1 attempting to view case of Institution 2 -> 403 Forbidden
        res_view = client.get(f"/api/review/cases/{case_id_inst2}", headers=headers_inst1)
        assert res_view.status_code == 403

        # Officer from Institution 1 attempting to act on case of Institution 2 -> 403 Forbidden
        res_act = client.post(f"/api/review/cases/{case_id_inst2}/action", json={
            "action": "start_review"
        }, headers=headers_inst1)
        assert res_act.status_code == 403

def test_intake_monitoring_and_admin_update():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # 1. Read intake monitoring (Officer can read)
    res_intake = client.get("/api/intake?academic_year=2026", headers=officer_headers)
    assert res_intake.status_code == 200
    intake_data = res_intake.json()
    assert "overall_utilization" in intake_data
    assert "items" in intake_data
    assert "aggregate_alerts" in intake_data

    # 2. Officer cannot update intake (403 Forbidden)
    res_off_upd = client.post("/api/intake", json={
        "course_id": 1,
        "academic_year": 2026,
        "approved_intake": 80,
        "notes": "Unauthorized officer update"
    }, headers=officer_headers)
    assert res_off_upd.status_code == 403

    # 3. Admin updates intake (Allowed)
    res_adm_upd = client.post("/api/intake", json={
        "course_id": 1,
        "academic_year": 2026,
        "approved_intake": 80,
        "notes": "Approved expansion per State Council Letter 2026-X"
    }, headers=admin_headers)
    assert res_adm_upd.status_code == 200
    assert res_adm_upd.json()["approved_intake"] == 80
    assert "admin" in res_adm_upd.json()["source"].lower()

def test_export_respects_institution_boundary_and_audits():
    headers_ait = get_auth_headers("asha.admin@apex.edu")

    # Export report
    res_export = client.get("/api/reports/export?report_type=student_summary", headers=headers_ait)
    assert res_export.status_code == 200
    csv_text = res_export.text
    
    # Must have metadata comments and official verification notice
    assert "# APAAR Guard Export: student_summary" in csv_text
    assert "Official verification unavailable" in csv_text

    # Audit log check
    db = SessionLocal()
    try:
        log = db.query(AuditLog).filter(
            AuditLog.action == "REPORT_EXPORTED",
            AuditLog.institution_id == 1
        ).order_by(AuditLog.created_at.desc()).first()
        assert log is not None
        assert "student_summary" in log.details
    finally:
        db.close()
