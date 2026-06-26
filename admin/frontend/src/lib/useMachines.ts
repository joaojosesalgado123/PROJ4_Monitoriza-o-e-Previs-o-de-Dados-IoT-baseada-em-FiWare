'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChartMachine, fetchChartMachines } from './api';

export function useMachines() {
  const [machines, setMachines] = useState<ChartMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await fetchChartMachines();
      setMachines(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [load, rev]);

  // Refresca de imediato quando outra parte da app (ex: modal de criar máquina)
  // sinaliza que a lista de máquinas mudou, sem esperar pelo próximo poll de 15s.
  useEffect(() => {
    const handleExternalChange = () => load();
    window.addEventListener('machines:changed', handleExternalChange);
    return () => window.removeEventListener('machines:changed', handleExternalChange);
  }, [load]);

  const refresh = useCallback(() => setRev((r) => r + 1), []);

  return { machines, loading, error, refresh };
}
