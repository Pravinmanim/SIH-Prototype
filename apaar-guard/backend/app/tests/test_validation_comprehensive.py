import io
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.course import Course
from app.models.review import ReviewCase
from app.schemas.student import (
    validate_indian_phone,
    validate_full_name,
    validate_apaar_format,
    validate_dob_calendar,
    validate_email_format,
    validate_roll_number
)

client = TestClient(app)

def get_auth_headers(email: str, password: str = "password123"):
    fresh_client = TestClient(app)
    res = fresh_client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# ==============================================================================
# 1. PHONE NUMBER VALIDATION TESTS
# ==============================================================================

def test_phone_validation_valid_numbers():
    assert validate_indian_phone("9876543210") == "9876543210"
    assert validate_indian_phone("8123456789") == "8123456789"
    assert validate_indian_phone("7000000000") == "7000000000"
    assert validate_indian_phone("6999999999") == "6999999999"
    # Optional field allows None and empty string
    assert validate_indian_phone(None, required=False) is None
    assert validate_indian_phone("", required=False) is None

def test_phone_validation_invalid_starting_digits():
    for invalid_start in ["0987654321", "1234567890", "2345678901", "3456789012", "4567890123", "5678901234"]:
        with pytest.raises(ValueError) as exc:
            validate_indian_phone(invalid_start)
        assert "Enter a valid Indian mobile number." in str(exc.value)

def test_phone_validation_invalid_length_and_characters():
    # Too short
    with pytest.raises(ValueError) as exc:
        validate_indian_phone("98765")
    assert "Mobile number must contain exactly 10 digits." in str(exc.value)

    # Too long
    with pytest.raises(ValueError) as exc:
        validate_indian_phone("987654321099")
    assert "Mobile number must contain exactly 10 digits." in str(exc.value)

    # Non-digits
    with pytest.raises(ValueError) as exc:
        validate_indian_phone("98765abcde")
    assert "Mobile number must contain exactly 10 digits." in str(exc.value)

    with pytest.raises(ValueError) as exc:
        validate_indian_phone("98765-4321")
    assert "Mobile number must contain exactly 10 digits." in str(exc.value)

# ==============================================================================
# 2. STUDENT NAME VALIDATION TESTS
# ==============================================================================

def test_student_name_validation_valid():
    assert validate_full_name("Asha Sharma") == "Asha Sharma"
    assert validate_full_name("O'Connor") == "O'Connor"
    assert validate_full_name("Jean-Luc") == "Jean-Luc"
    assert validate_full_name("Dr. A. P. J. Abdul Kalam") == "Dr. A. P. J. Abdul Kalam"
    # Unicode Indian names (Tamil and Devanagari)
    assert validate_full_name("அரவிந்த்") == "அரவிந்த்"
    assert validate_full_name("राहुल शर्मा") == "राहुल शर्मा"

def test_student_name_validation_rejections():
    # Empty and whitespace
    with pytest.raises(ValueError) as exc:
        validate_full_name("")
    assert "Student name is required." in str(exc.value)

    with pytest.raises(ValueError) as exc:
        validate_full_name("    ")
    assert "Student name is required." in str(exc.value)

    # Too short
    with pytest.raises(ValueError) as exc:
        validate_full_name("A")
    assert "Enter a name within the allowed length." in str(exc.value)

    # Digits and symbols
    with pytest.raises(ValueError) as exc:
        validate_full_name("Ramesh123")
    assert "Enter a valid student name." in str(exc.value)

    with pytest.raises(ValueError) as exc:
        validate_full_name("Asha@Sharma")
    assert "Enter a valid student name." in str(exc.value)

# ==============================================================================
# 3. APAAR ID VALIDATION TESTS
# ==============================================================================

def test_apaar_validation_format_and_leading_zeros():
    # Exactly 12 digits, leading zeros preserved
    assert validate_apaar_format("012345678901") == "012345678901"
    assert validate_apaar_format("999988887777") == "999988887777"
    assert validate_apaar_format(None) is None
    assert validate_apaar_format("") is None

def test_apaar_validation_errors():
    with pytest.raises(ValueError) as exc:
        validate_apaar_format("12345")
    assert "APAAR ID must contain exactly 12 digits." in str(exc.value)

    with pytest.raises(ValueError) as exc:
        validate_apaar_format("1234567890123")
    assert "APAAR ID must contain exactly 12 digits." in str(exc.value)

    with pytest.raises(ValueError) as exc:
        validate_apaar_format("12345678901a")
    assert "Enter digits only." in str(exc.value)

# ==============================================================================
# 4. DATE OF BIRTH VALIDATION TESTS
# ==============================================================================

def test_dob_validation_calendar_and_future():
    # Valid calendar date
    assert validate_dob_calendar("2002-05-15") == "2002-05-15"
    # Leap year February 29
    assert validate_dob_calendar("2004-02-29") == "2004-02-29"

    # Future date rejected
    with pytest.raises(ValueError) as exc:
        validate_dob_calendar("2099-01-01")
    assert "Date of birth cannot be in the future." in str(exc.value)

    # Invalid leap year rejected
    with pytest.raises(ValueError) as exc:
        validate_dob_calendar("2023-02-29")
    assert "Enter a valid calendar date (YYYY-MM-DD)." in str(exc.value)

    # Invalid day in month rejected
    with pytest.raises(ValueError) as exc:
        validate_dob_calendar("2024-04-31")
    assert "Enter a valid calendar date (YYYY-MM-DD)." in str(exc.value)

# ==============================================================================
# 5. INTAKE CAPACITY VALIDATION TESTS
# ==============================================================================

def test_intake_capacity_api_validation():
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # Positive integer valid
    res = client.post("/api/intake", json={
        "course_id": 1,
        "academic_year": 2026,
        "approved_intake": 120,
        "notes": "Valid update"
    }, headers=admin_headers)
    assert res.status_code == 200

    # Zero or negative rejected with specific message
    res_zero = client.post("/api/intake", json={
        "course_id": 1,
        "academic_year": 2026,
        "approved_intake": 0
    }, headers=admin_headers)
    assert res_zero.status_code == 422
    assert "Enter a valid whole-number intake capacity." in str(res_zero.json())

    res_neg = client.post("/api/intake", json={
        "course_id": 1,
        "academic_year": 2026,
        "approved_intake": -10
    }, headers=admin_headers)
    assert res_neg.status_code == 422
    assert "Enter a valid whole-number intake capacity." in str(res_neg.json())

    # Decimal rejected
    res_dec = client.post("/api/intake", json={
        "course_id": 1,
        "academic_year": 2026,
        "approved_intake": 55.5
    }, headers=admin_headers)
    assert res_dec.status_code == 422

# ==============================================================================
# 6. LOGIN & CREDENTIAL VALIDATION TESTS
# ==============================================================================

def test_login_field_validation_and_generic_error():
    # Empty fields
    res_empty = client.post("/api/auth/login", json={"email": "", "password": ""})
    assert res_empty.status_code == 422
    assert "Email address is required." in str(res_empty.json())

    # Invalid email format
    res_bad_email = client.post("/api/auth/login", json={"email": "not-an-email", "password": "pass"})
    assert res_bad_email.status_code == 422
    assert "Enter a valid email address." in str(res_bad_email.json())

    # Bad credentials returns safe generic message
    res_bad_creds = client.post("/api/auth/login", json={
        "email": "asha.admin@apex.edu",
        "password": "definitely_wrong_password"
    })
    assert res_bad_creds.status_code == 401
    assert res_bad_creds.json()["detail"] == "Unable to sign in with those credentials."

# ==============================================================================
# 7. DUPLICATE APAAR COLLISION PREVENTION TEST
# ==============================================================================

def test_exact_duplicate_apaar_rejection():
    admin_headers = get_auth_headers("asha.admin@apex.edu")
    test_apaar = f"99{uuid.uuid4().int % 10000000000:010d}"
    roll1 = f"2026-VAL-{uuid.uuid4().hex[:6]}"
    roll2 = f"2026-VAL-{uuid.uuid4().hex[:6]}"

    # Create first student with test_apaar
    res1 = client.post("/api/students", json={
        "roll_number": roll1,
        "full_name": "Unique Student One",
        "apaar_id": test_apaar,
        "course_id": 1,
        "admission_year": 2026,
        "phone": "9876543210"
    }, headers=admin_headers)
    assert res1.status_code == 201

    # Attempt to create second student with identical APAAR
    res2 = client.post("/api/students", json={
        "roll_number": roll2,
        "full_name": "Colliding Student Two",
        "apaar_id": test_apaar,
        "course_id": 1,
        "admission_year": 2026
    }, headers=admin_headers)
    assert res2.status_code == 400
    assert "This APAAR ID matches an existing record. Review the duplicate alert." in res2.json()["detail"]

# ==============================================================================
# 8. REVIEW STATUS TRANSITIONS & MANDATORY JUSTIFICATION
# ==============================================================================

def test_review_transitions_and_mandatory_reason():
    officer_headers = get_auth_headers("ravi.officer@apex.edu")

    # Fetch a pending review case in institution 1
    cases_res = client.get("/api/review/cases?status=Pending Review", headers=officer_headers)
    assert cases_res.status_code == 200
    pending_cases = cases_res.json()
    if not pending_cases:
        # Reopen an existing case to bring it to Pending Review
        all_cases = client.get("/api/review/cases", headers=officer_headers).json()
        target_case_id = all_cases[0]["id"]
        client.post(f"/api/review/cases/{target_case_id}/action", json={
            "action": "reopen",
            "note_text": "Resetting case to Pending Review for test"
        }, headers=officer_headers)
    else:
        target_case_id = pending_cases[0]["id"]

    # Trying to resolve without reason fails with 400
    res_no_reason = client.post(f"/api/review/cases/{target_case_id}/action", json={
        "action": "resolve",
        "note_text": ""
    }, headers=officer_headers)
    assert res_no_reason.status_code == 400
    assert "written justification reason is mandatory" in res_no_reason.json()["detail"].lower()

    # Reopening a Pending Review case (illegal transition) returns 409 Conflict
    res_illegal = client.post(f"/api/review/cases/{target_case_id}/action", json={
        "action": "reopen",
        "note_text": "Illegal reopen on pending case"
    }, headers=officer_headers)
    assert res_illegal.status_code == 409
    assert "Illegal transition" in res_illegal.json()["detail"]

# ==============================================================================
# 9. BULK IMPORT ROW-LEVEL VALIDATION
# ==============================================================================

def test_bulk_import_row_level_validation():
    admin_headers = get_auth_headers("asha.admin@apex.edu")

    # CSV with invalid phone and invalid DOB
    csv_content = (
        "roll_number,full_name,course_code,admission_year,phone,date_of_birth\n"
        "2026-IMP-001,Rajesh Kumar,CSE,2026,5876543210,2003-01-15\n"  # Invalid phone (starts with 5)
        "2026-IMP-002,Sunita Patel,CSE,2026,9876543210,2099-01-01\n"   # Invalid DOB (future)
    )

    form_data = {
        "mapping_json": '{"roll_number":"roll_number","full_name":"full_name","course_code":"course_code","admission_year":"admission_year","phone":"phone","date_of_birth":"date_of_birth"}'
    }
    files = {
        "file": ("test_validate.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")
    }

    res = client.post("/api/import/validate", data=form_data, files=files, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["invalid_count"] >= 2
    error_texts = [e["error_message"] for e in data["summary"]["errors"]]
    assert any("Enter a valid Indian mobile number." in msg for msg in error_texts)
    assert any("Date of birth cannot be in the future." in msg for msg in error_texts)
