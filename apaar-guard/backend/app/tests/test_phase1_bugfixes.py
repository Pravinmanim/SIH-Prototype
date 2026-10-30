import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.review import ReviewCase
from app.models.duplicate import DuplicateAlert
from app.models.import_job import ImportJob, ImportJobError
from app.models.audit import AuditLog

client = TestClient(app)

def get_auth_headers(email: str, password: str = "password123"):
    fresh_client = TestClient(app)
    res = fresh_client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# ==============================================================================
# BUG 1 REGRESSION TESTS: Notification Queries
# ==============================================================================

def test_notifications_endpoint_success_and_schema():
    """Verify GET /api/notifications returns 200 with clean schema and no runtime exceptions."""
    headers = get_auth_headers("asha.admin@apex.edu")
    res = client.get("/api/notifications", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "unread_count" in data
    assert "total_count" in data
    assert "notifications" in data
    assert isinstance(data["notifications"], list)


def test_notifications_canonical_review_case_status():
    """Verify ReviewCase status 'Pending Review' is counted and 'PENDING_REVIEW' is not queried."""
    db = SessionLocal()
    headers = get_auth_headers("asha.admin@apex.edu")
    try:
        # Check actual count of "Pending Review" cases for Inst 1
        expected_pending = db.query(ReviewCase).filter(
            ReviewCase.institution_id == 1,
            ReviewCase.status == "Pending Review"
        ).count()

        res = client.get("/api/notifications", headers=headers)
        assert res.status_code == 200
        notifications = res.json()["notifications"]

        review_notif = next((n for n in notifications if n["type"] == "REVIEW_PENDING"), None)
        if expected_pending > 0:
            assert review_notif is not None
            assert review_notif["count"] == expected_pending
            assert "Pending Verification Reviews" in review_notif["title"]
        else:
            assert review_notif is None
    finally:
        db.close()


def test_notifications_open_duplicate_alerts():
    """Verify duplicate alerts query DuplicateAlert with status 'open'."""
    db = SessionLocal()
    headers = get_auth_headers("asha.admin@apex.edu")
    try:
        open_alerts = db.query(DuplicateAlert).filter(
            DuplicateAlert.institution_id == 1,
            DuplicateAlert.status == "open"
        ).count()

        res = client.get("/api/notifications", headers=headers)
        assert res.status_code == 200
        notifications = res.json()["notifications"]

        dup_notif = next((n for n in notifications if n["type"] == "DUPLICATES_FLAGGED"), None)
        if open_alerts > 0:
            assert dup_notif is not None
            assert dup_notif["count"] == open_alerts
            assert dup_notif["link"] == "/verification"
    finally:
        db.close()


def test_notifications_archived_students_ignored():
    """Verify archived students (is_archived == True) are never counted in invalid/intake notifications."""
    db = SessionLocal()
    headers = get_auth_headers("asha.admin@apex.edu")
    created_student_id = None
    try:
        # Create an invalid student that is soft-archived
        archived_invalid = Student(
            institution_id=1,
            course_id=1,
            roll_number="TEST_ARCHIVED_999",
            full_name="Archived Test Student",
            admission_year=2026,
            status="Invalid Data",
            is_archived=True,
            archived_at=datetime.now(timezone.utc)
        )
        db.add(archived_invalid)
        db.commit()
        db.refresh(archived_invalid)
        created_student_id = archived_invalid.id

        # Query notifications
        res = client.get("/api/notifications", headers=headers)
        assert res.status_code == 200
        notifications = res.json()["notifications"]

        # Count active invalid students in DB
        active_invalid_count = db.query(Student).filter(
            Student.institution_id == 1,
            Student.status == "Invalid Data",
            Student.is_archived == False
        ).count()

        invalid_notif = next((n for n in notifications if n["type"] == "INVALID_DATA"), None)
        if active_invalid_count > 0:
            assert invalid_notif is not None
            assert invalid_notif["count"] == active_invalid_count
        else:
            assert invalid_notif is None
    finally:
        if created_student_id:
            db.query(Student).filter(Student.id == created_student_id).delete()
            db.commit()
        db.close()


def test_notifications_import_job_field_safety():
    """Verify ImportJob notifications handle failed and partial jobs using invalid_rows/created_rows."""
    db = SessionLocal()
    headers = get_auth_headers("asha.admin@apex.edu")
    test_job_ids = []
    try:
        # 1. Create a failed import job with an error
        failed_job = ImportJob(
            id="test-notif-failed-job-uuid",
            institution_id=1,
            filename="failed_batch.csv",
            file_hash="dummyhash_failed",
            total_rows=10,
            status="failed"
        )
        db.add(failed_job)
        db.flush()
        test_job_ids.append(failed_job.id)

        job_err = ImportJobError(
            import_job_id=failed_job.id,
            row_index=1,
            field_name="apaar_id",
            error_message="Invalid 12-digit format"
        )
        db.add(job_err)

        # 2. Create a completed import job with partial rejections
        partial_job = ImportJob(
            id="test-notif-partial-job-uuid",
            institution_id=1,
            filename="partial_batch.csv",
            file_hash="dummyhash_partial",
            total_rows=50,
            created_rows=45,
            invalid_rows=5,
            status="completed"
        )
        db.add(partial_job)
        test_job_ids.append(partial_job.id)
        db.commit()

        # Query notifications without throwing AttributeError on error_summary/failed_rows
        res = client.get("/api/notifications", headers=headers)
        assert res.status_code == 200
        notifications = res.json()["notifications"]

        failed_notif = next((n for n in notifications if n["id"] == f"notif-job-failed-{failed_job.id}"), None)
        assert failed_notif is not None
        assert "Invalid 12-digit format" in failed_notif["message"]

        partial_notif = next((n for n in notifications if n["id"] == f"notif-job-partial-{partial_job.id}"), None)
        assert partial_notif is not None
        assert "45 imported, 5 rows rejected" in partial_notif["message"]

    finally:
        for jid in test_job_ids:
            db.query(ImportJobError).filter(ImportJobError.import_job_id == jid).delete()
            db.query(ImportJob).filter(ImportJob.id == jid).delete()
        db.commit()
        db.close()


def test_notifications_multi_tenant_isolation():
    """Verify notifications never leak records from another institution."""
    inst1_headers = get_auth_headers("asha.admin@apex.edu")   # Inst 1 (Apex)
    inst2_headers = get_auth_headers("suresh.admin@bnce.edu")  # Inst 2 (BNCE)

    res1 = client.get("/api/notifications", headers=inst1_headers)
    res2 = client.get("/api/notifications", headers=inst2_headers)

    assert res1.status_code == 200
    assert res2.status_code == 200

    notifs1 = res1.json()["notifications"]
    notifs2 = res2.json()["notifications"]

    # Notification IDs for institution-specific configs should not cross
    inst1_ids = {n["id"] for n in notifs1}
    inst2_ids = {n["id"] for n in notifs2}

    # Config-specific IDs (e.g. intake configs) belong to different institutions and must be disjoint
    intake_notifs1 = {nid for nid in inst1_ids if nid.startswith("notif-intake-")}
    intake_notifs2 = {nid for nid in inst2_ids if nid.startswith("notif-intake-")}
    assert intake_notifs1.isdisjoint(intake_notifs2)


# ==============================================================================
# BUG 2 REGRESSION TESTS: Remove Duplicate Route Registration
# ==============================================================================

def test_reveal_apaar_route_registered_once():
    """Confirm students router contains only one canonical route definition for reveal-apaar."""
    from app.api.students import router as students_router
    matching_routes = [
        route for route in students_router.routes 
        if hasattr(route, "path") and route.path.endswith("/reveal-apaar")
    ]
    # Prior to the fix, with 2 declarations in students.py, there were 2 routes registered.
    # Now, there must be exactly 1 canonical definition.
    paths = [r.path for r in matching_routes]
    assert len(matching_routes) == 1, f"Expected exactly 1 route in students router, found {len(matching_routes)}: {paths}"
    assert matching_routes[0].path == "/students/{student_id}/reveal-apaar"


def test_reveal_apaar_rbac_and_audit():
    """Verify consolidated reveal-apaar endpoint requires admin and creates audit log."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.institution_id == 1, Student.is_archived == False).first()
        assert student is not None
        student_id = student.id
    finally:
        db.close()

    # Officer should be rejected with 403
    officer_headers = get_auth_headers("ravi.officer@apex.edu")
    officer_res = client.post(f"/api/students/{student_id}/reveal-apaar", headers=officer_headers)
    assert officer_res.status_code == 403

    # Admin should succeed
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    admin_res = client.post(f"/api/students/{student_id}/reveal-apaar", headers=admin_headers)
    assert admin_res.status_code == 200
    data = admin_res.json()
    assert data["student_id"] == student_id
    assert "apaar_id" in data
    assert "warning" in data

    # Verify audit log was recorded
    db = SessionLocal()
    try:
        audit = db.query(AuditLog).filter(
            AuditLog.action == "APAAR_REVEALED",
            AuditLog.target_id == str(student_id)
        ).order_by(AuditLog.created_at.desc()).first()
        assert audit is not None
        assert audit.actor_role == "institution_admin"
    finally:
        db.close()


# ==============================================================================
# BUG 3 REGRESSION TESTS: Dynamic Academic Year in Dashboard
# ==============================================================================

def test_dashboard_default_academic_year():
    """Verify dashboard metrics default to established academic year 2026 when parameter is omitted."""
    headers = get_auth_headers("asha.admin@apex.edu")
    res = client.get("/api/dashboard/metrics", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["academic_year"] == 2026
    assert "kpis" in data
    assert data["kpis"]["total_students"] > 0
    assert "course_breakdown" in data


def test_dashboard_explicit_academic_year_filtering():
    """Verify dashboard metrics with explicit academic_year=2026 match."""
    headers = get_auth_headers("asha.admin@apex.edu")
    res = client.get("/api/dashboard/metrics?academic_year=2026", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["academic_year"] == 2026

    db = SessionLocal()
    try:
        expected_2026 = db.query(Student).filter(
            Student.institution_id == 1,
            Student.admission_year == 2026,
            Student.is_archived == False
        ).count()
        assert data["kpis"]["total_students"] == expected_2026
    finally:
        db.close()


def test_dashboard_empty_academic_year():
    """Verify dashboard metrics for an academic year with no enrollments returns 0 enrolled."""
    headers = get_auth_headers("asha.admin@apex.edu")
    res = client.get("/api/dashboard/metrics?academic_year=2024", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["academic_year"] == 2024
    assert data["kpis"]["total_students"] == 0
    assert data["kpis"]["ready_count"] == 0
    assert data["kpis"]["invalid_count"] == 0
    assert data["kpis"]["needs_review_count"] == 0


def test_dashboard_invalid_academic_year_validation():
    """Verify invalid academic year inputs produce 422 Unprocessable Entity."""
    headers = get_auth_headers("asha.admin@apex.edu")

    # Below minimum (1999)
    res_low = client.get("/api/dashboard/metrics?academic_year=1999", headers=headers)
    assert res_low.status_code == 422

    # Above maximum (2051)
    res_high = client.get("/api/dashboard/metrics?academic_year=2051", headers=headers)
    assert res_high.status_code == 422

    # Non-integer string
    res_str = client.get("/api/dashboard/metrics?academic_year=twenty-twenty-six", headers=headers)
    assert res_str.status_code == 422


def test_dashboard_consistency_between_summary_and_courses():
    """Verify sum of enrolled counts in course_breakdown matches configured scope enrolment."""
    headers = get_auth_headers("asha.admin@apex.edu")
    res = client.get("/api/dashboard/metrics?academic_year=2026", headers=headers)
    assert res.status_code == 200
    data = res.json()

    courses = data["course_breakdown"]
    total_course_enrolled = sum(c["enrolled_count"] for c in courses)

    # In our database, every student has a course assigned
    assert total_course_enrolled == data["kpis"]["total_students"]
