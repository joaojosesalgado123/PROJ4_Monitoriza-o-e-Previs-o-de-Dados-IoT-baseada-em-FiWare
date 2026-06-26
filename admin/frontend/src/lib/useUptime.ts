'use client';

import { useCallback, useEffect, useState } from 'react';
import { Uptime, fetchUptime } from './api';

const EMPTY: Uptime = {
  available: false,
  avg_uptime_pct: null,
  minutes: 1440,
  machines: [],
};

export function useUptime(minutes: number = 1440) {
  const [data, setData] = useState<Uptime>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchUptime(minutes);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [minutes]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchUptime(minutes);
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
  }, [minutes]);

  return { data, loading, error, refresh };
}
