import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import JSONResponse

from app.config import settings
from app.database import init_db, SessionLocal
from app.services.seed import seed_admin
from app.routers import auth, users, properties, videos, reviews, favorites, chatbot, admin


# Create uploads folder immediately when app loads
os.makedirs("uploads", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="NyumbaSalama API",
    description="Student housing platform backend - Dar es Salaam, Tanzania",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================
# CORS CONFIGURATION - FIXED!
# ============================================
ALLOWED_ORIGINS = [
    "https://darcampus.netlify.app",
    "https://nyumbasalama-frontend.netlify.app",
    "http://localhost:3000",
    "http://localhost:8000",
    "https://nyumba-salama-api.onrender.com"
]

# Try to use settings if available, fallback to hardcoded
try:
    if hasattr(settings, 'ALLOWED_ORIGINS') and settings.ALLOWED_ORIGINS:
        origins = settings.ALLOWED_ORIGINS.split(",")
    else:
        origins = ALLOWED_ORIGINS
except:
    origins = ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status_code": exc.status_code,
                "message": exc.detail,
                "timestamp": None,
                "path": str(request.url),
            },
        )
    return JSONResponse(
        status_code=500,
        content={
            "status_code": 500,
            "message": str(exc),
            "timestamp": None,
            "path": str(request.url),
        },
    )


# Static files
app.mount(
    "/api/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)


# ROUTERS - Already have prefixes in their files
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(properties.router)
app.include_router(videos.router)
app.include_router(reviews.router)
app.include_router(favorites.router)
app.include_router(chatbot.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {
        "message": "NyumbaSalama API is running",
        "version": "1.0.0",
        "status": "online"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "cors": "enabled",
        "cors_origins": origins if isinstance(origins, list) else origins.split(",")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT if hasattr(settings, 'PORT') else 8000,
        reload=True
    )
