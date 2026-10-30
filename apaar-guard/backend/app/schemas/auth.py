import re
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime

class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Email address is required.")
        s = str(v).strip().lower()
        if not re.fullmatch(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", s):
            raise ValueError("Enter a valid email address.")
        return s

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Password is required.")
        return v

class InstitutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    aicte_id: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    support_phone: Optional[str] = None
    support_email: Optional[str] = None
    support_hours: Optional[str] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    institution_id: Optional[int] = None
    institution: Optional[InstitutionResponse] = None
    is_active: bool

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
