'use client';

import { useMemo } from 'react';
import { useMachines } from './useMachines';
import type { ChartMachine } from './api';

export type NotifSeverity = 'error' | 'warning';

export type AppNotification = {
  id: string;
  severity: NotifSeverity;
  title: string;
  description: string;
  machineId: string;
  machineName: string;
};

function deriveNotifications(machines: ChartMachine[]): AppNotification[] {
  const notifs: AppNotification[] = [];

  for (const m of machines) {
    if (m.status === 'Error') {
      notifs.push({
        id: `${m.id}-error`,
        severity: 'error',
        title: `Erro em ${m.name}`,
        description: m.error !== '-' ? m.error : 'Máquina em estado de erro',
        machineId: m.id,
        machineName: m.name,
      });
    }

    if (m.status === 'Offline') {
      notifs.push({
        id: `${m.id}-offline`,
        severity: 'warning',
        title: `${m.name} offline`,
        description: 'Máquina sem comunicação com o Orion Context Broker.',
        machineId: m.id,
        machineName: m.name,
      });
    }

    if (m.status !== 'Offline') {
      if (m.yarnRemaining < 10) {
        notifs.push({
          id: `${m.id}-yarn-critical`,
          severity: 'error',
          title: `Fio crítico — ${m.name}`,
          description: `Apenas ${m.yarnRemaining}% de fio restante. Substituição urgente.`,
          machineId: m.id,
          machineName: m.name,
        });
      } else if (m.yarnRemaining < 25) {
        notifs.push({
          id: `${m.id}-yarn-low`,
          severity: 'warning',
          title: `Fio baixo — ${m.name}`,
          description: `${m.yarnRemaining}% de fio restante. Programar substituição em breve.`,
          machineId: m.id,
          machineName: m.name,
        });
      }
    }
  }

  // erros primeiro, depois avisos
  return notifs.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

export function useNotifications() {
  const { machines } = useMachines();
  return useMemo(() => deriveNotifications(machines), [machines]);
}
