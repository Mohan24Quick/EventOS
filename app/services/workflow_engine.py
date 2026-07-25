"""
The workflow engine: the heart of the product.

Any part of the app can call `emit_event(db, "some.event", context)`.
The engine looks up active WorkflowTrigger rows matching that event_name
and executes their configured action. This is intentionally simple
(no external queue) for the MVP -- it runs synchronously in-process.
Swap for Celery/SQS-backed async execution once volume requires it.

Supported event_names emitted by the app today:
  - "event.created"            context: {event_id}
  - "quotation.accepted"       context: {event_id, vendor_id, quotation_id}
  - "task.status_changed"      context: {event_id, task_id, status}

Supported action_types:
  - create_tasks_from_sop  action_config: {"sop_category": "wedding"} or {"sop_template_id": 3}
  - send_notification      action_config: {"message": "...", "to": "organizer"|"client"|"vendor"}
  - update_event_status    action_config: {"status": "planning"}
"""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.workflow import WorkflowTrigger, Notification, ActionType
from app.models.sop import SOPTemplate
from app.models.task import Task
from app.models.event import Event, EventStatus


def emit_event(db: Session, event_name: str, context: dict) -> list[dict]:
    """Find and run all active triggers matching event_name. Returns a log of actions taken."""
    triggers = (
        db.query(WorkflowTrigger)
        .filter(WorkflowTrigger.event_name == event_name, WorkflowTrigger.is_active.is_(True))
        .all()
    )
    results = []
    for trigger in triggers:
        outcome = _run_action(db, trigger, context)
        results.append({"trigger": trigger.name, "outcome": outcome})
    db.commit()
    return results


def _run_action(db: Session, trigger: WorkflowTrigger, context: dict) -> str:
    config = trigger.action_config or {}

    if trigger.action_type == ActionType.CREATE_TASKS_FROM_SOP:
        return _create_tasks_from_sop(db, config, context)

    if trigger.action_type == ActionType.SEND_NOTIFICATION:
        return _send_notification(db, config, context)

    if trigger.action_type == ActionType.UPDATE_EVENT_STATUS:
        return _update_event_status(db, config, context)

    return "no-op: unknown action_type"


def _create_tasks_from_sop(db: Session, config: dict, context: dict) -> str:
    event_id = context.get("event_id")
    if not event_id:
        return "skipped: no event_id in context"

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return "skipped: event not found"

    template = None
    if config.get("sop_template_id"):
        template = db.query(SOPTemplate).filter(SOPTemplate.id == config["sop_template_id"]).first()
    elif config.get("sop_category"):
        template = db.query(SOPTemplate).filter(SOPTemplate.category == config["sop_category"]).first()

    if not template:
        return "skipped: no matching SOP template"

    assignee_id = context.get("vendor_id") or event.organizer_id

    created = 0
    for step in template.steps:
        due = event.event_date - timedelta(days=step.days_before_event) if event.event_date else None
        task = Task(
            event_id=event.id,
            title=step.title,
            description=step.description,
            assignee_id=assignee_id,
            due_date=due,
            sop_step_id=step.id,
            order=step.order,
        )
        db.add(task)
        created += 1

    return f"created {created} tasks from SOP '{template.name}'"


def _send_notification(db: Session, config: dict, context: dict) -> str:
    target_role = config.get("to", "organizer")
    user_id = context.get(f"{target_role}_id")

    # Fall back to resolving client_id/organizer_id from the event itself,
    # since not every emitted context carries every role's id.
    if not user_id and context.get("event_id") and target_role in ("client", "organizer"):
        event = db.query(Event).filter(Event.id == context["event_id"]).first()
        if event:
            user_id = getattr(event, f"{target_role}_id", None)

    if not user_id:
        return f"skipped: no {target_role}_id in context"

    message = config.get("message", "You have an update.")
    notif = Notification(user_id=user_id, message=message, channel=config.get("channel", "in_app"))
    db.add(notif)
    return f"notified user {user_id}"


def _update_event_status(db: Session, config: dict, context: dict) -> str:
    event_id = context.get("event_id")
    new_status = config.get("status")
    if not (event_id and new_status):
        return "skipped: missing event_id or status"

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return "skipped: event not found"

    event.status = EventStatus(new_status)
    return f"event {event_id} status -> {new_status}"
