import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from app.database import get_db
from app.dependencies import create_access_token
from app.models import User, PasswordReset
from app.schemas import RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.services.auth import hash_password, verify_password, sanitize_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.execute(select(User).where(User.email == req.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        name=req.name,
        email=req.email,
        password=hash_password(req.password),
        phone=req.phone,
        role=req.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    return {"access_token": token, "expires_in": "7d", "user": sanitize_user(user)}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    result = db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    return {"access_token": token, "expires_in": "7d", "user": sanitize_user(user)}


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    result = db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}

    reset_token = str(uuid.uuid4())
    reset = PasswordReset(
        id=str(uuid.uuid4()),
        token=reset_token,
        expires_at=datetime.utcnow() + timedelta(hours=1),
        user_id=user.id,
    )
    db.add(reset)
    db.commit()

    return {"message": "Password reset token generated", "token": reset_token}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    result = db.execute(select(PasswordReset).where(PasswordReset.token == req.token))
    reset = result.scalar_one_or_none()

    if not reset or reset.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.execute(select(User).where(User.id == reset.user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password = hash_password(req.password)
    db.execute(delete(PasswordReset).where(PasswordReset.id == reset.id))
    db.commit()

    return {"message": "Password reset successful"}
