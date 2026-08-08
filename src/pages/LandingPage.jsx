import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Database, Activity, ArrowRight,
  CheckCircle, Globe, Lock, TrendingUp, Cpu, Radio, Terminal,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Signature: live triage tape data ─────────────────────────────────────────
const TICKER = [
  { ref: 'REF7K2A', sender: '+233 24…', recipient: '+233 50…', amount: 4500, currency: 'GHS', risk: 62, tier: 'review' },
  { ref: 'REF2B8Q', sender: '+254 71…', recipient: '+254 72…', amount: 12850, currency: 'KES', risk: 81, tier: 'blocked' },
  { ref: 'REF9M3D', sender: '+234 80…', recipient: '+234 80…', amount: 150000, currency: 'NGN', risk: 12, tier: 'approved' },
  { ref: 'REF4T7P', sender: '+256 77…', recipient: '+256 70…', amount: 620000, currency: 'UGX', risk: 44, tier: 'review' },
  { ref: 'REF1X9L', sender: '+255 75…', recipient: '+255 71…', amount: 780000, currency: 'TZS', risk: 91, tier: 'blocked' },
  { ref: 'REF6H5C', sender: '+233 54…', recipient: '+233 20…', amount: 2100, currency: 'GHS', risk: 8, tier: 'approved' },
  { ref: 'REF3W8N', sender: '+254 70…', recipient: '+254 73…', amount: 24500, currency: 'KES', risk: 57, tier: 'review' },
  { ref: 'REF8S2R', sender: '+234 70…', recipient: '+234 80…', amount: 325000, currency: 'NGN', risk: 88, tier: 'blocked' },
  { ref: 'REF5K6F', sender: '+256 75…', recipient: '+256 77…', amount: 94000, currency: 'UGX', risk: 19, tier: 'approved' },
  { ref: 'REF0J4V', sender: '+255 76…', recipient: '+255 78…', amount: 1500000, currency: 'TZS', risk: 35, tier: 'review' },
];

const CONSOLE_FEED = [
  { ref: 'REF7K2A', route: '+233 24… → +233 50…', amount: 'GHS 4,500', risk: 62, tier: 'review' },
  { ref: 'REF2B8Q', route: '+254 71… → +254 72…', amount: 'KES 12,850', risk: 81, tier: 'blocked' },
  { ref: 'REF9M3D', route: '+234 80… → +234 80…', amount: 'NGN 150,000', risk: 12, tier: 'approved' },
  { ref: 'REF4T7P', route: '+256 77… → +256 70…', amount: 'UGX 620,000', risk: 44, tier: 'review' },
  { ref: 'REF1X9L', route: '+255 75… → +255 71…', amount: 'TZS 780,000', risk: 91, tier: 'blocked' },
];

const TIER_STYLES = {
  approved: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'PASS' },
  review:   { dot: 'bg-amber-400',   text: 'text-amber-300',   label: 'REVIEW' },
  blocked:  { dot: 'bg-rose-500',    text: 'text-rose-300',    label: 'BLOCK' },
};

// ─── Signature: self-scrolling triage tape ────────────────────────────────────
function TapeItem({ item }) {
  const t = TIER_STYLES[item.tier];
  return (
    <div className="flex items-center gap-2.5 px-4 shrink-0 border-r border-slate-800/80">
      <span className={clsx('w-1.5 h-1.5 rounded-full', t.dot)} />
      <span className="text-[11px] font-mono text-slate-500">{item.ref}</span>
      <span className="text-[11px] font-mono text-slate-300">
        {item.sender} <span className="text-slate-600">→</span> {item.recipient}
      </span>
      <span className="text-[11px] font-mono text-slate-400">
        {item.currency} {item.amount.toLocaleString()}
      </span>
      <span className={clsx('text-[11px] font-mono font-semibold', t.text)}>{item.risk}%</span>
      <span className={clsx('text-[10px] font-mono font-bold tracking-[0.14em]', t.text)}>{t.label}</span>
    </div>
  );
}

function TickerTape() {
  return (
    <div className="tape border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm" aria-hidden="true" tabIndex={-1}>
      <div className="tape-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center">
            {TICKER.map((item, i) => <TapeItem key={`${copy}-${i}`} item={item} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Signal console (hero artifact) ───────────────────────────────────────────
function SignalConsole() {
  return (
    <div
      className="signature-panel console rounded-[24px] p-4 md:p-6 animate-fade-up opacity-0 stagger-3"
      style={{ animationFillMode: 'forwards' }}
    >
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-[11px] font-semibold text-indigo-300 flex items-center gap-2">
            <Terminal size={12} /> LIVE SIGNAL CONSOLE
          </p>
          <div className="flex items-center gap-2 text-[11px] text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            stream stable
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-3 space-y-1.5 font-mono">
          {CONSOLE_FEED.map((row, i) => {
            const t = TIER_STYLES[row.tier];
            return (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={clsx('w-1 h-3.5 rounded-sm shrink-0', t.dot)} />
                <span className="text-slate-500">{row.ref}</span>
                <span className="text-slate-400 truncate">{row.route}</span>
                <span className="ml-auto text-slate-300">{row.amount}</span>
                <span className={clsx('font-semibold', t.text)}>{row.risk}%</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 text-[11px] text-emerald-300/90">
            <span className="blink w-1.5 h-3.5 bg-emerald-400 inline-block shrink-0" />
            <span>awaiting next signal…</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Queued reviews', value: '182', tone: 'text-amber-300' },
            { label: 'Auto-blocked', value: '13', tone: 'text-rose-300' },
            { label: 'Avg. latency', value: '47ms', tone: 'text-cyan-300' },
            { label: 'Precision floor', value: '99.12%', tone: 'text-emerald-300' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              <p className={clsx('mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums', item.tone)}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────
function SectionIndex({ index, label, tone = 'text-indigo-400' }) {
  return (
    <div className="flex items-center gap-3">
      <span className={clsx('font-mono text-xs font-semibold', tone)}>{index}</span>
      <span className="h-px w-8 bg-slate-700" />
      <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</span>
    </div>
  );
}

function StatCounter({ value, suffix = '', prefix = '', decimals = 0, label }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const dur = 1200;
        const animate = (now) => {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setCount(value * ease);
          if (p < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-2xl sm:text-3xl md:text-4xl font-bold font-mono tabular-nums text-gradient-primary">
        {prefix}{count.toFixed(decimals)}{suffix}
      </p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

// ─── Capability card ──────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, description, color, delay, index }) {
  const colors = {
    indigo: { icon: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', glow: 'hover:border-indigo-500/50 hover:shadow-indigo-500/10' },
    rose:   { icon: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   glow: 'hover:border-rose-500/50 hover:shadow-rose-500/10' },
    emerald:{ icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10' },
    amber:  { icon: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  glow: 'hover:border-amber-500/50 hover:shadow-amber-500/10' },
    cyan:   { icon: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   glow: 'hover:border-cyan-500/50 hover:shadow-cyan-500/10' },
    violet: { icon: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', glow: 'hover:border-violet-500/50 hover:shadow-violet-500/10' },
  };
  const c = colors[color] || colors.indigo;

  return (
    <div
      className={`glass-card rounded-2xl p-5 sm:p-6 border ${c.border} ${c.glow} hover:shadow-lg transition-all duration-300 group cursor-default animate-fade-up opacity-0`}
      style={{ animationDelay: delay, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${c.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
          <Icon size={20} className={c.icon} />
        </div>
        <span className="font-mono text-xs text-slate-700">{index}</span>
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-slate-100 mb-2">{title}</h3>
      <p className="text-[13px] sm:text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Triage lane ──────────────────────────────────────────────────────────────
const LANES = [
  { index: '01', tier: 'Approved', threshold: '< 30%', action: 'Auto-pass', color: 'emerald', desc: 'Clears with no interruption to the sender.' },
  { index: '02', tier: 'Review / MFA', threshold: '30–75%', action: 'Analyst queue · SMS OTP', color: 'amber', desc: 'Routed to an analyst queue or a step-up OTP challenge.' },
  { index: '03', tier: 'Hard Block', threshold: '≥ 75%', action: 'Freeze + flag', color: 'rose', desc: 'Wallet frozen; recipient node flagged for review.' },
];

function Lane({ lane }) {
  const colors = {
    emerald: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'border-emerald-500/25', bg: 'hover:bg-emerald-500/5' },
    amber:   { dot: 'bg-amber-400',   text: 'text-amber-300',   ring: 'border-amber-500/25',   bg: 'hover:bg-amber-500/5' },
    rose:    { dot: 'bg-rose-500',    text: 'text-rose-300',    ring: 'border-rose-500/25',    bg: 'hover:bg-rose-500/5' },
  };
  const c = colors[lane.color];
  return (
    <div className={clsx('glass-card rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 transition-colors duration-200', c.ring, c.bg)}>
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-slate-600">{lane.index}</span>
        <span className={clsx('w-2 h-2 rounded-full shrink-0', c.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display text-base sm:text-lg font-semibold text-slate-100">{lane.tier}</span>
            <span className="font-mono text-xs text-slate-500">{lane.threshold}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{lane.desc}</p>
        </div>
        <span className={clsx('hidden md:inline-flex font-mono text-xs font-semibold uppercase tracking-[0.14em]', c.text)}>
          {lane.action}
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-mesh text-slate-100 overflow-x-hidden">
      {/* ─── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 glass-card border-b border-slate-800/60 px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <span className="block font-display font-bold text-white tracking-wide">FRAUD<span className="text-indigo-400">OPS</span></span>
              <span className="hidden sm:block text-[10px] text-slate-500 uppercase tracking-[0.24em]">Command / Risk Console</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-5 lg:gap-6 text-xs lg:text-sm text-slate-400">
            <a href="#chain" className="hover:text-slate-200 transition-colors">Signal Chain</a>
            <a href="#triage" className="hover:text-slate-200 transition-colors">Triage</a>
            <a href="#features" className="hover:text-slate-200 transition-colors">Capabilities</a>
            <a href="#architecture" className="hover:text-slate-200 transition-colors">Architecture</a>
          </div>
          <button
            id="nav-cta-btn"
            onClick={() => navigate('/login')}
            className="btn-primary text-[11px] px-2.5 py-1 sm:text-xs sm:px-3 sm:py-1.5 lg:text-sm lg:px-4 lg:py-2"
          >
            Analyst Portal <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ─── Signature: live triage tape ─────────────────────────────────────── */}
      <TickerTape />

      {/* ─── Hero ────────────────────────────────────────────────────────────── */}
      <section id="chain" className="relative py-14 md:py-28 px-4 sm:px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-10 w-64 h-64 rounded-full bg-rose-600/5 blur-3xl pointer-events-none animate-float" />
        <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full bg-cyan-600/5 blur-3xl pointer-events-none animate-float" style={{ animationDelay: '3s' }} />

        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-7xl mx-auto grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start animate-fade-up opacity-0" style={{ animationFillMode: 'forwards' }}>
              <SectionIndex index="01" label="Live stream" />
            </div>

            <h1 className="font-display font-bold text-3xl sm:text-5xl md:text-6xl xl:text-7xl text-white leading-[1.04] tracking-tight animate-fade-up opacity-0 stagger-2" style={{ animationFillMode: 'forwards' }}>
              One signal.
              <br />
              <span className="text-gradient-primary">One decision.</span>
            </h1>

            <p className="text-sm md:text-lg text-slate-400 max-w-xl leading-relaxed mx-auto lg:mx-0 animate-fade-up opacity-0 stagger-3" style={{ animationFillMode: 'forwards' }}>
              FraudOps turns behavioral telemetry from five mobile-money networks into sub-second, color-coded triage — so one analyst can hold the line.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 animate-fade-up opacity-0 stagger-4" style={{ animationFillMode: 'forwards' }}>
              <button
                id="hero-cta-btn"
                onClick={() => navigate('/login')}
                className="btn-primary text-sm px-5 py-2.5 sm:text-base sm:px-6 sm:py-3"
              >
                <Lock size={16} />
                Enter the analyst portal
                <ArrowRight size={16} />
              </button>
              <a href="#triage" className="btn-ghost text-sm px-5 py-2.5 sm:text-base sm:px-6 sm:py-3">
                See the signal chain
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 animate-fade-up opacity-0 stagger-5" style={{ animationFillMode: 'forwards' }}>
              {[
                { icon: CheckCircle, text: '3-Tier Automated Triage' },
                { icon: Globe, text: '5 Currency Networks' },
                { icon: Activity, text: 'Supabase Realtime' },
                { icon: Cpu, text: 'RF Champion Model' },
              ].map(({ icon: I, text }) => (
                <div key={text} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <I size={11} className="text-indigo-400" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          <SignalConsole />
        </div>
      </section>

      {/* ─── Triage Lanes ────────────────────────────────────────────────────── */}
      <section id="triage" className="py-14 md:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <SectionIndex index="02" label="Decision engine" tone="text-amber-400" />
          <div className="space-y-3">
            {LANES.map((lane) => <Lane key={lane.index} lane={lane} />)}
          </div>
        </div>
      </section>

      {/* ─── Capabilities ────────────────────────────────────────────────────── */}
      <section id="features" className="py-14 md:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="max-w-xl space-y-5">
            <SectionIndex index="03" label="Capabilities" />
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
              Every layer engineered for <span className="text-gradient-primary">precision</span>
            </h2>
            <p className="text-slate-500">From zero-latency detection to human-in-the-loop override workflows.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard index="03.01" icon={Radio}     color="indigo"  delay="0ms"   title="Zero-Polling Realtime Feed"       description="Supabase WebSocket subscriptions push newly scored transactions to analysts in under 50ms — no polling, no lag." />
            <FeatureCard index="03.02" icon={Shield}    color="rose"    delay="80ms"  title="3-Tier Automated Triage"         description="Approved (< 30%), Review / MFA (30–75%), and Hard Block (≥ 75%) tiers with color-coded visual priority." />
            <FeatureCard index="03.03" icon={Cpu}       color="violet"  delay="160ms" title="25-Feature Behavioral Matrix"    description="Velocity, balance, geographic, device, temporal, and network graph features feed the RF champion model." />
            <FeatureCard index="03.04" icon={Database}  color="amber"   delay="240ms" title="In-Memory Feature Cache"        description="Per-sender sliding-window contexts are computed in a lightweight in-memory FeatureStore — a drop-in path to Redis when scaling out." />
            <FeatureCard index="03.05" icon={Activity}  color="emerald" delay="320ms" title="Human-in-the-Loop Overrides"     description="Risk Managers can confirm fraud, mark safe, or trigger step-up MFA — every decision logged for model retraining." />
            <FeatureCard index="03.06" icon={TrendingUp} color="cyan"   delay="400ms" title="Compliance Audit Exporter"       description="Generate filterable CSV reports with full transaction histories, confidence scores, and analyst reason codes." />
          </div>
        </div>
      </section>

      {/* ─── Architecture ─────────────────────────────────────────────────────── */}
      <section id="architecture" className="py-14 md:py-24 px-4 sm:px-6 bg-slate-900/20">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="max-w-xl space-y-5">
            <SectionIndex index="04" label="Architecture" tone="text-emerald-400" />
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Built for scale & reliability</h2>
          </div>

          <div className="glass-card rounded-2xl border border-slate-700/50 p-4 md:p-8 overflow-x-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 min-w-max mx-auto">
              {[
                { icon: Globe,    label: 'Mobile Network',   sub: 'GHS · KES · NGN · UGX · TZS', color: 'text-cyan-400' },
                { icon: Database, label: 'Feature Cache', sub: 'In-memory sliding window', color: 'text-amber-400' },
                { icon: Cpu,      label: 'RF Champion Model', sub: '50ms inference', color: 'text-indigo-400' },
                { icon: Activity, label: 'Supabase Realtime', sub: 'WebSocket broadcast', color: 'text-emerald-400' },
                { icon: Shield,   label: 'FraudOps UI',       sub: 'Analyst triage center', color: 'text-rose-400' },
              ].map((node, i, arr) => (
                <div key={node.label} className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-2 text-center w-28">
                    <div className="w-12 h-12 rounded-xl glass-card border border-slate-700 flex items-center justify-center">
                      <node.icon size={20} className={node.color} />
                    </div>
                    <p className="text-xs font-semibold text-slate-300 leading-tight">{node.label}</p>
                    <p className="text-[9px] text-slate-600">{node.sub}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex items-center gap-1 text-slate-700">
                      <div className="w-8 h-px bg-slate-700" />
                      <ArrowRight size={12} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Operations ──────────────────────────────────────────────────────── */}
      <section className="py-14 md:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="max-w-xl space-y-5">
            <SectionIndex index="05" label="Operations" tone="text-cyan-400" />
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Measured on the line, not in the lab</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCounter value={99.12} suffix="%" decimals={2} label="Model Precision Floor" />
            <StatCounter value={50} prefix="<" suffix="ms" label="Inference Latency" />
            <StatCounter value={25} label="Behavioral Dimensions" />
            <StatCounter value={99.9} suffix="%" decimals={1} label="Platform Uptime" />
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-14 md:py-24 px-4 sm:px-6 border-t border-slate-800/60">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <SectionIndex index="06" label="Entry" />
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
            One analyst can hold the line
          </h2>
          <p className="text-slate-500">Authorized risk analysts can enter the live triage console immediately.</p>
          <button
            id="footer-cta-btn"
            onClick={() => navigate('/login')}
            className="btn-primary text-sm px-6 py-2.5 sm:text-base sm:px-8 sm:py-3 mx-auto"
          >
            <Lock size={16} />
            Enter the analyst portal
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/60 py-6 px-6 text-center">
        <p className="text-xs text-slate-700">
          © 2026 FraudOps Platform · Mobile Money Fraud Detection System · All sessions are logged and audited · Invite-only access
        </p>
      </footer>
    </div>
  );
}
