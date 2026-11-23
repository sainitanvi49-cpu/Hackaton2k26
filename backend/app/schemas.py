from pydantic import BaseModel, Field
from typing import Optional

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    location: str = "Selected location"
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    severity: Optional[float] = None
    forecast_summary: Optional[str] = None

class ReportUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None

class AlertUpdate(BaseModel):
    status: str

class InterventionCreate(BaseModel):
    title: str
    location: str
    description: str
    priority: str = "Medium"
    assignee: Optional[str] = None
    due_date: Optional[str] = None

class InterventionUpdate(BaseModel):
    status: str
