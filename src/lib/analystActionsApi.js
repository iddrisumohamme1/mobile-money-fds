import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyst-actions`;

export async function performAnalystAction({ transactionId, action, reasonCode, note }) {
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
    body: JSON.stringify({
      transaction_id: transactionId,
      action,
      reason_code: reasonCode,
      note,
    }),
  });

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Analyst action request failed with ${response.status}`);
  }

  if (!response.ok || json.error) {
    throw new Error(json?.error || `Analyst action request failed with ${response.status}`);
  }

  return json;
}
