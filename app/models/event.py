import enum
from datetime import datetime, date

from sqlalchemy import String, DateTime, Date, Enum, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EventStatus(str, enum.Enum):
    DRAFT = "draft"
    PLANNING = "planning"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class VendorAssignmentStatus(str, enum.Enum):
    INVITED = "invited"
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    REMOVED = "removed"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    event_type: Mapped[str] = mapped_column(String(100))
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    organizer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    venue: Mapped[str] = mapped_column(String(255), default="")
    event_date: Mapped[date] = mapped_column(Date)
    budget: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus), default=EventStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vendors: Mapped[list["EventVendor"]] = relationship(cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    quotations: Mapped[list["Quotation"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class EventVendor(Base):
    __tablename__ = "event_vendors"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    category: Mapped[str] = mapped_column(String(100))
    status: Mapped[VendorAssignmentStatus] = mapped_column(
        Enum(VendorAssignmentStatus), default=VendorAssignmentStatus.INVITED
    )
