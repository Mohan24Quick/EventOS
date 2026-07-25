from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, VendorProfile, UserRole
from app.schemas.user import UserOut

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("")
def list_vendors(category: str | None = None, db: Session = Depends(get_db)):
    q = db.query(VendorProfile).join(User)
    if category:
        q = q.filter(VendorProfile.category == category)
    profiles = q.all()
    return [
        {
            "user_id": p.user_id,
            "business_name": p.business_name,
            "category": p.category,
            "service_areas": p.service_areas,
            "rating": p.rating,
            "is_verified": p.is_verified,
            "name": p.user.name,
            "email": p.user.email,
        }
        for p in profiles
    ]
