import os
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import admin_required
from app.models import User, Property, Video
from app.schemas import UpdateUserRoleRequest, UpdatePropertyStatusRequest
from app.services.auth import sanitize_user

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/stats")
def get_stats(current_user: User = Depends(admin_required), db: Session = Depends(get_db)):
    return {
        "totalVideos": db.scalar(select(func.count(Video.id))) or 0,
        "totalProperties": db.scalar(select(func.count(Property.id))) or 0,
        "totalUsers": db.scalar(select(func.count(User.id))) or 0,
        "verifiedVideos": db.scalar(select(func.count(Video.id)).where(Video.status == "VERIFIED")) or 0,
        "pendingVideos": db.scalar(select(func.count(Video.id)).where(Video.status == "PENDING")) or 0,
    }


@router.get("/videos")
def admin_list_videos(current_user: User = Depends(admin_required), db: Session = Depends(get_db),
                      page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    query = select(Video).order_by(Video.created_at.desc())
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    offset = (page - 1) * limit
    videos = db.execute(query.offset(offset).limit(limit)).scalars().all()
    return {
        "items": [{"id": v.id, "title": v.title, "url": v.url, "status": v.status,
                    "user_id": v.user_id, "likes": v.likes,
                    "created_at": v.created_at.isoformat() if v.created_at else None} for v in videos],
        "total": total, "page": page, "limit": limit,
    }


@router.put("/videos/{video_id}/verify")
def admin_verify_video(video_id: str, current_user: User = Depends(admin_required), db: Session = Depends(get_db)):
    video = db.execute(select(Video).where(Video.id == video_id)).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    video.status = "VERIFIED"
    db.commit()
    return {"message": "Video verified"}


@router.delete("/videos/{video_id}")
def admin_delete_video(video_id: str, current_user: User = Depends(admin_required), db: Session = Depends(get_db)):
    video = db.execute(select(Video).where(Video.id == video_id)).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    if video.url and video.url.startswith("/uploads/"):
        filepath = os.path.join(os.getcwd(), video.url.lstrip("/"))
        try:
            os.remove(filepath)
        except FileNotFoundError:
            pass
    db.delete(video)
    db.commit()
    return {"message": "Video deleted"}


@router.get("/properties")
def admin_list_properties(current_user: User = Depends(admin_required), db: Session = Depends(get_db),
                          page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    query = select(Property).order_by(Property.created_at.desc())
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    offset = (page - 1) * limit
    properties = db.execute(query.offset(offset).limit(limit)).scalars().all()
    return {
        "items": [{"id": p.id, "title": p.title, "type": p.type, "price": p.price,
                    "location": p.location, "status": p.status, "agent_id": p.agent_id,
                    "created_at": p.created_at.isoformat() if p.created_at else None} for p in properties],
        "total": total, "page": page, "limit": limit,
    }


@router.put("/properties/{property_id}/status")
def admin_update_property_status(property_id: str, req: UpdatePropertyStatusRequest,
                                 current_user: User = Depends(admin_required), db: Session = Depends(get_db)):
    prop = db.execute(select(Property).where(Property.id == property_id)).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    prop.status = req.status
    db.commit()
    return {"message": "Property status updated"}


@router.delete("/properties/{property_id}")
def admin_delete_property(property_id: str, current_user: User = Depends(admin_required), db: Session = Depends(get_db)):
    prop = db.execute(select(Property).where(Property.id == property_id)).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    db.delete(prop)
    db.commit()
    return {"message": "Property deleted"}


@router.get("/users")
def admin_list_users(current_user: User = Depends(admin_required), db: Session = Depends(get_db),
                     page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    query = select(User).order_by(User.created_at.desc())
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    offset = (page - 1) * limit
    users = db.execute(query.offset(offset).limit(limit)).scalars().all()
    return {"items": [sanitize_user(u) for u in users], "total": total, "page": page, "limit": limit}


@router.put("/users/{user_id}/role")
def admin_update_user_role(user_id: str, req: UpdateUserRoleRequest,
                           current_user: User = Depends(admin_required), db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = req.role
    db.commit()
    return {"message": "User role updated"}


@router.delete("/users/{user_id}")
def admin_delete_user(user_id: str, current_user: User = Depends(admin_required), db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    admin_count = db.scalar(select(func.count(User.id)).where(User.role == "ADMIN")) or 0
    if user.role == "ADMIN" and admin_count <= 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the last admin")

    db.delete(user)
    db.commit()
    return {"message": "User deleted"}
