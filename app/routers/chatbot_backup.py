import uuid
import logging
import httpx

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status
)

from sqlalchemy.orm import Session
from sqlalchemy import select, delete

from app.database import get_db
from app.dependencies import get_current_user_required
from app.models import (
    User,
    ChatMessage,
    Property,
    Review
)

from app.schemas import (
    ChatbotAskRequest,
    ChatbotCompareRequest,
    ChatbotRecommendRequest
)

from app.config import settings
from app.services.auth import parse_json_field


router = APIRouter(
    prefix="/api/chatbot",
    tags=["Chatbot"]
)


logger = logging.getLogger(__name__)


# ==============================
# AI SYSTEM PROMPT
# ==============================

def build_system_prompt():

    return """
You are NyumbaSalama AI Assistant.

NyumbaSalama is a student accommodation platform
in Dar es Salaam, Tanzania.

Your responsibilities:

- Help students find accommodation.
- Recommend rooms near universities.
- Explain prices and locations.
- Help compare properties.
- Answer in Swahili or English depending on user language.
- Be friendly and concise.

Rules:
- Never invent property information.
- Use only provided property data.
- If information is unavailable say you don't know.
"""



# ==============================
# PROPERTY RAG CONTEXT
# ==============================

def get_property_context(db: Session):

    properties = db.execute(
        select(Property)
        .where(
            Property.status == "AVAILABLE"
        )
        .limit(10)
    ).scalars().all()


    if not properties:
        return "No available properties."



    context = []


    for property in properties:

        context.append(
            f"""
ID: {property.id}
Name: {property.title}
Type: {property.type}
Location: {property.location}
University: {property.university}
Price: {property.price}
Rating: {property.rating}
"""
        )


    return "\n".join(context)




# ==============================
# INDEX PROPERTIES
# ==============================

@router.post("/index")
def index_properties(
    db: Session = Depends(get_db)
):

    properties = db.execute(
        select(Property)
    ).scalars().all()


    return {
        "message": "Properties indexed",
        "count": len(properties)
    }





# ==============================
# ASK AI
# ==============================

@router.post("/ask")
def ask_chatbot(
    req: ChatbotAskRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):


    # Save user message

    user_message = ChatMessage(
        id=str(uuid.uuid4()),
        role="user",
        content=req.query,
        user_id=current_user.id
    )


    db.add(user_message)
    db.commit()



    messages = [

        {
            "role":"system",
            "content":build_system_prompt()
        }

    ]



    # Add property knowledge

    context = get_property_context(db)


    messages.append(
        {
            "role":"system",
            "content":f"""
Available NyumbaSalama properties:

{context}

Use this information when answering.
"""
        }
    )



    # Chat history

    history = db.execute(

        select(ChatMessage)
        .where(
            ChatMessage.user_id == current_user.id
        )
        .order_by(
            ChatMessage.created_at.desc()
        )
        .limit(10)

    ).scalars().all()



    for message in reversed(history):

        messages.append(
            {
                "role":message.role,
                "content":message.content
            }
        )



    reply = (
        "Samahani, AI service haipatikani kwa sasa."
    )



    # ======================
    # GROQ REQUEST
    # ======================

    if settings.GROQ_API_KEY:


        try:

            with httpx.Client(
                timeout=30
            ) as client:


                response = client.post(

                    f"{settings.GROQ_BASE_URL}/chat/completions",

                    headers={

                        "Authorization":
                        f"Bearer {settings.GROQ_API_KEY}",

                        "Content-Type":
                        "application/json"

                    },


                    json={

                        "model":
                        settings.CHAT_MODEL,

                        "messages":
                        messages,

                        "temperature":
                        settings.TEMPERATURE,

                        "max_tokens":
                        settings.MAX_TOKENS

                    }

                )



            if response.status_code == 200:


                data = response.json()


                reply = (
                    data
                    .get("choices",[{}])[0]
                    .get("message",{})
                    .get(
                        "content",
                        reply
                    )
                )


            else:

                logger.error(
                    f"Groq Error {response.status_code}: {response.text}"
                )



        except Exception as e:

            logger.exception(
                f"Groq connection failed: {e}"
            )


    else:

        logger.warning(
            "GROQ_API_KEY missing"
        )




    # Save AI response

    assistant_message = ChatMessage(

        id=str(uuid.uuid4()),

        role="assistant",

        content=reply,

        user_id=current_user.id

    )


    db.add(assistant_message)

    db.commit()



    return {

        "reply":reply,

        "user_id":current_user.id

    }





# ==============================
# RECOMMEND PROPERTIES
# ==============================


@router.post("/recommend")
def recommend_properties(
    req: ChatbotRecommendRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):


    query = select(Property).where(
        Property.status=="AVAILABLE"
    )



    if req.university:

        query=query.where(
            Property.university ==
            req.university.upper()
        )



    if req.max_price:

        query=query.where(
            Property.price <= req.max_price
        )



    properties=db.execute(
        query.limit(10)
    ).scalars().all()



    return {

        "count":len(properties),

        "recommendations":[

            {

            "id":p.id,

            "title":p.title,

            "price":p.price,

            "location":p.location,

            "university":p.university,

            "rating":p.rating,

            "images":
            parse_json_field(p.images)

            }

            for p in properties

        ]

    }





# ==============================
# COMPARE PROPERTIES
# ==============================


@router.post("/compare")
def compare_properties(
    req:ChatbotCompareRequest,
    current_user:User=Depends(get_current_user_required),
    db:Session=Depends(get_db)
):


    if len(req.property_ids)<2:

        raise HTTPException(
            status_code=400,
            detail="Need at least two properties"
        )



    properties=db.execute(

        select(Property)
        .where(
            Property.id.in_(req.property_ids)
        )

    ).scalars().all()



    if len(properties)<2:

        raise HTTPException(
            status_code=404,
            detail="Properties not found"
        )



    result=[]



    for p in properties:


        reviews=db.execute(

            select(Review)
            .where(
                Review.property_id==p.id
            )
            .limit(3)

        ).scalars().all()



        result.append({

            "id":p.id,

            "title":p.title,

            "price":p.price,

            "location":p.location,

            "university":p.university,

            "rating":p.rating,

            "reviews":[

                {
                    "rating":r.rating,
                    "comment":r.comment
                }

                for r in reviews

            ]

        })



    return {

        "comparison":result

    }





# ==============================
# CHAT HISTORY
# ==============================


@router.get("/history")
def history(
    current_user:User=Depends(get_current_user_required),
    db:Session=Depends(get_db)
):


    messages=db.execute(

        select(ChatMessage)
        .where(
            ChatMessage.user_id==current_user.id
        )
        .order_by(
            ChatMessage.created_at.asc()
        )
        .limit(50)

    ).scalars().all()



    return [

        {
            "role":m.role,
            "content":m.content,
            "created_at":
            m.created_at.isoformat()
            if m.created_at else None
        }

        for m in messages

    ]





@router.delete("/history")
def clear_history(
    current_user:User=Depends(get_current_user_required),
    db:Session=Depends(get_db)
):

    db.execute(

        delete(ChatMessage)
        .where(
            ChatMessage.user_id==current_user.id
        )

    )


    db.commit()


    return {
        "message":"Chat history cleared"
    }