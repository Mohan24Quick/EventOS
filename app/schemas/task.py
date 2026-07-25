from datetime import date, datetime
from pydantic import BaseModel

from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    event_id: int
    title: str
    description: str = ""
    assignee_id: int | None = None
    due_date: date | None = None


class TaskOut(BaseModel):
    id: int
    event_id: int
    title: str
    description: str
    assignee_id: int | None
    status: TaskStatus
    due_date: date | None
    sop_step_id: int | None
    order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskStatusUpdate(BaseModel):
    status: TaskStatus
