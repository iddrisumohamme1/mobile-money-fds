from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .decision_engine import FraudDecisionEngine
from .schemas import PredictRequest, PredictResponse
from .services.feature_store import FeatureStore
from .services.model_service import FraudModelService

app = FastAPI(title="Mobile Money Fraud Detection Engine", version="0.1.0")

# Stateless JSON API: no cookies/session auth, so credentials are never needed.
# Restrict to explicit origins in production via CORS_ORIGINS (comma-separated);
# default stays open for local development only.
_cors_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

feature_store = FeatureStore()
model_service = FraudModelService()
decision_engine = FraudDecisionEngine(feature_store, model_service)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    result = decision_engine.evaluate(payload)
    return PredictResponse(**result)
