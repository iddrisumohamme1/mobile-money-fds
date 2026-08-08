from __future__ import annotations

from collections import defaultdict, deque
from statistics import mean, pstdev
from typing import Deque, Dict, List


class FeatureStore:
    """Lightweight in-memory feature store that mimics a Redis sliding-window design."""

    def __init__(self, window_minutes: int = 60) -> None:
        self.window_minutes = window_minutes
        self.sender_history: Dict[str, Deque[Dict[str, float]]] = defaultdict(deque)
        self.sender_amounts: Dict[str, Deque[float]] = defaultdict(deque)

    def record(self, sender_phone: str, amount: float, timestamp: float) -> None:
        self.sender_history[sender_phone].append({"ts": timestamp, "amount": amount})
        self.sender_amounts[sender_phone].append(amount)

        cutoff = timestamp - (self.window_minutes * 60)
        while self.sender_history[sender_phone] and self.sender_history[sender_phone][0]["ts"] < cutoff:
            self.sender_history[sender_phone].popleft()

        while self.sender_amounts[sender_phone] and len(self.sender_amounts[sender_phone]) > 1000:
            self.sender_amounts[sender_phone].popleft()

    def get_behavioral_snapshot(self, sender_phone: str, amount: float) -> Dict[str, float]:
        history = list(self.sender_history[sender_phone])
        amounts = list(self.sender_amounts[sender_phone])

        if not history:
            return {
                "tx_velocity_1h": 0.0,
                "tx_velocity_24h": 0.0,
                "tx_velocity_7d": 0.0,
                "amount_mean": 0.0,
                "amount_std": 0.0,
                "amount_zscore": 0.0,
                "geo_velocity_kmh": 0.0,
                "device_change_rate": 0.0,
                "recipient_repeat_rate": 0.0,
                "network_growth_rate": 0.0,
                "balance_delta_ratio": 0.0,
            }

        amounts_mean = mean(amounts)
        amounts_std = pstdev(amounts) if len(amounts) > 1 else 0.0
        zscore = (amount - amounts_mean) / (amounts_std + 1e-6)

        return {
            "tx_velocity_1h": float(len(history)),
            "tx_velocity_24h": float(len(history) * 1.5),
            "tx_velocity_7d": float(len(history) * 3.5),
            "amount_mean": float(amounts_mean),
            "amount_std": float(amounts_std),
            "amount_zscore": float(zscore),
            "geo_velocity_kmh": 0.0,
            "device_change_rate": 0.0,
            "recipient_repeat_rate": 0.0,
            "network_growth_rate": 0.0,
            "balance_delta_ratio": 0.0,
        }
