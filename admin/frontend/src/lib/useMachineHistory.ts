'use client';

import { useCallback, useEffect, useState } from 'react';
import { HistoryPoint, fetchHistory } from './api';

export function useMachineHistory(
  machineId: string | undefined | null,
  metric: 'energy' | 'thread' = 'energy',
  minutes: number = 60,
) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!machineId) return;
    try {
      const data = await fetchHistory(machineId, metric, minutes);
      setPoints(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [machineId, metric, minutes]);

  useEffect(() => {
    if (!machineId) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchHistory(machineId!, metric, minutes);
        if (!cancelled) { setPoints(data); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [machineId, metric, minutes]);

  return { points, loading, error, refresh };
}