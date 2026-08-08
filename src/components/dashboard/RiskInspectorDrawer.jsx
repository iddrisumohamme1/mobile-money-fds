import { useState, useEffect } from 'react';
import { X, ShieldCheck, ShieldX, Smartphone, AlertTriangle, User, ChevronDown, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import GaugeChart from '../ui/GaugeChart';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { BEHAVIORAL_FEATURES, FEATURE_CATEGORIES, AUDIT_REASON_CODES, RISK_THRESHOLDS, isAutoApproved } from '../../lib/constants';
import { useAuth } from '../../context/AuthContext';
import { useAnalystActions } from '../../hooks/useAnalystActions';
import clsx from 'clsx';

function FeatureTile({ feature, value, flagged }) {
  const catColor = FEATURE_CATEGORIES[feature.category]?.color || 'slate';

  const colorMap = {
    indigo: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-300',
    violet: 'border-violet-500/30 bg-violet-500/5 text-violet-300',
    amber:  'border-amber-500/30  bg-amber-500/5  text-amber-300',
    rose:   'border-rose-500/30   bg-rose-500/5   text-rose-300',
    cyan:   'border-cyan-500/30   bg-cyan-500/5   text-cyan-300',
    orange: 'border-orange-500/30 bg-orange-500/5 text-orange-300',
    teal:   'border-teal-500/30   bg-teal-500/5   text-teal-300',
    purple: 'border-purple-500/30 bg-purple-500/5 text-purple-300',
    yellow: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-300',
    emerald:'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
    slate:  'border-slate-500/30  bg-slate-500/5  text-slate-300',
  };

  const flaggedStyle = flagged
    ? 'border-amber-500/50 bg-amber-500/10 feature-flagged'
    : colorMap[catColor] || colorMap.slate;

  function formatValue(v) {
    if (typeof v === 'number') {
      if (v > 100) return v.toFixed(0);
      if (v > 1) return v.toFixed(1);
      return (v * 100).toFixed(1) + '%';
    }
    return String(v);
  }

  return (
    <div
      title={feature.description}
      className={clsx(
        'rounded-lg border p-2 flex flex-col gap-1 transition-all duration-200 cursor-default',
        flaggedStyle,
        flagged && 'shadow-sm shadow-amber-500/20',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[9px] font-medium text-slate-400 leading-tight">{feature.label}</p>
        {flagged && <AlertTriangle size={8} className="text-amber-400 shrink-0 mt-0.5" />}
      </div>
      <p className={clsx('text-xs font-bold font-mono', flagged ? 'text-amber-300' : 'text-slate-200')}>
        {formatValue(value)}
      </p>
    </div>
  );
}

function ProfileCard({ title, icon: Icon, data, color }) {
  const colorStyles = {
    indigo: 'text-indigo-400 bg-indigo-500/10',
    rose:   'text-rose-400   bg-rose-500/10',
  };
  const c = colorStyles[color] || colorStyles.indigo;

  return (
    <div className="glass-card rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={clsx('p-1.5 rounded-md', c.split(' ')[1])}>
          <Icon size={12} className={c.split(' ')[0]} />
        </div>
        <p className="text-xs font-semibold text-slate-300">{title}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {data.map(({ label, value }) => (
          <div key={label}>
            <p className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-xs font-mono text-slate-200">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RiskInspectorDrawer({ tx, onClose, updateTransaction }) {
  const { canOverride, refreshUser } = useAuth();
  const { overrideSafe, confirmFraud, triggerMFA, loading, error } = useAnalystActions(updateTransaction);
  const [confirmModal, setConfirmModal] = useState(null);
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [actionDone, setActionDone] = useState(null);
  const [activeTab, setActiveTab] = useState('features');

  // Pull the live role each time a transaction is inspected so a role promoted
  // server-side (e.g. via admin-users) takes effect without a re-login.
  useEffect(() => {
    if (tx?.id) refreshUser();
  }, [tx?.id, refreshUser]);

  if (!tx) return null;

  const handleAction = async (type) => {
    if (!reasonCode) return;
    let ok;
    if (type === 'safe') {
      ok = await overrideSafe(tx, reasonCode, note);
    } else if (type === 'fraud') {
      ok = await confirmFraud(tx, reasonCode, note);
    }
    if (ok) setActionDone(type);
    setConfirmModal(null);
  };

  const handleMFA = async () => {
    const ok = await triggerMFA(tx);
    if (ok) setActionDone('mfa');
  };

  const flaggedSet = new Set(tx.flagged_features?.map(f => f.key) || []);

  return (
    <>
      {/* Backdrop (mobile) */}
      <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />

      {/* Drawer */}
      <aside
        id="risk-inspector-drawer"
        className="fixed right-0 top-0 h-full w-full sm:w-[420px] z-30 flex flex-col bg-slate-900 border-l border-slate-700/60 shadow-2xl overflow-hidden"
        style={{ animation: 'slide-in-right 0.3s ease-out' }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className={clsx(
              tx.risk_tier === 'blocked' ? 'text-rose-400' :
              tx.risk_tier === 'review'  ? 'text-amber-400' : 'text-emerald-400'
            )} />
            <div>
              <p className="text-sm font-semibold text-slate-100 font-mono">{tx.ref_id}</p>
              <p className="text-[10px] text-slate-500">{format(new Date(tx.timestamp), 'dd MMM yyyy HH:mm:ss')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tier={tx.risk_tier} size="sm" />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto">
          {/* Gauge section */}
          <div className="p-4 border-b border-slate-800/60 bg-slate-950/40">
            <div className="flex flex-col items-center">
              <GaugeChart score={tx.risk_score} size={180} />
              <div className="mt-2 text-center">
                <p className="text-xs text-slate-500">Random Forest confidence score</p>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  {tx.flagged_features?.length || 0} / 25 features flagged
                </p>
              </div>
            </div>

            {isAutoApproved(tx) && (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                  <p className="text-xs font-semibold text-emerald-300">Auto-Approved</p>
                  {tx.backend_model_used && (
                    <span className="ml-auto text-[9px] font-mono text-emerald-400/80 uppercase tracking-wider">model verified</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Cleared the funnel without human review — blended risk {(tx.risk_score * 100).toFixed(1)}%
                  is below the {Math.round(RISK_THRESHOLDS.APPROVED * 100)}% auto-approve threshold.
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-mono text-slate-500">
                  <span>Model: <span className="text-slate-300">
                    {tx.backend_model_used && tx.backend_model_score != null
                      ? `${(tx.backend_model_score * 100).toFixed(1)}%`
                      : 'not evaluated'}
                  </span></span>
                  {tx.backend_heuristic_score != null && (
                    <span>Heuristic: <span className="text-slate-300">{(tx.backend_heuristic_score * 100).toFixed(1)}%</span></span>
                  )}
                  <span>Action: <span className="text-slate-300">{tx.backend_action || 'AUTO_PASS'}</span></span>
                </div>
              </div>
            )}

            {!isAutoApproved(tx) && tx.risk_tier === 'approved' && (
              <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-3 py-2.5 flex items-start gap-2">
                <ShieldCheck size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-indigo-300">Approved by Analyst Override</p>
                  <p className="text-[10px] text-slate-500">
                    Human decision — override logged{tx.analyst_reason ? ` as ${tx.analyst_reason}` : ''}.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-800/60">
            {['features', 'profiles', 'actions'].map(tab => (
              <button
                key={tab}
                id={`inspector-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'flex-1 py-2.5 text-xs font-medium capitalize transition-colors',
                  activeTab === tab
                    ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5'
                    : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {tab}
                {tab === 'actions' && !canOverride && (
                  <span className="ml-1 text-[8px] text-slate-600">(Mgr)</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab: Features */}
          {activeTab === 'features' && (
            <div className="p-4 space-y-4">
              {/* Flagged highlights */}
              {tx.flagged_features?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={9} /> {tx.flagged_features.length} Anomalies Detected
                  </p>
                  <div className="space-y-1.5">
                    {tx.flagged_features.slice(0, 4).map(f => (
                      <div key={f.key} className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        <AlertTriangle size={10} className="text-amber-400 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-300">{f.label}</p>
                          <p className="text-[9px] text-slate-500">{f.description}</p>
                        </div>
                        <span className="ml-auto text-xs font-mono text-amber-400 font-bold">
                          {typeof tx.feature_values?.[f.key] === 'number'
                            ? tx.feature_values[f.key] > 1
                              ? tx.feature_values[f.key].toFixed(1)
                              : (tx.feature_values[f.key] * 100).toFixed(1) + '%'
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full 25-feature matrix */}
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
                  Full Behavioral Matrix (25 Features)
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {BEHAVIORAL_FEATURES.map(f => (
                    <FeatureTile
                      key={f.key}
                      feature={f}
                      value={tx.feature_values?.[f.key] ?? 0}
                      flagged={flaggedSet.has(f.key)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Profiles */}
          {activeTab === 'profiles' && (
            <div className="p-4 space-y-3">
              <ProfileCard
                title="Sender Profile"
                icon={User}
                color="indigo"
                data={[
                  { label: 'Phone',          value: tx.sender_phone },
                  { label: '30d Volume',     value: `${tx.currency} ${tx.sender_history?.total_volume_30d?.toFixed(0) || '—'}` },
                  { label: 'Avg Tx Size',    value: `${tx.currency} ${tx.sender_history?.avg_tx_size?.toFixed(0) || '—'}` },
                  { label: 'Account Age',    value: `${tx.sender_history?.account_age_days || '—'} days` },
                  { label: 'Prior Flags',    value: tx.sender_history?.prior_flags || '0' },
                  { label: 'Current Tier',   value: tx.risk_tier.toUpperCase() },
                ]}
              />
              <ProfileCard
                title="Recipient Profile"
                icon={User}
                color="rose"
                data={[
                  { label: 'Phone',          value: tx.recipient_phone },
                  { label: '30d Received',   value: `${tx.currency} ${tx.recipient_history?.total_received_30d?.toFixed(0) || '—'}` },
                  { label: 'Account Age',    value: `${tx.recipient_history?.account_age_days || '—'} days` },
                  { label: 'Cashout Score',  value: `${((tx.recipient_history?.cashout_score || 0) * 100).toFixed(0)}%` },
                  { label: 'Prior Flags',    value: tx.recipient_history?.prior_flags || '0' },
                  { label: 'Risk Node',      value: tx.recipient_history?.account_age_days < 30 ? '⚠ New Account' : '✓ Established' },
                ]}
              />
            </div>
          )}

          {/* Tab: Actions */}
          {activeTab === 'actions' && (
            <div className="p-4 space-y-4">
              {/* Action done state */}
              {actionDone && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <p className="text-xs text-emerald-300 font-medium">
                    {actionDone === 'safe'  && 'Override applied — marked as safe'}
                    {actionDone === 'fraud' && 'Fraud confirmed — account blocked'}
                    {actionDone === 'mfa'   && 'MFA challenge sent to sender'}
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
                  <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-rose-300 font-medium">Action not saved</p>
                    <p className="text-[10px] text-rose-400/80 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Analyst controls */}
              {canOverride ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">
                      Audit Reason Code <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="reason-code-select"
                        value={reasonCode}
                        onChange={e => setReasonCode(e.target.value)}
                        className="input-dark appearance-none pr-8"
                      >
                        <option value="">Select reason code…</option>
                        {AUDIT_REASON_CODES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Analyst Note</label>
                    <textarea
                      id="analyst-note"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Optional investigation notes…"
                      rows={2}
                      className="input-dark resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="btn-override-safe"
                      disabled={!reasonCode || loading}
                      onClick={() => setConfirmModal('safe')}
                      className="btn-success disabled:opacity-40 disabled:cursor-not-allowed justify-center text-xs"
                    >
                      {loading ? <Loader size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                      Mark Safe
                    </button>
                    <button
                      id="btn-confirm-fraud"
                      disabled={!reasonCode || loading}
                      onClick={() => setConfirmModal('fraud')}
                      className="btn-danger disabled:opacity-40 disabled:cursor-not-allowed justify-center text-xs"
                    >
                      {loading ? <Loader size={12} className="animate-spin" /> : <ShieldX size={12} />}
                      Confirm Fraud
                    </button>
                  </div>

                  <button
                    id="btn-trigger-mfa"
                    onClick={handleMFA}
                    disabled={loading || tx.mfa_triggered}
                    className="btn-ghost w-full justify-center text-xs disabled:opacity-40"
                  >
                    <Smartphone size={12} />
                    {tx.mfa_triggered ? 'MFA Already Sent' : 'Trigger Step-Up MFA'}
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 text-center space-y-1">
                  <ShieldX size={20} className="text-slate-600 mx-auto" />
                  <p className="text-sm font-medium text-slate-400">Override Restricted</p>
                  <p className="text-xs text-slate-600">Risk Manager role required to perform overrides.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Confirm modal */}
      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal === 'safe' ? 'Confirm Override: Mark Safe' : 'Confirm Fraud & Hard Block'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            {confirmModal === 'safe'
              ? 'This will reverse the fraud flag and approve the transaction. The decision will be logged for model retraining.'
              : 'This will freeze the sender\'s wallet and blacklist the destination account. This action cannot be undone without admin approval.'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmModal(null)} className="btn-ghost flex-1 justify-center text-sm">Cancel</button>
            <button
              id="btn-confirm-modal"
              onClick={() => handleAction(confirmModal)}
              disabled={loading}
              className={clsx('flex-1 justify-center text-sm', confirmModal === 'safe' ? 'btn-success' : 'btn-danger')}
            >
              {loading && <Loader size={14} className="animate-spin" />}
              {confirmModal === 'safe' ? 'Confirm Safe' : 'Confirm Block'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
