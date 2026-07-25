from sqlalchemy import String, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SOPTemplate(Base):
    __tablename__ = "sop_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(String(500), default="")

    steps: Mapped[list["SOPStep"]] = relationship(
        back_populates="template", cascade="all, delete-orphan", order_by="SOPStep.order"
    )


class SOPStep(Base):
    __tablename__ = "sop_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    sop_template_id: Mapped[int] = mapped_column(ForeignKey("sop_templates.id"))
    order: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(1000), default="")
    default_assignee_role: Mapped[str] = mapped_column(String(50), default="organizer")
    days_before_event: Mapped[int] = mapped_column(Integer, default=0)

    template: Mapped["SOPTemplate"] = relationship(back_populates="steps")
