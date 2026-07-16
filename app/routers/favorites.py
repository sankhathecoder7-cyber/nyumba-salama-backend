import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user_required
from app.models import User, Favorite, Property

router = APIRouter(prefix="/api/favorites", tags=["Favorites"])


@router.get("")
def get_favorites(current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    favs = db.execute(
        select(Favorite).where(Favorite.user_id == current_user.id).order_by(Favorite.created_at.desc())
    ).scalars().all()

    items = []
    for f in favs:
        prop = db.execute(select(Property).where(Property.id == f.property_id)).scalar_one_or_none()
        if prop:
            items.append({
                "id": prop.id, "title": prop.title, "price": prop.price,
                "location": prop.location, "type": prop.type, "university": prop.university,
                "rating": prop.rating, "images": prop.images,
                "favorited_at": f.created_at.isoformat() if f.created_at else None,
            })
    return items


@router.get("/check/{property_id}")
def check_favorite(property_id: str, current_user: User = Depends(get_current_user_required),
                   db: Session = Depends(get_db)):
    result = db.execute(
        select(Favorite).where(Favorite.user_id == current_user.id, Favorite.property_id == property_id)
    )
    return {"is_favorite": result.scalar_one_or_none() is not None}


@router.post("/{property_id}")
def add_favorite(property_id: str, current_user: User = Depends(get_current_user_required),
                 db: Session = Depends(get_db)):
    existing = db.execute(
        select(Favorite).where(Favorite.user_id == current_user.id, Favorite.property_id == property_id)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already in favorites")

    if not db.execute(select(Property).where(Property.id == property_id)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    fav = Favorite(id=str(uuid.uuid4()), user_id=current_user.id, property_id=property_id)
    db.add(fav)
    db.commit()
    return {"message": "Added to favorites"}


@router.delete("/{property_id}")
def remove_favorite(property_id: str, current_user: User = Depends(get_current_user_required),
                    db: Session = Depends(get_db)):
    fav = db.execute(
        select(Favorite).where(Favorite.user_id == current_user.id, Favorite.property_id == property_id)
    ).scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")

    db.delete(fav)
    db.commit()
    return {"message": "Removed from favorites"}
