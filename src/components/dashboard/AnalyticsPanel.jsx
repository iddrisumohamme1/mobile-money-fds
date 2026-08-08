import { useEffect, useMemo, useState } from 'react';
import { Download, TrendingUp, BarChart2, FileText, ChevronLeft, ChevronRight, Loader, AlertCircle } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { generateHourlyChartData, generateFeatureImportance } from '../../lib/mockData';
import { REASON_LABELS } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import clsx from 'clsx';

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-elevated rounded-lg border border-slate-700 p-3 text-xs shadow-xl">
      <p className="text-slate-400 font-mono mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300 capitalize">{p.dataKey}:</span>
          <span className="font-bold text-slate-100">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

const ACTION_STYLES = {
  override_safe: 'text-emerald-400',
  confirm_fraud: 'text-rose-400',
  trigger_mfa:   'text-amber-400',
};
const ACTION_LABELS = {
  override_safe: 'Override: Safe',
  confirm_fraud: 'Fraud Confirmed',
  trigger_mfa:   'MFA Triggered',
};

const AUDIT_PAGE_SIZE = 8;

function mapAuditRow(a) {
  return {
    id: a.id,
    tx_ref: a.transactions?.ref_id ?? a.transaction_id ?? '—',
    action: a.action,
    analyst: a.analyst_email || '—',
    reason: REASON_LABELS[a.reason_code] || a.reason_code || '—',
    timestamp: a.created_at,
  };
}

const TABS = [
  { id: 'trends',     label: 'Fraud Trends',     icon: TrendingUp },
  { id: 'features',   label: 'Feature Importance', icon: BarChart2 },
  { id: 'audit',      label: 'Audit Log',         icon: FileText },
];

export default function AnalyticsPanel({ transactions }) {
  const [activeTab, setActiveTab] = useState('trends');
  const [auditPage, setAuditPage] = useState(0);
  const [auditRows, setAuditRows] = useState(null); // null while loading
  const [auditError, setAuditError] = useState('');
  const { canExport } = useAuth();

  const hourlyData = useMemo(() => generateHourlyChartData(transactions), [transactions]);
  const featureData = useMemo(() => generateFeatureImportance(), []);

  useEffect(() => {
    let cancelled = false;
    setAuditPage(0);
    setAuditError('');

    if (activeTab !== 'audit') return undefined;

    if (!supabase) {
      // Simulation mode: there is no live audit trail to read.
      setAuditRows([]);
      return undefined;
    }

    setAuditRows(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('analyst_actions')
          .select('*, transactions(ref_id)')
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        if (!cancelled) setAuditRows((data || []).map(mapAuditRow));
      } catch (e) {
        if (!cancelled) {
          setAuditRows([]);
          setAuditError(e?.message || 'Failed to load the audit trail');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [activeTab]);

  const totalPages = auditRows ? Math.max(1, Math.ceil(auditRows.length / AUDIT_PAGE_SIZE)) : 1;
  const pageRows = auditRows
    ? auditRows.slice(auditPage * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE + AUDIT_PAGE_SIZE)
    : [];

  const exportCSV = () => {
    const rows = auditRows || [];
    const csv = [
      ['ID', 'TX Ref', 'Action', 'Analyst', 'Reason', 'Timestamp'],
      ...rows.map(r => [r.id, r.tx_ref, r.action, r.analyst, r.reason, r.timestamp]),
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fraud-audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card rounded-2xl border border-slate-800/60 flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          <h2 className="font-display text-sm font-semibold tracking-wide text-slate-100 whitespace-nowrap">Model & Audit</h2>
        </div>
        {canExport && activeTab === 'audit' && auditRows && auditRows.length > 0 && (
          <button
            id="export-csv-btn"
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
          >
            <Download size={12} />
            Export CSV
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-slate-800/60">
        <div className="flex flex-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              id={`analytics-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        {/* Trends */}
        {activeTab === 'trends' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-3">Fraud Attempt Volume — Last 24 Hours</p>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={hourlyData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReview" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval={3} />
                  <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="blocked"  stroke="#f43f5e" fill="url(#gradBlocked)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="review"   stroke="#f59e0b" fill="url(#gradReview)"  strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="approved" stroke="#10b981" fill="url(#gradApproved)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Feature importance */}
        {activeTab === 'features' && (
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-3">Top 10 Alert-Triggering Features (Model Weights)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={featureData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" domain={[0, 0.2]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="feature" width={108} tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => active && payload?.length ? (
                    <div className="glass-card-elevated rounded-lg border border-slate-700 p-2 text-xs">
                      <p className="text-slate-300">{payload[0].payload.feature}</p>
                      <p className="text-indigo-400 font-bold">{(payload[0].value * 100).toFixed(1)}% importance</p>
                      <p className="text-slate-500">{payload[0].payload.alerts} alerts triggered</p>
                    </div>
                  ) : null}
                />
                <Bar dataKey="importance" fill="url(#barGrad)" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Audit log */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            {auditRows === null ? (
              <div className="flex items-center justify-center gap-2 py-10">
                <Loader size={16} className="text-slate-500 animate-spin" />
                <p className="text-xs text-slate-500 font-mono">Loading audit trail…</p>
              </div>
            ) : auditError ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-3">
                <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300">Could not load the audit trail: {auditError}</p>
              </div>
            ) : pageRows.length === 0 ? (
              <div className="text-center py-10 space-y-1">
                <FileText size={20} className="mx-auto text-slate-600" />
                <p className="text-xs text-slate-500">
                  {supabase ? 'No analyst actions recorded yet.' : 'Simulation mode — no audit trail to display.'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {['Audit ID', 'TX Ref', 'Action', 'Analyst', 'Reason', 'Time'].map(h => (
                          <th key={h} className="text-left py-2 px-2 text-[9px] text-slate-600 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map(row => (
                        <tr key={row.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-2 font-mono text-indigo-400">{String(row.id).slice(0, 8)}</td>
                          <td className="py-2 px-2 font-mono text-slate-400">{row.tx_ref}</td>
                          <td className={clsx('py-2 px-2 font-medium', ACTION_STYLES[row.action] || 'text-slate-300')}>{ACTION_LABELS[row.action] || row.action}</td>
                          <td className="py-2 px-2 text-slate-300">{row.analyst}</td>
                          <td className="py-2 px-2 text-slate-500 max-w-xs truncate">{row.reason}</td>
                          <td className="py-2 px-2 text-slate-600 font-mono whitespace-nowrap">{format(new Date(row.timestamp), 'HH:mm dd/MM')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {auditRows.length > AUDIT_PAGE_SIZE && (
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-600">Page {auditPage + 1} of {totalPages}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setAuditPage(p => Math.max(0, p - 1))}
                        disabled={auditPage === 0}
                        className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setAuditPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={auditPage >= totalPages - 1}
                        className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
