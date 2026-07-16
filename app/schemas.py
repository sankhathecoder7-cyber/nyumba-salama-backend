import uuid
import json
from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator


UNIVERSITIES = ["UDSM", "ARU", "MUHAS", "IFM", "UDOM", "SUZA", "BOTH"]
PROPERTY_TYPES = ["SINGLE_ROOM", "SHARED_ROOM", "STUDIO", "APARTMENT", "FULL_HOUSE"]
USER_ROLES = ["STUDENT", "PROPERTY_OWNER", "ADMIN"]
VIDEO_STATUSES = ["PENDING", "VERIFIED", "REJECTED"]


# ── Auth ────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    phone: str
    role: str = "STUDENT"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in USER_ROLES:
            raise ValueError(f"role must be one of: {', '.join(USER_ROLES)}")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=6)


class AuthResponse(BaseModel):
    access_token: str
    expires_in: str
    user: dict


# ── User ────────────────────────────────────────────────────
class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    role: str
    avatar: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Property ────────────────────────────────────────────────
class CreatePropertyRequest(BaseModel):
    title: str
    type: str
    price: float
    location: str
    area: Optional[str] = None
    university: str = "BOTH"
    description: Optional[str] = None
    amenities: Optional[list[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    images: Optional[list[str]] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        if v not in PROPERTY_TYPES:
            raise ValueError(f"type must be one of: {', '.join(PROPERTY_TYPES)}")
        return v


class UpdatePropertyRequest(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    price: Optional[float] = None
    location: Optional[str] = None
    area: Optional[str] = None
    university: Optional[str] = None
    description: Optional[str] = None
    amenities: Optional[list[str]] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    images: Optional[list[str]] = None
    video_url: Optional[str] = None


class SearchPropertyQuery(BaseModel):
    q: Optional[str] = None
    type: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    university: Optional[str] = None
    status: str = "AVAILABLE"
    page: int = 1
    limit: int = 20


class PropertyResponse(BaseModel):
    id: str
    title: str
    type: str
    price: float
    location: str
    area: Optional[str] = None
    university: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    amenities: Optional[Any] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    images: Optional[Any] = None
    video_url: Optional[str] = None
    agent_id: Optional[str] = None
    agent: Optional[UserResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @field_validator("amenities", "images", mode="before")
    @classmethod
    def parse_json(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return v
        return v


# ── Video ───────────────────────────────────────────────────
class UploadVideoRequest(BaseModel):
    title: str
    description: Optional[str] = None
    property_id: Optional[str] = None
    price: Optional[float] = None
    location: Optional[str] = None
    university: Optional[str] = None
    phone: Optional[str] = None


class VerifyVideoRequest(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in VIDEO_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(VIDEO_STATUSES)}")
        return v


# ── Review ──────────────────────────────────────────────────
class CreateReviewRequest(BaseModel):
    property_id: str
    rating: float = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class UpdateReviewRequest(BaseModel):
    rating: Optional[float] = Field(None, ge=1, le=5)
    comment: Optional[str] = None


# ── Chatbot ─────────────────────────────────────────────────
class ChatbotAskRequest(BaseModel):
    query: str


class ChatbotIndexRequest(BaseModel):
    pass


class ChatbotCompareRequest(BaseModel):
    property_ids: list[str]


class ChatbotRecommendRequest(BaseModel):
    preferences: Optional[str] = None
    university: Optional[str] = None
    max_price: Optional[float] = None


# ── Admin ───────────────────────────────────────────────────
class UpdateUserRoleRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in USER_ROLES:
            raise ValueError(f"role must be one of: {', '.join(USER_ROLES)}")
        return v


class UpdatePropertyStatusRequest(BaseModel):
    status: str
