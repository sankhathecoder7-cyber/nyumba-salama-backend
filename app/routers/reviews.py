import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user_required
from app.models import User, Review, Property
from app.schemas import CreateReviewRequest, UpdateReviewRequest

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


def review_to_dict(r: Review) -> dict:
    return {
        "id": r.id, "rating": r.rating, "comment": r.comment,
        "user_id": r.user_id, "property_id": r.property_id,
        "user": {"id": r.user_id, "name": r.user.name if r.user else None},
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def update_property_rating(db: Session, property_id: str):
    avg_rating = db.scalar(select(func.avg(Review.rating)).where(Review.property_id == property_id)) or 0.0
    count = db.scalar(select(func.count(Review.id)).where(Review.property_id == property_id)) or 0

    prop = db.execute(select(Property).where(Property.id == property_id)).scalar_one_or_none()
    if prop:
        prop.rating = round(float(avg_rating), 1)
        prop.review_count = count
        db.commit()


@router.get("/property/{property_id}")
def get_reviews(property_id: str, db: Session = Depends(get_db)):
    result = db.execute(
        select(Review).where(Review.property_id == property_id).order_by(Review.created_at.desc())
    )
    return [review_to_dict(r) for r in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_review(req: CreateReviewRequest, current_user: User = Depends(get_current_user_required),
                  db: Session = Depends(get_db)):
    existing = db.execute(
        select(Review).where(Review.user_id == current_user.id, Review.property_id == req.property_id)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already reviewed this property")

    prop = db.execute(select(Property).where(Property.id == req.property_id)).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    review = Review(
        id=str(uuid.uuid4()), rating=req.rating, comment=req.comment,
        user_id=current_user.id, property_id=req.property_id,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    update_property_rating(db, req.property_id)
    return review_to_dict(review)


@router.put("/{review_id}")
def update_review(review_id: str, req: UpdateReviewRequest,
                  current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    review = db.execute(select(Review).where(Review.id == review_id)).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if req.rating is not None:
        review.rating = req.rating
    if req.comment is not None:
        review.comment = req.comment
    db.commit()
    db.refresh(review)
    update_property_rating(db, review.property_id)
    return review_to_dict(review)


@router.delete("/{review_id}")
def delete_review(review_id: str, current_user: User = Depends(get_current_user_required),
                  db: Session = Depends(get_db)):
    review = db.execute(select(Review).where(Review.id == review_id)).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    property_id = review.property_id
    db.delete(review)
    db.commit()
    update_property_rating(db, property_id)
    return {"message": "Review deleted"}
