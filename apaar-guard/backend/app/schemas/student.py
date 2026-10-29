from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime

def mask_apaar_id(apaar: Optional[str]) -> str:
    """Safely masks APAAR ID so full ID is never shown in list views: XXXX-XXXX-1234"""
    if not apaar:
        return "Not Assigned"
    clean = str(apaar).strip()
    if len(clean) >= 4:
        return f"XXXX-XXXX-{clean[-4:]}"
    return "XXXX-XXXX-XXXX"

class CourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    department: Optional[str] = None
    duration_years: int

class StudentCreate(BaseModel):
    roll_number: str = Field(..., min_length=1, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=255)
    apaar_id: Optional[str] = None
    course_id: int
    admission_year: int = Field(..., ge=2000, le=2030)
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("apaar_id")
    @classmethod
    def clean_apaar(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

class StudentUpdate(BaseModel):
    roll_number: Optional[str] = None
    full_name: Optional[str] = None
    apaar_id: Optional[str] = None
    course_id: Optional[int] = None
    admission_year: Optional[int] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    version: Optional[int] = None  # Required for optimistic concurrency check

class StudentListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    institution_id: int
    course_id: Optional[int]
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    masked_apaar_id: str
    has_apaar: bool
    roll_number: str
    full_name: str
    date_of_birth: Optional[str]
    gender: Optional[str]
    admission_year: int
    email: Optional[str]
    phone: Optional[str]
    status: str
    version: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime

class PaginatedStudentResponse(BaseModel):
    items: List[StudentListItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class ValidationResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rule_id: str
    rule_name: str
    severity: str
    status: str
    message: str
    affected_field: Optional[str]
    suggested_action: Optional[str]
    created_at: datetime

class StudentDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    institution_id: int
    course_id: Optional[int]
    course: Optional[CourseResponse] = None
    masked_apaar_id: str
    apaar_length: int
    has_apaar: bool
    roll_number: str
    full_name: str
    date_of_birth: Optional[str]
    gender: Optional[str]
    admission_year: int
    email: Optional[str]
    phone: Optional[str]
    status: str
    version: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    validation_results: List[ValidationResultResponse] = []
    official_verification_notice: str = "Official verification unavailable. Local checks are not official verification."

class StudentRevealResponse(BaseModel):
    student_id: int
    roll_number: str
    full_name: str
    apaar_id: Optional[str]
    warning: str = "Confidential APAAR ID accessed. Audit event logged."
