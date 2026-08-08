// ─── Risk Tier Thresholds ─────────────────────────────────────────────────────
export const RISK_THRESHOLDS = {
  APPROVED: 0.30,
  REVIEW: 0.75,
};

export const RISK_TIERS = {
  APPROVED: 'approved',
  REVIEW: 'review',
  BLOCKED: 'blocked',
};

export function getRiskTier(score) {
  if (score < RISK_THRESHOLDS.APPROVED) return RISK_TIERS.APPROVED;
  if (score < RISK_THRESHOLDS.REVIEW) return RISK_TIERS.REVIEW;
  return RISK_TIERS.BLOCKED;
}

// A transaction was auto-approved by the decision engine when it cleared the
// approval threshold with no analyst intervention. A manual "override safe"
// also flips the tier to approved, but that is a human decision, not an
// auto-approval, so it must not carry the auto tag.
export function isAutoApproved(tx) {
  return tx?.risk_tier === RISK_TIERS.APPROVED && !tx?.analyst_action;
}

// ─── Currencies ───────────────────────────────────────────────────────────────
export const CURRENCIES = ['GHS', 'KES', 'NGN', 'UGX', 'TZS'];

// ─── Analyst Audit Reason Codes ───────────────────────────────────────────────
export const AUDIT_REASON_CODES = [
  { value: 'ato', label: 'Account Takeover Confirmed' },
  { value: 'authorized_hv', label: 'Authorized High-Value Transfer' },
  { value: 'sim_swap', label: 'SIM Swap Detected' },
  { value: 'merchant_fraud', label: 'Fraudulent Merchant' },
  { value: 'money_mule', label: 'Money Mule Network' },
  { value: 'false_positive', label: 'Confirmed False Positive' },
  { value: 'velocity_spike', label: 'Velocity Spike — Legitimate' },
  { value: 'customer_verified', label: 'Customer Identity Verified' },
  { value: 'geo_anomaly', label: 'Geographic Anomaly — Confirmed' },
  { value: 'social_engineering', label: 'Social Engineering / Scam' },
];

// Display labels for every stored reason, including the programmatic
// mfa_challenge code which is never offered as a manual override reason.
export const REASON_LABELS = {
  ...Object.fromEntries(AUDIT_REASON_CODES.map(r => [r.value, r.label])),
  mfa_challenge: 'Step-up MFA Challenge',
};

// ─── 25-Feature Behavioral Matrix Labels ──────────────────────────────────────
export const BEHAVIORAL_FEATURES = [
  { key: 'tx_velocity_1h',       label: 'Tx Velocity (1h)',          category: 'velocity',  description: 'Transactions in the last hour vs. baseline' },
  { key: 'tx_velocity_24h',      label: 'Tx Velocity (24h)',         category: 'velocity',  description: 'Transactions in the last 24 hours' },
  { key: 'tx_velocity_7d',       label: 'Tx Velocity (7d)',          category: 'velocity',  description: 'Transactions in the last 7 days' },
  { key: 'amount_zscore',        label: 'Amount Z-Score',            category: 'amount',    description: 'Standard deviations from sender mean amount' },
  { key: 'balance_drain_pct',    label: 'Balance Drain %',           category: 'balance',   description: 'Percentage of balance depleted in this session' },
  { key: 'balance_delta_15m',    label: 'Balance Δ (15m)',           category: 'balance',   description: 'Net balance change in last 15 minutes' },
  { key: 'new_recipient',        label: 'New Recipient',             category: 'recipient', description: 'Recipient account age < 7 days' },
  { key: 'recipient_risk_score', label: 'Recipient Risk Score',      category: 'recipient', description: 'Cumulative risk score of the receiving account' },
  { key: 'cashout_pattern',      label: 'Cash-Out Pattern',          category: 'recipient', description: 'Recipient exhibits cash-out agent behavior' },
  { key: 'geo_distance_km',      label: 'Geo Distance (km)',         category: 'geo',       description: 'Distance from sender\'s last known location' },
  { key: 'geo_velocity_kmh',     label: 'Geo Velocity (km/h)',       category: 'geo',       description: 'Impossible physical speed between transactions' },
  { key: 'roaming_flag',         label: 'Roaming Flag',              category: 'geo',       description: 'Device operating in foreign network' },
  { key: 'device_change',        label: 'Device Change',             category: 'device',    description: 'Transaction from unrecognized device' },
  { key: 'sim_age_days',         label: 'SIM Age (days)',            category: 'device',    description: 'Age of the SIM card in the device' },
  { key: 'imei_blacklist',       label: 'IMEI Blacklist',            category: 'device',    description: 'Device IMEI flagged in fraud registry' },
  { key: 'night_tx_flag',        label: 'Night Transaction',         category: 'time',      description: 'Transaction at unusual hours (00:00–05:00)' },
  { key: 'weekend_pattern',      label: 'Weekend Pattern',           category: 'time',      description: 'Deviation from sender\'s weekend behavior' },
  { key: 'tx_hour_anomaly',      label: 'Hour Anomaly Score',        category: 'time',      description: 'Probability this hour is unusual for sender' },
  { key: 'network_centrality',   label: 'Network Centrality',        category: 'network',   description: 'Sender node centrality in fraud ring graph' },
  { key: 'shared_device_count',  label: 'Shared Device Count',       category: 'network',   description: 'Number of accounts sharing this device' },
  { key: 'beneficiary_age_days', label: 'Beneficiary Acct Age',      category: 'network',   description: 'Age of beneficiary account in days' },
  { key: 'repeat_send_flag',     label: 'Repeat Destination',        category: 'pattern',   description: 'Sending to same recipient for first time' },
  { key: 'round_amount_flag',    label: 'Round Amount Flag',         category: 'pattern',   description: 'Transaction is a suspiciously round number' },
  { key: 'structuring_score',    label: 'Structuring Score',         category: 'pattern',   description: 'Score indicating transaction layering behavior' },
  { key: 'account_age_days',     label: 'Account Age (days)',        category: 'account',   description: 'Age of the sender\'s account' },
];

export const FEATURE_CATEGORIES = {
  velocity:  { label: 'Velocity',    color: 'indigo'  },
  amount:    { label: 'Amount',      color: 'violet'  },
  balance:   { label: 'Balance',     color: 'amber'   },
  recipient: { label: 'Recipient',   color: 'rose'    },
  geo:       { label: 'Geographic',  color: 'cyan'    },
  device:    { label: 'Device',      color: 'orange'  },
  time:      { label: 'Temporal',    color: 'teal'    },
  network:   { label: 'Network',     color: 'purple'  },
  pattern:   { label: 'Pattern',     color: 'yellow'  },
  account:   { label: 'Account',     color: 'emerald' },
};

// ─── User Roles ───────────────────────────────────────────────────────────────
export const USER_ROLES = {
  ANALYST: 'analyst',
  RISK_MANAGER: 'risk_manager',
  ADMIN: 'admin',
};
