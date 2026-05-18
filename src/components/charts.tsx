'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Gauge,
  Target,
  TimerReset,
  TrendingUp,
  Zap,
} from 'lucide-react';

type MachineKey = 'machineA' | 'machineB' | 'machineC';

type Series = {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
};

type Point = {
  x: number;
  y: number;
};

type AlertRow = {
  id: string;
  machine: string;
  occurrence: string;
  severity: 'Crítico' | 'Aviso' | 'Info';
  status: 'Aberto' | 'Em análise' | 'Resolvido';
  firedAt: string;
};

export const times = ['18:40', '18:45', '18:50', '18:55', '19:00', '19:05', '19:10', '19:15', '19:20', '19:25', '19:30', '19:35'];

const machines: Record<MachineKey, {
  id: string;
  name: string;
  shortName: string;
  type: string;
  line: string;
  color: string;
  status: 'Running' | 'Error' | 'Offline';
  yarnRemaining: number;
  consumption: number;
  error: string;
  updatedAt: string;
  history: number[];
  forecast: number[];
  consumed: number[];
  errors: number[];
  failureProbability: number;
}> = {
  machineA: {
    id: 'M-001',
    name: 'Tear Circular A',
    shortName: 'Máquina A',
    type: 'Fiação',
    line: 'Linha Norte',
    color: '#0f7ee7',
    status: 'Running',
    yarnRemaining: 78,
    consumption: 14.2,
    error: '-',
    updatedAt: 'há 3s',
    history: [13.7, 12.7, 12.0, 12.3, 13.5, 14.5, 14.6, 13.6, 12.2, 11.4, 11.5, 12.6, 13.4, 13.5, 12.4, 11.2, 10.9, 11.8, 13.1, 14.1, 14.3, 13.5, 12.4, 12.0],
    forecast: [12.7, 12.8, 12.4, 11.9, 11.8, 12.2, 13.0, 13.7, 13.9, 13.5, 12.9, 12.9, 13.8],
    consumed: [3.1, 5.8, 2.4, 6.2, 3.6, 6.7, 2.8, 5.5, 3.7, 6.1, 4.1, 6.4],
    errors: [0, 320, 0, 0, 405, 0, 0, 0, 290, 0, 0, 260],
    failureProbability: 12,
  },
  machineB: {
    id: 'M-002',
    name: 'Tear Jacquard B',
    shortName: 'Máquina B',
    type: 'Tecelagem',
    line: 'Linha Norte',
    color: '#38a4e8',
    status: 'Error',
    yarnRemaining: 22,
    consumption: 3.1,
    error: 'E-204 · Falha de tensão',
    updatedAt: 'há 12s',
    history: [12.4, 11.6, 12.1, 11.8, 12.9, 13.3, 12.7, 12.0, 11.5, 11.0, 10.7, 11.3, 12.2, 12.6, 11.9, 10.8, 10.2, 10.6, 11.2, 11.9, 12.3, 11.8, 11.2, 10.9],
    forecast: [11.4, 11.6, 11.7, 11.5, 11.1, 11.3, 11.8, 12.2, 12.4, 12.1, 11.9, 12.0, 12.3],
    consumed: [6.8, 4.0, 7.2, 3.9, 6.1, 4.3, 7.0, 3.6, 6.5, 4.7, 6.9, 5.1],
    errors: [0, 0, 280, 0, 0, 0, 0, 390, 0, 0, 310, 0],
    failureProbability: 71,
  },
  machineC: {
    id: 'M-003',
    name: 'Tear Retilíneo C',
    shortName: 'Máquina C',
    type: 'Tingimento',
    line: 'Linha Sul',
    color: '#d7bf42',
    status: 'Offline',
    yarnRemaining: 54,
    consumption: 0,
    error: 'E-101 · Manutenção programada',
    updatedAt: 'há 4m',
    history: [11.3, 11.7, 11.4, 12.0, 12.3, 12.1, 11.9, 12.4, 12.2, 11.8, 11.6, 11.9, 12.0, 12.3, 11.7, 11.4, 11.6, 11.8, 12.1, 12.2, 12.0, 11.8, 11.6, 11.5],
    forecast: [11.7, 11.9, 12.0, 12.1, 12.0, 11.8, 11.9, 12.2, 12.3, 12.1, 12.0, 12.1, 12.4],
    consumed: [4.2, 3.7, 5.3, 3.5, 4.8, 3.9, 4.1, 3.2, 5.0, 3.8, 4.7, 3.5],
    errors: [0, 0, 0, 260, 0, 0, 380, 0, 0, 395, 0, 300],
    failureProbability: 8,
  },
};

const machineRows = Object.values(machines);

const consumedSeries: Series[] = machineRows.map((machine) => ({
  label: machine.shortName,
  color: machine.color,
  values: machine.consumed,
}));

const initialAlerts: AlertRow[] = [
  { id: 'A-1041', machine: 'M-002', occurrence: 'E-204 · Falha de tensão na urdideira', severity: 'Crítico', status: 'Aberto', firedAt: 'há 12s' },
  { id: 'A-1040', machine: 'M-003', occurrence: 'Manutenção programada em curso', severity: 'Info', status: 'Em análise', firedAt: 'há 4m' },
  { id: 'A-1039', machine: 'M-001', occurrence: 'Consumo acima do limite durante 8 min', severity: 'Aviso', status: 'Resolvido', firedAt: 'há 21m' },
  { id: 'A-1038', machine: 'M-002', occurrence: 'Vibração fora da banda nominal', severity: 'Aviso', status: 'Resolvido', firedAt: 'há 38m' },
  { id: 'A-1037', machine: 'M-001', occurrence: 'Fio abaixo dos 30%', severity: 'Aviso', status: 'Resolvido', firedAt: 'há 1h' },
];

const severitySeries: Series[] = [
  { label: 'Crítico', color: '#ef4444', values: [0, 1, 1, 0, 2, 1, 0, 2, 1, 0, 1, 1] },
  { label: 'Aviso', color: '#f59e0b', values: [2, 1, 3, 2, 2, 4, 2, 3, 2, 3, 4, 3] },
  { label: 'Info', color: '#0f7ee7', values: [1, 0, 1, 1, 0, 2, 1, 0, 1, 1, 0, 1] },
];

function toPoints(values: number[], min: number, max: number, width: number, height: number, padX = 42, padY = 28): Point[] {
  const range = max - min || 1;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;

  return values.map((value, index) => ({
    x: padX + (index / Math.max(values.length - 1, 1)) * plotWidth,
    y: padY + ((max - value) / range) * plotHeight,
  }));
}

function pathFromPoints(points: Point[]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function areaPath(points: Point[], height: number, padY = 28) {
  const first = points[0];
  const last = points[points.length - 1];
  return `${pathFromPoints(points)} L ${last.x.toFixed(1)} ${height - padY} L ${first.x.toFixed(1)} ${height - padY} Z`;
}

function bandPath(top: Point[], bottom: Point[]) {
  return `${pathFromPoints(top)} ${[...bottom].reverse().map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')} Z`;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function PageIntro({
  icon,
  tint,
  title,
  description,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tint}`}>
        {icon}
      </div>
      <div>
        <h1 className="text-[22px] font-bold leading-tight text-slate-900">{title}</h1>
        <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  icon,
  badge,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[12px] font-medium uppercase text-slate-500">{label}</div>
        <div>{icon}</div>
      </div>
      <div className="mt-3 text-[26px] font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-8 flex items-end justify-between gap-4">
        <p className="text-[13px] leading-5 text-slate-500">{detail}</p>
        {badge && (
          <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-600">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={classNames('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex items-start justify-between gap-6 p-6">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-2 text-[14px] leading-5 text-slate-500">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="border-t border-slate-100 p-6">{children}</div>
    </section>
  );
}

function SeriesLegend({
  series,
  disabled,
  onToggle,
}: {
  series: Series[];
  disabled: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[13px] text-slate-500">
      {series.map((item) => {
        const isDisabled = disabled.includes(item.label);

        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onToggle(item.label)}
            className={classNames('inline-flex items-center gap-2 rounded-md transition-opacity', isDisabled && 'opacity-35')}
          >
            <span className="h-2 w-4 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function InteractiveLineChart({
  series,
  labels = times,
  yTicks = [0, 2, 4, 6, 8],
  height = 280,
}: {
  series: Series[];
  labels?: string[];
  yTicks?: number[];
  height?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [disabled, setDisabled] = useState<string[]>([]);
  const activeSeries = series.filter((item) => !disabled.includes(item.label));
  const width = 1180;
  const values = activeSeries.flatMap((item) => item.values);
  const min = Math.min(0, ...values, ...yTicks);
  const max = Math.max(...values, ...yTicks);
  const hoverX = hoverIndex === null ? 0 : 42 + (hoverIndex / Math.max(labels.length - 1, 1)) * (width - 84);

  const toggleSeries = (label: string) => {
    setDisabled((current) => {
      if (!current.includes(label)) return [...current, label];
      return current.filter((item) => item !== label);
    });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <SeriesLegend series={series} disabled={disabled} onToggle={toggleSeries} />
      </div>
      <div className="relative h-[280px] w-full overflow-hidden">
        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-3 z-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-lg"
            style={{ left: `min(calc(${(hoverX / width) * 100}% + 8px), calc(100% - 170px))` }}
          >
            <div className="mb-1 font-semibold text-slate-900">{labels[hoverIndex]}</div>
            {activeSeries.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
                <span className="font-mono">{item.values[hoverIndex]?.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full"
          role="img"
          aria-label="Gráfico interativo"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((tick) => {
            const y = toPoints([tick], min, max, width, height)[0].y;

            return (
              <g key={tick}>
                <line x1="42" x2={width - 26} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x="12" y={y + 4} className="fill-slate-500 text-[12px]">
                  {tick}
                </text>
              </g>
            );
          })}

          {labels.map((label, index) => {
            const x = 42 + (index / Math.max(labels.length - 1, 1)) * (width - 84);

            return (
              <g key={label}>
                <line x1={x} x2={x} y1="28" y2={height - 34} stroke="#eef2f7" />
                {index % 2 === 0 && (
                  <text x={x - 18} y={height - 8} className="fill-slate-500 text-[11px]">
                    {label}
                  </text>
                )}
                <rect
                  x={x - 22}
                  y="0"
                  width="44"
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(index)}
                />
              </g>
            );
          })}

          {hoverIndex !== null && <line x1={hoverX} x2={hoverX} y1="28" y2={height - 34} stroke="#94a3b8" strokeDasharray="3 4" />}

          {activeSeries.map((item) => {
            const points = toPoints(item.values, min, max, width, height);

            return (
              <g key={item.label}>
                <path
                  d={pathFromPoints(points)}
                  fill="none"
                  stroke={item.color}
                  strokeDasharray={item.dashed ? '7 7' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                />
                {hoverIndex !== null && points[hoverIndex] && (
                  <circle
                    cx={points[hoverIndex].x}
                    cy={points[hoverIndex].y}
                    r="5"
                    fill="white"
                    stroke={item.color}
                    strokeWidth="3"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function ErrorBarsChart() {
  const [hovered, setHovered] = useState<{ series: string; index: number; value: number } | null>(null);
  const series = machineRows.map((machine) => ({
    label: machine.shortName,
    color: machine.color,
    values: machine.errors,
  }));
  const width = 1180;
  const height = 280;
  const max = 420;
  const groupWidth = (width - 84) / times.length;

  return (
    <div className="relative h-[280px] w-full">
      {hovered && (
        <div className="absolute right-4 top-3 z-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-lg">
          <div className="font-semibold text-slate-900">{hovered.series}</div>
          <div className="text-slate-500">{times[hovered.index]} · código {hovered.value}</div>
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Códigos de erro por máquina">
        {[0, 100, 200, 300, 400].map((tick) => {
          const y = toPoints([tick], 0, max, width, height)[0].y;

          return (
            <g key={tick}>
              <line x1="42" x2={width - 26} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x="10" y={y + 4} className="fill-slate-500 text-[12px]">{tick}</text>
            </g>
          );
        })}
        {times.map((label, index) => {
          const x = 42 + (index / (times.length - 1)) * (width - 84);
          return (
            <g key={label}>
              <line x1={x} x2={x} y1="28" y2={height - 34} stroke="#eef2f7" />
              {index % 2 === 0 && <text x={x - 17} y={height - 8} className="fill-slate-500 text-[11px]">{label}</text>}
            </g>
          );
        })}
        {series.map((item, seriesIndex) =>
          item.values.map((value, index) => {
            const barHeight = ((height - 62) * value) / max;
            const x = 42 + index * groupWidth + 13 + seriesIndex * 12;
            const y = height - 34 - barHeight;

            return (
              <rect
                key={`${item.label}-${index}`}
                x={x}
                y={y}
                width="5"
                height={barHeight}
                rx="2"
                fill={item.color}
                opacity={value === 0 ? 0 : 0.9}
                onMouseEnter={() => value > 0 && setHovered({ series: item.label, index, value })}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

export function FailureProbabilityChart() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {machineRows.map((machine) => {
        const value = machine.failureProbability;
        const color = value >= 65 ? '#ef4444' : value >= 35 ? '#f59e0b' : '#10b981';

        return (
          <div key={machine.id} className="relative">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <div className="text-[14px] font-semibold text-slate-900">{machine.shortName}</div>
                <div className="text-[12px] text-slate-500">{machine.type} · {machine.status}</div>
              </div>
              <div className="font-mono text-[18px] font-bold" style={{ color }}>
                {value}%
              </div>
            </div>
            <div
              className="h-4 rounded-full bg-slate-100"
              onMouseEnter={() => setHovered(machine.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${value}%`, backgroundColor: color }}
              />
            </div>
            {hovered === machine.id && (
              <div className="absolute right-0 top-12 z-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-lg">
                <div className="font-semibold text-slate-900">{machine.name}</div>
                <div className="text-slate-500">Probabilidade nas próximas 2h: {value}%</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function YarnRemainingChart() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-3 gap-4">
      {machineRows.map((machine) => {
        const value = machine.yarnRemaining;
        const color = value <= 25 ? '#ef4444' : value <= 55 ? '#f59e0b' : '#10b981';
        const circumference = 2 * Math.PI * 48;
        const dash = (value / 100) * circumference;

        return (
          <button
            key={machine.id}
            type="button"
            onMouseEnter={() => setHovered(machine.id)}
            onMouseLeave={() => setHovered(null)}
            className="relative rounded-2xl border border-slate-200 bg-slate-50/50 p-5 text-left transition hover:border-slate-300 hover:bg-white"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[14px] font-semibold text-slate-900">{machine.shortName}</div>
                <div className="mt-1 text-[12px] text-slate-500">{machine.name}</div>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-500 shadow-sm">{machine.type}</span>
            </div>
            <div className="mt-5 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-32 w-32" role="img" aria-label={`Fio restante ${machine.shortName}`}>
                <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke={color}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="64" textAnchor="middle" className="fill-slate-900 text-[22px] font-bold">
                  {value}%
                </text>
              </svg>
            </div>
            <div className="mt-2 text-center text-[12px] text-slate-500">Fio restante</div>
            {hovered === machine.id && (
              <div className="absolute left-4 right-4 top-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-lg">
                <div className="font-semibold text-slate-900">{machine.name}</div>
                <div className="text-slate-500">{value <= 25 ? 'Reposição urgente recomendada.' : 'Nível dentro do intervalo operacional.'}</div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SeverityOverTimeChart() {
  return (
    <InteractiveLineChart
      series={severitySeries}
      yTicks={[0, 1, 2, 3, 4]}
      height={260}
    />
  );
}

export function PredictionPanel() {
  const [machineKey, setMachineKey] = useState<MachineKey>('machineA');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const machine = machines[machineKey];
  const width = 1180;
  const height = 330;
  const labels = ['-60m', '-52m', '-44m', '-36m', '-28m', '-20m', '-12m', '-4m', '+4m', '+12m', '+20m', '+28m'];
  const real = machine.history;
  const forecast = machine.forecast;
  const forecastStart = real.length - 1;
  const minBand = forecast.map((value, index) => value - 0.8 + index * 0.02);
  const maxBand = forecast.map((value, index) => value + 0.8 + index * 0.02);
  const realPoints = toPoints(real, 0, 16, width, height, 46, 28);
  const forecastPoints = toPoints(forecast, 0, 16, width, height, 46 + ((forecastStart / (real.length + forecast.length - 2)) * (width - 92)), 28);
  const minPoints = toPoints(minBand, 0, 16, width, height, 46 + ((forecastStart / (real.length + forecast.length - 2)) * (width - 92)), 28);
  const maxPoints = toPoints(maxBand, 0, 16, width, height, 46 + ((forecastStart / (real.length + forecast.length - 2)) * (width - 92)), 28);
  const nowX = realPoints[realPoints.length - 1].x;
  const hoverPoint = hoverIndex !== null ? realPoints[hoverIndex] : null;

  return (
    <Panel
      title="Consumo energético · histórico + previsão"
      subtitle="Últimos 60 minutos de telemetria e projeção dos próximos 30 minutos pelo modelo LSTM."
      actions={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-[13px] text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-full bg-[#0f7ee7]" />Histórico</span>
            <span className="inline-flex items-center gap-2"><span className="flex gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" /><span className="h-2 w-2 rounded-full bg-violet-500" /></span>Previsão IA</span>
          </div>
          <label className="relative">
            <select
              value={machineKey}
              onChange={(event) => setMachineKey(event.target.value as MachineKey)}
              className="h-10 min-w-[230px] appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-[14px] text-slate-900 outline-none transition focus:border-[#0f7ee7] focus:ring-4 focus:ring-blue-500/10"
            >
              {Object.entries(machines).map(([key, item]) => (
                <option key={key} value={key}>{item.id} · {item.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          </label>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-4">
        <KpiMini label="Consumo atual" value={`${machine.consumption.toFixed(2)} kW`} />
        <KpiMini label="Previsão média (30 min)" value={`${(machine.forecast.reduce((sum, value) => sum + value, 0) / machine.forecast.length).toFixed(2)} kW`} icon={<BrainCircuit size={14} />} />
        <KpiMini label="Variação esperada" value="+6.3%" accent="text-red-500" icon={<TrendingUp size={15} />} />
      </div>

      <div className="relative mt-4 h-[330px] overflow-hidden">
        {hoverPoint && (
          <div className="absolute top-4 z-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-lg" style={{ left: `min(calc(${(hoverPoint.x / width) * 100}% + 8px), calc(100% - 150px))` }}>
            <div className="font-semibold text-slate-900">{labels[Math.min(hoverIndex ?? 0, labels.length - 1)]}</div>
            <div className="text-slate-500">{machine.shortName}: {machine.history[hoverIndex ?? 0].toFixed(2)} kW</div>
          </div>
        )}
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Previsão de consumo">
          {[0, 4, 8, 12, 16].map((tick) => {
            const y = toPoints([tick], 0, 16, width, height, 46, 28)[0].y;
            return (
              <g key={tick}>
                <line x1="46" x2={width - 26} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x="12" y={y + 4} className="fill-slate-500 text-[12px]">{tick || 'kW'}</text>
              </g>
            );
          })}
          {labels.map((label, index) => {
            const x = 46 + (index / (labels.length - 1)) * (width - 92);
            return (
              <text key={label} x={x - 16} y={height - 8} className="fill-slate-500 text-[11px]">{label}</text>
            );
          })}
          <path d={areaPath(realPoints, height)} fill="#0f7ee7" opacity="0.12" />
          <path d={bandPath(maxPoints, minPoints)} fill="#8b5cf6" opacity="0.12" />
          <path d={pathFromPoints(realPoints)} fill="none" stroke="#0f7ee7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={pathFromPoints(forecastPoints)} fill="none" stroke="#8b5cf6" strokeDasharray="7 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <line x1={nowX} x2={nowX} y1="28" y2={height - 28} stroke="#64748b" strokeDasharray="3 5" />
          <text x={nowX - 38} y="48" className="fill-slate-500 text-[11px]">agora</text>
          {realPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="13"
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          ))}
        </svg>
      </div>
    </Panel>
  );
}

function KpiMini({
  label,
  value,
  accent = 'text-slate-900',
  icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2 text-[12px] font-medium uppercase text-slate-500">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-[22px] font-bold ${accent}`}>{value}</div>
    </div>
  );
}

export function DashboardOverview() {
  const latestAlerts = initialAlerts.slice(0, 3);

  return (
    <section className="mx-auto max-w-[1500px]">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Energia consumida (hoje)" value="182.4 kWh" detail="Acumulado nas 3 máquinas desde 00:00" icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-[#0f7ee7]"><Zap size={20} /></span>} badge="-4.1% vs ontem" />
        <KpiCard label="Estado da fábrica" value="2 / 3 operacionais" detail="1 em manutenção · 0 em paragem crítica" icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><Activity size={20} /></span>} />
        <KpiCard label="Alerta mais recente" value="E-204 · Máquina 002" detail="Falha de tensão detetada há 12 segundos" icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-500"><AlertTriangle size={20} /></span>} badge="Crítico" />
        <KpiCard label="Previsão próxima hora" value="21.6 kWh" detail="Estimativa do modelo LSTM para consumo agregado" icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600"><BrainCircuit size={20} /></span>} badge="LSTM" />
      </div>

      <div className="mt-6">
        <PredictionPanel />
      </div>

      <div className="mt-6 grid grid-cols-[0.85fr_1.15fr] gap-4">
        <Panel title="Risco operacional" subtitle="Resumo do risco previsto por máquina.">
          <FailureProbabilityChart />
        </Panel>
        <Panel title="Últimas ocorrências" subtitle="Eventos recentes que precisam de atenção ou acompanhamento.">
          <div className="space-y-3">
            {latestAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="font-mono text-[12px] text-slate-500">{alert.id}</span>
                  </div>
                  <div className="mt-2 text-[14px] font-semibold text-slate-900">{alert.occurrence}</div>
                  <div className="mt-1 text-[12px] text-slate-500">{alert.machine} · {alert.firedAt}</div>
                </div>
                <StatusText status={alert.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

export function MachinesView() {
  const [filter, setFilter] = useState<'Todos' | 'Running' | 'Error' | 'Offline'>('Todos');
  const filteredRows = filter === 'Todos' ? machineRows : machineRows.filter((row) => row.status === filter);

  return (
    <section className="mx-auto max-w-[1500px]">
      <PageIntro
        icon={<Cpu size={23} className="text-[#0f7ee7]" />}
        tint="bg-blue-100"
        title="Gestão de Máquinas"
        description="Inventário completo dos Agentes IoT. Cada máquina publica telemetria em NGSI-v2 para o Orion Context Broker."
      />

      <div className="mt-7 grid grid-cols-3 gap-4">
        <KpiCard label="Agentes registados" value="3" detail="1 operacionais · 2 com incidência" icon={<Gauge size={16} className="text-slate-500" />} />
        <KpiCard label="Consumo agregado" value="17.3 kW" detail="Média em tempo real · amostra últimos 5 min" icon={<Zap size={16} className="text-slate-500" />} />
        <KpiCard label="Uptime médio" value="96.4%" detail="Últimos 7 dias · excluindo manutenções programadas" icon={<TimerReset size={16} className="text-slate-500" />} />
      </div>

      <Panel
        className="mt-6"
        title="Estado das máquinas · tempo real"
        subtitle="Telemetria enviada pelos Agentes IoT para o Orion Context Broker."
        actions={
          <div className="flex items-center gap-2">
            {(['Todos', 'Running', 'Error', 'Offline'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={classNames('rounded-full border px-3 py-1.5 text-[12px] font-medium transition', filter === item ? 'border-[#0f7ee7] bg-blue-50 text-[#0f7ee7]' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50')}
              >
                {item}
              </button>
            ))}
          </div>
        }
      >
        <MachineTable rows={filteredRows} />
      </Panel>

      <Panel className="mt-6" title="Fio restante por máquina" subtitle="Leitura percentual dos sensores de alimentação de fio.">
        <YarnRemainingChart />
      </Panel>

      <Panel className="mt-6" title="Energia consumida por máquina" subtitle="Consumo por agente IoT nas últimas leituras agregadas.">
        <InteractiveLineChart series={consumedSeries} />
      </Panel>

      <Panel className="mt-6" title="Condições ambientais por linha" subtitle="Leituras agregadas dos sensores de temperatura e humidade.">
        <InteractiveLineChart
          series={[
            { label: 'Linha Norte · temperatura', color: '#f59e0b', values: [22, 22.4, 23.1, 22.8, 23.5, 24, 23.6, 23.2, 22.9, 23.4, 24.1, 23.8] },
            { label: 'Linha Sul · temperatura', color: '#0f7ee7', values: [21.5, 21.7, 22.1, 22.4, 22.6, 22.3, 22.0, 22.2, 22.8, 23.1, 22.7, 22.5] },
            { label: 'Humidade média', color: '#10b981', values: [48, 51, 50, 49, 53, 52, 50, 51, 49, 48, 50, 52] },
          ]}
          yTicks={[20, 30, 40, 50, 60]}
        />
      </Panel>
    </section>
  );
}

function MachineTable({ rows }: { rows: typeof machineRows }) {
  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-900">
            <th className="w-[110px] py-3">ID</th>
            <th className="py-3">Máquina</th>
            <th className="w-[140px] py-3">Status</th>
            <th className="w-[230px] py-3">Fio restante</th>
            <th className="w-[140px] py-3">Consumo</th>
            <th className="py-3">Último erro</th>
            <th className="w-[110px] py-3 text-right">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((machine) => {
            const isRunning = machine.status === 'Running';
            const statusClass = isRunning ? 'bg-emerald-100 text-emerald-600' : machine.status === 'Error' ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600';
            const barClass = isRunning ? 'bg-emerald-500' : machine.status === 'Error' ? 'bg-red-500' : 'bg-amber-500';

            return (
              <tr key={machine.id} className="border-b border-slate-200 last:border-b-0">
                <td className="py-4 font-mono text-[13px] text-slate-900">{machine.id}</td>
                <td className="py-4">
                  <div className="font-semibold text-slate-900">{machine.name}</div>
                  <div className="text-[12px] text-slate-500">{machine.line}</div>
                </td>
                <td className="py-4">
                  <span className={classNames('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', statusClass)}>
                    <span className={classNames('h-1.5 w-1.5 rounded-full', isRunning ? 'bg-emerald-500' : machine.status === 'Error' ? 'bg-red-500' : 'bg-amber-500')} />
                    {machine.status}
                  </span>
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                      <div className={classNames('h-full rounded-full', barClass)} style={{ width: `${machine.yarnRemaining}%` }} />
                    </div>
                    <span className="w-10 text-right text-[13px] font-semibold text-slate-900">{machine.yarnRemaining}%</span>
                  </div>
                </td>
                <td className="py-4"><span className="font-semibold">{machine.consumption.toFixed(1)}</span> <span className="text-[12px] text-slate-500">kW</span></td>
                <td className={classNames('py-4 font-mono text-[12px]', machine.error === '-' ? 'text-slate-500' : machine.status === 'Error' ? 'text-red-500' : 'text-amber-500')}>{machine.error}</td>
                <td className="py-4 text-right text-[12px] text-slate-500">{machine.updatedAt}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ForecastView() {
  const metricCards = [
    { label: 'MAE · consumo', value: '0.41 kW', detail: 'Erro médio absoluto na validação das últimas 72h', icon: <Target size={16} className="text-slate-500" /> },
    { label: 'Acurácia · falhas', value: '87.6%', detail: 'Classificação binária · janelas de 15 minutos', icon: <Activity size={16} className="text-slate-500" /> },
    { label: 'Última retraining', value: '2h 14m', detail: 'Pipeline automático a cada 6 horas', icon: <TimerReset size={16} className="text-slate-500" /> },
  ];

  return (
    <section className="mx-auto max-w-[1500px]">
      <PageIntro
        icon={<BrainCircuit size={23} className="text-violet-600" />}
        tint="bg-violet-100"
        title="Previsão com IA · LSTM"
        description="Modelo recorrente treinado com 30 dias de telemetria agregada. Produz previsões de consumo energético e probabilidade de falha nos próximos 30 minutos."
      />
      <div className="mt-7 grid grid-cols-3 gap-4">
        {metricCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
      <div className="mt-6">
        <PredictionPanel />
      </div>
      <div className="mt-6">
        <Panel title="Probabilidade de falha por máquina" subtitle="Classificação preditiva do risco operacional nas próximas 2 horas.">
          <FailureProbabilityChart />
        </Panel>
      </div>
    </section>
  );
}

export function AlertsView() {
  const [alerts, setAlerts] = useState(initialAlerts);
  const open = alerts.filter((alert) => alert.status === 'Aberto').length;
  const inReview = alerts.filter((alert) => alert.status === 'Em análise').length;
  const resolved = alerts.filter((alert) => alert.status === 'Resolvido').length;

  const resolveAlert = (id: string) => {
    setAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, status: 'Resolvido' } : alert));
  };

  return (
    <section className="mx-auto max-w-[1500px]">
      <PageIntro
        icon={<AlertTriangle size={23} className="text-red-500" />}
        tint="bg-red-100"
        title="Centro de Alertas"
        description="Regras definidas sobre atributos NGSI acionam notificações quando os limites são excedidos."
      />

      <div className="mt-7 grid grid-cols-3 gap-4">
        <KpiCard label="Alertas abertos" value={String(open)} detail="Requerem ação imediata da equipa de manutenção" icon={<Bell size={16} className="text-red-500" />} />
        <KpiCard label="Em análise" value={String(inReview)} detail="Atribuídos a técnicos no terreno" icon={<AlertTriangle size={16} className="text-amber-500" />} />
        <KpiCard label="Resolvidos (24h)" value={String(resolved)} detail="Tempo médio de resolução · 14 min" icon={<CheckCircle2 size={16} className="text-emerald-500" />} />
      </div>

      <Panel className="mt-6" title="Alertas por severidade ao longo do tempo" subtitle="Evolução das ocorrências críticas, avisos e informativas por intervalo.">
        <SeverityOverTimeChart />
      </Panel>

      <Panel className="mt-6" title="Códigos de erro por máquina" subtitle="Eventos NGSI agregados por intervalo e por máquina.">
        <ErrorBarsChart />
      </Panel>

      <Panel className="mt-6" title="Histórico de alertas" subtitle="Eventos gerados pelas regras de subscrição do Orion Context Broker.">
        <table className="w-full table-fixed border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-900">
              <th className="w-[110px] py-3">ID</th>
              <th className="w-[140px] py-3">Máquina</th>
              <th className="py-3">Ocorrência</th>
              <th className="w-[170px] py-3">Severidade</th>
              <th className="w-[170px] py-3">Status</th>
              <th className="w-[130px] py-3">Disparado</th>
              <th className="w-[120px] py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} className="border-b border-slate-200 last:border-b-0">
                <td className="py-4 font-mono text-[13px]">{alert.id}</td>
                <td className="py-4 font-mono text-[13px]">{alert.machine}</td>
                <td className="py-4">{alert.occurrence}</td>
                <td className="py-4"><SeverityBadge severity={alert.severity} /></td>
                <td className="py-4"><StatusText status={alert.status} /></td>
                <td className="py-4 text-[13px] text-slate-500">{alert.firedAt}</td>
                <td className="py-4 text-right">
                  {alert.status !== 'Resolvido' && (
                    <button
                      type="button"
                      onClick={() => resolveAlert(alert.id)}
                      className="h-8 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-900 transition hover:bg-slate-50"
                    >
                      Resolver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: AlertRow['severity'] }) {
  const style = severity === 'Crítico' ? 'bg-red-100 text-red-500' : severity === 'Aviso' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600';
  return <span className={classNames('rounded-full px-2.5 py-1 text-[12px] font-medium', style)}>{severity}</span>;
}

function StatusText({ status }: { status: AlertRow['status'] }) {
  const style = status === 'Aberto' ? 'text-red-500' : status === 'Em análise' ? 'text-amber-600' : 'text-emerald-600';
  return (
    <span className={classNames('inline-flex items-center gap-1.5 text-[13px] font-medium', style)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
