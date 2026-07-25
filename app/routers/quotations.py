from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import get_current_user
from app.models.user import User
from app.models.quotation import Quotation, QuotationLineItem, QuotationStatus
from app.models.event import Event
from app.schemas.quotation import QuotationCreate, QuotationOut, QuotationStatusUpdate
from app.services.workflow_engine import emit_event

router = APIRouter(prefix="/quotations", tags=["quotations"])


@router.post("", response_model=QuotationOut, status_code=201)
def create_quotation(payload: QuotationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    total = sum(li.quantity * li.unit_price for li in payload.line_items)
    quotation = Quotation(
        event_id=payload.event_id,
        vendor_id=payload.vendor_id,
        created_by_id=user.id,
        valid_until=payload.valid_until,
        notes=payload.notes,
        total_amount=total,
    )
    db.add(quotation)
    db.flush()

    for li in payload.line_items:
        db.add(
            QuotationLineItem(
                quotation_id=quotation.id,
                description=li.description,
                quantity=li.quantity,
                unit_price=li.unit_price,
                amount=li.quantity * li.unit_price,
            )
        )

    db.commit()
    db.refresh(quotation)
    return quotation


@router.get("", response_model=list[QuotationOut])
def list_quotations(
    event_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    q = db.query(Quotation)
    if event_id:
        q = q.filter(Quotation.event_id == event_id)
    return q.all()


@router.get("/{quotation_id}", response_model=QuotationOut)
def get_quotation(quotation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return quotation


@router.patch("/{quotation_id}/status", response_model=QuotationOut)
def update_quotation_status(
    quotation_id: int,
    payload: QuotationStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    quotation.status = payload.status
    db.commit()
    db.refresh(quotation)

    # The moment a quotation is accepted, the workflow engine takes over:
    # it can spin up vendor-specific SOP tasks, notify the client, etc.
    if payload.status == QuotationStatus.ACCEPTED:
        emit_event(
            db,
            "quotation.accepted",
            {"event_id": quotation.event_id, "vendor_id": quotation.vendor_id, "quotation_id": quotation.id},
        )
        db.refresh(quotation)

    return quotation
