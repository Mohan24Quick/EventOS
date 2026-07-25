from datetime import date, datetime
from pydantic import BaseModel

from app.models.quotation import QuotationStatus


class LineItemIn(BaseModel):
    description: str
    quantity: int = 1
    unit_price: float = 0.0


class QuotationCreate(BaseModel):
    event_id: int
    vendor_id: int
    valid_until: date | None = None
    notes: str = ""
    line_items: list[LineItemIn]


class LineItemOut(BaseModel):
    id: int
    description: str
    quantity: int
    unit_price: float
    amount: float

    model_config = {"from_attributes": True}


class QuotationOut(BaseModel):
    id: int
    event_id: int
    vendor_id: int
    created_by_id: int
    status: QuotationStatus
    total_amount: float
    valid_until: date | None
    notes: str
    created_at: datetime
    line_items: list[LineItemOut]

    model_config = {"from_attributes": True}


class QuotationStatusUpdate(BaseModel):
    status: QuotationStatus
