import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

async function callAdmin(action, payload = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Admin request failed with ${response.status}`);
  }

  if (!response.ok || json.error) {
    throw new Error(json?.error || `Admin request failed with ${response.status}`);
  }

  return json;
}

export const adminApi = {
  async listUsers({ page = 1, perPage = 1000 } = {}) {
    return callAdmin('list', { page, perPage });
  },

  async createUser({ email, password, email_confirm = true, user_metadata = {} }) {
    return callAdmin('create', { email, password, email_confirm, user_metadata });
  },

  async inviteUser({ email, role, full_name, redirectTo }) {
    return callAdmin('invite', { email, role, full_name, redirectTo });
  },

  async updateUserRole(id, role) {
    return callAdmin('update_role', { id, role });
  },

  async disableUser(id) {
    return callAdmin('disable', { id });
  },

  async enableUser(id) {
    return callAdmin('enable', { id });
  },

  async deleteUser(id) {
    return callAdmin('delete', { id });
  },

  async resetPassword(id) {
    return callAdmin('reset_password', { id });
  },

  // Read the audit trail directly with the user's own session (RLS is
  // admin-only, see migrations/0003_admin_actions.sql).
  async listActivity(limit = 50) {
    const { data, error } = await supabase
      .from('admin_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { data: { actions: data } };
  },
};
