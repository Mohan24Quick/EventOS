from datetime import date, datetime
from pydantic import BaseModel

from app.models.event import EventStatus, VendorAssignmentStatus


class EventCreate(BaseModel):
    title: str
    event_type: str
    client_id: int
    organizer_id: int | None = None
    venue: str = ""
    event_date: date
    budget: float = 0.0


class EventOut(BaseModel):
    id: int
    title: str
    event_type: str
    client_id: int
    organizer_id: int | None
    venue: str
    event_date: date
    budget: float
    status: EventStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class EventStatusUpdate(BaseModel):
    status: EventStatus


class AssignVendorRequest(BaseModel):
    vendor_id: int
    category: str


class EventVendorOut(BaseModel):
    id: int
    event_id: int
    vendor_id: int
    category: str
    status: VendorAssignmentStatus

    model_config = {"from_attributes": True}


class VendorAssignmentStatusUpdate(BaseModel):
    status: VendorAssignmentStatus
