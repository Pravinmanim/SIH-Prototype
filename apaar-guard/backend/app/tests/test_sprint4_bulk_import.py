import pytest
import io
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.import_job import ImportJob

client = TestClient(app)

def get_auth_headers(email: str, password: str = "password123"):
    fresh_client = TestClient(app)
    res = fresh_client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_officer_cannot_access_import_endpoints():
    headers = get_auth_headers("ravi.officer@apex.edu")

    # Template download
    res_tpl = client.get("/api/import/template", headers=headers)
    assert res_tpl.status_code == 403
    assert "Only Institution Admins" in res_tpl.json()["detail"]

    # Inspect endpoint
    file_bytes = b"roll_number,full_name\n1,Test"
    res_inspect = client.post(
        "/api/import/inspect",
        files={"file": ("test.csv", io.BytesIO(file_bytes), "text/csv")},
        headers=headers
    )
    assert res_inspect.status_code == 403

def test_wrong_file_type_rejected_safely():
    headers = get_auth_headers("asha.admin@apex.edu")
    res = client.post(
        "/api/import/inspect",
        files={"file": ("malicious.exe", io.BytesIO(b"fake binary"), "application/octet-stream")},
        headers=headers
    )
    assert res.status_code == 400
    assert "Invalid file format" in res.json()["detail"]

def test_import_with_errors_csv_shows_plain_english_row_errors():
    headers = get_auth_headers("asha.admin@apex.edu")

    with open("../sample-data/with_errors.csv", "rb") as f:
        file_bytes = f.read()

    # 1. Inspect
    inspect_res = client.post(
        "/api/import/inspect",
        files={"file": ("with_errors.csv", io.BytesIO(file_bytes), "text/csv")},
        headers=headers
    )
    assert inspect_res.status_code == 200
    inspect_data = inspect_res.json()
    assert inspect_data["total_rows"] >= 8

    # 2. Validate
    mapping = {
        "roll_number": "roll_number",
        "full_name": "full_name",
        "apaar_id": "apaar_id",
        "course_code": "course_code",
        "admission_year": "admission_year",
        "date_of_birth": "date_of_birth",
        "gender": "gender",
        "email": "email",
        "phone": "phone"
    }
    import json
    val_res = client.post(
        "/api/import/validate",
        files={"file": ("with_errors.csv", io.BytesIO(file_bytes), "text/csv")},
        data={"mapping_json": json.dumps(mapping)},
        headers=headers
    )
    assert val_res.status_code == 200
    val_data = val_res.json()
    summary = val_data["summary"]
    
    assert summary["invalid_count"] > 0
    assert summary["duplicate_count"] > 0

    error_msgs = [e["error_message"] for e in summary["errors"]]
    # Verify specific plain-English errors are reported
    assert any("Roll number is required" in m for m in error_msgs)
    assert any("8 digits" in m for m in error_msgs)
    assert any("non-numeric" in m for m in error_msgs)
    assert any("already belongs to student" in m for m in error_msgs)
    assert any("does not exist in institution catalog" in m for m in error_msgs)

def test_valid_csv_import_and_idempotency():
    headers = get_auth_headers("asha.admin@apex.edu")

    # Clean up prior test job and students for valid.csv
    db = SessionLocal()
    try:
        db.query(ImportJob).filter(ImportJob.filename == "valid.csv").delete()
        db.query(Student).filter(Student.roll_number.in_([
            "2026-CSE-501", "2026-CSE-502", "2026-CSE-503", "2026-CSE-504", "2026-CSE-505"
        ])).delete()
        db.commit()
    finally:
        db.close()

    with open("../sample-data/valid.csv", "rb") as f:
        file_bytes = f.read()

    import json
    mapping = {
        "roll_number": "roll_number",
        "full_name": "full_name",
        "apaar_id": "apaar_id",
        "course_code": "course_code",
        "admission_year": "admission_year",
        "date_of_birth": "date_of_birth",
        "gender": "gender",
        "email": "email",
        "phone": "phone"
    }

    val_res = client.post(
        "/api/import/validate",
        files={"file": ("valid.csv", io.BytesIO(file_bytes), "text/csv")},
        data={"mapping_json": json.dumps(mapping)},
        headers=headers
    )
    assert val_res.status_code == 200
    staged = val_res.json()

    # Commit import
    commit_payload = {
        "filename": "valid.csv",
        "file_hash": staged["file_hash"],
        "staged_rows": staged["staged_rows"],
        "options": {"skip_duplicates": True}
    }

    res_commit = client.post("/api/import/commit", json=commit_payload, headers=headers)
    assert res_commit.status_code == 200
    job_data = res_commit.json()
    assert job_data["created_rows"] > 0

    # Idempotency: Re-submitting the same file without force_reimport raises safe error
    res_retry = client.post("/api/import/commit", json=commit_payload, headers=headers)
    assert res_retry.status_code == 400
    assert "already imported" in res_retry.json()["detail"]
