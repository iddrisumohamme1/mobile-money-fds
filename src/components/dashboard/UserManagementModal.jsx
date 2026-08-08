import { useEffect, useMemo, useState } from 'react';
import {
  Users, Plus, Loader, RefreshCw, AlertCircle, CheckCircle, Search,
  Ban, Check, Trash2, KeyRound, Copy, Link2, UserPlus, Shield, Clock,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { adminApi } from '../../lib/adminApi';
import { USER_ROLES } from '../../lib/constants';
import clsx from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

const ROLE_OPTIONS = [
  { value: USER_ROLES.ANALYST,      label: 'Fraud Analyst' },
  { value: USER_ROLES.RISK_MANAGER, label: 'Risk Manager' },
  { value: USER_ROLES.ADMIN,        label: 'System Admin' },
];

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]));

const ACTION_LABELS = {
  list: 'Viewed user list',
  create: 'Created user',
  invite: 'Invited user',
  update_role: 'Changed role',
  disable: 'Suspended user',
  enable: 'Reactivated user',
  delete: 'Deleted user',
  reset_password: 'Reset password',
};

function RoleSelect({ value, onChange, disabled }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={clsx(
        'input-dark py-1 pr-7 text-xs w-full',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {ROLE_OPTIONS.map(r => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </select>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy to clipboard"
      className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors shrink-0"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

function LinkNotice({ label, link, onClose }) {
  return (
    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Link2 size={13} className="text-indigo-400 shrink-0" />
        <p className="text-xs text-indigo-300">{label}</p>
        <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">✕</button>
      </div>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 text-[10px] font-mono text-indigo-200 bg-slate-900/60 rounded px-2 py-1 break-all">{link}</code>
        <CopyButton text={link} />
      </div>
    </div>
  );
}

function StatusPill({ user }) {
  const suspended = user.banned_until && new Date(user.banned_until) > new Date();
  const unconfirmed = !user.email_confirmed_at && !suspended;
  const styles = suspended
    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    : unconfirmed
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  const label = suspended ? 'Suspended' : unconfirmed ? 'Unconfirmed' : 'Active';
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', styles)}>
      {label}
    </span>
  );
}

export default function UserManagementModal({ open, onClose }) {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [actions, setActions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState(null);
  const [pending, setPending] = useState(null); // { id, label }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState('invite');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: USER_ROLES.ANALYST });
  const [linkNotice, setLinkNotice] = useState(null);

  const PAGE_SIZE = 6;

  const loadUsers = async () => {
    if (!supabase) {
      setUsers([]);
      setError('User management requires a live Supabase connection.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await adminApi.listUsers({ page: 1, perPage: 1000 });
      if (err) throw err;
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    try {
      const { data, error: err } = await adminApi.listActivity(50);
      if (err) throw err;
      setActions(data.actions || []);
    } catch {
      setActions([]);
    }
  };

  const loadCurrentUser = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    setCurrentUser(data?.user ?? null);
  };

  useEffect(() => {
    if (open) {
      setTab('users');
      setError('');
      setNotice('');
      loadUsers();
      loadActivity();
      loadCurrentUser();
    }
  }, [open]);

  useEffect(() => setPage(1), [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(q) ||
      (u.user_metadata?.full_name || '').toLowerCase().includes(q) ||
      (u.user_metadata?.role || '').toLowerCase().includes(q),
    );
  }, [users, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const isSelf = (user) => user.id === currentUser?.id;

  const updateRole = async (id, role) => {
    if (updatingId === id) return;
    setUpdatingId(id);
    setError('');
    setNotice('');
    setLinkNotice(null);
    try {
      const { error: err } = await adminApi.updateUserRole(id, role);
      if (err) throw err;
      setUsers(prev => prev.map(u => u.id === id ? { ...u, user_metadata: { ...(u.user_metadata || {}), role } } : u));
      setNotice(`Role updated to ${ROLE_LABELS[role]}`);
      loadActivity();
    } catch (e) {
      setError(e.message || 'Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleSuspend = async (user) => {
    const suspended = user.banned_until && new Date(user.banned_until) > new Date();
    setPending({ id: user.id, label: suspended ? 'Reactivating' : 'Suspending' });
    setError('');
    setNotice('');
    setLinkNotice(null);
    try {
      if (suspended) {
        const { error: err } = await adminApi.enableUser(user.id);
        if (err) throw err;
      } else {
        const { error: err } = await adminApi.disableUser(user.id);
        if (err) throw err;
      }
      setNotice(`${user.email} ${suspended ? 'reactivated' : 'suspended'}`);
      await loadUsers();
      loadActivity();
    } catch (e) {
      setError(e.message || 'Failed to update user status');
    } finally {
      setPending(null);
    }
  };

  const requestReset = async (user) => {
    setPending({ id: user.id, label: 'Generating link' });
    setError('');
    setNotice('');
    setLinkNotice(null);
    try {
      const { data, error: err } = await adminApi.resetPassword(user.id);
      if (err) throw err;
      setLinkNotice({ label: `Password reset link for ${user.email}`, link: data.reset_link });
      loadActivity();
    } catch (e) {
      setError(e.message || 'Failed to generate reset link');
    } finally {
      setPending(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    setNotice('');
    try {
      const { error: err } = await adminApi.deleteUser(deleteTarget.id);
      if (err) throw err;
      setNotice(`Deleted ${deleteTarget.email}`);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
      loadActivity();
    } catch (e) {
      setError(e.message || 'Failed to delete user');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setNotice('');
    setLinkNotice(null);
    try {
      if (createMode === 'invite') {
        const { data, error: err } = await adminApi.inviteUser({
          email: form.email,
          role: form.role,
          full_name: form.full_name || null,
          redirectTo: window.location.origin,
        });
        if (err) throw err;
        setLinkNotice({ label: `Invite link for ${form.email}`, link: data.invite_link });
      } else {
        const { data, error: err } = await adminApi.createUser({
          email: form.email,
          password: form.password,
          email_confirm: true,
          user_metadata: { full_name: form.full_name || null, role: form.role },
        });
        if (err) throw err;
        setNotice(`User ${data.user.email} created`);
        setShowCreate(false);
      }
      setForm({ email: '', password: '', full_name: '', role: USER_ROLES.ANALYST });
      loadUsers();
      loadActivity();
    } catch (e) {
      setError(e.message || 'Failed to add user');
    } finally {
      setCreating(false);
    }
  };

  const activityIcon = (action) => {
    const icons = {
      delete: <Trash2 size={13} className="text-rose-400" />,
      disable: <Ban size={13} className="text-rose-400" />,
      create: <UserPlus size={13} className="text-indigo-400" />,
      invite: <Link2 size={13} className="text-indigo-400" />,
      update_role: <Shield size={13} className="text-indigo-400" />,
      reset_password: <KeyRound size={13} className="text-amber-400" />,
      enable: <CheckCircle size={13} className="text-emerald-400" />,
      list: <Clock size={13} className="text-slate-500" />,
    };
    return icons[action] ?? <Shield size={13} className="text-slate-500" />;
  };

  return (
    <Modal open={open} onClose={onClose} title="User Management" size="lg">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-800/50 p-1 w-fit">
          {[
            { key: 'users', label: `Users (${users.length})`, icon: Users },
            { key: 'activity', label: 'Activity', icon: Clock },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                tab === t.key ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {notice && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <CheckCircle size={13} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300">{notice}</p>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
            <AlertCircle size={13} className="text-rose-400 shrink-0" />
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}
        {linkNotice && (
          <LinkNotice label={linkNotice.label} link={linkNotice.link} onClose={() => setLinkNotice(null)} />
        )}

        {tab === 'users' ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search name, email or role…"
                  className="input-dark text-xs pl-8"
                />
              </div>
              <button onClick={() => { setShowCreate(!showCreate); setLinkNotice(null); }} className="btn-primary text-xs shrink-0">
                {showCreate ? <Plus size={12} className="rotate-45" /> : <Plus size={12} />}
                Add User
              </button>
              <button onClick={() => { loadUsers(); loadActivity(); }} className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors shrink-0" title="Refresh">
                <RefreshCw size={13} className={clsx(loading && 'animate-spin')} />
              </button>
            </div>

            {/* Create / invite form */}
            {showCreate && (
              <form onSubmit={submitCreate} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-xs font-medium text-slate-300">Add a team member</p>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-900/60 p-0.5">
                    {[
                      { key: 'invite', label: 'Invite by email' },
                      { key: 'password', label: 'Create with password' },
                    ].map(m => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setCreateMode(m.key)}
                        className={clsx(
                          'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
                          createMode === m.key ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-slate-300',
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    required
                    placeholder="email@company.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="input-dark text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Full name"
                    value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    className="input-dark text-xs"
                  />
                  {createMode === 'password' && (
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Temporary password"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      className="input-dark text-xs"
                    />
                  )}
                  <RoleSelect value={form.role} onChange={role => setForm({ ...form, role })} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-[10px] text-slate-500">
                    {createMode === 'invite'
                      ? 'An invite link is generated (no SMTP needed) — share it with the new member.'
                      : 'The user can sign in immediately with the chosen password.'}
                  </p>
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-primary justify-center text-xs shrink-0 disabled:opacity-60"
                  >
                    {creating ? <Loader size={12} className="animate-spin" /> : <Users size={12} />}
                    {createMode === 'invite' ? 'Generate Invite' : 'Create User'}
                  </button>
                </div>
              </form>
            )}

            {/* User list */}
            <div className="overflow-auto max-h-[300px] rounded-lg border border-slate-800">
              {loading && users.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <Loader size={18} className="text-slate-500 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-10">
                  {users.length === 0 ? 'No users found.' : 'No users match your search.'}
                </p>
              ) : (
                <table className="w-full min-w-[640px] text-xs">
                  <thead className="sticky top-0 bg-slate-900">
                    <tr className="border-b border-slate-800">
                      {['User', 'Email', 'Status', 'Role', 'Created', ''].map((h, i) => (
                        <th key={i} className="text-left py-2 px-3 text-[9px] text-slate-600 font-semibold uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(user => {
                      const self = isSelf(user);
                      const role = user.user_metadata?.role || USER_ROLES.ANALYST;
                      const busy = pending?.id === user.id;
                      const suspended = user.banned_until && new Date(user.banned_until) > new Date();
                      return (
                        <tr key={user.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3 text-slate-200 truncate max-w-[110px]">
                            <span className="flex items-center gap-1.5">
                              {user.user_metadata?.full_name || '—'}
                              {self && <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-px text-[9px] text-indigo-300 font-medium shrink-0">you</span>}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400 truncate max-w-[130px]">{user.email}</td>
                          <td className="py-2 px-3"><StatusPill user={user} /></td>
                          <td className="py-2 px-3 w-[130px]">
                            <RoleSelect
                              value={role}
                              onChange={r => updateRole(user.id, r)}
                              disabled={updatingId === user.id || self}
                            />
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-mono whitespace-nowrap">
                            {format(new Date(user.created_at), 'dd MMM yy')}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-end gap-0.5">
                              {!self && (
                                <>
                                  <button
                                    onClick={() => requestReset(user)}
                                    disabled={busy}
                                    title="Password reset link"
                                    className="p-1 rounded text-slate-500 hover:text-amber-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
                                  >
                                    <KeyRound size={13} />
                                  </button>
                                  <button
                                    onClick={() => toggleSuspend(user)}
                                    disabled={busy}
                                    title={suspended ? 'Reactivate account' : 'Suspend account'}
                                    className={clsx(
                                      'p-1 rounded transition-colors disabled:opacity-50',
                                      suspended
                                        ? 'text-slate-500 hover:text-emerald-300 hover:bg-slate-800'
                                        : 'text-slate-500 hover:text-rose-300 hover:bg-slate-800',
                                    )}
                                  >
                                    {busy ? <Loader size={13} className="animate-spin" /> : suspended ? <Check size={13} /> : <Ban size={13} />}
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget(user)}
                                    disabled={busy}
                                    title="Delete user"
                                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Activity tab */
          <div className="overflow-y-auto max-h-[380px] rounded-lg border border-slate-800">
            {actions.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-10">No admin activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {actions.map(a => (
                  <li key={a.id} className="flex items-start gap-2.5 px-3 py-2.5">
                    <span className="mt-px shrink-0">{activityIcon(a.action)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-200">
                        <span className="font-medium">{a.admin_email || 'Admin'}</span>
                        <span className="text-slate-500"> {ACTION_LABELS[a.action] || a.action} </span>
                        {a.target_email && <span className="font-mono text-slate-400">{a.target_email}</span>}
                        {a.details?.role && (
                          <span className="text-slate-500"> → <span className="text-indigo-300">{ROLE_LABELS[a.details.role] || a.details.role}</span></span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete user"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Permanently delete <span className="font-mono text-slate-200">{deleteTarget?.email}</span>? This cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 disabled:opacity-60 transition-colors flex items-center gap-1.5"
            >
              {deleting ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
