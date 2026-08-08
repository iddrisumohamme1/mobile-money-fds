import clsx from 'clsx';

export default function StatusDot({ status = 'connected', label, showLabel = true }) {
  const styles = {
    connected:    { dot: 'bg-emerald-400', ring: 'bg-emerald-400/30', text: 'text-emerald-400', label: label || 'Connected' },
    reconnecting: { dot: 'bg-amber-400',   ring: 'bg-amber-400/30',   text: 'text-amber-400',   label: label || 'Reconnecting…' },
    disconnected: { dot: 'bg-rose-400',    ring: 'bg-rose-400/30',    text: 'text-rose-400',    label: label || 'Disconnected' },
    mock:         { dot: 'bg-indigo-400',  ring: 'bg-indigo-400/30',  text: 'text-indigo-400',  label: label || 'Simulation Mode' },
  };

  const s = styles[status] || styles.connected;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', s.ring)} />
        <span className={clsx('relative inline-flex rounded-full h-2.5 w-2.5', s.dot)} />
      </span>
      {showLabel && (
        <span className={clsx('text-xs font-medium', s.text)}>{s.label}</span>
      )}
    </span>
  );
}
