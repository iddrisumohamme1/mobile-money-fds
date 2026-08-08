// ─── Analyst Actions Edge Function ───────────────────────────────────────────
// Server-side enforcement for analyst overrides:
//   override_safe  -> risk_manager / admin
//   confirm_fraud  -> risk_manager / admin
//   trigger_mfa    -> risk_manager / admin
//
// Uses the SERVICE_ROLE_KEY secret server-side (never shipped to the browser)
// so risk-tier changes and audit entries cannot be forged by calling the
// Supabase client directly. See: supabase/functions/admin-users/index.ts
//
// Deploy:  supabase functions deploy analyst-actions
// Secrets: SERVICE_ROLE_KEY must already be set (shared with admin-users).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const OVERRIDE_ROLES = ['risk_manager', 'admin'];
const VALID_ACTIONS = ['override_safe', 'confirm_fraud', 'trigger_mfa'];

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

function buildUpdates(action, reasonCode, note) {
  const updates = {
    analyst_action: action,
    analyst_note: note ?? null,
    analyst_reason: action === 'trigger_mfa' ? 'mfa_challenge' : reasonCode ?? null,
    actioned_at: new Date().toISOString(),
  };
  if (action === 'confirm_fraud') updates.risk_tier = 'blocked';
  if (action === 'override_safe') updates.risk_tier = 'approved';
  if (action === 'trigger_mfa') updates.mfa_triggered = true;
  return updates;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const { data: authData, error: authError } = await supabase.auth.getUser(authHeader);
  if (authError || !authData.user) return json({ error: 'Invalid or expired session' }, 401);

  const role = String(authData.user.user_metadata?.role ?? '').toLowerCase();
  if (!OVERRIDE_ROLES.includes(role)) {
    return json({ error: 'Forbidden: risk manager or admin role required' }, 403);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { action, transaction_id, reason_code, note } = body ?? {};

  if (!VALID_ACTIONS.includes(action)) {
    return json({ error: `Unknown action: ${action}` }, 400);
  }
  if (!transaction_id) {
    return json({ error: 'transaction_id is required' }, 400);
  }
  if ((action === 'override_safe' || action === 'confirm_fraud') && !reason_code) {
    return json({ error: 'reason_code is required for overrides' }, 400);
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('transactions')
      .select('id')
      .eq('id', transaction_id)
      .single();
    if (fetchErr || !existing) return json({ error: 'Transaction not found' }, 404);

    const updates = buildUpdates(action, reason_code, note);

    const { error: updateErr } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transaction_id);
    if (updateErr) return json({ error: updateErr.message }, 400);

    const { error: insertErr } = await supabase.from('analyst_actions').insert({
      transaction_id,
      action,
      reason_code: action === 'trigger_mfa' ? 'mfa_challenge' : reason_code,
      note,
      created_at: new Date().toISOString(),
    });
    if (insertErr) return json({ error: insertErr.message }, 400);

    return json({ data: { ok: true, updates } });
  } catch (e) {
    return json({ error: e?.message ?? 'Internal server error' }, 500);
  }
});
