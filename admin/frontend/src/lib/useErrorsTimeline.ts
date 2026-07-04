'use client';

import { useCallback, useEffect, useState } from 'react';
import { ErrorsTimelinePoint, fetchErrorsTimeline } from './api';

export function useErrorsTimeline(
  minutes: number = 60,
  bucketMinutes: number = 5,
) {
  const [points, setPoints] = useState<ErrorsTimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchErrorsTimeline(minutes, bucketMinutes);
      setPoints(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [minutes, bucketMinutes]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchErrorsTimeline(minutes, bucketMinutes);
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
  }, [minutes, bucketMinutes]);

  return { points, loading, error, refresh };
}