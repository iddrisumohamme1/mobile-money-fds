from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Dict

from .schemas import PredictRequest, PredictResult
from .services.feature_store import FeatureStore
from .services.model_service import FraudModelService

MODEL_BLEND_WEIGHT = float(os.getenv("FRAUD_MODEL_BLEND_WEIGHT", "0.5"))


class FraudDecisionEngine:
    def __init__(
        self, feature_store: FeatureStore, model_service: FraudModelService | None = None
    ) -> None:
        self.feature_store = feature_store
        self.model_service = model_service

    def evaluate(self, payload: PredictRequest) -> PredictResult:
        timestamp = datetime.now(timezone.utc).timestamp()
        self.feature_store.record(payload.sender_phone, float(payload.amount), timestamp)

        snapshot = self.feature_store.get_behavioral_snapshot(payload.sender_phone, float(payload.amount))

        model_risk: float | None = None
        if self.model_service is not None:
            model_risk = self.model_service.predict(
                payload.sender_phone,
                payload.recipient_phone,
                float(payload.amount),
                payload.currency,
            )

        heuristic_score = self._heuristic_score(snapshot, payload)
        if model_risk is None:
            risk_score = heuristic_score
        else:
            # The trained model is a weak signal (its P(fraud) never exceeds ~0.24),
            # so we fuse it as an additive boost over the heuristic baseline.
            risk_score = round(min(0.99, heuristic_score + MODEL_BLEND_WEIGHT * model_risk), 4)

        triage_status, action, reason = self._triage(risk_score)

        # PredictResponse.behavioral_features is numeric-only, so the currency
        # string is intentionally excluded from the response payload.
        features: Dict[str, float] = {
            "tx_velocity_1h": snapshot["tx_velocity_1h"],
            "tx_velocity_24h": snapshot["tx_velocity_24h"],
            "tx_velocity_7d": snapshot["tx_velocity_7d"],
            "amount_mean": snapshot["amount_mean"],
            "amount_std": snapshot["amount_std"],
            "amount_zscore": snapshot["amount_zscore"],
            "sender_phone_length": len(payload.sender_phone),
            "recipient_phone_length": len(payload.recipient_phone),
            "amount": float(payload.amount),
            "risk_score": risk_score,
        }

        return {
            "status": "SUCCESS",
            "transaction_reference": payload.transaction_reference,
            "risk_score": risk_score,
            "triage_status": triage_status,
            "action": action,
            "reason": reason,
            "behavioral_features": features,
            "model_used": model_risk is not None,
            "model_score": model_risk,
            "heuristic_score": heuristic_score,
        }

    @staticmethod
    def _heuristic_score(snapshot: Dict[str, float], payload: PredictRequest) -> float:
        velocity_component = min(snapshot["tx_velocity_1h"] / 12.0, 0.35)
        zscore_component = min(max(snapshot["amount_zscore"], 0.0) / 8.0, 0.25)
        recipient_component = min(abs(len(payload.sender_phone) - len(payload.recipient_phone)) / 12.0, 0.10)
        amount_component = min(float(payload.amount) / 25000.0, 0.20)
        return round(
            min(0.99, velocity_component + zscore_component + recipient_component + amount_component),
            4,
        )

    @staticmethod
    def _triage(risk_score: float) -> tuple[str, str, str]:
        if risk_score < 0.30:
            return "APPROVED", "AUTO_PASS", "Low risk probability under threshold."
        if risk_score < 0.75:
            return "REVIEW", "MFA_STEP_UP", "Medium risk probability. Route to analyst queue or initiate OTP challenge."
        return "BLOCKED", "HARD_BLOCK", "High risk probability. Freeze wallet and flag recipient node."
