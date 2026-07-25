from pydantic import BaseModel

from app.models.workflow import ActionType


class WorkflowTriggerCreate(BaseModel):
    name: str
    event_name: str
    action_type: ActionType
    action_config: dict = {}
    is_active: bool = True


class WorkflowTriggerOut(BaseModel):
    id: int
    name: str
    event_name: str
    action_type: ActionType
    action_config: dict
    is_active: bool

    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: int
    message: str
    channel: str
    is_read: bool

    model_config = {"from_attributes": True}
