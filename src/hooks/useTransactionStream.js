import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateTransaction, generateHistoricalTransactions } from '../lib/mockData';
import { enrichTransactionWithPrediction, pingBackend, predictTransaction } from '../lib/fraudApi';

const MOCK_INTERVAL_MS = 2200; // new transaction every ~2.2s
const MAX_TRANSACTIONS = 300;
const NO_DATA_FALLBACK_MS = 8000; // start simulation if no real rows arrive
const CHANNEL_FAILOVER_MS = 5000; // start simulation after a channel failure

export function useTransactionStream() {
  const [transactions, setTransactions] = useState(() => generateHistoricalTransactions(60));
  const [connectionStatus, setConnectionStatus] = useState('mock');
  const [isConnected, setIsConnected] = useState(true);
  const channelRef = useRef(null);
  const timerRef = useRef(null);
  const failoverTimerRef = useRef(null);
  const noDataTimerRef = useRef(null);
  const backendAvailableRef = useRef(false);
  const receivedRealRef = useRef(false);
  const mockIdsRef = useRef(new Set());

  // ── Mock simulation (fallback only) ─────────────────────────────────────────
  const stopMockStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startMockStream = useCallback(() => {
    if (timerRef.current) return;
    setConnectionStatus(backendAvailableRef.current ? 'connected' : 'mock');
    setIsConnected(true);

    const publish = (tx) => {
      mockIdsRef.current.add(tx.id);
      setTransactions(prev => {
        const next = [tx, ...prev];
        return next.slice(0, MAX_TRANSACTIONS);
      });

      if (supabase) {
        void supabase
          .from('transactions')
          .insert(tx)
          .then(({ error }) => {
            if (error) console.warn('[Mock Stream] Supabase insert failed:', error.message);
          });
      }
    };

    timerRef.current = setInterval(() => {
      const tx = generateTransaction();

      if (backendAvailableRef.current) {
        // Backend is the source of truth for risk scoring when it is reachable.
        void predictTransaction(tx).then(prediction => {
          publish(prediction ? enrichTransactionWithPrediction(tx, prediction) : tx);
        });
      } else {
        publish(tx);
      }
    }, MOCK_INTERVAL_MS);
  }, []);

  // ── Supabase Realtime (primary source) ──────────────────────────────────────
  const startSupabaseStream = useCallback(() => {
    if (!supabase) { startMockStream(); return; }

    setConnectionStatus('reconnecting');

    channelRef.current = supabase
      .channel('transactions-stream')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
      }, (payload) => {
        const tx = payload.new;

        // Our own simulated inserts echo back over realtime; they are not
        // evidence of a live data source, so they must not stop the fallback.
        if (!mockIdsRef.current.has(tx.id)) {
          receivedRealRef.current = true;
          // A real source is flowing — hand over and stop the simulation.
          stopMockStream();
          setConnectionStatus('connected');
          setIsConnected(true);
        }

        setTransactions(prev => {
          if (prev.some(item => item.id === tx.id)) return prev;
          return [tx, ...prev].slice(0, MAX_TRANSACTIONS);
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('disconnected');
          setIsConnected(false);
          // Fall back to simulation after a short grace period.
          failoverTimerRef.current = setTimeout(startMockStream, CHANNEL_FAILOVER_MS);
        }
      });

    // If no real rows arrive within the grace window (quiet/empty database),
    // run the simulation until the first real insert shows up.
    noDataTimerRef.current = setTimeout(() => {
      if (!receivedRealRef.current) startMockStream();
    }, NO_DATA_FALLBACK_MS);
  }, [startMockStream, stopMockStream]);

  useEffect(() => {
    let cancelled = false;

    const initializeStream = async () => {
      backendAvailableRef.current = await pingBackend();
      if (cancelled) return;

      setConnectionStatus(backendAvailableRef.current ? 'connected' : 'mock');
      setIsConnected(true);

      if (supabase) {
        startSupabaseStream();
      } else {
        startMockStream();
      }
    };

    void initializeStream();

    return () => {
      cancelled = true;
      stopMockStream();
      clearTimeout(failoverTimerRef.current);
      clearTimeout(noDataTimerRef.current);
      if (channelRef.current) supabase?.removeChannel(channelRef.current);
    };
  }, [startMockStream, startSupabaseStream, stopMockStream]);

  const updateTransaction = useCallback((id, updates) => {
    setTransactions(prev =>
      prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx)
    );
  }, []);

  return { transactions, connectionStatus, isConnected, updateTransaction };
}
