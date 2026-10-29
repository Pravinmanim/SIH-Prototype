import json
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.models.user import User

def record_audit_log(
    db: Session,
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    outcome: str = "SUCCESS",
    details: Optional[Any] = None,
    user: Optional[User] = None,
    institution_id: Optional[int] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    actor_name = user.full_name if user else "SYSTEM"
    actor_role = user.role if user else "SYSTEM"
    inst_id = institution_id or (user.institution_id if user else None)
    
    details_str = None
    if details is not None:
        if isinstance(details, (dict, list)):
            details_str = json.dumps(details)
        else:
            details_str = str(details)

    audit_entry = AuditLog(
        institution_id=inst_id,
        user_id=user.id if user else None,
        actor_name=actor_name,
        actor_role=actor_role,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        outcome=outcome,
        details=details_str,
        ip_address=ip_address
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry

