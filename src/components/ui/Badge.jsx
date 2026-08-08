import clsx from 'clsx';
import { ShieldCheck } from 'lucide-react';

const TIER_STYLES = {
  approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10',
  review:   'text-amber-400   bg-amber-500/10   border-amber-500/30   shadow-amber-500/10',
  blocked:  'text-rose-400    bg-rose-500/10    border-rose-500/30    shadow-rose-500/10',
};

const TIER_DOTS = {
  approved: 'bg-emerald-400',
  review:   'bg-amber-400',
  blocked:  'bg-rose-400',
};

const TIER_LABELS = {
  approved: 'Approved',
  review:   'Review / MFA',
  blocked:  'Hard Block',
};

export default function Badge({ tier, size = 'sm', auto = false, className }) {
  const style = TIER_STYLES[tier] || TIER_STYLES.approved;
  const dotColor = TIER_DOTS[tier] || TIER_DOTS.approved;
  const isAuto = auto && tier === 'approved';

  return (
    <span
      title={isAuto ? 'Cleared by the decision engine — no human review required' : undefined}
      className={clsx(
      'inline-flex items-center gap-1.5 font-medium border rounded-full shadow-sm',
      size === 'sm'  && 'px-2 py-0.5 text-xs',
      size === 'md'  && 'px-3 py-1 text-sm',
      size === 'lg'  && 'px-4 py-1.5 text-sm',
      style,
      className,
    )}>
      {isAuto ? (
        <ShieldCheck size={11} className="text-emerald-300" />
      ) : (
        <span className={clsx('w-1.5 h-1.5 rounded-full animate-pulse-ring', dotColor)} />
      )}
      {isAuto ? 'Auto-Approved' : TIER_LABELS[tier]}
    </span>
  );
}
