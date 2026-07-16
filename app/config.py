import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./pydev.db"
    JWT_SECRET: str = "nyumbasalama-super-secret-key-change-in-production"
    JWT_EXPIRES_IN: str = "7d"
    PORT: int = 8000
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    CHAT_MODEL: str = "llama-3.3-70b-versatile"
    EMBEDDING_MODEL: str = "openai/text-embedding-3-small"
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    TOP_K: int = 5
    TEMPERATURE: float = 0.3
    MAX_TOKENS: int = 1000
    FRONTEND_URL: str = "https://nyumbasalama-frontend.netlify.app"
    ALLOWED_ORIGINS: str = "http://localhost:3000,https://nyumbasalama-frontend.netlify.app"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
