import uuid
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user_required
from app.models import User, Video
from app.schemas import VerifyVideoRequest

router = APIRouter(prefix="/api/videos", tags=["Videos"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".flv", ".wmv"}


def video_to_dict(v: Video) -> dict:
    return {
        "id": v.id,
        "title": v.title,
        "description": v.description,
        "url": v.url,
        "thumbnail": v.thumbnail,
        "cloudinary_public_id": v.cloudinary_public_id,
        "status": v.status,
        "price": v.price,
        "location": v.location,
        "university": v.university,
        "phone": v.phone,
        "user_id": v.user_id,
        "property_id": v.property_id,
        "likes": v.likes,
        "comments": v.comments,
        "shares": v.shares,
        "user": {"id": v.user_id, "name": v.user.name if v.user else None},
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None,
    }


@router.get("")
def list_videos(
    status: str = Query(None),
    university: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = select(Video).order_by(Video.created_at.desc())

    if status:
        query = query.where(Video.status == status)
    if university:
        query = query.where(Video.university == university)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    offset = (page - 1) * limit
    result = db.execute(query.offset(offset).limit(limit))
    videos = result.scalars().all()

    return {
        "items": [video_to_dict(v) for v in videos],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 0,
    }


@router.get("/my")
def get_my_videos(current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    result = db.execute(
        select(Video).where(Video.user_id == current_user.id).order_by(Video.created_at.desc())
    )
    return [video_to_dict(v) for v in result.scalars().all()]


@router.get("/{video_id}")
def get_video(video_id: str, db: Session = Depends(get_db)):
    result = db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    return video_to_dict(video)


@router.post("/upload")
async def upload_video(
    video: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(None),
    property_id: str = Form(None),
    price: float = Form(None),
    location: str = Form(None),
    university: str = Form(None),
    phone: str = Form(None),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    import aiofiles
    ext = os.path.splitext(video.filename or ".mp4")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported extension: {ext}")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{int(uuid.uuid4().fields[0])}-{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    async with aiofiles.open(filepath, "wb") as f:
        while chunk := await video.read(1024 * 1024):
            await f.write(chunk)

    video_url = f"/uploads/{filename}"
    vid = Video(
        id=str(uuid.uuid4()),
        title=title,
        description=description,
        url=video_url,
        status="VERIFIED",
        price=price,
        location=location,
        university=university,
        phone=phone,
        user_id=current_user.id,
        property_id=property_id,
    )
    db.add(vid)
    db.commit()
    db.refresh(vid)
    return video_to_dict(vid)


@router.post("/{video_id}/verify")
def verify_video(
    video_id: str, req: VerifyVideoRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    result = db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    if video.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    video.status = req.status
    db.commit()
    db.refresh(video)
    return video_to_dict(video)


@router.post("/{video_id}/like")
def like_video(video_id: str, current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    result = db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    video.likes = (video.likes or 0) + 1
    db.commit()
    db.refresh(video)
    return video_to_dict(video)


@router.delete("/{video_id}")
def delete_video(video_id: str, current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    result = db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    if video.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if video.url and video.url.startswith("/uploads/"):
        filepath = os.path.join(os.getcwd(), video.url.lstrip("/"))
        try:
            os.remove(filepath)
        except FileNotFoundError:
            pass

    db.delete(video)
    db.commit()
    return {"message": "Video deleted"}
