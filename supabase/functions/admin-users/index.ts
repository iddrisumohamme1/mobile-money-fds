// ─── Admin Users Edge Function ───────────────────────────────────────────────
// Full team/user lifecycle management, enforced server-side:
//
//   list           -> list auth users (page / perPage)
//   create         -> create a user with a password (email_confirm: true)
//   invite         -> generate an invite link (works without SMTP configured)
//   update_role    -> change user_metadata.role
//   disable        -> ban the user (cannot disable self / last admin)
//   enable         -> lift the ban
//   delete         -> hard-delete the user (cannot delete self / last admin)
//   reset_password -> generate a recovery link (works without SMTP configured)
//
// The service-role key is used ONLY here, server-side. Set it as a Supabase
// secret (Project Settings -> Edge Functions -> Secrets) named
// SERVICE_ROLE_KEY. It must never be shipped to the browser.
//
// Authorization: verifies the caller's session JWT and requires the caller's
// user_metadata.role to be "admin". Every request is denied otherwise.
//
// Every successful action is recorded in the public.admin_actions audit table
// (service role). See migrations/0003_admin_actions.sql.
//
// Deploy:  supabase functions deploy admin-users
// Secrets: supabase secrets set SERVICE_ROLE_KEY=<service_role_key>
// (The SUPABASE_URL secret is provided automatically by Supabase.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const ADMIN_ROLE = 'admin';
const VALID_ROLES = ['analyst', 'risk_manager', 'admin'];
const VALID_ACTIONS = ['list', 'create', 'invite', 'update_role', 'disable', 'enable', 'delete', 'reset_password'];
const BAN_DURATION = '876000h'; // ~100 years, effectively indefinite

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function requireAdmin(authHeader) {
  if (!authHeader) return { error: 'Missing Authorization header', status: 401 };

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : authHeader;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: 'Invalid or expired session', status: 401 };
  }
  if (String(data.user.user_metadata?.role ?? '').toLowerCase() !== ADMIN_ROLE) {
    return { error: 'Forbidden: admin role required', status: 403 };
  }
  return { user: data.user };
}

async function getTargetUser(id) {
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data.user) return null;
  return data.user;
}

async function countAdmins() {
  // Team lists are far below 1000 users, so a single page is enough here.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  return data.users.filter((u) => String(u.user_metadata?.role ?? '').toLowerCase() === ADMIN_ROLE).length;
}

// Safety guards: an admin can never remove/demote/suspend themselves, and the
// team must always keep at least one admin.
async function guardTarget(admin, target) {
  if (target.id === admin.id) {
    return 'You cannot modify your own account';
  }
  if (String(target.user_metadata?.role ?? '').toLowerCase() === ADMIN_ROLE) {
    const count = await countAdmins();
    if (count !== null && count <= 1) {
      return 'Cannot modify the last remaining admin';
    }
  }
  return null;
}

// Best-effort audit write; never fails the primary action.
async function logAction(admin, action, target = null, details = {}) {
  try {
    await supabase.from('admin_actions').insert({
      admin_id: admin.id,
      admin_email: admin.email ?? null,
      action,
      target_id: target?.id ?? null,
      target_email: target?.email ?? null,
      details,
    });
  } catch (e) {
    console.error('admin_actions write failed:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await requireAdmin(req.headers.get('Authorization'));
  if (auth.error) return json({ error: auth.error }, auth.status);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { action, ...params } = body ?? {};
  if (!VALID_ACTIONS.includes(action)) {
    return json({ error: `Unknown action: ${action}` }, 400);
  }

  try {
    switch (action) {
      case 'list': {
        const page = Math.max(1, Number(params.page) || 1);
        const perPage = Math.min(1000, Math.max(1, Number(params.perPage) || 100));
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) return json({ error: error.message }, 400);
        await logAction(auth.user, action);
        return json({ data: { users: data.users } });
      }

      case 'create': {
        const { email, password, email_confirm = true, user_metadata = {} } = params;
        if (!email || !password) return json({ error: 'email and password are required' }, 400);
        if (!VALID_ROLES.includes(user_metadata.role)) {
          return json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, 400);
        }
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm,
          user_metadata,
        });
        if (error) return json({ error: error.message }, 400);
        await logAction(auth.user, action, data.user, { role: user_metadata.role });
        return json({ data: { user: data.user } });
      }

      case 'invite': {
        const { email, role = 'analyst', full_name = null, redirectTo = null } = params;
        if (!email) return json({ error: 'email is required' }, 400);
        if (!VALID_ROLES.includes(role)) {
          return json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, 400);
        }
        const { data, error } = await supabase.auth.admin.generateLink({
          type: 'invite',
          email,
          options: {
            data: { role, ...(full_name ? { full_name } : {}) },
            ...(redirectTo ? { redirectTo } : {}),
          },
        });
        if (error) return json({ error: error.message }, 400);
        const link = data?.properties?.action_link;
        if (!link) {
          return json({ error: 'Invite link could not be generated (SMTP may be required)' }, 400);
        }
        await logAction(auth.user, action, data.user ?? { id: null, email }, { role });
        return json({ data: { invite_link: link } });
      }

      case 'update_role': {
        const { id, role } = params;
        if (!id) return json({ error: 'id is required' }, 400);
        if (!VALID_ROLES.includes(role)) {
          return json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, 400);
        }
        const target = await getTargetUser(id);
        if (!target) return json({ error: 'User not found' }, 404);
        const guardErr = await guardTarget(auth.user, target);
        if (guardErr) return json({ error: guardErr }, 400);
        const { data, error } = await supabase.auth.admin.updateUserById(id, {
          user_metadata: { ...(target.user_metadata || {}), role },
        });
        if (error) return json({ error: error.message }, 400);
        await logAction(auth.user, action, target, { role });
        return json({ data: { user: data.user } });
      }

      case 'disable':
      case 'enable': {
        const { id } = params;
        if (!id) return json({ error: 'id is required' }, 400);
        const target = await getTargetUser(id);
        if (!target) return json({ error: 'User not found' }, 404);
        if (action === 'disable') {
          const guardErr = await guardTarget(auth.user, target);
          if (guardErr) return json({ error: guardErr }, 400);
        }
        const { data, error } = await supabase.auth.admin.updateUserById(id, {
          ban_duration: action === 'disable' ? BAN_DURATION : 'none',
        });
        if (error) return json({ error: error.message }, 400);
        await logAction(auth.user, action, target);
        return json({ data: { user: data.user } });
      }

      case 'delete': {
        const { id } = params;
        if (!id) return json({ error: 'id is required' }, 400);
        const target = await getTargetUser(id);
        if (!target) return json({ error: 'User not found' }, 404);
        const guardErr = await guardTarget(auth.user, target);
        if (guardErr) return json({ error: guardErr }, 400);
        const { error } = await supabase.auth.admin.deleteUser(id);
        if (error) return json({ error: error.message }, 400);
        await logAction(auth.user, action, target);
        return json({ data: { ok: true } });
      }

      case 'reset_password': {
        const { id } = params;
        if (!id) return json({ error: 'id is required' }, 400);
        const target = await getTargetUser(id);
        if (!target) return json({ error: 'User not found' }, 404);
        const { data, error } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: target.email,
        });
        if (error) return json({ error: error.message }, 400);
        const link = data?.properties?.action_link;
        if (!link) {
          return json({ error: 'Recovery link could not be generated (SMTP may be required)' }, 400);
        }
        await logAction(auth.user, action, target);
        return json({ data: { reset_link: link } });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: e?.message ?? 'Internal server error' }, 500);
  }
});
