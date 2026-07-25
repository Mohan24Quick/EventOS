import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, JSON, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ActionType(str, enum.Enum):
    CREATE_TASKS_FROM_SOP = "create_tasks_from_sop"
    SEND_NOTIFICATION = "send_notification"
    UPDATE_EVENT_STATUS = "update_event_status"


class WorkflowTrigger(Base):
    __tablename__ = "workflow_triggers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    event_name: Mapped[str] = mapped_column(String(100), index=True)
    action_type: Mapped[ActionType] = mapped_column(Enum(ActionType))
    action_config: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    message: Mapped[str] = mapped_column(String(1000))
    channel: Mapped[str] = mapped_column(String(50), default="in_app")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
