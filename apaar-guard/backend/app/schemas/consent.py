from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime

VALID_CONSENT_ACTIONS = {"granted", "withdrawn"}

class ConsentStatusUpdate(BaseModel):
    status: str
    notice_version: str = "v1.0"
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        s = v.strip().lower()
        if s not in VALID_CONSENT_ACTIONS:
            raise ValueError(f"Invalid consent status '{v}'. Allowed values are: 'granted', 'withdrawn'.")
        return s

    @field_validator("notice_version")
    @classmethod
    def validate_notice_version(cls, v: str) -> str:
        s = v.strip()
        if not s:
            return "v1.0"
        if len(s) > 50:
            raise ValueError("Notice version exceeds maximum length of 50 characters.")
        return s

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        if len(s) > 500:
            raise ValueError("Notes exceed maximum allowed length of 500 characters.")
        return s if s else None


class ConsentEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    previous_status: str
    new_status: str
    action: str
    consent_type: str
    notice_version: str
    notes: Optional[str] = None
    actor_name: Optional[str] = None
    actor_role: Optional[str] = None
    timestamp: datetime


class StudentConsentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    student_id: int
    institution_id: int
    status: str  # 'not_recorded', 'granted', 'withdrawn'
    consent_type: str = "staff_recorded"
    notice_version: str = "v1.0"
    notes: Optional[str] = None
    recorded_by_name: Optional[str] = None
    recorded_by_role: Optional[str] = None
    recorded_at: Optional[datetime] = None
    history: List[ConsentEventResponse] = []
    disclaimer: str = "Staff-recorded workflow record only. Does not independently prove legal compliance."


class ConsentSummaryResponse(BaseModel):
    institution_id: int
    total_students: int
    granted: int
    withdrawn: int
    not_recorded: int

