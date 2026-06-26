'use client';

import { useEffect, useState } from 'react';
import { fetchPredictions } from './api';

/**
 * Agrega a previsão mais distante (~+30/35 min) de cada máquina, somando-as,
 * para alimentar o KPI "Previsão próxima hora" do Dashboard.
 * Reaproveita o endpoint /api/machines/<id>/predictions já usado na página de Previsão —
 * não precisa de nenhum endpoint novo no backend.
 */
export function useNextHourForecast(machineIds: string[]) {
  const [forecastKwh, setForecastKwh] = useState(0);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const idsKey = machineIds.join(',');

  useEffect(() => {
    if (machineIds.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const results = await Promise.all(
          machineIds.map((id) => fetchPredictions(id, 35).catch(() => [])),
        );
        if (cancelled) return;

        let total = 0;
        let any = false;
        results.forEach((points) => {
          if (points.length > 0) {
            any = true;
            total += points[points.length - 1].value;
          }
        });

        setForecastKwh(total);
        setAvailable(any);
      } catch {
        if (!cancelled) setAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return { forecastKwh, available, loading };
}
