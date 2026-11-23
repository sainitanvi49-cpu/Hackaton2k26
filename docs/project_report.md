# EcoAI — Project Report

## Problem
Air-quality information is distributed across data providers and is difficult for nontechnical users to interpret. EcoAI combines location-based forecast data, transparent indicators, citizen reporting, and environmental action tracking in one dashboard.

## Objectives
1. Retrieve air-quality and weather forecasts for selected coordinates.
2. Explain pollutant concentrations and forecast uncertainty.
3. Calculate a transparent custom severity indicator.
4. Collect and review citizen environmental reports.
5. Track alerts and proposed interventions.
6. Demonstrate a Green Priority Index workflow.

## Data and methodology
The core live integration uses Open-Meteo Air Quality and Weather forecast APIs. Values are labeled as model forecasts rather than direct ground measurements. If the provider is unavailable and demo mode is enabled, the app returns visibly labeled illustrative values. The severity score is a provisional custom concentration indicator and is not CPCB AQI. Green Priority rows are illustrative demo-grid data and require local geospatial datasets and site surveys for operational use.

## Limitations
No validated historical station archive, trained ML model, official CPCB AQI implementation, production authentication, email/SMS delivery, or live ESA WorldCover raster processing is included in this MVP. These must be added and validated before operational deployment.
