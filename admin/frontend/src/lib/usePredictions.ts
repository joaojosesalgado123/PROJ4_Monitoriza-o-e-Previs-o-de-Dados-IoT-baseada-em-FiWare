'use client';

import { useCallback, useEffect, useState } from 'react';
import { PredictionPoint, fetchPredictions } from './api';

export function usePredictions(
  machineId: string | undefined | null,
  minutes: number = 60,
) {
  const [points, setPoints] = useState<PredictionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!machineId) return;
    try {
      const data = await fetchPredictions(machineId, minutes);
      setPoints(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [machineId, minutes]);

  useEffect(() => {
    if (!machineId) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchPredictions(machineId!, minutes);
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
  }, [machineId, minutes]);

  return { points, loading, error, refresh };
}