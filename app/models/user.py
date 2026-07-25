import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Enum, ForeignKey, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    CLIENT = "client"
    ORGANIZER = "organizer"
    VENDOR = "vendor"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.CLIENT)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vendor_profile: Mapped["VendorProfile"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class VendorProfile(Base):
    __tablename__ = "vendor_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    business_name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    service_areas: Mapped[str] = mapped_column(String(255), default="")
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="vendor_profile")
