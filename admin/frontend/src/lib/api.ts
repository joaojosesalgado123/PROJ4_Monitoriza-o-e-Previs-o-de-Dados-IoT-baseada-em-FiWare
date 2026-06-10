const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

let _token: string | null = null;
export function setApiToken(t: string | null) { _token = t; }
function authHeader(): HeadersInit {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}

type BackendMachine = {
  id: string;
  name: string;
  type: string;
  base_energy: number;
  base_thread: number;
  status: string;
  error_code: number;
  error_description: string;
  energy_consumed: number;
  thread_remaining: number;
  online: boolean;
  paused: boolean;
  water_consumption: number | null;
  chemical_level: number | null;
  compressed_air: number | null;
};

export type MachineStatus = 'running' | 'error' | 'offline' | 'stopped';

export type MachineItem = {
  id: string;
  name: string;
  line: string;
  status: MachineStatus;
  yarnRemaining: number;
  consumption: number;
  lastError: { code: string; message: string } | null;
  lastUpdate: string;
  paused: boolean;
  waterConsumption: number | null;
  chemicalLevel: number | null;
  compressedAir: number | null;
};

export type KpiItem = {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  type: 'energy' | 'status' | 'alert' | 'prediction';
  badge?: { text: string; style: 'success' | 'danger' | 'purple' };
};

export type HistoryPoint = {
  time: string;
  value: number;
};

export type PredictionPoint = {
  time: string;
  value: number;
  min: number;
  max: number;
};

export type EnergyToday = {
  total_kwh: number;
  by_machine: { machine_id: string; kwh: number }[];
};

export type SeverityPoint = {
  time: string;
  running: number;
  warning: number;
  error: number;
};

export type ErrorsTimelinePoint = {
  time: string;
  by_machine: { machine_id: string; error_code: number }[];
};

function adaptMachine(m: BackendMachine): MachineItem {
  const shortId = m.id.split(':').pop() ?? m.id;

  let status: MachineStatus;
  if (m.paused || m.status === 'stopped') {
    status = 'stopped';
  } else if (!m.online || m.status === 'unknown') {
    status = 'offline';
  } else if (m.status === 'warning' || m.status === 'error') {
    status = 'error';
  } else {
    status = 'running';
  }

  const yarnRemaining = m.base_thread > 0
    ? Math.max(0, Math.min(100, (m.thread_remaining / m.base_thread) * 100))
    : 0;

  const lastError = m.error_code === 0
    ? null
    : { code: `E-${m.error_code}`, message: m.error_description };

  return {
    id: `M-${shortId}`,
    name: m.name,
    line: m.type,
    status,
    yarnRemaining: Math.round(yarnRemaining),
    consumption: m.energy_consumed,
    lastError,
    lastUpdate: 'agora',
    paused: m.paused ?? false,
    waterConsumption: m.water_consumption ?? null,
    chemicalLevel: m.chemical_level ?? null,
    compressedAir: m.compressed_air ?? null,
  };
}

export async function fetchMachines(): Promise<MachineItem[]> {
  const res = await fetch(`${API_URL}/api/machines`, { cache: 'no-store', headers: authHeader() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data: BackendMachine[] = await res.json();
  return data.map(adaptMachine);
}

const CHART_COLORS = ['#0f7ee7', '#38a4e8', '#d7bf42', '#10b981', '#8b5cf6', '#f59e0b'];

type FallbackSeries = {
  history: number[];
  forecast: number[];
  forecastMin: number[];
  forecastMax: number[];
  consumed: number[];
  errors: number[];
};

function makeBands(forecast: number[]) {
  return {
    forecastMin: forecast.map((v, i) => +(v - 0.8 + i * 0.02).toFixed(3)),
    forecastMax: forecast.map((v, i) => +(v + 0.8 + i * 0.02).toFixed(3)),
  };
}

const FALLBACK_SERIES: FallbackSeries[] = [
  {
    history: [13.7, 12.7, 12.0, 12.3, 13.5, 14.5, 14.6, 13.6, 12.2, 11.4, 11.5, 12.6, 13.4, 13.5, 12.4, 11.2, 10.9, 11.8, 13.1, 14.1, 14.3, 13.5, 12.4, 12.0],
    forecast: [12.7, 12.8, 12.4, 11.9, 11.8, 12.2, 13.0, 13.7, 13.9, 13.5, 12.9, 12.9, 13.8],
    ...makeBands([12.7, 12.8, 12.4, 11.9, 11.8, 12.2, 13.0, 13.7, 13.9, 13.5, 12.9, 12.9, 13.8]),
    consumed: [3.1, 5.8, 2.4, 6.2, 3.6, 6.7, 2.8, 5.5, 3.7, 6.1, 4.1, 6.4],
    errors: [0, 320, 0, 0, 405, 0, 0, 0, 290, 0, 0, 260],
  },
  {
    history: [12.4, 11.6, 12.1, 11.8, 12.9, 13.3, 12.7, 12.0, 11.5, 11.0, 10.7, 11.3, 12.2, 12.6, 11.9, 10.8, 10.2, 10.6, 11.2, 11.9, 12.3, 11.8, 11.2, 10.9],
    forecast: [11.4, 11.6, 11.7, 11.5, 11.1, 11.3, 11.8, 12.2, 12.4, 12.1, 11.9, 12.0, 12.3],
    ...makeBands([11.4, 11.6, 11.7, 11.5, 11.1, 11.3, 11.8, 12.2, 12.4, 12.1, 11.9, 12.0, 12.3]),
    consumed: [6.8, 4.0, 7.2, 3.9, 6.1, 4.3, 7.0, 3.6, 6.5, 4.7, 6.9, 5.1],
    errors: [0, 0, 280, 0, 0, 0, 0, 390, 0, 0, 310, 0],
  },
  {
    history: [11.3, 11.7, 11.4, 12.0, 12.3, 12.1, 11.9, 12.4, 12.2, 11.8, 11.6, 11.9, 12.0, 12.3, 11.7, 11.4, 11.6, 11.8, 12.1, 12.2, 12.0, 11.8, 11.6, 11.5],
    forecast: [11.7, 11.9, 12.0, 12.1, 12.0, 11.8, 11.9, 12.2, 12.3, 12.1, 12.0, 12.1, 12.4],
    ...makeBands([11.7, 11.9, 12.0, 12.1, 12.0, 11.8, 11.9, 12.2, 12.3, 12.1, 12.0, 12.1, 12.4]),
    consumed: [4.2, 3.7, 5.3, 3.5, 4.8, 3.9, 4.1, 3.2, 5.0, 3.8, 4.7, 3.5],
    errors: [0, 0, 0, 260, 0, 0, 380, 0, 0, 395, 0, 300],
  },
];

export type ChartMachine = {
  id: string;
  name: string;
  shortName: string;
  type: string;
  line: string;
  color: string;
  status: 'Running' | 'Error' | 'Offline' | 'Stopped';
  yarnRemaining: number;
  consumption: number;
  error: string;
  updatedAt: string;
  history: number[];
  forecast: number[];
  forecastMin: number[];
  forecastMax: number[];
  consumed: number[];
  errors: number[];
  failureProbability: number;
  paused: boolean;
  waterConsumption: number | null;
  chemicalLevel: number | null;
  compressedAir: number | null;
};

function toChartMachine(m: MachineItem, index: number): ChartMachine {
  const statusMap: Record<MachineStatus, ChartMachine['status']> = {
    running: 'Running',
    error:   'Error',
    offline: 'Offline',
    stopped: 'Stopped',
  };

  const failureProbMap: Record<MachineStatus, number> = {
    error:   70,
    offline: 20,
    running: 10,
    stopped: 0,
  };

  const series = FALLBACK_SERIES[index % FALLBACK_SERIES.length];

  return {
    id: m.id,
    name: m.name,
    shortName: m.name,
    type: m.line,
    line: m.line,
    color: CHART_COLORS[index % CHART_COLORS.length],
    status: statusMap[m.status],
    yarnRemaining: m.yarnRemaining,
    consumption: m.consumption,
    error: m.lastError ? `${m.lastError.code} · ${m.lastError.message}` : '-',
    updatedAt: 'agora',
    history: series.history,
    forecast: series.forecast,
    forecastMin: series.forecastMin,
    forecastMax: series.forecastMax,
    consumed: series.consumed,
    errors: series.errors,
    failureProbability: failureProbMap[m.status],
    paused: m.paused,
    waterConsumption: m.waterConsumption,
    chemicalLevel: m.chemicalLevel,
    compressedAir: m.compressedAir,
  };
}

export async function fetchChartMachines(): Promise<ChartMachine[]> {
  const machines = await fetchMachines();
  return machines.map(toChartMachine);
}

export async function fetchHistory(
  machineId: string,
  metric: 'energy' | 'thread' = 'energy',
  minutes: number = 60,
): Promise<HistoryPoint[]> {
  const res = await fetch(
    `${API_URL}/api/machines/${machineId}/history?metric=${metric}&minutes=${minutes}`,
    { cache: 'no-store', headers: authHeader() },
  );
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.points;
}

export async function fetchPredictions(
  machineId: string,
  minutes: number = 60,
): Promise<PredictionPoint[]> {
  const res = await fetch(
    `${API_URL}/api/machines/${machineId}/predictions?minutes=${minutes}`,
    { cache: 'no-store', headers: authHeader() },
  );
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.points;
}

export async function fetchEnergyToday(): Promise<EnergyToday> {
  const res = await fetch(`${API_URL}/api/kpi/energy-today`, { cache: 'no-store', headers: authHeader() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function fetchSeverityTimeline(
  minutes: number = 60,
  bucketMinutes: number = 5,
): Promise<SeverityPoint[]> {
  const res = await fetch(
    `${API_URL}/api/alerts/severity?minutes=${minutes}&bucket_minutes=${bucketMinutes}`,
    { cache: 'no-store', headers: authHeader() },
  );
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.points;
}

export async function fetchErrorsTimeline(
  minutes: number = 60,
  bucketMinutes: number = 5,
): Promise<ErrorsTimelinePoint[]> {
  const res = await fetch(
    `${API_URL}/api/alerts/errors-timeline?minutes=${minutes}&bucket_minutes=${bucketMinutes}`,
    { cache: 'no-store', headers: authHeader() },
  );
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.points;
}

export function computeKpis(machines: MachineItem[]): KpiItem[] {
  const total = machines.length;
  const running = machines.filter((m) => m.status === 'running').length;

  const worstMachine = machines
    .filter((m) => m.status !== 'running')
    .sort((a, b) => {
      const rank: Record<MachineStatus, number> = { error: 2, offline: 1, running: 0, stopped: 0 };
      return rank[b.status] - rank[a.status];
    })[0] ?? null;

  return [
    {
      id: '1',
      title: 'ENERGIA CONSUMIDA (HOJE)',
      value: '—',
      subtitle: 'Endpoint de agregação ainda não disponível',
      type: 'energy',
      badge: { text: 'em breve', style: 'purple' },
    },
    {
      id: '2',
      title: 'ESTADO DA FÁBRICA',
      value: `${running} / ${total} operacionais`,
      subtitle: `${total - running} fora de serviço`,
      type: 'status',
    },
    {
      id: '3',
      title: 'ALERTA MAIS RECENTE',
      value: worstMachine
        ? `${worstMachine.lastError?.code ?? worstMachine.status.toUpperCase()} · ${worstMachine.name}`
        : 'Sem alertas activos',
      subtitle: worstMachine?.lastError?.message ?? 'Todas as máquinas operacionais',
      type: 'alert',
      badge: worstMachine?.status === 'error'
        ? { text: 'Crítico', style: 'danger' }
        : undefined,
    },
    {
      id: '4',
      title: 'PREVISÃO PRÓXIMA HORA',
      value: '—',
      subtitle: 'Endpoint LSTM ainda não disponível',
      type: 'prediction',
      badge: { text: 'em breve', style: 'purple' },
    },
  ];
}

export async function machineControl(machineId: string, action: 'start' | 'stop'): Promise<void> {
  const res = await fetch(`${API_URL}/api/machines/${machineId}/control`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`Control error ${res.status}`);
}
