from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.institution import Institution
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/institution", tags=["Institution Settings"])

class InstitutionSettingsUpdate(BaseModel):
    support_phone: Optional[str] = None
    support_email: Optional[str] = None
    support_hours: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None

@router.get("/settings")
def get_institution_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inst = None
    if current_user.institution_id:
        inst = db.query(Institution).filter(Institution.id == current_user.institution_id).first()
    if not inst:
        return {
            "id": 0,
            "name": "AICTE Regulatory Authority",
            "code": "AICTE-HQ",
            "aicte_id": "REG-AICTE-01",
            "state": "National",
            "district": "New Delhi",
            "support_phone": "1800-111-222",
            "support_email": "regulator-support@aicte.gov.in",
            "support_hours": "Mon-Fri 09:00 - 17:30 IST",
            "is_configured": True
        }

    return {
        "id": inst.id,
        "name": inst.name,
        "code": inst.code,
        "aicte_id": inst.aicte_id,
        "state": inst.state,
        "district": inst.district,
        "support_phone": inst.support_phone,
        "support_email": inst.support_email,
        "support_hours": inst.support_hours,
        "is_configured": bool(inst.support_phone or inst.support_email)
    }

@router.put("/settings")
def update_institution_settings(
    payload: InstitutionSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    inst = db.query(Institution).filter(Institution.id == current_user.institution_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    if payload.support_phone is not None:
        inst.support_phone = payload.support_phone.strip() if payload.support_phone else None
    if payload.support_email is not None:
        inst.support_email = payload.support_email.strip() if payload.support_email else None
    if payload.support_hours is not None:
        inst.support_hours = payload.support_hours.strip() if payload.support_hours else None
    if payload.state is not None:
        inst.state = payload.state.strip() if payload.state else None
    if payload.district is not None:
        inst.district = payload.district.strip() if payload.district else None

    db.commit()
    db.refresh(inst)

    record_audit_log(
        db=db,
        action="INSTITUTION_SETTINGS_UPDATED",
        target_type="INSTITUTION",
        target_id=str(inst.id),
        outcome="SUCCESS",
        details=f"Updated support contact details for {inst.code}",
        user=current_user
    )

    return {
        "message": "Institution settings updated successfully",
        "settings": {
            "id": inst.id,
            "name": inst.name,
            "code": inst.code,
            "aicte_id": inst.aicte_id,
            "state": inst.state,
            "district": inst.district,
            "support_phone": inst.support_phone,
            "support_email": inst.support_email,
            "support_hours": inst.support_hours,
            "is_configured": bool(inst.support_phone or inst.support_email)
        }
    }

