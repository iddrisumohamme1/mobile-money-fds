import { Shield, Bell, LogOut, ChevronDown, Activity, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import StatusDot from '../ui/StatusDot';
import UserManagementModal from './UserManagementModal';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';

function formatAmount(amount, currency) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatter.format(amount)}`;
}

const ROLE_LABELS = {
  analyst:      'Fraud Analyst',
  risk_manager: 'Risk Manager',
  admin:        'System Admin',
};

const ROLE_COLORS = {
  analyst:      'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  risk_manager: 'text-amber-400  bg-amber-500/10  border-amber-500/30',
  admin:        'text-rose-400   bg-rose-500/10   border-rose-500/30',
};

export default function NavHeader({ connectionStatus, alerts = [], onSelectAlert }) {
  const { user, role, signOut, canManageUsers } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => new Set());
  const notifRef = useRef(null);
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Analyst';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const unreadCount = alerts.filter(a => !readIds.has(a.id)).length;

  const openNotifs = () => {
    setNotifOpen(true);
    setMenuOpen(false);
    setReadIds(prev => new Set([...prev, ...alerts.map(a => a.id)]));
  };

  const handleAlertClick = (tx) => {
    setNotifOpen(false);
    onSelectAlert?.(tx);
  };

  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setNotifOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  return (
    <>
      <header className="glass-card border-b border-slate-800/80 sticky top-0 z-30 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Shield size={16} className="text-white sm:hidden" />
              <Shield size={18} className="text-white hidden sm:block" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-ping" />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-white tracking-wide leading-none">FRAUD<span className="text-indigo-400">OPS</span></p>
            <p className="hidden sm:block text-xs text-slate-500 font-mono leading-none mt-0.5">Mobile Money FDS</p>
          </div>
        </div>

        {/* Center: Connection status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full glass-card border border-slate-700/50">
          <Activity size={13} className="text-slate-400" />
          <StatusDot status={connectionStatus} />
          <span className="text-xs text-slate-500 font-mono">RF Champion v2.4.1</span>
        </div>

        {/* Right: Alerts + User */}
        <div className="flex items-center gap-2">
          {/* User management (admin only) */}
          {canManageUsers && (
            <button
              id="user-management-btn"
              onClick={() => setUsersOpen(true)}
              className="relative p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Manage users"
            >
              <Users size={18} />
            </button>
          )}

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              id="notifications-btn"
              onClick={notifOpen ? () => setNotifOpen(false) : openNotifs}
              className="relative p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Fraud alerts"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1rem)] glass-card-elevated rounded-xl border border-slate-700 shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/50">
                  <p className="text-xs font-semibold text-slate-200">Fraud Alerts</p>
                  <span className="text-[10px] font-mono text-slate-500">{alerts.length} unresolved</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <ShieldCheck size={20} className="mx-auto text-slate-600 mb-1.5" />
                      <p className="text-xs text-slate-500">All lanes clear — no unresolved blocks.</p>
                    </div>
                  ) : (
                    alerts.map(a => (
                      <button
                        key={a.id}
                        onClick={() => handleAlertClick(a)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-800/60 transition-colors border-b border-slate-800/40 last:border-b-0"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-mono text-slate-200 truncate">{a.ref_id}</span>
                          <span className="block text-[10px] font-mono text-slate-500 truncate">
                            {a.sender_phone} → {a.recipient_phone}
                          </span>
                          <span className="block text-[9px] text-slate-600 mt-0.5">
                            {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-xs font-semibold text-slate-100 tabular-nums">{formatAmount(a.amount, a.currency)}</span>
                          <span className="block text-[10px] font-mono text-rose-400 font-semibold">{Math.round(a.risk_score * 100)}%</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              id="user-menu-btn"
              onClick={() => { setMenuOpen(!menuOpen); setNotifOpen(false); }}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-800 transition-colors group"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600/40 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-200 leading-none">{name}</p>
                <p className="text-[10px] text-slate-500 leading-none mt-0.5">{ROLE_LABELS[role] || role}</p>
              </div>
              <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-200 transition-transform duration-200" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 glass-card-elevated rounded-xl border border-slate-700 shadow-2xl z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-700/50">
                  <p className="text-xs font-semibold text-slate-200">{name}</p>
                  <p className="text-[10px] text-slate-500">{user?.email}</p>
                  <span className={`mt-1.5 inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[role]}`}>
                    {ROLE_LABELS[role]}
                  </span>
                </div>
                <button
                  id="sign-out-btn"
                  onClick={async () => { setMenuOpen(false); await signOut(); navigate('/login'); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-colors"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    {canManageUsers && (
      <UserManagementModal open={usersOpen} onClose={() => setUsersOpen(false)} />
    )}
    </>
  );
}
