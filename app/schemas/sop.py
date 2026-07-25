from pydantic import BaseModel


class SOPStepIn(BaseModel):
    order: int = 0
    title: str
    description: str = ""
    default_assignee_role: str = "organizer"
    days_before_event: int = 0


class SOPTemplateCreate(BaseModel):
    name: str
    category: str
    description: str = ""
    steps: list[SOPStepIn] = []


class SOPStepOut(SOPStepIn):
    id: int

    model_config = {"from_attributes": True}


class SOPTemplateOut(BaseModel):
    id: int
    name: str
    category: str
    description: str
    steps: list[SOPStepOut]

    model_config = {"from_attributes": True}
