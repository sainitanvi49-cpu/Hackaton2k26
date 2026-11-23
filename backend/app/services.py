import httpx
from datetime import date, timedelta
from typing import Any

AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"

async def geocode(query: str):
    async with httpx.AsyncClient(timeout=12) as client:
        r = await client.get(GEO_URL, params={"name": query, "count": 8, "language": "en", "format": "json"})
        r.raise_for_status()
        return r.json().get("results", [])

async def fetch_environment(latitude: float, longitude: float) -> dict[str, Any]:
    today = date.today()
    params = {
        "latitude": latitude, "longitude": longitude,
        "hourly": "pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide",
        "forecast_days": 2, "timezone": "auto"
    }
    weather_params = {
        "latitude": latitude, "longitude": longitude,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation",
        "forecast_days": 2, "timezone": "auto"
    }
    async with httpx.AsyncClient(timeout=18) as client:
        air_r, weather_r = await client.get(AIR_URL, params=params), await client.get(WEATHER_URL, params=weather_params)
        air_r.raise_for_status()
        weather_r.raise_for_status()
        return {"air": air_r.json(), "weather": weather_r.json(), "source": "Open-Meteo model forecast", "demo": False}

def demo_environment(latitude: float, longitude: float):
    # Explicitly labeled illustrative fallback; never presented as live measurements.
    now = date.today()
    times = [f"{now.isoformat()}T{h:02d}:00" for h in range(24)] + [
        f"{(now + timedelta(days=1)).isoformat()}T{h:02d}:00" for h in range(24)
    ]
    pm25 = [24 + (h % 9) * 2 for h in range(48)]
    pm10 = [42 + (h % 7) * 3 for h in range(48)]
    return {
        "air": {"timezone": "Asia/Kolkata", "hourly": {"time": times, "pm2_5": pm25, "pm10": pm10,
            "ozone": [35]*48, "nitrogen_dioxide": [18]*48, "sulphur_dioxide": [5]*48, "carbon_monoxide": [180]*48}},
        "weather": {"hourly": {"time": times, "temperature_2m": [22]*48, "relative_humidity_2m": [55]*48,
            "wind_speed_10m": [8]*48, "wind_direction_10m": [240]*48, "precipitation": [0]*48}},
        "source": "Illustrative demo data — not live measurements", "demo": True
    }

def severity_score(pm25: float | None, pm10: float | None):
    # Simple provisional concentration indicator, not official AQI.
    values = []
    if pm25 is not None:
        values.append(min(100, pm25 / 75 * 100))
    if pm10 is not None:
        values.append(min(100, pm10 / 150 * 100))
    if not values:
        return {"score": None, "category": "Unavailable", "provisional": True, "method": "No pollutant inputs"}
    pollution = sum(values) / len(values)
    score = round(pollution, 1)
    category = "Low" if score < 20 else "Moderate" if score < 40 else "Elevated" if score < 60 else "High" if score < 80 else "Critical"
    return {"score": score, "category": category, "provisional": True,
            "method": "Available PM concentrations normalized to illustrative reference levels; not CPCB AQI."}

def green_priority_demo():
    # Demonstration-only cells; not a real site suitability assessment.
    rows = []
    for i, (name, pollution, vegetation_deficit, suitability) in enumerate([
        ("Demo Zone A", 82, 75, 55), ("Demo Zone B", 68, 88, 42), ("Demo Zone C", 55, 48, 80)
    ], 1):
        score = round(.5*pollution + .3*vegetation_deficit + .2*suitability, 1)
        rows.append({"id": i, "location": name, "score": score, "pollution_priority": pollution,
                     "vegetation_deficit": vegetation_deficit, "site_suitability": suitability,
                     "label": "Illustrative sample — requires site survey"})
    return sorted(rows, key=lambda x: x["score"], reverse=True)

def chatbot_answer(req):
    msg = req.message.lower()
    if any(k in msg for k in ["pm2.5", "pm 2.5", "pm10", "difference"]):
        answer = "PM2.5 refers to fine particles 2.5 micrometres or smaller; PM10 includes particles up to 10 micrometres. Smaller particles can remain airborne and penetrate deeper into the respiratory system."
    elif "severity" in msg or "score" in msg:
        answer = f"The current provisional EcoAI severity score for {req.location} is {req.severity if req.severity is not None else 'unavailable'}. It is a custom indicator based on available PM2.5/PM10 inputs, not an official AQI."
    elif "tomorrow" in msg or "forecast" in msg:
        answer = f"For {req.location}, the available forecast context is: {req.forecast_summary or 'not supplied'}. Forecasts are model outputs, not direct station observations."
    elif "why" in msg or "worsen" in msg:
        answer = f"For {req.location}, the app has PM2.5={req.pm25 if req.pm25 is not None else 'unavailable'} and PM10={req.pm10 if req.pm10 is not None else 'unavailable'}. Weather, emissions, and atmospheric mixing can influence concentrations, but these values alone do not identify a specific pollution source or prove a cause."
    elif "report" in msg:
        answer = "Use the Citizen Report section to submit the issue type, a short description, and an optional photo/location. Reports remain unverified until an administrator reviews them."
    else:
        answer = "I can explain PM2.5 vs PM10, interpret the selected location's available forecast and provisional severity score, describe weather influences, or explain how to submit a citizen report. Ask about one of these topics for a data-grounded response."
    return {"answer": answer, "context_location": req.location, "mode": "Rule-based assistant", "source_note": "Uses supplied dashboard context; no paid LLM required."}
