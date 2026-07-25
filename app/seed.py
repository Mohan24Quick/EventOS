"""
Seed script: creates demo users, an SOP template, and a workflow trigger
so you can exercise the full flow immediately after starting the app.

Run with:  python -m app.seed
"""
from app.database import SessionLocal, Base, engine
from app import models  # noqa: F401
from app.models.user import User, VendorProfile, UserRole
from app.models.sop import SOPTemplate, SOPStep
from app.models.workflow import WorkflowTrigger, ActionType
from app.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    if db.query(User).filter(User.email == "admin@eventos.dev").first():
        print("Seed data already present, skipping.")
    else:
        admin = User(name="Admin", email="admin@eventos.dev", hashed_password=hash_password("password123"), role=UserRole.ADMIN)
        organizer = User(name="Priya Organizer", email="organizer@eventos.dev", hashed_password=hash_password("password123"), role=UserRole.ORGANIZER)
        client = User(name="Rahul Client", email="client@eventos.dev", hashed_password=hash_password("password123"), role=UserRole.CLIENT)
        vendor_user = User(name="Sunrise Caterers", email="vendor@eventos.dev", hashed_password=hash_password("password123"), role=UserRole.VENDOR)
        db.add_all([admin, organizer, client, vendor_user])
        db.flush()

        db.add(VendorProfile(user_id=vendor_user.id, business_name="Sunrise Caterers", category="catering", service_areas="Chennai, Tirupporur"))

        # SOP template for weddings -- fires when an event is created
        wedding_sop = SOPTemplate(name="Wedding Planning Checklist", category="wedding", description="Default checklist for wedding events")
        db.add(wedding_sop)
        db.flush()
        db.add_all([
            SOPStep(sop_template_id=wedding_sop.id, order=1, title="Confirm venue booking", days_before_event=90, default_assignee_role="organizer"),
            SOPStep(sop_template_id=wedding_sop.id, order=2, title="Shortlist and assign vendors", days_before_event=75, default_assignee_role="organizer"),
            SOPStep(sop_template_id=wedding_sop.id, order=3, title="Send quotations to client", days_before_event=60, default_assignee_role="organizer"),
            SOPStep(sop_template_id=wedding_sop.id, order=4, title="Collect advance payment", days_before_event=45, default_assignee_role="organizer"),
            SOPStep(sop_template_id=wedding_sop.id, order=5, title="Final headcount confirmation", days_before_event=7, default_assignee_role="organizer"),
        ])

        # SOP template specific to catering vendors -- fires when a quotation is accepted
        catering_sop = SOPTemplate(name="Catering Vendor Checklist", category="catering", description="Steps a caterer follows once booked")
        db.add(catering_sop)
        db.flush()
        db.add_all([
            SOPStep(sop_template_id=catering_sop.id, order=1, title="Confirm menu with client", days_before_event=30, default_assignee_role="vendor"),
            SOPStep(sop_template_id=catering_sop.id, order=2, title="Order raw materials", days_before_event=5, default_assignee_role="vendor"),
            SOPStep(sop_template_id=catering_sop.id, order=3, title="Staff and logistics allocation", days_before_event=2, default_assignee_role="vendor"),
        ])

        # Trigger: event created -> generate the wedding checklist automatically
        db.add(WorkflowTrigger(
            name="Auto-create wedding checklist",
            event_name="event.created",
            action_type=ActionType.CREATE_TASKS_FROM_SOP,
            action_config={"sop_category": "wedding"},
        ))

        # Trigger: quotation accepted -> generate vendor-specific checklist + notify client
        db.add(WorkflowTrigger(
            name="Auto-create catering checklist on acceptance",
            event_name="quotation.accepted",
            action_type=ActionType.CREATE_TASKS_FROM_SOP,
            action_config={"sop_category": "catering"},
        ))
        db.add(WorkflowTrigger(
            name="Notify client of vendor confirmation",
            event_name="quotation.accepted",
            action_type=ActionType.SEND_NOTIFICATION,
            action_config={"to": "client", "message": "Your vendor has been confirmed and their checklist is underway."},
        ))

        db.commit()
        print("Seed data created.")
        print("Login as: admin@eventos.dev / organizer@eventos.dev / client@eventos.dev / vendor@eventos.dev (password: password123)")
finally:
    db.close()
