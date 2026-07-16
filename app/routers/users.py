from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user_required
from app.models import User, Property, Video, Favorite, Review
from app.schemas import UpdateUserRequest
from app.services.auth import sanitize_user

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    prop_count = db.scalar(select(func.count(Property.id)).where(Property.agent_id == current_user.id))
    fav_count = db.scalar(select(func.count(Favorite.id)).where(Favorite.user_id == current_user.id))
    vid_count = db.scalar(select(func.count(Video.id)).where(Video.user_id == current_user.id))

    user_data = sanitize_user(current_user)
    user_data["propertiesCount"] = prop_count or 0
    user_data["favoritesCount"] = fav_count or 0
    user_data["videosCount"] = vid_count or 0
    return user_data


@router.get("/dashboard")
def get_dashboard(current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    total_properties = db.scalar(select(func.count(Property.id)))
    total_videos = db.scalar(select(func.count(Video.id)))
    total_reviews = db.scalar(select(func.count(Review.id)))
    verified_videos = db.scalar(select(func.count(Video.id)).where(Video.status == "VERIFIED"))
    return {
        "totalProperties": total_properties or 0,
        "totalVideos": total_videos or 0,
        "totalReviews": total_reviews or 0,
        "verifiedVideos": verified_videos or 0,
    }


@router.put("/profile")
def update_profile(
    req: UpdateUserRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    if req.name is not None:
        current_user.name = req.name
    if req.phone is not None:
        current_user.phone = req.phone
    if req.avatar is not None:
        current_user.avatar = req.avatar
    db.commit()
    db.refresh(current_user)
    return sanitize_user(current_user)


@router.get("/properties")
def get_my_properties(current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    result = db.execute(
        select(Property).where(Property.agent_id == current_user.id).order_by(Property.created_at.desc())
    )
    properties = result.scalars().all()
    return [
        {
            "id": p.id, "title": p.title, "type": p.type, "price": p.price,
            "location": p.location, "status": p.status, "university": p.university,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in properties
    ]
