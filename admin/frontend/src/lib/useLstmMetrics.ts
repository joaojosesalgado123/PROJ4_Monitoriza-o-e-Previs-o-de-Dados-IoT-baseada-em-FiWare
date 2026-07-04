'use client';

import { useCallback, useEffect, useState } from 'react';
import { LstmMetrics, fetchLstmMetrics } from './api';

const EMPTY: LstmMetrics = {
  available: false,
  mae: null,
  failure_accuracy: null,
  last_trained_at: null,
  machines: [],
};

export function useLstmMetrics() {
  const [data, setData] = useState<LstmMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchLstmMetrics();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchLstmMetrics();
        if (!cancelled) { setData(result); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { data, loading, error, refresh };
}
