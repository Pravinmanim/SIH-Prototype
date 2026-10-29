from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.audit import AuditLog

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("")
def list_audit_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(AuditLog).filter(
        AuditLog.institution_id == current_user.institution_id
    )

    if action and action != "ALL":
        query = query.filter(AuditLog.action == action)

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    items = []
    for log in logs:
        items.append({
            "id": log.id,
            "actor_name": log.actor_name,
            "actor_role": log.actor_role,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "outcome": log.outcome,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat()
        })

    return items

