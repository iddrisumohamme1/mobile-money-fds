import { useState, useMemo } from 'react';
import { Search, Filter, X, ChevronRight, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import Badge from '../ui/Badge';
import { BEHAVIORAL_FEATURES, FEATURE_CATEGORIES, isAutoApproved } from '../../lib/constants';
import clsx from 'clsx';

const TIERS = ['all', 'approved', 'review', 'blocked'];

const TIER_PILL = {
  all:      'bg-indigo-600 text-white',
  approved: 'bg-emerald-600 text-white',
  review:   'bg-amber-600 text-white',
  blocked:  'bg-rose-600 text-white',
};

const TIER_TEXT = {
  approved: 'text-emerald-400',
  review:   'text-amber-400',
  blocked:  'text-rose-400',
};

const TIER_BORDER = {
  approved: 'border-l-emerald-500',
  review:   'border-l-amber-500',
  blocked:  'border-l-rose-500',
};

const CHIP_COLORS = {
  indigo:  'text-indigo-300 border-indigo-500/30 bg-indigo-500/10',
  violet:  'text-violet-300  border-violet-500/30  bg-violet-500/10',
  amber:   'text-amber-300   border-amber-500/30   bg-amber-500/10',
  rose:    'text-rose-300    border-rose-500/30    bg-rose-500/10',
  cyan:    'text-cyan-300    border-cyan-500/30    bg-cyan-500/10',
  orange:  'text-orange-300  border-orange-500/30  bg-orange-500/10',
  teal:    'text-teal-300    border-teal-500/30    bg-teal-500/10',
  purple:  'text-purple-300  border-purple-500/30  bg-purple-500/10',
  yellow:  'text-yellow-300  border-yellow-500/30  bg-yellow-500/10',
  emerald: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
};

function formatCurrency(amount, currency) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatter.format(amount)}`;
}

// ─── Signal chain: the flagged features that produced this decision ───────────
function signalChips(tx) {
  const seen = new Set();
  const chips = [];
  for (const f of tx.flagged_features || []) {
    const meta = BEHAVIORAL_FEATURES.find(b => b.key === f.key);
    if (!meta) continue;
    const cat = FEATURE_CATEGORIES[meta.category];
    if (!cat || seen.has(meta.category)) continue;
    seen.add(meta.category);
    chips.push({ label: cat.label, color: CHIP_COLORS[cat.color] || CHIP_COLORS.indigo });
    if (chips.length === 3) break;
  }
  return chips;
}

function TxRow({ tx, selected, onClick, isNew }) {
  const pct = Math.round(tx.risk_score * 100);
  const chips = signalChips(tx);
  const showChips = tx.risk_tier !== 'approved' && chips.length > 0;

  return (
    <div
      id={`tx-row-${tx.id}`}
      onClick={() => onClick(tx)}
      className={clsx(
        'tx-row relative grid grid-cols-12 gap-1.5 sm:gap-2 items-center px-2 py-1.5 sm:px-4 sm:py-3 group border-l-2',
        TIER_BORDER[tx.risk_tier],
        selected && 'selected',
        isNew && 'tx-row-new',
      )}
    >
      {/* Ref + Time */}
      <div className="col-span-5 md:col-span-3 min-w-0">
        <p className="text-[11px] sm:text-xs font-mono text-indigo-300 truncate">{tx.ref_id}</p>
        <p className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">{format(new Date(tx.timestamp), 'HH:mm:ss')}</p>
      </div>

      {/* Sender → Recipient + signal chain */}
      <div className="hidden md:block md:col-span-4 min-w-0">
        <p className="text-xs text-slate-300 font-mono truncate">{tx.sender_phone}</p>
        <p className="text-[10px] text-slate-600 truncate">→ {tx.recipient_phone}</p>
        {showChips && (
          <div className="mt-1.5 hidden xl:flex gap-1 flex-wrap">
            {chips.map(c => (
              <span
                key={c.label}
                className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[9px] uppercase tracking-[0.08em]', c.color)}
              >
                <span className="w-1 h-1 rounded-full bg-current" />
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="hidden md:block md:col-span-2 text-right md:text-left mr-2 md:mr-0">
        <p className="text-xs sm:text-sm font-semibold text-slate-100 tabular-nums truncate">{formatCurrency(tx.amount, tx.currency)}</p>
      </div>

      {/* Risk score */}
      <div className="hidden lg:flex lg:col-span-2 items-center">
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1 rounded-full bg-slate-700 overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', {
                'bg-emerald-500': tx.risk_tier === 'approved',
                'bg-amber-500':   tx.risk_tier === 'review',
                'bg-rose-500':    tx.risk_tier === 'blocked',
              })}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={clsx('text-[10px] font-mono font-semibold', TIER_TEXT[tx.risk_tier])}>{pct}%</span>
        </div>
      </div>

      {/* Tier badge */}
      <div className="col-span-3 col-start-10 md:col-span-2 md:col-start-11 lg:col-span-1 lg:col-start-12 flex justify-end pr-6 md:pr-6">
        <Badge tier={tx.risk_tier} size="sm" auto={isAutoApproved(tx)} />
      </div>

      {/* Chevron */}
      <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-indigo-400 transition-colors" />
    </div>
  );
}

export default function TransactionFeed({ transactions, selectedTx, onSelect }) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const matchSearch = !search ||
        tx.ref_id?.toLowerCase().includes(search.toLowerCase()) ||
        tx.sender_phone?.includes(search) ||
        tx.recipient_phone?.includes(search);
      const matchTier = tierFilter === 'all' || tx.risk_tier === tierFilter;
      return matchSearch && matchTier;
    });
  }, [transactions, search, tierFilter]);

  // Track newest 3 for animation
  const newest3 = new Set(transactions.slice(0, 3).map(t => t.id));

  return (
    <div className="glass-card rounded-2xl border border-slate-800/60 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
          <h2 className="font-display text-sm font-semibold tracking-wide text-slate-100 whitespace-nowrap">Live Triage Feed</h2>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full shrink-0">
            {filtered.length.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-300/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            streaming
          </span>
          <button
            id="toggle-filters-btn"
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              showFilters
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
            )}
          >
            <Filter size={12} />
            Filters
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className={clsx('border-b border-slate-800/60 transition-all duration-300 overflow-hidden', showFilters ? 'max-h-40' : 'max-h-0')}>
        <div className="p-3 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="tx-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Ref ID, phone number…"
              className="input-dark pl-8 pr-8"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TIERS.map(tier => (
              <button
                key={tier}
                id={`filter-${tier}`}
                onClick={() => setTierFilter(tier)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors',
                  tierFilter === tier
                    ? TIER_PILL[tier]
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700',
                )}
              >
                {tier === 'all' ? 'All' : tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Column header */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 border-b border-slate-800/40 bg-slate-900/40">
        <div className="col-span-5 md:col-span-3 text-[10px] text-slate-600 font-medium uppercase tracking-wider flex items-center gap-1"><ArrowUpDown size={8} />Ref / Time</div>
        <div className="md:col-span-4 text-[10px] text-slate-600 font-medium uppercase tracking-wider">Sender → Recipient</div>
        <div className="col-span-4 md:col-span-2 text-[10px] text-slate-600 font-medium uppercase tracking-wider md:text-left">Amount</div>
        <div className="lg:col-span-2 text-[10px] text-slate-600 font-medium uppercase tracking-wider hidden lg:block">Risk Score</div>
        <div className="col-span-3 md:col-span-2 md:col-start-11 lg:col-span-1 lg:col-start-12 text-[10px] text-slate-600 font-medium uppercase tracking-wider text-right md:pr-6">Status</div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Search size={24} className="text-slate-600" />
            <p className="text-sm text-slate-500">No signals on this lane</p>
            <button onClick={() => { setSearch(''); setTierFilter('all'); }} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Clear filters to return to the live feed
            </button>
          </div>
        ) : (
          filtered.map(tx => (
            <TxRow
              key={tx.id}
              tx={tx}
              selected={selectedTx?.id === tx.id}
              onClick={onSelect}
              isNew={newest3.has(tx.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 sm:px-4 sm:py-2 border-t border-slate-800/60 bg-slate-900/40 flex items-center justify-between">
        <p className="text-[10px] text-slate-600 font-mono">Showing {filtered.length.toLocaleString()} of {transactions.length.toLocaleString()} transactions</p>
        <p className="text-[10px] text-slate-600 font-mono">Max 300 retained in memory</p>
      </div>
    </div>
  );
}
