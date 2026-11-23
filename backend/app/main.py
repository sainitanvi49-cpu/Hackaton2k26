import csv, io, os, secrets
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from .database import Base, engine, get_db
from .models import CitizenReport, Alert, Intervention
from .schemas import ChatRequest, ReportUpdate, AlertUpdate, InterventionCreate, InterventionUpdate
from .services import geocode, fetch_environment, demo_environment, severity_score, green_priority_demo, chatbot_answer

Base.metadata.create_all(bind=engine)
app = FastAPI(title="EcoAI API", version="1.0.0", description="Air quality intelligence and sustainability MVP")
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "EcoAI API"}

@app.get("/api/locations/search")
async def locations_search(q: str):
    if len(q.strip()) < 2:
        return {"results": []}
    try:
        return {"results": await geocode(q)}
    except Exception:
        raise HTTPException(502, "Location search is temporarily unavailable. Please try again.")

@app.get("/api/air-quality")
async def air_quality(latitude: float, longitude: float):
    try:
        data = await fetch_environment(latitude, longitude)
    except Exception:
        if os.getenv("DEMO_MODE", "true").lower() == "true":
            data = demo_environment(latitude, longitude)
        else:
            raise HTTPException(503, "Air-quality provider unavailable and demo mode is disabled.")
    return data

@app.get("/api/forecast")
async def forecast(latitude: float, longitude: float):
    try:
        data = await fetch_environment(latitude, longitude)
    except Exception:
        if os.getenv("DEMO_MODE", "true").lower() == "true":
            data = demo_environment(latitude, longitude)
        else:
            raise HTTPException(503, "Forecast provider unavailable.")
    hourly = data["air"].get("hourly", {})
    return {"hourly": hourly, "weather": data["weather"].get("hourly", {}),
            "timezone": data["air"].get("timezone", "local"), "source": data["source"], "demo": data["demo"]}

@app.get("/api/severity")
async def severity(latitude: float, longitude: float):
    try:
        data = await fetch_environment(latitude, longitude)
    except Exception:
        data = demo_environment(latitude, longitude)
    h = data["air"]["hourly"]
    score = severity_score(h["pm2_5"][0] if h.get("pm2_5") else None, h["pm10"][0] if h.get("pm10") else None)
    return {**score, "source": data["source"], "data_type": "forecast"}

@app.get("/api/green-priority")
def green_priority(latitude: float = 0, longitude: float = 0):
    return {"results": green_priority_demo(), "method": "0.50 pollution + 0.30 vegetation deficit + 0.20 site suitability",
            "data_note": "Illustrative demo-grid only; not derived from local ESA raster data."}

@app.post("/api/reports")
async def create_report(title: str = Form(...), description: str = Form(...), category: str = Form(...),
                        latitude: float | None = Form(None), longitude: float | None = Form(None),
                        photo: UploadFile | None = File(None), db: Session = Depends(get_db)):
    if not title.strip() or not description.strip():
        raise HTTPException(422, "Title and description are required.")
    image_name = None
    if photo and photo.filename:
        if photo.content_type not in ALLOWED_TYPES:
            raise HTTPException(415, "Upload a JPG, PNG, or WEBP image.")
        content = await photo.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(413, "Image must be 5 MB or smaller.")
        # Check common file signatures rather than trusting filename or MIME alone.
        valid = (photo.content_type == "image/jpeg" and content.startswith(b"\xff\xd8")) or \
                (photo.content_type == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n")) or \
                (photo.content_type == "image/webp" and content.startswith(b"RIFF") and content[8:12] == b"WEBP")
        if not valid:
            raise HTTPException(415, "The uploaded file does not match its image type.")
        image_name = secrets.token_hex(16) + ALLOWED_TYPES[photo.content_type]
        (UPLOAD_DIR / image_name).write_bytes(content)
    code = "ECO-" + secrets.token_hex(4).upper()
    item = CitizenReport(report_code=code, title=title.strip(), description=description.strip(),
                         category=category, image_name=image_name, latitude=latitude, longitude=longitude)
    db.add(item); db.commit(); db.refresh(item)
    return {"report_id": code, "status": item.status, "message": "Report submitted. It remains unverified pending review."}

@app.get("/api/reports")
def list_reports(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(CitizenReport).order_by(CitizenReport.created_at.desc())
    if status: stmt = stmt.where(CitizenReport.status == status)
    items = db.scalars(stmt).all()
    return [{"report_id": x.report_code, "title": x.title, "category": x.category, "description": x.description,
             "status": x.status, "created_at": x.created_at, "latitude": x.latitude, "longitude": x.longitude,
             "admin_notes": x.admin_notes} for x in items]

@app.get("/api/reports/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_db)):
    x = db.scalar(select(CitizenReport).where(CitizenReport.report_code == report_id))
    if not x: raise HTTPException(404, "Report not found.")
    return {"report_id": x.report_code, "title": x.title, "category": x.category, "status": x.status,
            "created_at": x.created_at, "admin_notes": x.admin_notes}

@app.patch("/api/admin/reports/{report_id}")
def update_report(report_id: str, payload: ReportUpdate, db: Session = Depends(get_db)):
    allowed = {"Under Review", "Verified", "Rejected", "Resolved"}
    if payload.status not in allowed: raise HTTPException(422, "Invalid report status.")
    x = db.scalar(select(CitizenReport).where(CitizenReport.report_code == report_id))
    if not x: raise HTTPException(404, "Report not found.")
    x.status, x.admin_notes = payload.status, payload.admin_notes
    db.commit()
    return {"report_id": x.report_code, "status": x.status}

@app.get("/api/alerts")
def list_alerts(db: Session = Depends(get_db)):
    return [{"id": x.id, "location": x.location, "level": x.level, "condition": x.condition,
             "explanation": x.explanation, "source": x.source, "status": x.status, "created_at": x.created_at}
            for x in db.scalars(select(Alert).order_by(Alert.created_at.desc())).all()]

@app.post("/api/alerts/evaluate")
async def evaluate_alert(latitude: float, longitude: float, location: str = "Selected location", db: Session = Depends(get_db)):
    try: data = await fetch_environment(latitude, longitude)
    except Exception: data = demo_environment(latitude, longitude)
    h = data["air"]["hourly"]
    pm = h.get("pm2_5", [None])[0]
    if pm is None or pm < 35:
        return {"created": False, "reason": "No configured PM2.5 alert threshold crossed.", "source": data["source"]}
    existing = db.scalar(select(Alert).where(Alert.location == location, Alert.status == "Unacknowledged"))
    if existing:
        return {"created": False, "reason": "An unacknowledged alert already exists for this location."}
    item = Alert(location=location, level="Warning" if pm < 55 else "High priority",
                 condition=f"PM2.5 forecast: {pm} µg/m³", explanation="Configured PM2.5 threshold crossed. This is forecast-based, not a station observation.",
                 source=data["source"])
    db.add(item); db.commit(); db.refresh(item)
    return {"created": True, "alert_id": item.id, "source": data["source"]}

@app.patch("/api/admin/alerts/{alert_id}")
def update_alert(alert_id: int, payload: AlertUpdate, db: Session = Depends(get_db)):
    x = db.get(Alert, alert_id)
    if not x: raise HTTPException(404, "Alert not found.")
    if payload.status not in {"Acknowledged", "Resolved"}: raise HTTPException(422, "Invalid alert status.")
    x.status = payload.status; db.commit()
    return {"id": x.id, "status": x.status}

@app.post("/api/chat")
def chat(payload: ChatRequest):
    return chatbot_answer(payload)

@app.get("/api/admin/interventions")
def list_interventions(db: Session = Depends(get_db)):
    return [vars_clean(x) for x in db.scalars(select(Intervention).order_by(Intervention.created_at.desc())).all()]

def vars_clean(x):
    return {"id": x.id, "title": x.title, "location": x.location, "description": x.description,
            "priority": x.priority, "assignee": x.assignee, "due_date": x.due_date, "status": x.status}

@app.post("/api/admin/interventions")
def create_intervention(payload: InterventionCreate, db: Session = Depends(get_db)):
    x = Intervention(**payload.model_dump())
    db.add(x); db.commit(); db.refresh(x)
    return vars_clean(x)

@app.patch("/api/admin/interventions/{task_id}")
def update_intervention(task_id: int, payload: InterventionUpdate, db: Session = Depends(get_db)):
    x = db.get(Intervention, task_id)
    if not x: raise HTTPException(404, "Intervention not found.")
    x.status = payload.status; db.commit()
    return vars_clean(x)

@app.delete("/api/admin/interventions/{task_id}")
def delete_intervention(task_id: int, db: Session = Depends(get_db)):
    x = db.get(Intervention, task_id)

    if not x:
        raise HTTPException(404, "Intervention not found.")

    db.delete(x)
    db.commit()

    return {"message": "Intervention deleted successfully"}
@app.get("/api/export/{kind}")
def export_csv(kind: str, db: Session = Depends(get_db)):
    mapping = {"reports": (CitizenReport, ["report_code","title","category","status","created_at","latitude","longitude"]),
               "alerts": (Alert, ["id","location","level","condition","status","created_at"]),
               "interventions": (Intervention, ["id","title","location","priority","assignee","due_date","status"])}
    if kind not in mapping: raise HTTPException(404, "Unknown export type.")
    model, fields = mapping[kind]
    output = io.StringIO(); writer = csv.writer(output); writer.writerow(fields)
    for item in db.scalars(select(model)).all(): writer.writerow([getattr(item, f) for f in fields])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="ecoai-{kind}.csv"'})
