from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import User
from app.services.auth import hash_password


def seed_admin(db: Session):
    result = db.execute(select(User).where(User.role == "ADMIN").limit(1))
    admin = result.scalar_one_or_none()
    if not admin:
        import uuid
        admin = User(
            id=str(uuid.uuid4()),
            name="Admin",
            email="admin@nyumbasalama.com",
            password=hash_password("admin123"),
            phone="0000000000",
            role="ADMIN",
        )
        db.add(admin)
        db.commit()
