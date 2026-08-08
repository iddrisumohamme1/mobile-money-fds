from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Optional

MODEL_PATH = os.getenv(
    "FRAUD_MODEL_PATH",
    str(
        Path(__file__).resolve().parent.parent.parent
        / "model"
        / "random_forest_smote_engineered_features.joblib"
    ),
)

TYPE_ORDER = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]
DEFAULT_TYPE = os.getenv("FRAUD_MODEL_DEFAULT_TYPE", "TRANSFER")


class _AccountState:
    """Rolling state for a PaySim-style account id.

    Mirrors the running aggregates the notebook built over the training set
    (dest_total_transactions_count, orig/dest mean & std amounts, sequential
    time/amount deltas) so live predictions share the same semantics.
    """

    def __init__(self) -> None:
        self.tx_count = 0
        self.sum_amount = 0.0
        self.sum_sq_amount = 0.0
        self.balance = 0.0
        self.last_step: Optional[int] = None
        self.last_amount: Optional[float] = None
        self.senders: set = set()


class FraudModelService:
    """Serves the trained RandomForest (SMOTE) pipeline.

    The joblib stores no ``feature_names_in_``, so this service reproduces the
    exact 30-column vector (25 engineered numerics + 5 one-hot ``type`` bits)
    built by ``backend/model/Fraud.ipynb`` cells 25-41. Phone numbers are
    treated as PaySim account ids.
    """

    def __init__(self, model_path: str = MODEL_PATH) -> None:
        self._model_path = model_path
        self._pipeline = None
        self._load_attempted = False
        self._orig: Dict[str, _AccountState] = {}
        self._dest: Dict[str, _AccountState] = {}
        self._type_stats: Dict[str, Dict[str, float]] = {}
        self._step = 0

    @property
    def available(self) -> bool:
        return self._load() is not None

    def _load(self):
        if not self._load_attempted:
            self._load_attempted = True
            try:
                import warnings

                import joblib

                if os.path.exists(self._model_path):
                    # The pickled pipeline was re-saved with the pinned sklearn
                    # (see backend/requirements.txt). Tolerate residual version-
                    # drift / numpy deprecation warnings raised while unpickling
                    # instead of letting them escalate (e.g. under -W error) and
                    # silently disable the model.
                    try:
                        from sklearn.exceptions import InconsistentVersionWarning
                    except ImportError:
                        InconsistentVersionWarning = None

                    with warnings.catch_warnings():
                        if InconsistentVersionWarning is not None:
                            warnings.simplefilter("ignore", InconsistentVersionWarning)
                        warnings.simplefilter("ignore", DeprecationWarning)
                        self._pipeline = joblib.load(self._model_path)
                else:
                    print(f"[FraudModelService] model not found: {self._model_path}")
            except Exception as exc:  # pragma: no cover - defensive fallback path
                print(f"[FraudModelService] failed to load model: {exc}")
                self._pipeline = None
        return self._pipeline

    def reset(self) -> None:
        self._orig.clear()
        self._dest.clear()
        self._type_stats.clear()
        self._step = 0

    def predict(
        self,
        sender_phone: str,
        recipient_phone: str,
        amount: float,
        currency: str,
        transaction_type: Optional[str] = None,
    ) -> Optional[float]:
        """Return P(fraud) in [0, 1], or None if the model is unavailable."""
        pipeline = self._load()
        if pipeline is None:
            return None

        tx_type = (transaction_type or DEFAULT_TYPE).upper()
        features = self._build_features(sender_phone, recipient_phone, amount, tx_type)

        import numpy as np

        proba = pipeline.predict_proba(np.asarray([features], dtype=np.float64))
        risk = float(proba[0, 1])

        self._update_state(sender_phone, recipient_phone, amount, tx_type)
        return risk

    def _build_features(self, sender: str, recipient: str, amount: float, tx_type: str) -> List[float]:
        orig = self._orig.setdefault(sender, _AccountState())
        dest = self._dest.setdefault(recipient, _AccountState())
        tstat = self._type_stats.setdefault(tx_type, {"count": 0.0, "sum": 0.0, "sum_sq": 0.0})

        step = float(self._step + 1)
        t_mean, t_std = self._stats(tstat)
        o_mean, o_std = self._stats(orig)
        d_mean, d_std = self._stats(dest)

        old_balance_orig = orig.balance
        new_balance_orig = max(0.0, orig.balance - amount)
        old_balance_dest = dest.balance
        new_balance_dest = dest.balance + amount

        dest_balance_after = old_balance_dest + amount
        orig_balance_diff = old_balance_orig - new_balance_orig
        dest_balance_anomaly = new_balance_dest - dest_balance_after

        features = [
            step,  # 1. step
            amount,  # 2. amount
            old_balance_orig,  # 3. oldbalanceOrg
            new_balance_orig,  # 4. newbalanceOrig
            old_balance_dest,  # 5. oldbalanceDest
            new_balance_dest,  # 6. newbalanceDest
            step % 24,  # 7. time_window
            float(orig.tx_count + 1),  # 8. orig_transactions_count
            float(dest.tx_count + 1),  # 9. dest_transactions_count
            amount - t_mean,  # 10. amount_vs_type_mean
            self._z(amount, t_mean, t_std),  # 11. amount_vs_type_zscore
            amount - o_mean,  # 12. amount_vs_orig_mean
            self._z(amount, o_mean, o_std),  # 13. amount_vs_orig_zscore
            amount - d_mean,  # 14. amount_vs_dest_mean
            self._z(amount, d_mean, d_std),  # 15. amount_vs_dest_zscore
            float(len(dest.senders)),  # 16. dest_unique_orig_count
            float(dest.tx_count + 1),  # 17. dest_total_transactions_count
            orig_balance_diff,  # 18. orig_balance_diff
            dest_balance_anomaly,  # 19. dest_balance_anomaly
            float(int(old_balance_orig == 0 and new_balance_orig == 0 and amount != 0)),  # 20.
            float(
                int(
                    old_balance_dest == 0
                    and new_balance_dest == 0
                    and amount != 0
                    and tx_type == "TRANSFER"
                )
            ),  # 21. is_dest_bal_zero_and_amount_not_zero
            0.0 if orig.last_step is None else step - orig.last_step,  # 22. time_since_last_orig_txn
            0.0 if orig.last_amount is None else amount - orig.last_amount,  # 23. amount_change_orig
            0.0 if dest.last_step is None else step - dest.last_step,  # 24. time_since_last_dest_txn
            0.0 if dest.last_amount is None else amount - dest.last_amount,  # 25. amount_change_dest
        ]

        one_hot = [0.0] * len(TYPE_ORDER)
        one_hot[TYPE_ORDER.index(tx_type)] = 1.0
        return features + one_hot

    def _update_state(self, sender: str, recipient: str, amount: float, tx_type: str) -> None:
        self._step += 1
        orig = self._orig[sender]
        dest = self._dest[recipient]
        tstat = self._type_stats[tx_type]

        orig.balance = max(0.0, orig.balance - amount)
        orig.tx_count += 1
        orig.sum_amount += amount
        orig.sum_sq_amount += amount * amount
        orig.last_step = self._step
        orig.last_amount = amount

        dest.balance = dest.balance + amount
        dest.tx_count += 1
        dest.sum_amount += amount
        dest.sum_sq_amount += amount * amount
        dest.senders.add(sender)
        dest.last_step = self._step
        dest.last_amount = amount

        tstat["count"] += 1.0
        tstat["sum"] += amount
        tstat["sum_sq"] += amount * amount

    @staticmethod
    def _stats(state) -> tuple[float, float]:
        count = float(state.tx_count if hasattr(state, "tx_count") else state["count"])
        if count == 0:
            return 0.0, 0.0
        sum_ = state.sum_amount if hasattr(state, "sum_amount") else state["sum"]
        sum_sq = state.sum_sq_amount if hasattr(state, "sum_sq_amount") else state["sum_sq"]
        mean_ = sum_ / count
        var = max(0.0, sum_sq / count - mean_ * mean_)
        return mean_, var**0.5

    @staticmethod
    def _z(value: float, mean_: float, std: float) -> float:
        if std == 0:
            return 0.0
        return (value - mean_) / std
