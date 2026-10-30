from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.institution import Institution
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(
    req: LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        record_audit_log(
            db=db,
            action="LOGIN_FAILED",
            target_type="USER",
            outcome="FAILURE",
            details={"email": req.email},
            ip_address=request.client.host if request.client else None
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to sign in with those credentials."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your institution administrator."
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role, "inst": user.institution_id})
    
    # Set HttpOnly cookie for secure auth (supports cross-domain in prod with samesite none)
    is_https = (
        request.url.scheme == "https" 
        or request.headers.get("x-forwarded-proto") == "https"
        or settings.APP_ENV != "development"
    )
    samesite_policy = "none" if is_https else "lax"
    secure_flag = True if is_https else False

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        samesite=samesite_policy,
        secure=secure_flag
    )

    record_audit_log(
        db=db,
        action="LOGIN_SUCCESS",
        target_type="USER",
        target_id=str(user.id),
        outcome="SUCCESS",
        user=user,
        ip_address=request.client.host if request.client else None
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    is_https = (
        request.url.scheme == "https" 
        or request.headers.get("x-forwarded-proto") == "https"
        or settings.APP_ENV != "development"
    )
    samesite_policy = "none" if is_https else "lax"
    secure_flag = True if is_https else False

    response.delete_cookie(
        key="access_token",
        path="/",
        samesite=samesite_policy,
        secure=secure_flag
    )
    record_audit_log(
        db=db,
        action="LOGOUT",
        target_type="USER",
        target_id=str(current_user.id),
        outcome="SUCCESS",
        user=current_user,
        ip_address=request.client.host if request.client else None
    )
    return {"message": "Successfully logged out."}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/demo-accounts")
def get_demo_accounts(db: Session = Depends(get_db)):
    """Returns seeded demo accounts for rapid testing with safety disclaimer. Disabled outside development."""
    if settings.APP_ENV != "development":
        return {
            "disclaimer": "Demo account discovery is disabled outside the development environment.",
            "accounts": []
        }

    users = db.query(User).all()
    demo_accounts = []
    for u in users:
        demo_accounts.append({
            "id": u.id,
            "email": u.email,
            "name": u.full_name,
            "role": u.role,
            "role_label": (
                "AICTE Regulator (National Oversight)" if u.role == "regulator" else
                "Institution Admin" if u.role == "institution_admin" else
                "Verification Officer"
            ),
            "institution_id": u.institution_id,
            "institution_name": "AICTE National Headquarters" if u.role == "regulator" else (u.institution.name if u.institution else f"Institution {u.institution_id}"),
            "institution_code": "AICTE-HQ" if u.role == "regulator" else (u.institution.code if u.institution else ""),
        })
    return {
        "disclaimer": "Demo login — not production-secure",
        "accounts": demo_accounts
    }

