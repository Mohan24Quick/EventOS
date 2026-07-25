from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import get_current_user
from app.models.user import User
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskOut, TaskStatusUpdate
from app.services.workflow_engine import emit_event

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(
    event_id: int | None = None,
    assignee_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Task)
    if event_id:
        q = q.filter(Task.event_id == event_id)
    if assignee_id:
        q = q.filter(Task.assignee_id == assignee_id)
    return q.order_by(Task.order).all()


@router.patch("/{task_id}/status", response_model=TaskOut)
def update_task_status(
    task_id: int, payload: TaskStatusUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = payload.status
    db.commit()
    db.refresh(task)

    emit_event(db, "task.status_changed", {"event_id": task.event_id, "task_id": task.id, "status": task.status.value})

    return task
