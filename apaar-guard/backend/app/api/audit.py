from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.audit import AuditLog

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("")
def list_audit_logs(
    action: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    limit: Optional[int] = Query(None, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    effective_limit = limit if limit is not None else page_size
    offset = (page - 1) * effective_limit

    query = db.query(AuditLog).filter(
        AuditLog.institution_id == current_user.institution_id
    )

    if action and action != "ALL":
        query = query.filter(AuditLog.action == action)

    if outcome and outcome != "ALL":
        query = query.filter(AuditLog.outcome == outcome)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            (AuditLog.actor_name.ilike(search_pattern)) |
            (AuditLog.action.ilike(search_pattern)) |
            (AuditLog.target_type.ilike(search_pattern)) |
            (AuditLog.target_id.ilike(search_pattern)) |
            (AuditLog.details.ilike(search_pattern))
        )

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(effective_limit).all()

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

    total_pages = max(1, (total + effective_limit - 1) // effective_limit)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": effective_limit,
        "total_pages": total_pages
    }

@router.get("/{log_id}")
def get_audit_log_detail(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    log = db.query(AuditLog).filter(
        AuditLog.id == log_id,
        AuditLog.institution_id == current_user.institution_id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Audit log record not found")

    return {
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
    }
