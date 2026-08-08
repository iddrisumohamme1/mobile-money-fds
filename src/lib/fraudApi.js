import { getFlaggedFeatures } from './mockData';

const DEFAULT_BACKEND_URL = import.meta.env.VITE_FRAUD_API_URL || 'http://127.0.0.1:8000';

function mapTriageStatus(status) {
  const normalized = String(status || 'review').toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'blocked') return 'blocked';
  return 'review';
}

function sanitizePayload(transaction) {
  return {
    transaction_reference: transaction.ref_id || transaction.id || `REF-${Date.now()}`,
    sender_phone: transaction.sender_phone || '',
    recipient_phone: transaction.recipient_phone || '',
    amount: Number(transaction.amount || 0),
    currency: transaction.currency || 'GHS',
  };
}

export async function pingBackend() {
  try {
    const response = await fetch(`${DEFAULT_BACKEND_URL}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function predictTransaction(transaction) {
  const payload = sanitizePayload(transaction);

  try {
    const response = await fetch(`${DEFAULT_BACKEND_URL}/api/v1/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Prediction request failed with ${response.status}`);
    }

    return await response.json();
  } catch {
    return null;
  }
}

export function enrichTransactionWithPrediction(transaction, prediction) {
  if (!prediction) return transaction;

  const riskScore = Number(prediction.risk_score ?? transaction.risk_score ?? 0);
  const riskTier = mapTriageStatus(prediction.triage_status);
  const featureValues = {
    ...(transaction.feature_values || {}),
    ...(prediction.behavioral_features || {}),
  };

  return {
    ...transaction,
    risk_score: Number.isFinite(riskScore) ? Math.max(0, Math.min(1, riskScore)) : transaction.risk_score,
    risk_tier: riskTier,
    feature_values: featureValues,
    flagged_features: getFlaggedFeatures(featureValues),
    backend_action: prediction.action || null,
    backend_reason: prediction.reason || null,
    backend_model_used: prediction.model_used ?? null,
    backend_model_score: prediction.model_score ?? null,
    backend_heuristic_score: prediction.heuristic_score ?? null,
  };
}
