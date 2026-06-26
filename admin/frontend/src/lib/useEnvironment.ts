'use client';

import { useCallback, useEffect, useState } from 'react';
import { EnvironmentData, fetchEnvironment } from './api';

const EMPTY: EnvironmentData = {
  available: false,
  timestamps: [],
  north_temp: [],
  south_temp: [],
  avg_humidity: [],
};

export function useEnvironment(minutes: number = 60) {
  const [data, setData] = useState<EnvironmentData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await fetchEnvironment(minutes);
      setData(result);
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [minutes]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const result = await fetchEnvironment(minutes);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setData(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    const interval = setInterval(run, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [minutes]);

  return { data, loading, refresh: load };
}
