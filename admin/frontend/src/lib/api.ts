const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

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
};

export type MachineStatus = 'running' | 'error' | 'offline';

export type MachineItem = {
  id: string;
  name: string;
  line: string;
  status: MachineStatus;
  yarnRemaining: number;
  consumption: number;
  lastError: { code: string; message: string } | null;
  lastUpdate: string;
};

export type KpiItem = {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  type: 'energy' | 'status' | 'alert' | 'prediction';
  badge?: { text: string; style: 'success' | 'danger' | 'purple' };
};

function adaptMachine(m: BackendMachine): MachineItem {
  const shortId = m.id.split(':').pop() ?? m.id;

  let status: MachineStatus;
  if (!m.online || m.status === 'unknown') {
    status = 'offline';
  } else if (m.status === 'warning' || m.status === 'error') {
    status = 'error';
  } else {
    status = 'running';
  }

  const yarnRemaining = m.base_thread > 0
    ? Math.max(0, Math.min(100, (m.thread_remaining / m.base_thread) * 100))
    : 0;

  // energy_consumed chega em kWh (base_energy ~5.2 kWh), não dividir por 1000
  const consumption = m.energy_consumed;

  const lastError = m.error_code === 0
    ? null
    : { code: `E-${m.error_code}`, message: m.error_description };

  return {
    id: `M-${shortId}`,
    name: m.name,
    line: m.type,
    status,
    yarnRemaining: Math.round(yarnRemaining),
    consumption,
    lastError,
    lastUpdate: 'agora',
  };
}

export async function fetchMachines(): Promise<MachineItem[]> {
  const res = await fetch(`${API_URL}/api/machines`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data: BackendMachine[] = await res.json();
  return data.map(adaptMachine);
}

export function computeKpis(machines: MachineItem[]): KpiItem[] {
  const total = machines.length;
  const running = machines.filter((m) => m.status === 'running').length;

  const worstMachine = machines
    .filter((m) => m.status !== 'running')
    .sort((a, b) => {
      const rank: Record<MachineStatus, number> = { error: 2, offline: 1, running: 0 };
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
