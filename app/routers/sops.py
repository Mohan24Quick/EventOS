from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import require_roles
from app.models.user import User
from app.models.sop import SOPTemplate, SOPStep
from app.schemas.sop import SOPTemplateCreate, SOPTemplateOut

router = APIRouter(prefix="/sops", tags=["sops"])


@router.post("", response_model=SOPTemplateOut, status_code=201)
def create_sop(
    payload: SOPTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "organizer")),
):
    template = SOPTemplate(name=payload.name, category=payload.category, description=payload.description)
    db.add(template)
    db.flush()

    for step in payload.steps:
        db.add(SOPStep(sop_template_id=template.id, **step.model_dump()))

    db.commit()
    db.refresh(template)
    return template


@router.get("", response_model=list[SOPTemplateOut])
def list_sops(category: str | None = None, db: Session = Depends(get_db)):
    q = db.query(SOPTemplate)
    if category:
        q = q.filter(SOPTemplate.category == category)
    return q.all()


@router.get("/{sop_id}", response_model=SOPTemplateOut)
def get_sop(sop_id: int, db: Session = Depends(get_db)):
    template = db.query(SOPTemplate).filter(SOPTemplate.id == sop_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="SOP template not found")
    return template
