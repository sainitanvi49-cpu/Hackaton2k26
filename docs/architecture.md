# Architecture

React + Vite frontend communicates with FastAPI through `/api/*`. FastAPI owns external API requests, validation, SQLite persistence, file validation, custom scoring, and rule-based chatbot logic.

External services:
- Open-Meteo Geocoding API
- Open-Meteo Air Quality API
- Open-Meteo Weather Forecast API

Persistence:
- SQLite tables: citizen_reports, alerts, interventions.
- Uploaded images are restricted to JPEG/PNG/WEBP, checked by signature and size, and stored under a server-generated filename.

Trust boundaries:
- Forecast data is not an observation.
- Citizen submissions are unverified until reviewed.
- Severity is custom and provisional, not official AQI.
- Green priority demo rows are not real site recommendations.
- Admin routes are demonstration controls and require authentication before deployment.
