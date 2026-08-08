import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { USER_ROLES } from '../lib/constants';

const AuthContext = createContext(null);

// Mock user for when Supabase isn't fully configured
const MOCK_USER = {
  id: 'mock-analyst-001',
  email: 'analyst@fraudops.io',
  user_metadata: {
    full_name: 'Alex Mensah',
    role: USER_ROLES.RISK_MANAGER,
    avatar_url: null,
  },
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      // Mock mode — auto-sign in
      setUser(MOCK_USER);
      setSession({ user: MOCK_USER });
      setLoading(false);
      return;
    }

    const refresh = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) refresh();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // JWT metadata can be stale (e.g. a role promoted server-side); re-fetch
      // the live record so permissions update without waiting for a re-login.
      if (session?.user) refresh();
    });

    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(refresh, 30000);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, []);

  const signOut = async () => {
    if (!supabase) {
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const refreshUser = async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    if (data?.user) setUser(data.user);
    return data?.user ?? null;
  };

  // Role is case-normalized so data issues (e.g. "Admin" vs "admin") can never
  // silently downgrade an account to the default analyst permissions.
  const role = String(user?.user_metadata?.role ?? '').toLowerCase() || USER_ROLES.ANALYST;

  const canOverride  = [USER_ROLES.RISK_MANAGER, USER_ROLES.ADMIN].includes(role);
  const canExport    = [USER_ROLES.RISK_MANAGER, USER_ROLES.ADMIN].includes(role);
  const canManageUsers = role === USER_ROLES.ADMIN;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      role,
      canOverride,
      canExport,
      canManageUsers,
      refreshUser,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
