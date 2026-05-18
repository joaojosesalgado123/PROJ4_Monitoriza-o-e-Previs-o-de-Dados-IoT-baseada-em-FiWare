'use client';

import { useEffect, useState } from 'react';
import { ChartMachine, fetchChartMachines } from './api';

export function useMachines() {
  const [machines, setMachines] = useState<ChartMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchChartMachines();
        if (!cancelled) {
          setMachines(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { machines, loading, error };
}