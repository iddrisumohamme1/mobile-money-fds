import { format, subHours } from 'date-fns';
import { BEHAVIORAL_FEATURES, getRiskTier, CURRENCIES } from './constants';

// ─── Seeded pseudo-random ─────────────────────────────────────────────────────
let seed = 42;
function rand(min = 0, max = 1) {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  const t = ((seed >>> 0) / 0xffffffff);
  return min + t * (max - min);
}
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// ─── Phone number generators ──────────────────────────────────────────────────
const PREFIXES = { GHS: ['024', '055', '050', '023'], KES: ['0722', '0733', '0711'], NGN: ['0803', '0813', '0706'], UGX: ['0772', '0752', '0756'], TZS: ['0754', '0715', '0784'] };
function phone(currency) {
  const p = pick(PREFIXES[currency] || PREFIXES.GHS);
  return `+${p}${randInt(1000000, 9999999)}`;
}

// ─── Feature value generator ──────────────────────────────────────────────────
function generateFeatureValues(riskScore) {
  const highRisk = riskScore >= 0.75;
  const medRisk = riskScore >= 0.30;
  return {
    tx_velocity_1h:        highRisk ? randInt(5, 15) : randInt(0, 2),
    tx_velocity_24h:       highRisk ? randInt(20, 50) : randInt(1, 8),
    tx_velocity_7d:        randInt(5, 80),
    amount_zscore:         highRisk ? rand(2.5, 6.0) : rand(-0.5, 1.5),
    balance_drain_pct:     highRisk ? rand(0.70, 0.99) : rand(0.01, 0.35),
    balance_delta_15m:     highRisk ? -rand(500, 5000) : -rand(10, 300),
    new_recipient:         highRisk ? rand(0.7, 1.0) : rand(0, 0.3),
    recipient_risk_score:  highRisk ? rand(0.6, 1.0) : rand(0, 0.4),
    cashout_pattern:       highRisk ? rand(0.6, 1.0) : rand(0, 0.3),
    geo_distance_km:       highRisk ? randInt(500, 3000) : randInt(0, 50),
    geo_velocity_kmh:      highRisk ? randInt(200, 1200) : randInt(0, 60),
    roaming_flag:          highRisk ? rand(0.5, 1) : rand(0, 0.2),
    device_change:         highRisk ? rand(0.6, 1.0) : rand(0, 0.2),
    sim_age_days:          highRisk ? randInt(1, 14) : randInt(90, 1800),
    imei_blacklist:        highRisk ? rand(0.3, 1.0) : 0,
    night_tx_flag:         medRisk  ? rand(0.4, 1.0) : rand(0, 0.3),
    weekend_pattern:       rand(0, 1),
    tx_hour_anomaly:       highRisk ? rand(0.6, 1.0) : rand(0, 0.4),
    network_centrality:    highRisk ? rand(0.5, 1.0) : rand(0, 0.3),
    shared_device_count:   highRisk ? randInt(3, 20) : randInt(0, 2),
    beneficiary_age_days:  highRisk ? randInt(1, 30) : randInt(60, 730),
    repeat_send_flag:      highRisk ? rand(0, 0.4) : rand(0.6, 1.0),
    round_amount_flag:     highRisk ? rand(0.6, 1.0) : rand(0, 0.4),
    structuring_score:     highRisk ? rand(0.5, 1.0) : rand(0, 0.3),
    account_age_days:      highRisk ? randInt(1, 60) : randInt(90, 1200),
  };
}

// ─── Determine which features are "flagged" ───────────────────────────────────
const FLAG_THRESHOLDS = {
  tx_velocity_1h: v => v >= 4,
  tx_velocity_24h: v => v >= 15,
  amount_zscore: v => v >= 2.0,
  balance_drain_pct: v => v >= 0.5,
  new_recipient: v => v >= 0.6,
  recipient_risk_score: v => v >= 0.5,
  cashout_pattern: v => v >= 0.5,
  geo_distance_km: v => v >= 300,
  geo_velocity_kmh: v => v >= 150,
  roaming_flag: v => v >= 0.5,
  device_change: v => v >= 0.5,
  sim_age_days: v => v <= 30,
  imei_blacklist: v => v >= 0.1,
  night_tx_flag: v => v >= 0.5,
  tx_hour_anomaly: v => v >= 0.5,
  network_centrality: v => v >= 0.4,
  shared_device_count: v => v >= 3,
  beneficiary_age_days: v => v <= 30,
  round_amount_flag: v => v >= 0.5,
  structuring_score: v => v >= 0.4,
  account_age_days: v => v <= 60,
};

export function getFlaggedFeatures(featureValues) {
  return BEHAVIORAL_FEATURES.filter(f => {
    const threshold = FLAG_THRESHOLDS[f.key];
    if (!threshold) return false;
    return threshold(featureValues[f.key]);
  });
}

// ─── Single transaction generator ─────────────────────────────────────────────
let txCounter = 1000;
export function generateTransaction(overrides = {}) {
  const currency = pick(CURRENCIES);
  const riskScore = rand(0, 1);
  const tier = getRiskTier(riskScore);
  const amount = tier === 'blocked'
    ? rand(1500, 25000)
    : tier === 'review'
      ? rand(400, 3000)
      : rand(5, 800);
  const featureValues = generateFeatureValues(riskScore);
  const id = `TXN-${Date.now()}-${++txCounter}`;
  const now = new Date();

  return {
    id,
    ref_id: `REF${Date.now().toString(36).toUpperCase()}`,
    timestamp: now.toISOString(),
    sender_phone: phone(currency),
    recipient_phone: phone(currency),
    amount: parseFloat(amount.toFixed(2)),
    currency,
    risk_score: parseFloat(riskScore.toFixed(4)),
    risk_tier: tier,
    feature_values: featureValues,
    flagged_features: getFlaggedFeatures(featureValues),
    analyst_action: null,
    analyst_note: null,
    mfa_triggered: false,
    sender_history: {
      total_volume_30d: rand(500, 50000),
      avg_tx_size: rand(50, 2000),
      prior_flags: randInt(0, tier === 'blocked' ? 8 : 1),
      account_age_days: featureValues.account_age_days,
    },
    recipient_history: {
      total_received_30d: rand(100, 30000),
      account_age_days: featureValues.beneficiary_age_days,
      cashout_score: featureValues.cashout_pattern,
      prior_flags: randInt(0, tier === 'blocked' ? 5 : 1),
    },
    ...overrides,
  };
}

// ─── Bulk historical transactions ─────────────────────────────────────────────
export function generateHistoricalTransactions(count = 200) {
  seed = 12345;
  return Array.from({ length: count }, (_, i) => {
    const hoursAgo = (count - i) * 0.12;
    const ts = subHours(new Date(), hoursAgo);
    return { ...generateTransaction(), timestamp: ts.toISOString() };
  });
}

// ─── KPI aggregation ──────────────────────────────────────────────────────────
export function computeKpis(transactions) {
  const now = Date.now();
  const last24h = transactions.filter(t => now - new Date(t.timestamp).getTime() <= 24 * 3600000);
  const blocked = transactions.filter(t => t.risk_tier === 'blocked');
  const review  = transactions.filter(t => t.risk_tier === 'review');
  const approved = transactions.filter(t => t.risk_tier === 'approved');
  const totalBlocked = blocked.reduce((s, t) => s + t.amount, 0);
  const truePositives = blocked.length;
  const falsePositives = approved.filter(t => t.analyst_action === 'override_safe').length;
  const precision = truePositives / Math.max(truePositives + falsePositives, 1);

  return {
    total_volume_24h: last24h.reduce((s, t) => s + t.amount, 0),
    high_risk_count: blocked.length,
    review_queue: review.filter(t => !t.analyst_action).length,
    model_precision: precision,
    total_blocked_value: totalBlocked,
    approved_count: approved.length,
  };
}

// ─── Hourly fraud chart data ───────────────────────────────────────────────────
export function generateHourlyChartData(transactions) {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = new Date();
    h.setHours(h.getHours() - (23 - i), 0, 0, 0);
    return { hour: format(h, 'HH:mm'), blocked: 0, review: 0, approved: 0, value: 0 };
  });
  transactions.forEach(tx => {
    const txDate = new Date(tx.timestamp);
    const diffH = Math.floor((Date.now() - txDate.getTime()) / 3600000);
    const idx = 23 - diffH;
    if (idx >= 0 && idx < 24) {
      hours[idx][tx.risk_tier]++;
      if (tx.risk_tier === 'blocked') hours[idx].value += tx.amount;
    }
  });
  return hours;
}

// ─── Feature importance data ───────────────────────────────────────────────────
export function generateFeatureImportance() {
  const importances = [
    { feature: 'Balance Drain %',      importance: 0.187, alerts: 342 },
    { feature: 'Recipient Risk Score', importance: 0.154, alerts: 289 },
    { feature: 'Tx Velocity (1h)',     importance: 0.131, alerts: 241 },
    { feature: 'New Recipient',        importance: 0.112, alerts: 198 },
    { feature: 'IMEI Blacklist',       importance: 0.098, alerts: 179 },
    { feature: 'Device Change',        importance: 0.087, alerts: 156 },
    { feature: 'Amount Z-Score',       importance: 0.079, alerts: 142 },
    { feature: 'Geo Distance (km)',    importance: 0.063, alerts: 118 },
    { feature: 'SIM Age (days)',       importance: 0.051, alerts: 93  },
    { feature: 'Network Centrality',   importance: 0.038, alerts: 71  },
  ];
  return importances;
}
