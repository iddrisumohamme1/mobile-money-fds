import AnimatedCounter from '../ui/AnimatedCounter';
import StatusDot from '../ui/StatusDot';
import clsx from 'clsx';

function KpiCell({ label, dot, value, prefix = '', suffix = '', decimals = 0, delta, deltaTone = 'text-slate-500', children, className }) {
  return (
    <div className={clsx('bg-slate-900/60 px-3 py-2.5 sm:px-4 sm:py-3.5 min-w-0', className)}>
      <p className="flex items-center gap-1.5 text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-slate-500 truncate">
        <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
        {label}
      </p>
      <p className="mt-2 font-display text-lg sm:text-2xl md:text-[1.65rem] font-bold tabular-nums leading-none text-slate-100">
        {children ?? <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />}
      </p>
      {delta && (
        <p className={clsx('mt-1.5 text-[10px] font-mono', deltaTone)}>{delta}</p>
      )}
    </div>
  );
}

export default function KpiBar({ metrics, connectionStatus }) {
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-px bg-slate-800/60 border border-slate-800/60 rounded-2xl overflow-hidden">
      <KpiCell
        label="Volume · 24h"
        dot="bg-indigo-400"
        delta="▲ 12.4% vs prior"
        deltaTone="text-indigo-300/80"
        className="animate-fade-up opacity-0 stagger-1"
      >
        {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(metrics.total_volume_24h)}
      </KpiCell>
      <KpiCell
        label="Blocked"
        dot="bg-rose-500"
        value={metrics.high_risk_count}
        delta="▲ 3.1% vs prior"
        deltaTone="text-rose-400"
        className="animate-fade-up opacity-0 stagger-2"
      />
      <KpiCell
        label="Review Queue"
        dot="bg-amber-400"
        value={metrics.review_queue}
        delta="▼ 8% vs prior"
        deltaTone="text-emerald-400"
        className="animate-fade-up opacity-0 stagger-3"
      />
      <KpiCell
        label="Model Precision"
        dot="bg-emerald-400"
        value={metrics.model_precision * 100}
        suffix="%"
        decimals={2}
        className="animate-fade-up opacity-0 stagger-4"
      />
      <KpiCell
        label="Engine"
        dot="bg-cyan-400"
        className="col-span-2 md:col-span-1 animate-fade-up opacity-0 stagger-5"
      >
        <span className="flex items-center gap-2 text-sm sm:text-lg capitalize text-cyan-300 leading-none">
          <StatusDot status={connectionStatus} showLabel={false} />
          {connectionStatus}
        </span>
      </KpiCell>
    </div>
  );
}
