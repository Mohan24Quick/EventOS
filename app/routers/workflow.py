from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import require_roles, get_current_user
from app.models.user import User
from app.models.workflow import WorkflowTrigger, Notification
from app.schemas.workflow import WorkflowTriggerCreate, WorkflowTriggerOut, NotificationOut

router = APIRouter(prefix="/workflow", tags=["workflow"])


@router.post("/triggers", response_model=WorkflowTriggerOut, status_code=201)
def create_trigger(
    payload: WorkflowTriggerCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))
):
    trigger = WorkflowTrigger(**payload.model_dump())
    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    return trigger


@router.get("/triggers", response_model=list[WorkflowTriggerOut])
def list_triggers(db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    return db.query(WorkflowTrigger).all()


@router.get("/notifications", response_model=list[NotificationOut])
def my_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.id.desc()).all()
