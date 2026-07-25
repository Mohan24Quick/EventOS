from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import get_current_user
from app.models.user import User
from app.models.event import Event, EventVendor
from app.schemas.event import (
    EventCreate,
    EventOut,
    EventStatusUpdate,
    AssignVendorRequest,
    EventVendorOut,
    VendorAssignmentStatusUpdate,
)
from app.services.workflow_engine import emit_event

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventOut, status_code=201)
def create_event(payload: EventCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = Event(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)

    # This is what makes the platform "run itself": creating an event
    # automatically spins up the right SOP checklist as tasks.
    emit_event(db, "event.created", {"event_id": event.id})

    return event


@router.get("", response_model=list[EventOut])
def list_events(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Event).all()


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}/status", response_model=EventOut)
def update_status(
    event_id: int, payload: EventStatusUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = payload.status
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/vendors", response_model=EventVendorOut, status_code=201)
def assign_vendor(
    event_id: int, payload: AssignVendorRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    ev = EventVendor(event_id=event_id, vendor_id=payload.vendor_id, category=payload.category)
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.get("/{event_id}/vendors", response_model=list[EventVendorOut])
def list_event_vendors(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(EventVendor).filter(EventVendor.event_id == event_id).all()


@router.patch("/{event_id}/vendors/{assignment_id}", response_model=EventVendorOut)
def update_vendor_assignment(
    event_id: int,
    assignment_id: int,
    payload: VendorAssignmentStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ev = db.query(EventVendor).filter(EventVendor.id == assignment_id, EventVendor.event_id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Assignment not found")
    ev.status = payload.status
    db.commit()
    db.refresh(ev)
    return ev
