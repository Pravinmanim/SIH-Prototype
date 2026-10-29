import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.database import SessionLocal
from app.models.student import Student
from app.models.institution import Institution
from app.models.user import User
from app.core.dependencies import verify_institution_access, require_admin
from fastapi import HTTPException

client = TestClient(app)

def test_health_and_docs():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    
    docs_res = client.get("/docs")
    assert docs_res.status_code == 200

def test_login_success_admin():
    response = client.post("/api/auth/login", json={
        "email": "asha.admin@apex.edu",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "asha.admin@apex.edu"
    assert data["user"]["role"] == "institution_admin"
    assert "access_token" in response.cookies

def test_login_success_officer():
    response = client.post("/api/auth/login", json={
        "email": "ravi.officer@apex.edu",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "verification_officer"

def test_login_invalid_password_safe_error():
    response = client.post("/api/auth/login", json={
        "email": "asha.admin@apex.edu",
        "password": "wrong_password_999"
    })
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]

def test_auth_me_authenticated_and_unauthenticated():
    # Fresh client without cookies
    fresh_client = TestClient(app)
    unauth_res = fresh_client.get("/api/auth/me")
    assert unauth_res.status_code == 401

    # Login and call me
    login_res = fresh_client.post("/api/auth/login", json={
        "email": "asha.admin@apex.edu",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    
    auth_res = fresh_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert auth_res.status_code == 200
    assert auth_res.json()["email"] == "asha.admin@apex.edu"

def test_demo_accounts_disclaimer():
    response = client.get("/api/auth/demo-accounts")
    assert response.status_code == 200
    data = response.json()
    assert "disclaimer" in data
    assert "Demo login — not production-secure" in data["disclaimer"]
    assert len(data["accounts"]) >= 6

def test_institution_isolation_enforcement():
    db = SessionLocal()
    try:
        user_ait = db.query(User).filter(User.email == "asha.admin@apex.edu").first()
        user_bnce = db.query(User).filter(User.email == "suresh.admin@bnce.edu").first()
        
        # Institution 1 user accessing Institution 1 data -> allowed
        verify_institution_access(user_ait.institution_id, user_ait)
        
        # Institution 1 user accessing Institution 2 data -> 403 Forbidden
        with pytest.raises(HTTPException) as exc_info:
            verify_institution_access(user_bnce.institution_id, user_ait)
        assert exc_info.value.status_code == 403
        assert "Cross-institution access violation" in exc_info.value.detail
    finally:
        db.close()

def test_role_enforcement():
    db = SessionLocal()
    try:
        officer = db.query(User).filter(User.role == "verification_officer").first()
        with pytest.raises(HTTPException) as exc_info:
            require_admin(officer)
        assert exc_info.value.status_code == 403
        assert "Only Institution Admins" in exc_info.value.detail
    finally:
        db.close()

def test_seed_data_integrity():
    db = SessionLocal()
    try:
        students = db.query(Student).all()
        assert len(students) >= 100, f"Expected 100+ students, got {len(students)}"
        
        institutions = db.query(Institution).all()
        assert len(institutions) == 3
        
        # Check string APAAR ID preserves leading zeros
        leading_zero_records = [s for s in students if s.apaar_id and s.apaar_id.startswith("0")]
        assert len(leading_zero_records) > 0, "Leading zero APAAR IDs must be stored as string without loss"
        assert len(leading_zero_records[0].apaar_id) == 12

        # Check cross-institution roll number does not collide
        roll_ait = db.query(Student).filter(Student.roll_number == "2026-ECE-099", Student.institution_id == 1).first()
        roll_bnce = db.query(Student).filter(Student.roll_number == "2026-ECE-099", Student.institution_id == 2).first()
        assert roll_ait is not None
        assert roll_bnce is not None
        assert roll_ait.institution_id != roll_bnce.institution_id
    finally:
        db.close()
