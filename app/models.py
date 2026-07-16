import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    role = Column(String, default="STUDENT")
    avatar = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    properties = relationship("Property", back_populates="agent", cascade="all, delete-orphan")
    videos = relationship("Video", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Property(Base):
    __tablename__ = "properties"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    location = Column(String, nullable=False)
    area = Column(String, nullable=True)
    university = Column(String, default="BOTH")
    description = Column(Text, nullable=True)
    status = Column(String, default="AVAILABLE")
    amenities = Column(Text, nullable=True)
    rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    images = Column(Text, nullable=True)
    video_url = Column(String, nullable=True)
    agent_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent = relationship("User", back_populates="properties")
    reviews = relationship("Review", back_populates="property", cascade="all, delete-orphan")
    videos = relationship("Video", back_populates="property")
    favorites = relationship("Favorite", back_populates="property", cascade="all, delete-orphan")


class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    url = Column(String, nullable=False)
    thumbnail = Column(String, nullable=True)
    cloudinary_public_id = Column(String, nullable=True)
    status = Column(String, default="PENDING")
    price = Column(Float, nullable=True)
    location = Column(String, nullable=True)
    university = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(String, ForeignKey("properties.id", ondelete="SET NULL"), nullable=True)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="videos")
    property = relationship("Property", back_populates="videos")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("user_id", "property_id"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    rating = Column(Float, nullable=False)
    comment = Column(Text, nullable=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(String, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="reviews")
    property = relationship("Property", back_populates="reviews")


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "property_id"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(String, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    property = relationship("Property", back_populates="favorites")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=gen_uuid)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    extra_data = Column("metadata", Text, nullable=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_messages")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_uuid)
    type = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Integer, default=0)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(String, primary_key=True, default=gen_uuid)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
