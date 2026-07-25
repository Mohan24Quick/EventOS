import enum
from datetime import datetime, date

from sqlalchemy import String, DateTime, Date, Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(1000), default="")
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.TODO)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sop_step_id: Mapped[int | None] = mapped_column(ForeignKey("sop_steps.id"), nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event: Mapped["Event"] = relationship(back_populates="tasks")
