import uuid
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from app.database import get_db
from app.dependencies import get_current_user_required
from app.models import User, ChatMessage, Property, Review
from app.schemas import ChatbotAskRequest, ChatbotCompareRequest, ChatbotRecommendRequest
from app.config import settings
from app.services.auth import parse_json_field

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])


def build_system_prompt():
    return (
        "You are a helpful assistant for NyumbaSalama, a student housing platform in Dar es Salaam, Tanzania. "
        "You help students find accommodation near universities like UDSM, ARU, MUHAS, IFM, UDOM, and SUZA. "
        "Be friendly, concise, and informative. Answer in Swahili or English based on the user's language."
    )


@router.post("/index")
def index_properties(db: Session = Depends(get_db)):
    result = db.execute(select(Property))
    count = len(result.scalars().all())
    return {"message": f"Indexed {count} properties", "count": count}


@router.post("/ask")
def ask_chatbot(req: ChatbotAskRequest, current_user: User = Depends(get_current_user_required),
                db: Session = Depends(get_db)):
    user_msg = ChatMessage(id=str(uuid.uuid4()), role="user", content=req.query, user_id=current_user.id)
    db.add(user_msg)
    db.commit()

    messages = [{"role": "system", "content": build_system_prompt()}]
    history = db.execute(
        select(ChatMessage).where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc()).limit(10)
    ).scalars().all()
    for msg in reversed(history):
        messages.append({"role": msg.role, "content": msg.content})

    reply = "Samahani, huduma ya AI haipatikani kwa sasa. (AI service is currently unavailable.)"

    if settings.GROQ_API_KEY:
        try:
            resp = httpx.post(
                f"{settings.GROQ_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"},
                json={"model": settings.CHAT_MODEL, "messages": messages,
                      "temperature": settings.TEMPERATURE, "max_tokens": settings.MAX_TOKENS},
                timeout=30.0,
            )
            if resp.status_code == 200:
                reply = resp.json()["choices"][0]["message"]["content"]
        except Exception:
            pass

    assistant_msg = ChatMessage(id=str(uuid.uuid4()), role="assistant", content=reply, user_id=current_user.id)
    db.add(assistant_msg)
    db.commit()
    return {"reply": reply, "user_id": current_user.id}


@router.post("/recommend")
def recommend_properties(req: ChatbotRecommendRequest, current_user: User = Depends(get_current_user_required),
                         db: Session = Depends(get_db)):
    query = select(Property).where(Property.status == "AVAILABLE")
    if req.university:
        query = query.where(Property.university == req.university.upper())
    if req.max_price is not None:
        query = query.where(Property.price <= req.max_price)

    properties = db.execute(query.limit(10)).scalars().all()
    items = [{
        "id": p.id, "title": p.title, "type": p.type, "price": p.price,
        "location": p.location, "university": p.university, "rating": p.rating,
        "images": parse_json_field(p.images),
    } for p in properties]
    return {"recommendations": items, "count": len(items)}


@router.post("/compare")
def compare_properties(req: ChatbotCompareRequest, current_user: User = Depends(get_current_user_required),
                       db: Session = Depends(get_db)):
    if len(req.property_ids) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Need at least 2 property IDs")

    properties = db.execute(select(Property).where(Property.id.in_(req.property_ids))).scalars().all()
    if len(properties) < 2:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Some properties not found")

    comparison = []
    for p in properties:
        reviews = db.execute(select(Review).where(Review.property_id == p.id).limit(3)).scalars().all()
        comparison.append({
            "id": p.id, "title": p.title, "type": p.type, "price": p.price,
            "location": p.location, "university": p.university, "rating": p.rating,
            "review_count": p.review_count,
            "amenities": parse_json_field(p.amenities),
            "reviews": [{"rating": r.rating, "comment": r.comment,
                         "user": {"name": r.user.name if r.user else None}} for r in reviews],
        })
    return {"comparison": comparison}


@router.get("/history")
def get_chat_history(current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    messages = db.execute(
        select(ChatMessage).where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc()).limit(50)
    ).scalars().all()
    return [
        {"id": m.id, "role": m.role, "content": m.content,
         "created_at": m.created_at.isoformat() if m.created_at else None}
        for m in messages
    ]


@router.delete("/history")
def clear_chat_history(current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    db.execute(delete(ChatMessage).where(ChatMessage.user_id == current_user.id))
    db.commit()
    return {"message": "Chat history cleared"}
