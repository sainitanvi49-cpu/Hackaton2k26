# EcoAI — Air Quality Intelligence & Environmental Sustainability

A runnable student/hackathon MVP with a React + TypeScript frontend and FastAPI + SQLite backend.

## What works
- City search using Open-Meteo geocoding.
- Air-quality and weather forecasts from Open-Meteo (forecast values are clearly labeled as model forecasts, not ground observations).
- Hourly PM2.5 / PM10 charts and tomorrow's forecast summary.
- Transparent provisional EcoAI severity score.
- Citizen reports with image validation, SQLite persistence, and report-ID lookup.
- In-app alerts, a rule-based context-aware environmental assistant, and a provisional Green Priority Index demo grid.
- Admin demo endpoints for report review and intervention tasks.
- CSV exports, health endpoint, backend tests, and setup documentation.

## Important scope notes
This is a functional MVP, not a certified environmental monitoring system. It does not claim official CPCB AQI unless all required inputs and methodology are implemented. The Green Priority Index uses explicitly illustrative demo-grid inputs; replace these with verified local land-cover and site-survey data before operational use. The optional custom ML model is not trained by default, so no untrained predictions or fabricated metrics are shown. Sections 17–20 and 22 were absent from the supplied specification.

## Requirements
- Python 3.10+
- Node.js 20+
- Internet connection for Open-Meteo data (the app has a labeled demo fallback)

## Backend setup (Windows PowerShell)
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```
Backend API docs: http://localhost:8000/docs

## Frontend setup (new terminal)
```powershell
cd frontend
npm install
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

## Environment variables
Copy `backend/.env.example` to `backend/.env`.
- `DATABASE_URL`: defaults to local SQLite.
- `OPENAQ_API_KEY`: optional; not required for core operation.
- `UPLOAD_DIR`: defaults to `backend/uploads`.
- `CORS_ORIGINS`: comma-separated allowed frontend origins.
- `DEMO_MODE`: enables explicitly labeled fallback data when APIs fail.

## API endpoints
- `GET /api/health`
- `GET /api/locations/search?q=`
- `GET /api/air-quality?latitude=&longitude=`
- `GET /api/forecast?latitude=&longitude=`
- `GET /api/severity?latitude=&longitude=`
- `GET /api/green-priority?latitude=&longitude=`
- `POST /api/reports`, `GET /api/reports`, `GET /api/reports/{report_id}`
- `PATCH /api/admin/reports/{report_id}`
- `GET /api/alerts`, `POST /api/alerts/evaluate`, `PATCH /api/admin/alerts/{alert_id}`
- `POST /api/chat`
- `GET/POST/PATCH /api/admin/interventions`
- `GET /api/export/{reports|alerts|interventions}`

## Tests
```powershell
cd backend
pytest
```

## Notes
- Open-Meteo requests have timeouts and failures return a clear error or labeled demo values.
- Open-Meteo hourly values are forecasts. They are not direct station measurements.
- No API secrets are exposed in frontend code.
- Admin routes are marked as demo/admin MVP routes. Add proper authentication and authorization before deployment.
- OpenStreetMap tiles are used with attribution in the frontend.
