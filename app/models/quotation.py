import enum
from datetime import datetime, date

from sqlalchemy import String, DateTime, Date, Enum, ForeignKey, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class QuotationStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[QuotationStatus] = mapped_column(Enum(QuotationStatus), default=QuotationStatus.DRAFT)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event: Mapped["Event"] = relationship(back_populates="quotations")
    line_items: Mapped[list["QuotationLineItem"]] = relationship(cascade="all, delete-orphan")


class QuotationLineItem(Base):
    __tablename__ = "quotation_line_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    quotation_id: Mapped[int] = mapped_column(ForeignKey("quotations.id"))
    description: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
