from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None
    role: UserRole = UserRole.CLIENT
    # vendor-only fields, optional
    business_name: str | None = None
    category: str | None = None
    service_areas: str | None = None


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str | None
    role: UserRole
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
