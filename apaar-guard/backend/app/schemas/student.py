import re
import unicodedata
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime, date, timezone

def mask_apaar_id(apaar: Optional[str]) -> str:
    """Safely masks APAAR ID so full ID is never shown in list views: XXXX-XXXX-1234"""
    if not apaar:
        return "Not Assigned"
    clean = str(apaar).strip()
    if len(clean) >= 4:
        return f"XXXX-XXXX-{clean[-4:]}"
    return "XXXX-XXXX-XXXX"

def validate_full_name(v: Optional[str], required: bool = True) -> Optional[str]:
    if v is None:
        if required:
            raise ValueError("Student name is required.")
        return None
    s = str(v).strip()
    if not s:
        if required:
            raise ValueError("Student name is required.")
        return None
    if len(s) < 2 or len(s) > 255:
        raise ValueError("Enter a name within the allowed length.")
    
    # Check valid characters: Unicode letters, combining marks, spaces, hyphens, apostrophes, periods, parentheses
    letters_count = 0
    for ch in s:
        if ch.isspace() or ch in "-'.()":
            continue
        cat = unicodedata.category(ch)
        if cat.startswith("L") or cat.startswith("M"):
            letters_count += 1
        else:
            raise ValueError("Enter a valid student name.")
    
    if letters_count < 2:
        raise ValueError("Enter a name within the allowed length.")
    
    # Preserve valid capitalization while trimming whitespace
    return s

def validate_indian_phone(v: Optional[str], required: bool = False) -> Optional[str]:
    if v is None:
        if required:
            raise ValueError("Mobile number is required.")
        return None
    s = str(v).strip()
    if not s:
        if required:
            raise ValueError("Mobile number is required.")
        return None
    
    # Strip any common prefix if full +91 was entered, or check digits
    digits_only = re.sub(r"\D", "", s)
    if s.startswith("+91") and len(digits_only) == 12 and digits_only.startswith("91"):
        cleaned = digits_only[2:]
    elif not s.isdigit() or len(s) != 10:
        raise ValueError("Mobile number must contain exactly 10 digits.")
    else:
        cleaned = s

    if len(cleaned) != 10 or not cleaned.isdigit():
        raise ValueError("Mobile number must contain exactly 10 digits.")
    
    if cleaned[0] not in ("6", "7", "8", "9"):
        raise ValueError("Enter a valid Indian mobile number.")
    
    return cleaned

def validate_apaar_format(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    if not s.isdigit():
        raise ValueError("Enter digits only.")
    if len(s) != 12:
        raise ValueError("APAAR ID must contain exactly 12 digits.")
    return s

def validate_dob_calendar(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        parsed_date = datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Enter a valid calendar date (YYYY-MM-DD).")
    
    today = datetime.now(timezone.utc).date()
    if parsed_date > today:
        raise ValueError("Date of birth cannot be in the future.")
    if parsed_date.year < 1900:
        raise ValueError("Enter a valid calendar date.")
    return s

def validate_email_format(v: Optional[str], required: bool = False) -> Optional[str]:
    if v is None:
        if required:
            raise ValueError("Email address is required.")
        return None
    s = str(v).strip()
    if not s:
        if required:
            raise ValueError("Email address is required.")
        return None
    # RFC 5322 simplified pattern
    if not re.fullmatch(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", s):
        raise ValueError("Enter a valid email address.")
    return s.lower()

def validate_roll_number(v: Optional[str], required: bool = True) -> Optional[str]:
    if v is None:
        if required:
            raise ValueError("Roll number is required.")
        return None
    s = str(v).strip()
    if not s:
        if required:
            raise ValueError("Roll number is required.")
        return None
    if len(s) > 100:
        raise ValueError("Roll number cannot exceed 100 characters.")
    return s

VALID_ADMISSION_CATEGORIES = {
    "General": "General",
    "NRI": "NRI",
    "OCI": "OCI",
    "Foreign National": "Foreign National",
    "FN": "Foreign National",
    "Other": "Other"
}

def validate_admission_category(v: Optional[str]) -> str:
    """
    Validates admission category against supported categories:
    General, NRI, OCI, Foreign National (FN), Other.
    Defaults to 'General' when empty.
    """
    if v is None:
        return "General"
    s = str(v).strip()
    if not s:
        return "General"
    for valid_k, canonical in VALID_ADMISSION_CATEGORIES.items():
        if s.lower() == valid_k.lower():
            return canonical
    raise ValueError(f"Admission category '{v}' is invalid. Supported: General, NRI, OCI, Foreign National, Other.")

class CourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    department: Optional[str] = None
    duration_years: int

class StudentCreate(BaseModel):
    roll_number: str
    full_name: str
    apaar_id: Optional[str] = None
    course_id: int = Field(..., ge=1, description="Select a valid course.")
    admission_year: int = Field(..., ge=2000, le=2030, description="Select a valid academic year.")
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    admission_category: Optional[str] = "General"
    is_supernumerary: Optional[bool] = False

    @field_validator("admission_category")
    @classmethod
    def check_admission_category(cls, v):
        return validate_admission_category(v)

    @field_validator("full_name")
    @classmethod
    def check_full_name(cls, v):
        return validate_full_name(v, required=True)

    @field_validator("roll_number")
    @classmethod
    def check_roll_number(cls, v):
        return validate_roll_number(v, required=True)

    @field_validator("apaar_id")
    @classmethod
    def check_apaar(cls, v):
        return validate_apaar_format(v)

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v):
        return validate_indian_phone(v, required=False)

    @field_validator("date_of_birth")
    @classmethod
    def check_dob(cls, v):
        return validate_dob_calendar(v)

    @field_validator("email")
    @classmethod
    def check_email(cls, v):
        return validate_email_format(v, required=False)

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
    admission_category: Optional[str] = None
    is_supernumerary: Optional[bool] = None
    version: Optional[int] = None  # Required for optimistic concurrency check

    @field_validator("admission_category")
    @classmethod
    def check_admission_category(cls, v):
        if v is not None:
            return validate_admission_category(v)
        return v

    @field_validator("full_name")
    @classmethod
    def check_full_name(cls, v):
        if v is not None:
            return validate_full_name(v, required=True)
        return v

    @field_validator("roll_number")
    @classmethod
    def check_roll_number(cls, v):
        if v is not None:
            return validate_roll_number(v, required=True)
        return v

    @field_validator("apaar_id")
    @classmethod
    def check_apaar(cls, v):
        return validate_apaar_format(v)

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v):
        return validate_indian_phone(v, required=False)

    @field_validator("date_of_birth")
    @classmethod
    def check_dob(cls, v):
        return validate_dob_calendar(v)

    @field_validator("email")
    @classmethod
    def check_email(cls, v):
        return validate_email_format(v, required=False)

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
    admission_category: str = "General"
    is_supernumerary: bool = False
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
    institution_name: Optional[str] = None
    institution_code: Optional[str] = None
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
    admission_category: str = "General"
    is_supernumerary: bool = False
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
