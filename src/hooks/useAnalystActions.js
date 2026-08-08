import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { performAnalystAction } from '../lib/analystActionsApi';

export function useAnalystActions(updateTransaction) {
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [error, setError] = useState(null);

  const performAction = useCallback(async (tx, action, reasonCode, note) => {
    const txId = tx?.id;
    if (!txId) return false;

    setLoading(true);
    setError(null);

    // Snapshot the pre-action state so the optimistic update can be rolled back
    // if the server-side write fails (otherwise the UI lies about persistence).
    const snapshot = {
      risk_tier: tx.risk_tier,
      analyst_action: tx.analyst_action,
      analyst_note: tx.analyst_note,
      analyst_reason: tx.analyst_reason,
      actioned_at: tx.actioned_at,
      mfa_triggered: tx.mfa_triggered,
    };

    const updates = {
      analyst_action: action,
      analyst_note: note || null,
      analyst_reason: reasonCode,
      actioned_at: new Date().toISOString(),
    };

    if (action === 'confirm_fraud') {
      updates.risk_tier = 'blocked';
    } else if (action === 'override_safe') {
      updates.risk_tier = 'approved';
    } else if (action === 'trigger_mfa') {
      updates.mfa_triggered = true;
    }

    updateTransaction(txId, updates);

    try {
      // Persist server-side via Edge Function (role check + audit insert).
      if (supabase) {
        await performAnalystAction({ transactionId: txId, action, reasonCode, note });
      }
      setLastAction({ txId, action, timestamp: Date.now() });
      return true;
    } catch (e) {
      updateTransaction(txId, snapshot);
      setError(e?.message || 'Server write failed — action not persisted');
      return false;
    } finally {
      setLoading(false);
    }
  }, [updateTransaction]);

  const overrideSafe = useCallback((tx, reasonCode, note) =>
    performAction(tx, 'override_safe', reasonCode, note), [performAction]);

  const confirmFraud = useCallback((tx, reasonCode, note) =>
    performAction(tx, 'confirm_fraud', reasonCode, note), [performAction]);

  const triggerMFA = useCallback((tx) =>
    performAction(tx, 'trigger_mfa', 'mfa_challenge', 'Step-up MFA challenge sent'), [performAction]);

  return { overrideSafe, confirmFraud, triggerMFA, loading, lastAction, error };
}
