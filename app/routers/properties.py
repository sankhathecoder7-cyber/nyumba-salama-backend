import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user_required
from app.models import User, Property, Review, Video
from app.schemas import CreatePropertyRequest, UpdatePropertyRequest
from app.services.auth import parse_json_field, json_field_to_str

router = APIRouter(prefix="/api/properties", tags=["Properties"])


def property_to_dict(p: Property) -> dict:
    agent_name = p.agent.name if p.agent else None
    return {
        "id": p.id,
        "title": p.title,
        "type": p.type,
        "price": p.price,
        "location": p.location,
        "area": p.area,
        "university": p.university,
        "description": p.description,
        "status": p.status,
        "amenities": parse_json_field(p.amenities),
        "rating": p.rating,
        "review_count": p.review_count,
        "latitude": p.latitude,
        "longitude": p.longitude,
        "images": parse_json_field(p.images),
        "video_url": p.video_url,
        "agent_id": p.agent_id,
        "agent": {"id": p.agent_id, "name": agent_name},
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("")
def list_properties(
    q: str = Query(None),
    type: str = Query(None),
    min_price: float = Query(None),
    max_price: float = Query(None),
    university: str = Query(None),
    status: str = Query("AVAILABLE"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = select(Property)

    if status:
        query = query.where(Property.status == status)
    if type:
        query = query.where(Property.type == type)
    if university:
        query = query.where(Property.university == university)
    if min_price is not None:
        query = query.where(Property.price >= min_price)
    if max_price is not None:
        query = query.where(Property.price <= max_price)
    if q:
        query = query.where(
            (Property.title.ilike(f"%{q}%")) | (Property.location.ilike(f"%{q}%"))
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    offset = (page - 1) * limit
    result = db.execute(query.offset(offset).limit(limit))
    properties = result.scalars().all()

    return {
        "items": [property_to_dict(p) for p in properties],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 0,
    }


@router.get("/university/{university}")
def get_by_university(university: str, db: Session = Depends(get_db)):
    result = db.execute(
        select(Property).where(Property.university == university.upper()).order_by(Property.created_at.desc())
    )
    return [property_to_dict(p) for p in result.scalars().all()]


@router.get("/{property_id}")
def get_property(property_id: str, db: Session = Depends(get_db)):
    result = db.execute(select(Property).where(Property.id == property_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    reviews = db.execute(
        select(Review).where(Review.property_id == property_id).order_by(Review.created_at.desc())
    ).scalars().all()

    videos = db.execute(
        select(Video).where(Video.property_id == property_id, Video.status == "VERIFIED")
    ).scalars().all()

    data = property_to_dict(p)
    data["reviews"] = [
        {
            "id": r.id, "rating": r.rating, "comment": r.comment,
            "user_id": r.user_id,
            "user": {"name": r.user.name if r.user else None},
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reviews
    ]
    data["videos"] = [
        {
            "id": v.id, "title": v.title, "url": v.url, "thumbnail": v.thumbnail,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in videos
    ]
    return data


@router.post("", status_code=status.HTTP_201_CREATED)
def create_property(
    req: CreatePropertyRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    p = Property(
        id=str(uuid.uuid4()),
        title=req.title,
        type=req.type,
        price=req.price,
        location=req.location,
        area=req.area,
        university=req.university,
        description=req.description,
        amenities=json_field_to_str(req.amenities or []),
        latitude=req.latitude,
        longitude=req.longitude,
        images=json_field_to_str(req.images or []),
        agent_id=current_user.id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return property_to_dict(p)


@router.put("/{property_id}")
def update_property(
    property_id: str,
    req: UpdatePropertyRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    result = db.execute(select(Property).where(Property.id == property_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if p.agent_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    for field in ["title", "type", "location", "area", "university", "description", "status", "video_url"]:
        val = getattr(req, field, None)
        if val is not None:
            setattr(p, field, val)

    if req.price is not None:
        p.price = req.price
    if req.latitude is not None:
        p.latitude = req.latitude
    if req.longitude is not None:
        p.longitude = req.longitude
    if req.amenities is not None:
        p.amenities = json_field_to_str(req.amenities)
    if req.images is not None:
        p.images = json_field_to_str(req.images)

    db.commit()
    db.refresh(p)
    return property_to_dict(p)


@router.delete("/{property_id}")
def delete_property(
    property_id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    result = db.execute(select(Property).where(Property.id == property_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if p.agent_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    db.delete(p)
    db.commit()
    return {"message": "Property deleted"}
