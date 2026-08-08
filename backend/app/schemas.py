from __future__ import annotations

from decimal import Decimal
from typing import Dict, TypedDict

from pydantic import BaseModel, Field, field_validator


class PredictRequest(BaseModel):
    transaction_reference: str = Field(..., min_length=3)
    sender_phone: str = Field(..., min_length=8)
    recipient_phone: str = Field(..., min_length=8)
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="GHS", min_length=3, max_length=5)

    @field_validator("sender_phone", "recipient_phone")
    @classmethod
    def sanitize_phone(cls, value: str) -> str:
        return value.strip().replace(" ", "")


class PredictResponse(BaseModel):
    status: str
    transaction_reference: str
    risk_score: float
    triage_status: str
    action: str
    reason: str
    model_used: bool = False
    model_score: float | None = None
    heuristic_score: float | None = None
    behavioral_features: Dict[str, float] = {}


class PredictResult(TypedDict):
    status: str
    transaction_reference: str
    risk_score: float
    triage_status: str
    action: str
    reason: str
    model_used: bool
    model_score: float | None
    heuristic_score: float | None
    behavioral_features: Dict[str, float]
