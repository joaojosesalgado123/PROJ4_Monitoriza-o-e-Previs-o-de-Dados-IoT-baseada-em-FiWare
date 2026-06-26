
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Gauge,
  Pencil,
  Target,
  TimerReset,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { ChartMachine, ErrorsTimelinePoint, HistoryPoint, LstmMetrics, UpdateMachinePayload, deleteMachine, machineControl, updateMachine } from '../lib/api';
import { useMachines } from '../lib/useMachines';
import { useAuth } from '../lib/auth';
import { useMachineHistory } from '../lib/useMachineHistory';
import { usePredictions } from '../lib/usePredictions';
import { useEnergyToday } from '../lib/useEnergyToday';
import { useSeverityTimeline } from '../lib/useSeverityTimeline';
import { useErrorsTimeline } from '../lib/useErrorsTimeline';
import { useLstmMetrics } from '../lib/useLstmMetrics';
import { useNextHourForecast } from '../lib/useNextHourForecast';
import { useUptime } from '../lib/useUptime';
import { useEnvironment } from '../lib/useEnvironment';
import { useLang } from '../lib/lang';

const FALLBACK_COLORS = ['#0f7ee7', '#38a4e8', '#d7bf42', '#10b981', '#8b5cf6', '#f59e0b'];

function formatElapsed(isoTime: string | null): string {
  if (!isoTime) return '—';
  const diffMs = Date.now() - new Date(isoTime).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function pointsToSeries(
  machines: { label: string; color: string; points: HistoryPoint[] }[],
  bucketCount = 12,
): { series: Series[]; labels: string[] } {
  const withData = machines.filter((m) => m.points.length > 0);
  if (withData.length === 0) {
    return { series: machines.map((m) => ({ label: m.label, color: m.color, values: [] })), labels: [] };
  }
  const allMs = withData.flatMap((m) => m.points.map((p) => Date.parse(p.time)));
  const minMs = Math.min(...allMs);
  const maxMs = Math.max(...allMs);
  const slotMs = (maxMs - minMs) / Math.max(bucketCount - 1, 1);
  const slots = Array.from({ length: bucketCount }, (_, i) => minMs + i * slotMs);
  const labels = slots.map((t) => new Date(t).toISOString().slice(11, 16));
  const series = machines.map((m) => ({
    label: m.label,
    color: m.color,
    values: slots.map((slotT) => {
      if (m.points.length === 0) return 0;
      const closest = m.points.reduce((best, p) =>
        Math.abs(Date.parse(p.time) - slotT) < Math.abs(Date.parse(best.time) - slotT) ? p : best,
      );
      return Math.abs(Date.parse(closest.time) - slotT) <= slotMs ? closest.value : 0;
    }),
  }));
  return { series, labels };
}

function MachineHistoryCollector({
  machineId,
  onData,
}: {
  machineId: string;
  onData: (id: string, pts: HistoryPoint[]) => void;
}) {
  const { points } = useMachineHistory(machineId, 'energy', 60);
  useEffect(() => { onData(machineId, points); }, [machineId, points, onData]);
  return null;
}

type Series = { label: string; color: string; values: number[]; dashed?: boolean };
type Point  = { x: number; y: number };
type AlertRow = {
  id: string; machine: string; occurrence: string;
  severity: 'Crítico' | 'Aviso' | 'Info';
  status: 'Aberto' | 'Em análise' | 'Resolvido';
  firedAt: string;
};

export const times = ['18:40','18:45','18:50','18:55','19:00','19:05','19:10','19:15','19:20','19:25','19:30','19:35'];

const severitySeriesDefault: Series[] = [
  { label: 'Crítico', color: '#ef4444', values: [0,1,1,0,2,1,0,2,1,0,1,1] },
  { label: 'Aviso',   color: '#f59e0b', values: [2,1,3,2,2,4,2,3,2,3,4,3] },
  { label: 'Info',    color: '#0f7ee7', values: [1,0,1,1,0,2,1,0,1,1,0,1] },
];

function toPoints(values: number[], min: number, max: number, width: number, height: number, padX=42, padY=28): Point[] {
  const range = max - min || 1;
  const plotWidth  = width  - padX * 2;
  const plotHeight = height - padY * 2;
  return values.map((value, index) => ({
    x: padX + (index / Math.max(values.length - 1, 1)) * plotWidth,
    y: padY + ((max - value) / range) * plotHeight,
  }));
}

function toPointsRange(values: number[], min: number, max: number, xStart: number, xEnd: number, height: number, padY=28): Point[] {
  const range = max - min || 1;
  const plotHeight = height - padY * 2;
  return values.map((value, index) => ({
    x: xStart + (index / Math.max(values.length - 1, 1)) * (xEnd - xStart),
    y: padY + ((max - value) / range) * plotHeight,
  }));
}

function pathFromPoints(points: Point[]) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/** Curva suave (Catmull-Rom -> Bézier cúbica) em vez de segmentos de reta entre pontos. */
function smoothPathFromPoints(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length < 3) return pathFromPoints(points);

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Continuação de uma curva suave (sem 'M' inicial) — usada para fechar bandas. */
function smoothPathContinuation(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length < 3) {
    return points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }
  let d = `L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Banda de incerteza com contornos suaves (curva superior + curva inferior invertida). */
function smoothBandPath(top: Point[], bottom: Point[]) {
  if (top.length === 0 || bottom.length === 0) return '';
  const topCurve = smoothPathFromPoints(top);
  const bottomCurve = smoothPathContinuation([...bottom].reverse());
  return `${topCurve} ${bottomCurve} Z`;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

// ─── PageIntro ────────────────────────────────────────────────────────────────

export function PageIntro({ icon, tint, title, description }: { icon: React.ReactNode; tint: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tint}`}>{icon}</div>
      <div>
        <h1 className="text-[22px] font-bold leading-tight text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, detail, icon, badge }: { label: string; value: string; detail: string; icon: React.ReactNode; badge?: string }) {
  return (
    <div className="min-h-[150px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[12px] font-medium uppercase text-slate-500 dark:text-slate-400">{label}</div>
        <div>{icon}</div>
      </div>
      <div className="mt-3 text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-8 flex items-end justify-between gap-4">
        <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
        {badge && (
          <span className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function Panel({ title, subtitle, actions, children, className }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-6 p-6">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="mt-2 text-[14px] leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700 p-6">{children}</div>
    </section>
  );
}

// ─── KpiMini ──────────────────────────────────────────────────────────────────

function KpiMini({ label, value, accent = 'text-slate-900 dark:text-slate-100', icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-700/40 p-4">
      <div className="flex items-center gap-2 text-[12px] font-medium uppercase text-slate-500 dark:text-slate-400">{icon}{label}</div>
      <div className={`mt-2 text-[22px] font-bold ${accent}`}>{value}</div>
    </div>
  );
}

// ─── SeriesLegend ─────────────────────────────────────────────────────────────

function SeriesLegend({ series, disabled, onToggle }: { series: Series[]; disabled: string[]; onToggle: (label: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[13px] text-slate-500 dark:text-slate-400">
      {series.map((item) => (
        <button key={item.label} type="button" onClick={() => onToggle(item.label)}
          className={cx('inline-flex items-center gap-2 rounded-md transition-opacity', disabled.includes(item.label) && 'opacity-35')}>
          <span className="h-2 w-4 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─── InteractiveLineChart ─────────────────────────────────────────────────────

export function InteractiveLineChart({ series, labels = times, yTicks = [0,2,4,6,8], height = 280 }: { series: Series[]; labels?: string[]; yTicks?: number[]; height?: number }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [disabled, setDisabled] = useState<string[]>([]);
  const activeSeries = series.filter((item) => !disabled.includes(item.label));
  const width  = 1180;
  const values = activeSeries.flatMap((item) => item.values);
  const min    = Math.min(0, ...values, ...yTicks);
  const max    = Math.max(...values, ...yTicks);
  const hoverX = hoverIndex === null ? 0 : 42 + (hoverIndex / Math.max(labels.length - 1, 1)) * (width - 84);

  const toggleSeries = (label: string) => {
    setDisabled((cur) => cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <SeriesLegend series={series} disabled={disabled} onToggle={toggleSeries} />
      </div>
      <div className="relative h-[280px] w-full overflow-hidden">
        {hoverIndex !== null && (
          <div className="pointer-events-none absolute top-3 z-10 min-w-[150px] rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-[12px] shadow-lg"
            style={{ left: `min(calc(${(hoverX/width)*100}% + 8px), calc(100% - 170px))` }}>
            <div className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{labels[hoverIndex]}</div>
            {activeSeries.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}
                </span>
                <span className="font-mono">{item.values[hoverIndex]?.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Gráfico interativo" onMouseLeave={() => setHoverIndex(null)}>
          {yTicks.map((tick) => {
            const y = toPoints([tick], min, max, width, height)[0].y;
            return (
              <g key={tick}>
                <line x1="42" x2={width-26} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-700" strokeDasharray="4 4" />
                <text x="12" y={y+4} className="fill-slate-400 dark:fill-slate-500 text-[12px]">{tick}</text>
              </g>
            );
          })}
          {labels.map((label, index) => {
            const x = 42 + (index / Math.max(labels.length - 1, 1)) * (width - 84);
            return (
              <g key={label}>
                <line x1={x} x2={x} y1="28" y2={height-34} className="stroke-slate-100 dark:stroke-slate-700/50" />
                {index % 2 === 0 && <text x={x-18} y={height-8} className="fill-slate-400 dark:fill-slate-500 text-[11px]">{label}</text>}
                <rect x={x-22} y="0" width="44" height={height} fill="transparent" onMouseEnter={() => setHoverIndex(index)} />
              </g>
            );
          })}
          {hoverIndex !== null && <line x1={hoverX} x2={hoverX} y1="28" y2={height-34} stroke="#94a3b8" strokeDasharray="3 4" />}
          {activeSeries.map((item) => {
            const pts = toPoints(item.values, min, max, width, height);
            return (
              <g key={item.label}>
                <path d={pathFromPoints(pts)} fill="none" stroke={item.color} strokeDasharray={item.dashed ? '7 7' : undefined} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                {hoverIndex !== null && pts[hoverIndex] && (
                  <circle cx={pts[hoverIndex].x} cy={pts[hoverIndex].y} r="5" fill="white" stroke={item.color} strokeWidth="3" />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── ErrorBarsChart ───────────────────────────────────────────────────────────

export function ErrorBarsChart({ points, colors = {} }: { points: ErrorsTimelinePoint[]; colors?: Record<string, string> }) {
  const { t } = useLang();
  const [hovered, setHovered] = useState<{ machineId: string; index: number; value: number } | null>(null);
  const width = 1180; const height = 280; const max = 420;
  const groupWidth = points.length > 0 ? (width - 84) / points.length : 0;
  const labels = points.map((p) => p.time.slice(11, 16));

  return (
    <div className="relative h-[280px] w-full">
      {hovered && (
        <div className="absolute right-4 top-3 z-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-[12px] shadow-lg">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{hovered.machineId}</div>
          <div className="text-slate-500 dark:text-slate-400">{labels[hovered.index]} · {t.alrt.errorCode} {hovered.value}</div>
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Códigos de erro por máquina">
        {[0,100,200,300,400].map((tick) => {
          const y = toPoints([tick], 0, max, width, height)[0].y;
          return (
            <g key={tick}>
              <line x1="42" x2={width-26} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-700" strokeDasharray="4 4" />
              <text x="10" y={y+4} className="fill-slate-400 dark:fill-slate-500 text-[12px]">{tick}</text>
            </g>
          );
        })}
        {labels.map((label, index) => {
          const x = 42 + (index / Math.max(labels.length - 1, 1)) * (width - 84);
          return (
            <g key={`${label}-${index}`}>
              <line x1={x} x2={x} y1="28" y2={height-34} className="stroke-slate-100 dark:stroke-slate-700/50" />
              {index % 2 === 0 && <text x={x-17} y={height-8} className="fill-slate-400 dark:fill-slate-500 text-[11px]">{label}</text>}
            </g>
          );
        })}
        {points.map((point, index) =>
          point.by_machine.map((entry, machineIndex) => {
            const value = entry.error_code;
            const color = colors[entry.machine_id] ?? FALLBACK_COLORS[machineIndex % FALLBACK_COLORS.length];
            const barHeight = ((height - 62) * value) / max;
            const x = 42 + index * groupWidth + 13 + machineIndex * 12;
            const y = height - 34 - barHeight;
            return (
              <rect key={`${index}-${entry.machine_id}`} x={x} y={y} width="5" height={barHeight} rx="2" fill={color} opacity={value === 0 ? 0 : 0.9}
                onMouseEnter={() => value > 0 && setHovered({ machineId: entry.machine_id, index, value })}
                onMouseLeave={() => setHovered(null)} />
            );
          })
        )}
      </svg>
    </div>
  );
}

// ─── FailureProbabilityChart ──────────────────────────────────────────────────

export function FailureProbabilityChart({ rows, metrics }: { rows: ChartMachine[]; metrics?: LstmMetrics }) {
  const { t } = useLang();
  const [hovered, setHovered] = useState<string | null>(null);

  const byMachine = new Map((metrics?.machines ?? []).map((m) => [m.machine_id, m]));

  return (
    <div className="space-y-5">
      {rows.map((machine) => {
        const real = byMachine.get(machine.id)?.failure_probability;
        // Enquanto o modelo de falha não tem dados suficientes, usa a estimativa
        // estática por estado da máquina como aproximação visual.
        const value = real != null ? Math.round(real * 100) : machine.failureProbability;
        const isReal = real != null;
        const color = value >= 65 ? '#ef4444' : value >= 35 ? '#f59e0b' : '#10b981';
        return (
          <div key={machine.id} className="relative">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <div className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{machine.shortName}</div>
                <div className="text-[12px] text-slate-500 dark:text-slate-400">{machine.type} · {machine.status}</div>
              </div>
              <div className="font-mono text-[18px] font-bold" style={{ color }}>{value}%</div>
            </div>
            <div className="h-4 rounded-full bg-slate-100 dark:bg-slate-700" onMouseEnter={() => setHovered(machine.id)} onMouseLeave={() => setHovered(null)}>
              <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
            </div>
            {hovered === machine.id && (
              <div className="absolute right-0 top-12 z-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-[12px] shadow-lg">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{machine.name}</div>
                <div className="text-slate-500 dark:text-slate-400">{t.fore.failureProb}: {value}%</div>
                <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  {isReal ? t.fore.modelOutput : t.dash.lstmNotAvail}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── YarnRemainingChart ───────────────────────────────────────────────────────

export function YarnRemainingChart({ rows }: { rows: ChartMachine[] }) {
  const { t } = useLang();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-3 gap-4">
      {rows.map((machine) => {
        // Cada tipo tem a sua própria "matéria-prima" a esgotar-se: fio (Fiação/Tecelagem)
        // ou corante (Tingimento) — chemical_level já é guardado/enviado exatamente da
        // mesma forma que thread_remaining, só muda o que mostramos.
        const isDyeing = machine.type === 'Tingimento';
        const value = isDyeing ? Math.round(machine.chemicalLevel ?? 0) : machine.yarnRemaining;
        const label = isDyeing ? t.fore.chemicalRemaining : t.fore.yarnRemaining;
        const color = value <= 25 ? '#ef4444' : value <= 55 ? '#f59e0b' : '#10b981';
        const circumference = 2 * Math.PI * 48;
        const dash = (value / 100) * circumference;
        return (
          <button key={machine.id} type="button"
            onMouseEnter={() => setHovered(machine.id)} onMouseLeave={() => setHovered(null)}
            className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 p-5 text-left transition hover:border-slate-300 dark:hover:border-slate-500 hover:bg-white dark:hover:bg-slate-700/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{machine.shortName}</div>
                <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{machine.name}</div>
              </div>
              <span className="rounded-full bg-white dark:bg-slate-600 px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-300 shadow-sm">{machine.type}</span>
            </div>
            <div className="mt-5 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-32 w-32" role="img" aria-label={`${label} ${machine.shortName}`}>
                <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" strokeWidth="12" className="stroke-slate-200 dark:stroke-slate-600" />
                <circle cx="60" cy="60" r="48" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference - dash}`} transform="rotate(-90 60 60)" />
                <text x="60" y="64" textAnchor="middle" className="fill-slate-900 dark:fill-slate-100 text-[22px] font-bold">{value}%</text>
              </svg>
            </div>
            <div className="mt-2 text-center text-[12px] text-slate-500 dark:text-slate-400">{label}</div>
            {hovered === machine.id && (
              <div className="absolute left-4 right-4 top-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-[12px] shadow-lg">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{machine.name}</div>
                <div className="text-slate-500 dark:text-slate-400">{value <= 25 ? t.fore.urgentRefill : t.fore.withinRange}</div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── SeverityOverTimeChart ────────────────────────────────────────────────────

export function SeverityOverTimeChart({ series = severitySeriesDefault, labels }: { series?: Series[]; labels?: string[] } = {}) {
  return <InteractiveLineChart series={series} labels={labels} yTicks={[0,1,2,3,4]} height={260} />;
}

// ─── PredictionPanel ──────────────────────────────────────────────────────────

type HoverState = { kind: 'hist' | 'forecast'; index: number } | null;

export function PredictionPanel({ rows }: { rows: ChartMachine[] }) {
  const { t } = useLang();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hover, setHover] = useState<HoverState>(null);
  const machine = rows[selectedIndex] ?? rows[0];

  const { points: historyPoints } = useMachineHistory(machine?.id, 'energy', 60);
  const { points: predPoints }    = usePredictions(machine?.id, 60);

  if (!machine) return <div className="flex h-[200px] items-center justify-center text-[14px] text-slate-400 dark:text-slate-500">{t.fore.loadingData}</div>;

  // Só há previsão real quando o endpoint devolve pontos (modelo já treinado
  // com dados suficientes). Antes disso NÃO se deve inventar uma curva a
  // partir de `machine.forecast` (dados mock) — isso fazia o gráfico parecer
  // funcional mesmo quando o LSTM ainda não tinha histórico suficiente.
  const forecastReady = predPoints.length > 0;

  const width = 1180; const height = 330;
  const PAD_L = 46; const PAD_R = 26; const PAD_Y = 28;
  // Histórico (60 min) e previsão (60 min, 12 passos de 5 min) ocupam metade cada
  const NOW_RATIO = 0.50;
  const nowX = PAD_L + NOW_RATIO * (width - PAD_L - PAD_R);

  const histLabels = ['-60m','-52m','-44m','-36m','-28m','-20m','-12m','-4m'];
  const foreLabels = ['+5m','+10m','+15m','+20m','+25m','+30m','+35m','+40m','+45m','+50m','+55m','+60m'];

  const real     = historyPoints.length > 0 ? historyPoints.map((p) => p.value) : machine.history;
  const forecast = forecastReady ? predPoints.map((p) => p.value) : [];
  const minBand  = forecastReady ? predPoints.map((p) => p.min)   : [];
  const maxBand  = forecastReady ? predPoints.map((p) => p.max)   : [];

  // Calcular máximo global para escala Y consistente
  const allValues = [...real, ...forecast, ...minBand, ...maxBand];
  const yMax = Math.ceil(Math.max(...allValues, 1) * 1.1);

  // Histórico: de PAD_L até nowX  |  Previsão: de nowX até width-PAD_R
  const realPoints     = toPointsRange(real,     0, yMax, PAD_L, nowX,           height, PAD_Y);
  const forecastPoints = toPointsRange(forecast, 0, yMax, nowX,  width - PAD_R,  height, PAD_Y);
  const minPoints      = toPointsRange(minBand,  0, yMax, nowX,  width - PAD_R,  height, PAD_Y);
  const maxPoints      = toPointsRange(maxBand,  0, yMax, nowX,  width - PAD_R,  height, PAD_Y);

  const hoverPoint =
    hover?.kind === 'hist'     ? realPoints[hover.index] :
    hover?.kind === 'forecast' ? forecastPoints[hover.index] :
    null;

  return (
    <Panel
      title={t.fore.panelTitle}
      subtitle={t.fore.panelSub}
      actions={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-[13px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-full bg-[#0f7ee7]" />{t.fore.histLabel}</span>
            <span className="inline-flex items-center gap-2">
              <span className="flex gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" /><span className="h-2 w-2 rounded-full bg-violet-500" /></span>
              {t.fore.foreLabel}
            </span>
          </div>
          <label className="relative">
            <select value={selectedIndex} onChange={(e) => setSelectedIndex(Number(e.target.value))}
              className="h-10 min-w-[230px] appearance-none rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 pr-10 text-[14px] text-slate-900 dark:text-slate-100 outline-none transition focus:border-[#0f7ee7] focus:ring-4 focus:ring-blue-500/10">
              {rows.map((item, index) => (<option key={item.id} value={index}>{item.id} · {item.name}</option>))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          </label>
        </div>
      }
    >
      {(() => {
        const avgForecast = forecastReady ? forecast.reduce((s, v) => s + v, 0) / forecast.length : null;
        const variationPct = forecastReady && machine.consumption > 0
          ? ((avgForecast! - machine.consumption) / machine.consumption) * 100
          : null;
        return (
          <div className="grid grid-cols-3 gap-4">
            <KpiMini label={t.fore.currentConsumption} value={`${machine.consumption.toFixed(2)} kW`} />
            <KpiMini
              label={t.fore.avgForecast}
              value={forecastReady ? `${avgForecast!.toFixed(2)} kW` : '—'}
              icon={<BrainCircuit size={14} />}
            />
            <KpiMini
              label={t.fore.expectedVar}
              value={forecastReady && variationPct !== null ? `${variationPct >= 0 ? '+' : ''}${variationPct.toFixed(1)}%` : '—'}
              accent={forecastReady && variationPct !== null ? (variationPct >= 0 ? 'text-red-500' : 'text-emerald-600') : undefined}
              icon={<TrendingUp size={15} />}
            />
          </div>
        );
      })()}
      <div className="relative mt-4 h-[330px] overflow-hidden">
        {!forecastReady && (
          <div className="absolute inset-y-0 right-0 z-10 flex w-1/2 flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[12px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              {t.dash.soonBadge}
            </span>
            <p className="text-[13px] text-slate-400 dark:text-slate-500">{t.dash.lstmNotAvail}</p>
          </div>
        )}
        {hoverPoint && hover && (
          <div className="absolute top-4 z-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-[12px] shadow-lg"
            style={{ left: `min(calc(${(hoverPoint.x/width)*100}% + 8px), calc(100% - 220px))` }}>
            {hover.kind === 'hist' ? (
              <>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{histLabels[Math.min(hover.index, histLabels.length - 1)]}</div>
                <div className="text-slate-500 dark:text-slate-400">{machine.shortName}: {(real[Math.min(hover.index, real.length - 1)] ?? 0).toFixed(2)} kWh</div>
              </>
            ) : (
              <>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {machine.shortName} {foreLabels[Math.min(hover.index, foreLabels.length - 1)]}: {(forecast[hover.index] ?? 0).toFixed(2)} kWh
                </div>
                <div className="text-violet-500 dark:text-violet-400">
                  {t.fore.errorRange}: {(minBand[hover.index] ?? 0).toFixed(2)} – {(maxBand[hover.index] ?? 0).toFixed(2)} kWh
                </div>
              </>
            )}
          </div>
        )}
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Previsão de consumo">
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const tick = Math.round(frac * yMax);
            const y = PAD_Y + (1 - frac) * (height - PAD_Y * 2);
            return (
              <g key={frac}>
                <line x1={PAD_L} x2={width - PAD_R} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-700" strokeDasharray="4 4" />
                <text x="12" y={y + 4} className="fill-slate-400 dark:fill-slate-500 text-[12px]">{tick}</text>
              </g>
            );
          })}
          {/* Labels histórico — distribuídos na zona PAD_L..nowX */}
          {histLabels.map((label, i) => {
            const x = PAD_L + (i / (histLabels.length - 1)) * (nowX - PAD_L);
            return <text key={label} x={x - 14} y={height - 8} className="fill-slate-400 dark:fill-slate-500 text-[11px]">{label}</text>;
          })}
          {/* Labels previsão — distribuídos na zona nowX..width-PAD_R */}
          {foreLabels.map((label, i) => {
            const x = nowX + ((i + 1) / foreLabels.length) * (width - PAD_R - nowX);
            return <text key={label} x={x - 14} y={height - 8} className="fill-violet-400 dark:fill-violet-500 text-[11px]">{label}</text>;
          })}

          {/* Área suave sob o histórico */}
          <path d={smoothPathFromPoints(realPoints)} fill="none" stroke="none" />
          <path d={`${smoothPathFromPoints(realPoints)} L ${realPoints[realPoints.length-1]?.x.toFixed(1)} ${height-PAD_Y} L ${realPoints[0]?.x.toFixed(1)} ${height-PAD_Y} Z`}
            fill="#0f7ee7" opacity="0.08" />

          {/* Banda de erro (min/max) — sombreada e bem visível, como no exemplo de referência */}
          <path d={smoothBandPath(maxPoints, minPoints)} fill="#8b5cf6" opacity="0.22" stroke="#a78bfa" strokeOpacity="0.4" strokeWidth="1" />

          {/* Curva suave: histórico + previsão */}
          <path d={smoothPathFromPoints(realPoints)} fill="none" stroke="#0f7ee7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={smoothPathFromPoints(forecastPoints)} fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          <line x1={nowX} x2={nowX} y1="28" y2={height-28} stroke="#64748b" strokeDasharray="3 5" />
          <text x={nowX-22} y="48" className="fill-slate-400 dark:fill-slate-500 text-[11px]">{t.fore.now}</text>

          {/* Pontos do limite da banda (min/max) */}
          {[...minPoints, ...maxPoints].map((point, index) => (
            <circle key={`band-${index}`} cx={point.x} cy={point.y} r="2.5" fill="#ef4444" opacity="0.7" />
          ))}

          {/* Marcadores ao longo da curva real */}
          {realPoints.map((point, index) => (
            <circle key={`real-${index}`} cx={point.x} cy={point.y} r="4" fill="#10b981" stroke="white" strokeWidth="1.5" />
          ))}
          {/* Marcadores ao longo da curva de previsão */}
          {forecastPoints.map((point, index) => (
            <circle key={`fore-${index}`} cx={point.x} cy={point.y} r="4" fill="#10b981" stroke="white" strokeWidth="1.5" />
          ))}

          {/* Áreas de interação para o tooltip (invisíveis, maiores que os marcadores) */}
          {realPoints.map((point, index) => (
            <circle key={`hit-real-${index}`} cx={point.x} cy={point.y} r="13" fill="transparent"
              onMouseEnter={() => setHover({ kind: 'hist', index })} onMouseLeave={() => setHover(null)} />
          ))}
          {forecastPoints.map((point, index) => (
            <circle key={`hit-fore-${index}`} cx={point.x} cy={point.y} r="13" fill="transparent"
              onMouseEnter={() => setHover({ kind: 'forecast', index })} onMouseLeave={() => setHover(null)} />
          ))}
        </svg>
      </div>
    </Panel>
  );
}

// ─── DashboardOverview ────────────────────────────────────────────────────────

export function DashboardOverview() {
  const { machines: rows, loading } = useMachines();
  const { data: energyData } = useEnergyToday();
  const { data: lstmMetrics } = useLstmMetrics();
  const { forecastKwh, available: forecastAvailable } = useNextHourForecast(rows.map((m) => m.id));
  const { t } = useLang();

  const currentKwh = rows.reduce((sum, m) => sum + m.consumption, 0);
  const forecastVariationPct = forecastAvailable && currentKwh > 0
    ? ((forecastKwh - currentKwh) / currentKwh) * 100
    : null;

  const total   = rows.length;
  const running = rows.filter((m) => m.status === 'Running').length;
  const worstMachine = rows.filter((m) => m.status !== 'Running').sort((a, b) => {
    const rank: Record<string, number> = { Error: 2, Offline: 1, Running: 0 };
    return (rank[b.status] ?? 0) - (rank[a.status] ?? 0);
  })[0] ?? null;

  const latestAlerts: AlertRow[] = rows.filter((m) => m.error !== '-').map((m, i) => ({
    id: `A-${1000 + i}`, machine: m.id, occurrence: m.error,
    severity: (m.status === 'Error' ? 'Crítico' : 'Aviso') as AlertRow['severity'],
    status: 'Aberto' as AlertRow['status'], firedAt: m.updatedAt,
  })).slice(0, 3);

  return (
    <section className="mx-auto max-w-[1500px]">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label={t.dash.energyToday}
          value={energyData ? `${energyData.total_kwh.toFixed(1)} kWh` : '—'}
          detail={energyData ? t.dash.energyMachines(energyData.by_machine.length, (energyData.total_kwh / energyData.by_machine.length).toFixed(1)) : t.dash.loading}
          icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-[#0f7ee7]"><Zap size={20} /></span>}
          badge={energyData ? undefined : t.dash.soonBadge}
        />
        <KpiCard
          label={t.dash.factoryStatus}
          value={loading ? '…' : `${running} / ${total} ${t.dash.operational}`}
          detail={loading ? '' : `${total - running} ${t.dash.outOfService}`}
          icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"><Activity size={20} /></span>}
        />
        <KpiCard
          label={t.dash.latestAlert}
          value={loading ? '…' : worstMachine ? `${worstMachine.error !== '-' ? worstMachine.error.split(' · ')[0] : worstMachine.status.toUpperCase()} · ${worstMachine.name}` : t.dash.noAlerts}
          detail={worstMachine?.error !== '-' ? worstMachine?.error ?? '' : t.dash.allOperational}
          icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-500"><AlertTriangle size={20} /></span>}
          badge={worstMachine?.status === 'Error' ? t.dash.critical : undefined}
        />
        <KpiCard
          label={t.dash.nextHourForecast}
          value={forecastAvailable ? `${forecastKwh.toFixed(1)} kWh` : '—'}
          detail={forecastAvailable
            ? `${forecastVariationPct != null && forecastVariationPct >= 0 ? '+' : ''}${forecastVariationPct?.toFixed(1) ?? '0.0'}% vs ${t.fore.currentConsumption.toLowerCase()}`
            : t.dash.lstmNotAvail}
          icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30 text-violet-600"><BrainCircuit size={20} /></span>}
          badge={forecastAvailable ? undefined : t.dash.soonBadge}
        />
      </div>

      <div className="mt-6"><PredictionPanel rows={rows} /></div>

      <div className="mt-6 grid grid-cols-[0.85fr_1.15fr] gap-4">
        <Panel title={t.dash.opRisk} subtitle={t.dash.opRiskSub}>
          <FailureProbabilityChart rows={rows} metrics={lstmMetrics} />
        </Panel>
        <Panel title={t.dash.latestEvents} subtitle={t.dash.latestEventsSub}>
          <div className="space-y-3">
            {latestAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-700/30 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{alert.id}</span>
                  </div>
                  <div className="mt-2 text-[14px] font-semibold text-slate-900 dark:text-slate-100">{alert.occurrence}</div>
                  <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{alert.machine} · {alert.firedAt}</div>
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

// ─── MaintenanceOverview ──────────────────────────────────────────────────────

export function MaintenanceOverview() {
  const { machines: rows, loading } = useMachines();
  const { canResolveAlerts } = useAuth();
  const { t } = useLang();
  const { points: severityPoints } = useSeverityTimeline(60, 5);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  // ── máquinas ───────────────────────────────────────────────────────────────
  const total             = rows.length;
  const running           = rows.filter((m) => m.status === 'Running').length;
  const errors            = rows.filter((m) => m.status === 'Error').length;
  const totalConsumption  = rows.reduce((s, m) => s + m.consumption, 0);

  // máquinas com problema, ordenadas por gravidade (Error primeiro)
  const problemMachines = rows
    .filter((m) => m.status !== 'Running')
    .sort((a, b) => {
      const rank: Record<string, number> = { Error: 2, Offline: 1, Stopped: 0 };
      return (rank[b.status] ?? 0) - (rank[a.status] ?? 0);
    });

  // ── alertas ────────────────────────────────────────────────────────────────
  const baseAlerts: AlertRow[] = rows.filter((m) => m.error !== '-').map((m, i) => ({
    id: `A-${1000 + i}`, machine: m.id, occurrence: m.error,
    severity: (m.status === 'Error' ? 'Crítico' : 'Aviso') as AlertRow['severity'],
    status: 'Aberto' as AlertRow['status'], firedAt: m.updatedAt,
  }));
  const alerts: AlertRow[] = baseAlerts.map((a) =>
    resolvedIds.has(a.id) ? { ...a, status: 'Resolvido' as AlertRow['status'] } : a
  );
  const openAlerts     = alerts.filter((a) => a.status === 'Aberto');
  const resolvedCount  = alerts.filter((a) => a.status === 'Resolvido').length;

  const severityChartSeries: Series[] = [
    { label: t.alrt.critical, color: '#ef4444', values: severityPoints.map((p) => p.error) },
    { label: t.alrt.warning,  color: '#f59e0b', values: severityPoints.map((p) => p.warning) },
  ];
  const severityLabels = severityPoints.map((p) => p.time.slice(11, 16));

  const statusStyle = (status: string) => {
    if (status === 'Running') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
    if (status === 'Error')   return 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400';
    if (status === 'Stopped') return 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400';
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
  };

  return (
    <section className="mx-auto max-w-[1500px]">
      <PageIntro
        icon={<Cpu size={23} className="text-amber-500" />}
        tint="bg-amber-100 dark:bg-amber-900/30"
        title="Visão Geral · Manutenção"
        description="Estado atual das máquinas e alertas ativos na fábrica"
      />

      {/* ── 4 KPIs ─────────────────────────────────────────────────────────── */}
      <div className="mt-7 grid grid-cols-4 gap-4">
        <KpiCard
          label={t.dash.factoryStatus}
          value={loading ? '…' : `${running} / ${total} ${t.dash.operational}`}
          detail={loading ? '' : `${total - running} ${t.dash.outOfService}`}
          icon={<Activity size={16} className="text-slate-500 dark:text-slate-400" />}
        />
        <KpiCard
          label="Máquinas com erro"
          value={loading ? '…' : String(errors)}
          detail={errors === 0 ? 'Nenhum erro ativo' : `${errors} requer${errors === 1 ? '' : 'em'} intervenção`}
          icon={<AlertTriangle size={16} className={errors > 0 ? 'text-red-500' : 'text-slate-400'} />}
          badge={errors > 0 ? String(errors) : undefined}
        />
        <KpiCard
          label={t.mach.aggregated}
          value={loading ? '…' : `${totalConsumption.toFixed(1)} kW`}
          detail={t.mach.aggregatedSub}
          icon={<Zap size={16} className="text-slate-500 dark:text-slate-400" />}
        />
        <KpiCard
          label={t.alrt.open}
          value={String(openAlerts.length)}
          detail={resolvedCount > 0 ? `${resolvedCount} resolvidos nesta sessão` : t.alrt.openSub}
          icon={<Bell size={16} className={openAlerts.length > 0 ? 'text-red-500' : 'text-slate-400'} />}
        />
      </div>

      {/* ── Estado das máquinas ─────────────────────────────────────────────── */}
      <Panel className="mt-6" title={t.mach.statusTitle} subtitle="Todas as máquinas · apenas leitura">
        <table className="w-full table-fixed border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              <th className="py-3">{t.mach.colMachine}</th>
              <th className="w-[140px] py-3">{t.mach.colStatus}</th>
              <th className="w-[230px] py-3">{t.mach.colYarn}</th>
              <th className="w-[150px] py-3">{t.mach.colConsumption}</th>
              <th className="py-3">{t.mach.colLastError}</th>
              <th className="w-[110px] py-3 text-right">{t.mach.colUpdated}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((machine) => {
              const isDyeing = machine.type === 'Tingimento';
              const rawMaterialPct = isDyeing ? Math.round(machine.chemicalLevel ?? 0) : machine.yarnRemaining;
              const barClass = machine.status === 'Running' ? 'bg-emerald-500' : machine.status === 'Error' ? 'bg-red-500' : 'bg-slate-400';
              const statusLabel = machine.status === 'Stopped' ? t.mach.stopped : machine.status;
              return (
                <tr key={machine.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                  <td className="py-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{machine.name}</div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400">{machine.line}</div>
                  </td>
                  <td className="py-4">
                    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', statusStyle(machine.status))}>
                      <span className={cx('h-1.5 w-1.5 rounded-full', barClass)} />
                      {statusLabel}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-700">
                        <div className={cx('h-full rounded-full', barClass)} style={{ width: `${rawMaterialPct}%` }} />
                      </div>
                      <span className="w-10 text-right text-[13px] font-semibold text-slate-900 dark:text-slate-100">{rawMaterialPct}%</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{machine.consumption.toFixed(1)}</span>{' '}
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">kW</span>
                  </td>
                  <td className={cx('py-4 font-mono text-[12px]', machine.error === '-' ? 'text-slate-500 dark:text-slate-400' : machine.status === 'Error' ? 'text-red-500' : 'text-amber-500')}>
                    {machine.error}
                  </td>
                  <td className="py-4 text-right text-[12px] text-slate-500 dark:text-slate-400">{machine.updatedAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {/* ── Alertas ativos + gráfico de severidade ──────────────────────────── */}
      <div className="mt-6 grid grid-cols-[1.2fr_0.8fr] gap-4">

        {/* Alertas abertos */}
        <Panel title={t.alrt.histTitle} subtitle={`${openAlerts.length} abertos · ${resolvedCount} resolvidos nesta sessão`}>
          {openAlerts.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-emerald-600 dark:text-emerald-400 text-[14px] font-medium">
              <CheckCircle2 size={18} />
              {t.dash.noAlerts}
            </div>
          ) : (
            <div className="space-y-3">
              {openAlerts.map((alert) => (
                <div key={alert.id} className={cx(
                  'flex items-center justify-between gap-4 rounded-xl border px-4 py-3',
                  alert.severity === 'Crítico'
                    ? 'border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10'
                    : 'border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10',
                )}>
                  <div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{alert.machine}</span>
                    </div>
                    <div className="mt-1.5 text-[14px] font-semibold text-slate-900 dark:text-slate-100">{alert.occurrence}</div>
                    <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{alert.firedAt}</div>
                  </div>
                  {canResolveAlerts && (
                    <button type="button"
                      onClick={() => setResolvedIds((prev) => new Set([...prev, alert.id]))}
                      className="shrink-0 h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-[13px] font-medium text-slate-900 dark:text-slate-100 transition hover:bg-slate-50 dark:hover:bg-slate-600">
                      {t.alrt.resolve}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Gráfico de severidade ao longo do tempo */}
        <Panel title={t.alrt.severityTitle} subtitle={t.alrt.severitySub}>
          <SeverityOverTimeChart series={severityChartSeries} labels={severityLabels} />
        </Panel>
      </div>
    </section>
  );
}

// ─── MachinesView ─────────────────────────────────────────────────────────────

export function MachinesView() {
  const { machines: rows, loading, refresh } = useMachines();
  const { isAdmin } = useAuth();
  const { t } = useLang();
  const { data: uptime } = useUptime();
  const { data: envData } = useEnvironment(60);
  const [filter, setFilter] = useState<'Todos' | 'Running' | 'Error' | 'Offline' | 'Stopped'>('Todos');
  const [historyMap, setHistoryMap] = useState<Record<string, HistoryPoint[]>>({});
  const filteredRows = filter === 'Todos' ? rows : rows.filter((row) => row.status === filter);
  const total = rows.length;
  const totalConsumption = rows.reduce((sum, m) => sum + m.consumption, 0);

  const handleHistoryData = useCallback((id: string, pts: HistoryPoint[]) => {
    setHistoryMap((prev) => (prev[id] === pts ? prev : { ...prev, [id]: pts }));
  }, []);

  const { series: consumedSeries, labels: consumedLabels } = pointsToSeries(
    rows.map((m) => ({ label: m.shortName, color: m.color, points: historyMap[m.id] ?? [] })),
  );

  const filterLabels: Record<string, string> = {
    'Todos': t.mach.all, 'Running': 'Running', 'Error': 'Error', 'Offline': 'Offline', 'Stopped': t.mach.stopped,
  };

  const dyeingMachines  = rows.filter((m) => m.type === 'Tingimento');
  const airMachines     = rows.filter((m) => m.type === 'Fiação' || m.type === 'Tecelagem');

  return (
    <section className="mx-auto max-w-[1500px]">
      <PageIntro icon={<Cpu size={23} className="text-[#0f7ee7]" />} tint="bg-blue-100 dark:bg-blue-900/30"
        title={t.mach.title} description={t.mach.description} />

      <div className="mt-7 grid grid-cols-3 gap-4">
        <KpiCard label={t.mach.registeredAgents} value={loading ? '…' : String(total)} detail={`${rows.filter((m) => m.status !== 'Running').length} ${t.mach.withIncident}`} icon={<Gauge size={16} className="text-slate-500 dark:text-slate-400" />} />
        <KpiCard label={t.mach.aggregated} value={loading ? '…' : `${totalConsumption.toFixed(1)} kW`} detail={t.mach.aggregatedSub} icon={<Zap size={16} className="text-slate-500 dark:text-slate-400" />} />
        <KpiCard
          label={t.mach.avgUptime}
          value={uptime.available && uptime.avg_uptime_pct != null ? `${uptime.avg_uptime_pct.toFixed(1)}%` : '—'}
          detail={uptime.available ? t.mach.uptimeSubAvailable : t.mach.uptimeSub}
          icon={<TimerReset size={16} className="text-slate-500 dark:text-slate-400" />}
          badge={uptime.available ? undefined : t.dash.soonBadge}
        />
      </div>

      <Panel className="mt-6" title={t.mach.statusTitle} subtitle={t.mach.statusSub}
        actions={
          <div className="flex items-center gap-2">
            {(['Todos','Running','Error','Offline','Stopped'] as const).map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)}
                className={cx('rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
                  filter === item ? 'border-[#0f7ee7] bg-blue-50 dark:bg-blue-900/20 text-[#0f7ee7]' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600')}>
                {filterLabels[item]}
              </button>
            ))}
          </div>
        }>
        <MachineTable rows={filteredRows} isAdmin={isAdmin} onControl={refresh} />
      </Panel>

      <Panel className="mt-6" title={t.mach.yarnTitle} subtitle={t.mach.yarnSub}>
        <YarnRemainingChart rows={rows} />
      </Panel>

      {rows.map((m) => <MachineHistoryCollector key={m.id} machineId={m.id} onData={handleHistoryData} />)}

      <Panel className="mt-6" title={t.mach.energyTitle} subtitle={t.mach.energySub}>
        <InteractiveLineChart series={consumedSeries} labels={consumedLabels} />
      </Panel>

      {/* Consumos específicos por tipo de máquina */}
      {dyeingMachines.length > 0 && (
        <Panel className="mt-6" title={t.mach.waterTitle} subtitle={t.mach.waterSub}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dyeingMachines.map((m) => {
              const waterPct = m.waterConsumption !== null ? Math.min(100, (m.waterConsumption / 200) * 100) : 0;
              const chemPct  = m.chemicalLevel ?? 0;
              const chemLow  = chemPct < 20;
              const chemColor = chemLow ? '#ef4444' : chemPct < 50 ? '#f59e0b' : '#10b981';
              return (
                <div key={m.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[14px] text-slate-900 dark:text-slate-100 leading-tight">{m.name}</p>
                      <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{m.id}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 p-2.5">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2C6 9 4 13 4 15a8 8 0 0 0 16 0c0-2-2-6-8-13z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="flex justify-between text-[12px] mb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">{t.mach.water}</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {m.waterConsumption !== null ? `${m.waterConsumption.toFixed(0)} L` : '—'}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${waterPct}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>0 L</span><span>200 L</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[12px] mb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">{t.mach.chemical}</span>
                        <span className="font-semibold" style={{ color: chemColor }}>
                          {m.chemicalLevel !== null ? `${m.chemicalLevel.toFixed(0)}%` : '—'}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${chemPct}%`, backgroundColor: chemColor }} />
                      </div>
                      {chemLow && (
                        <p className="text-[10px] text-red-500 mt-1 font-medium">⚠ Nível baixo — reabastecimento necessário</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {airMachines.length > 0 && (
        <Panel className="mt-6" title={t.mach.airTitle} subtitle={t.mach.airSub}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {airMachines.map((m) => {
              const airVal = m.compressedAir ?? 0;
              const airPct = Math.min(100, (airVal / 1.5) * 100);
              const airColor = airPct > 80 ? '#ef4444' : airPct > 60 ? '#f59e0b' : '#8b5cf6';
              return (
                <div key={m.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[14px] text-slate-900 dark:text-slate-100 leading-tight">{m.name}</p>
                      <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{m.id} · {m.type}</p>
                    </div>
                    <div className="rounded-xl bg-violet-50 dark:bg-violet-900/30 p-2.5">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44l-1-9.96" />
                        <path d="M14.5 22A2.5 2.5 0 0 0 12 19.5v-15a2.5 2.5 0 0 1 4.96.44l1 9.96" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] mb-1.5">
                      <span className="text-slate-500 dark:text-slate-400">{t.mach.compressedAir}</span>
                      <span className="font-semibold" style={{ color: airColor }}>
                        {m.compressedAir !== null ? `${m.compressedAir.toFixed(2)} m³/h` : '—'}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${airPct}%`, backgroundColor: airColor }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>0</span><span>1.5 m³/h</span>
                    </div>
                  </div>
                  {/* Mini radial gauge via SVG */}
                  <div className="flex items-center justify-center pt-1">
                    <svg viewBox="0 0 120 70" className="w-32 h-auto">
                      <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
                      <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke={airColor} strokeWidth="12" strokeLinecap="round"
                        strokeDasharray={`${(airPct / 100) * 157} 157`} />
                      <text x="60" y="60" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200" fontSize="14" fontWeight="700">
                        {airPct.toFixed(0)}%
                      </text>
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel className="mt-6" title={t.mach.envTitle} subtitle={t.mach.envSub}>
        {envData.available && envData.north_temp.length > 0 ? (
          <InteractiveLineChart
            series={[
              { label: t.mach.lineNorthTemp, color: '#f59e0b', values: envData.north_temp },
              { label: t.mach.lineSouthTemp, color: '#0f7ee7', values: envData.south_temp },
              { label: t.mach.avgHumidity,   color: '#10b981', values: envData.avg_humidity },
            ]}
            labels={envData.timestamps}
            yTicks={[15, 20, 30, 40, 50, 60, 70]}
          />
        ) : (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[12px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              {t.dash.soonBadge}
            </span>
            <p className="text-[13px] text-slate-400 dark:text-slate-500">{t.dash.lstmNotAvail}</p>
          </div>
        )}
      </Panel>
    </section>
  );
}

// ─── MachineTable ─────────────────────────────────────────────────────────────

// ─── EditMachineModal ─────────────────────────────────────────────────────────

function EditMachineModal({ machine, onClose, onSaved }: {
  machine: ChartMachine;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const isTingimento = machine.type === 'Tingimento';
  const isAirType    = machine.type === 'Fiação' || machine.type === 'Tecelagem';

  const [name,         setName]         = useState(machine.name);
  const [baseEnergy,   setBaseEnergy]   = useState(String(machine.baseEnergy));
  const [baseThread,   setBaseThread]   = useState(String(machine.baseThread));
  const [baseWater,    setBaseWater]    = useState(String(machine.baseWater  ?? 125));
  const [baseChemical, setBaseChemical] = useState(String(machine.baseChemical ?? 100));
  const [baseAir,      setBaseAir]      = useState(String(machine.baseAir    ?? 0.9));
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Nome obrigatório'); return; }
    const payload: UpdateMachinePayload = {
      name: name.trim(),
      base_energy: Number(baseEnergy),
      ...(isAirType    ? { base_thread: Number(baseThread), base_air: Number(baseAir) } : {}),
      ...(isTingimento ? { base_thread: Number(baseThread), base_water: Number(baseWater), base_chemical: Number(baseChemical) } : {}),
      ...(!isTingimento && !isAirType ? { base_thread: Number(baseThread) } : {}),
    };
    setSubmitting(true);
    try {
      await updateMachine(machine.id, payload);
      window.dispatchEvent(new Event('machines:changed'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "h-11 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-[15px] font-normal text-slate-700 dark:text-slate-200 outline-none transition-all focus:border-[#0070f3] focus:ring-4 focus:ring-blue-500/10";

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-900/45 pt-20 px-4 pb-6"
      onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[600px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl p-7">
        <button type="button" onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          <X size={22} />
        </button>

        <div className="mb-6">
          <h2 className="text-[20px] font-bold text-slate-900 dark:text-slate-100">Editar máquina</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
            {machine.id} · <span className="font-medium">{machine.type}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <label className="col-span-2 flex flex-col gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-100">
            {t.modal.labelName}
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </label>

          <label className="flex flex-col gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-100">
            {t.modal.limitBase}
            <input type="number" step="0.1" min="0.1" value={baseEnergy} onChange={(e) => setBaseEnergy(e.target.value)} required className={inputCls} />
            <span className="text-[13px] font-normal text-slate-500">kW</span>
          </label>

          {!isTingimento && (
            <label className="flex flex-col gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-100">
              {t.modal.baseThread}
              <input type="number" step="1" min="1" value={baseThread} onChange={(e) => setBaseThread(e.target.value)} required className={inputCls} />
              <span className="text-[13px] font-normal text-slate-500">m</span>
            </label>
          )}

          {isTingimento && (
            <label className="flex flex-col gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-100">
              {t.modal.baseThread}
              <input type="number" step="1" min="1" value={baseThread} onChange={(e) => setBaseThread(e.target.value)} required className={inputCls} />
              <span className="text-[13px] font-normal text-slate-500">m</span>
            </label>
          )}

          {isTingimento && (
            <label className="flex flex-col gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-100">
              {t.modal.baseWater}
              <input type="number" step="1" min="1" value={baseWater} onChange={(e) => setBaseWater(e.target.value)} required className={inputCls} />
              <span className="text-[13px] font-normal text-slate-500">L</span>
            </label>
          )}

          {isTingimento && (
            <label className="flex flex-col gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-100">
              {t.modal.baseChemical}
              <input type="number" step="1" min="1" max="100" value={baseChemical} onChange={(e) => setBaseChemical(e.target.value)} required className={inputCls} />
              <span className="text-[13px] font-normal text-slate-500">%</span>
            </label>
          )}

          {isAirType && (
            <label className="flex flex-col gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-100">
              {t.modal.baseAir}
              <input type="number" step="0.1" min="0.1" value={baseAir} onChange={(e) => setBaseAir(e.target.value)} required className={inputCls} />
              <span className="text-[13px] font-normal text-slate-500">m³/h</span>
            </label>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-[13px] text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={submitting}
            className="h-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-5 text-[14px] font-semibold text-slate-800 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50">
            {t.modal.btnCancel}
          </button>
          <button type="submit" disabled={submitting}
            className="h-10 rounded-xl bg-[#0070f3] px-5 text-[14px] font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60">
            {submitting ? 'A guardar…' : 'Guardar alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── MachineTable ─────────────────────────────────────────────────────────────

function MachineTable({ rows, isAdmin, onControl }: { rows: ChartMachine[]; isAdmin: boolean; onControl?: () => void }) {
  const { t } = useLang();
  const [pending,        setPending]        = useState<string | null>(null);
  const [confirmStop,    setConfirmStop]    = useState<ChartMachine | null>(null);
  const [confirmDelete,  setConfirmDelete]  = useState<ChartMachine | null>(null);
  const [editMachine,    setEditMachine]    = useState<ChartMachine | null>(null);
  const [deleting,       setDeleting]       = useState(false);

  async function handleControl(machine: ChartMachine) {
    if (!machine.paused) {
      // parar → pedir confirmação
      setConfirmStop(machine);
      return;
    }
    // arrancar → direto
    setPending(machine.id);
    try {
      await machineControl(machine.id, 'start');
      onControl?.();
    } catch (e) { console.error(e); }
    finally { setPending(null); }
  }

  async function confirmDoStop() {
    if (!confirmStop) return;
    setPending(confirmStop.id);
    setConfirmStop(null);
    try {
      await machineControl(confirmStop.id, 'stop');
      onControl?.();
    } catch (e) { console.error(e); }
    finally { setPending(null); }
  }

  async function confirmDoDelete(purge: boolean) {
    if (!confirmDelete) return;
    setDeleting(true);
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await deleteMachine(target.id, purge);
      window.dispatchEvent(new Event('machines:changed'));
      onControl?.();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  }

  return (
    <>
      {/* Modal de edição */}
      {editMachine && (
        <EditMachineModal
          machine={editMachine}
          onClose={() => setEditMachine(null)}
          onSaved={() => { setEditMachine(null); onControl?.(); }}
        />
      )}

      {/* Confirmação de parar */}
      {confirmStop && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45" onClick={() => setConfirmStop(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-bold text-slate-900 dark:text-slate-100">Parar máquina?</h3>
            <p className="mt-2 text-[14px] text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{confirmStop.name}</span> vai parar de enviar leituras. Pode ser reiniciada a qualquer momento.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setConfirmStop(null)}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 text-[13px] font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={confirmDoStop}
                className="h-9 rounded-xl bg-red-500 px-4 text-[13px] font-semibold text-white transition hover:bg-red-600">
                Parar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de apagar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-bold text-red-600 dark:text-red-400">Apagar máquina?</h3>
            <p className="mt-2 text-[14px] text-slate-500 dark:text-slate-400">
              Vai remover <span className="font-semibold text-slate-700 dark:text-slate-300">{confirmDelete.name}</span> do sistema e do Orion. Esta ação não pode ser desfeita.
            </p>
            <p className="mt-3 text-[13px] text-slate-400 dark:text-slate-500">
              Os dados históricos no CrateDB são mantidos por defeito.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 text-[13px] font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={() => confirmDoDelete(false)} disabled={deleting}
                className="h-9 rounded-xl border border-red-300 dark:border-red-700 bg-white dark:bg-slate-700 px-4 text-[13px] font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-50 disabled:opacity-50">
                Apagar
              </button>
              <button onClick={() => confirmDoDelete(true)} disabled={deleting}
                className="h-9 rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                Apagar + dados
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              <th className="w-[110px] py-3">{t.mach.colId}</th>
              <th className="py-3">{t.mach.colMachine}</th>
              <th className="w-[140px] py-3">{t.mach.colStatus}</th>
              <th className="w-[230px] py-3">{t.mach.colYarn}</th>
              <th className="w-[140px] py-3">{t.mach.colConsumption}</th>
              <th className="py-3">{t.mach.colLastError}</th>
              <th className="w-[110px] py-3 text-right">{t.mach.colUpdated}</th>
              {isAdmin && <th className="w-[160px] py-3 text-right">{t.mach.colControl}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((machine) => {
              const isStopped = machine.status === 'Stopped';
              const isRunning = machine.status === 'Running';
              const statusClass = isRunning
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : machine.status === 'Error'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                : isStopped
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
              const barClass = isRunning ? 'bg-emerald-500' : machine.status === 'Error' ? 'bg-red-500' : 'bg-slate-400';
              const statusLabel = isStopped ? t.mach.stopped : machine.status;
              return (
                <tr key={machine.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                  <td className="py-4 font-mono text-[13px] text-slate-900 dark:text-slate-100">{machine.id}</td>
                  <td className="py-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{machine.name}</div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400">{machine.line}</div>
                  </td>
                  <td className="py-4">
                    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', statusClass)}>
                      <span className={cx('h-1.5 w-1.5 rounded-full', isRunning ? 'bg-emerald-500' : machine.status === 'Error' ? 'bg-red-500' : 'bg-slate-400')} />
                      {statusLabel}
                    </span>
                  </td>
                  <td className="py-4">
                    {(() => {
                      const isDyeing = machine.type === 'Tingimento';
                      const rawMaterialPct = isDyeing ? Math.round(machine.chemicalLevel ?? 0) : machine.yarnRemaining;
                      return (
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-700">
                            <div className={cx('h-full rounded-full', barClass)} style={{ width: `${rawMaterialPct}%` }} />
                          </div>
                          <span className="w-10 text-right text-[13px] font-semibold text-slate-900 dark:text-slate-100">{rawMaterialPct}%</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-4">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{machine.consumption.toFixed(1)}</span>{' '}
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">kW</span>
                  </td>
                  <td className={cx('py-4 font-mono text-[12px]', machine.error === '-' ? 'text-slate-500 dark:text-slate-400' : machine.status === 'Error' ? 'text-red-500' : 'text-amber-500')}>{machine.error}</td>
                  <td className="py-4 text-right text-[12px] text-slate-500 dark:text-slate-400">{machine.updatedAt}</td>
                  {isAdmin && (
                    <td className="py-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Editar */}
                        <button
                          onClick={() => setEditMachine(machine)}
                          title="Editar"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Pencil size={13} />
                        </button>
                        {/* Parar / Arrancar */}
                        <button
                          onClick={() => handleControl(machine)}
                          disabled={pending === machine.id}
                          className={cx(
                            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition disabled:opacity-50',
                            machine.paused
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                              : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50',
                          )}
                        >
                          {machine.paused ? t.mach.startBtn : t.mach.stopBtn}
                        </button>
                        {/* Apagar */}
                        <button
                          onClick={() => setConfirmDelete(machine)}
                          title="Apagar"
                          disabled={deleting}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 transition hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── ForecastView ─────────────────────────────────────────────────────────────

export function ForecastView() {
  const { machines: rows } = useMachines();
  const { t } = useLang();
  const { data: metrics } = useLstmMetrics();

  const metricCards = [
    {
      label: t.fore.mae,
      value: metrics.available && metrics.mae != null ? `${metrics.mae.toFixed(2)} kW` : '—',
      detail: metrics.available ? t.fore.maeSub : t.dash.lstmNotAvail,
      icon: <Target size={16} className="text-slate-500 dark:text-slate-400" />,
      badge: metrics.available ? undefined : t.dash.soonBadge,
    },
    {
      label: t.fore.accuracy,
      value: metrics.available && metrics.failure_accuracy != null ? `${(metrics.failure_accuracy * 100).toFixed(1)}%` : '—',
      detail: metrics.available ? t.fore.accuracySub : t.dash.lstmNotAvail,
      icon: <Activity size={16} className="text-slate-500 dark:text-slate-400" />,
      badge: metrics.available ? undefined : t.dash.soonBadge,
    },
    {
      label: t.fore.lastRetrain,
      value: metrics.available ? formatElapsed(metrics.last_trained_at) : '—',
      detail: metrics.available ? t.fore.retrainSub : t.dash.lstmNotAvail,
      icon: <TimerReset size={16} className="text-slate-500 dark:text-slate-400" />,
      badge: metrics.available ? undefined : t.dash.soonBadge,
    },
  ];

  return (
    <section className="mx-auto max-w-[1500px]">
      <PageIntro icon={<BrainCircuit size={23} className="text-violet-600" />} tint="bg-violet-100 dark:bg-violet-900/30"
        title={t.fore.title} description={t.fore.description} />
      <div className="mt-7 grid grid-cols-3 gap-4">
        {metricCards.map((card) => <KpiCard key={card.label} {...card} />)}
      </div>
      <div className="mt-6"><PredictionPanel rows={rows} /></div>
      <div className="mt-6">
        <Panel title={t.fore.failureRisk} subtitle={t.fore.failureRiskSub}>
          <FailureProbabilityChart rows={rows} metrics={metrics} />
        </Panel>
      </div>
    </section>
  );
}

// ─── AlertsView ───────────────────────────────────────────────────────────────

export function AlertsView() {
  const { machines: rows } = useMachines();
  const { t } = useLang();
  const { canResolveAlerts } = useAuth();
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const { points: severityPoints } = useSeverityTimeline(60, 5);
  const { points: errorsPoints }   = useErrorsTimeline(60, 5);

  const baseAlerts: AlertRow[] = rows.filter((m) => m.error !== '-').map((m, i) => ({
    id: `A-${1000 + i}`, machine: m.id, occurrence: m.error,
    severity: (m.status === 'Error' ? 'Crítico' : 'Aviso') as AlertRow['severity'],
    status: 'Aberto' as AlertRow['status'], firedAt: m.updatedAt,
  }));

  const alerts: AlertRow[] = baseAlerts.map((a) =>
    resolvedIds.has(a.id) ? { ...a, status: 'Resolvido' as AlertRow['status'] } : a
  );

  const open      = alerts.filter((a) => a.status === 'Aberto').length;
  const inReview  = alerts.filter((a) => a.status === 'Em análise').length;
  const resolved  = alerts.filter((a) => a.status === 'Resolvido').length;
  const colorMap  = Object.fromEntries(rows.map((m) => [m.id, m.color]));

  const severityChartSeries: Series[] = [
    { label: t.alrt.critical, color: '#ef4444', values: severityPoints.map((p) => p.error) },
    { label: t.alrt.warning,  color: '#f59e0b', values: severityPoints.map((p) => p.warning) },
  ];
  const severityLabels = severityPoints.map((p) => p.time.slice(11, 16));

  return (
    <section className="mx-auto max-w-[1500px]">
      <PageIntro icon={<AlertTriangle size={23} className="text-red-500" />} tint="bg-red-100 dark:bg-red-900/30"
        title={t.alrt.title} description={t.alrt.description} />

      <div className="mt-7 grid grid-cols-3 gap-4">
        <KpiCard label={t.alrt.open}     value={String(open)}     detail={t.alrt.openSub}     icon={<Bell       size={16} className="text-red-500" />} />
        <KpiCard label={t.alrt.inReview} value={String(inReview)} detail={t.alrt.inReviewSub} icon={<AlertTriangle size={16} className="text-amber-500" />} />
        <KpiCard label={t.alrt.resolved} value={String(resolved)} detail={t.alrt.resolvedSub} icon={<CheckCircle2 size={16} className="text-emerald-500" />} />
      </div>

      <Panel className="mt-6" title={t.alrt.severityTitle} subtitle={t.alrt.severitySub}>
        <SeverityOverTimeChart series={severityChartSeries} labels={severityLabels} />
      </Panel>

      <Panel className="mt-6" title={t.alrt.errorsTitle} subtitle={t.alrt.errorsSub}>
        <ErrorBarsChart points={errorsPoints} colors={colorMap} />
      </Panel>

      <Panel className="mt-6" title={t.alrt.histTitle} subtitle={t.alrt.histSub}>
        <table className="w-full table-fixed border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              <th className="w-[110px] py-3">{t.alrt.colId}</th>
              <th className="w-[140px] py-3">{t.alrt.colMachine}</th>
              <th className="py-3">{t.alrt.colOccurrence}</th>
              <th className="w-[170px] py-3">{t.alrt.colSeverity}</th>
              <th className="w-[170px] py-3">{t.alrt.colStatus}</th>
              <th className="w-[130px] py-3">{t.alrt.colFired}</th>
              <th className="w-[120px] py-3 text-right">{t.alrt.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                <td className="py-4 font-mono text-[13px] text-slate-900 dark:text-slate-100">{alert.id}</td>
                <td className="py-4 font-mono text-[13px] text-slate-900 dark:text-slate-100">{alert.machine}</td>
                <td className="py-4 text-slate-700 dark:text-slate-300">{alert.occurrence}</td>
                <td className="py-4"><SeverityBadge severity={alert.severity} /></td>
                <td className="py-4"><StatusText status={alert.status} /></td>
                <td className="py-4 text-[13px] text-slate-500 dark:text-slate-400">{alert.firedAt}</td>
                <td className="py-4 text-right">
                  {alert.status !== 'Resolvido' && canResolveAlerts && (
                    <button type="button" onClick={() => setResolvedIds((prev) => new Set([...prev, alert.id]))}
                      className="h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-[13px] font-medium text-slate-900 dark:text-slate-100 transition hover:bg-slate-50 dark:hover:bg-slate-600">
                      {t.alrt.resolve}
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

// ─── SeverityBadge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: AlertRow['severity'] }) {
  const { t } = useLang();
  const labelMap: Record<AlertRow['severity'], string> = {
    'Crítico': t.alrt.critical,
    'Aviso':   t.alrt.warning,
    'Info':    t.alrt.info,
  };
  const styleMap: Record<AlertRow['severity'], string> = {
    'Crítico': 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400',
    'Aviso':   'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    'Info':    'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  };
  return <span className={cx('rounded-full px-2.5 py-1 text-[12px] font-medium', styleMap[severity])}>{labelMap[severity]}</span>;
}

// ─── StatusText ───────────────────────────────────────────────────────────────

function StatusText({ status }: { status: AlertRow['status'] }) {
  const { t } = useLang();
  const labelMap: Record<AlertRow['status'], string> = {
    'Aberto':     t.alrt.statusOpen,
    'Em análise': t.alrt.statusInReview,
    'Resolvido':  t.alrt.statusResolved,
  };
  const styleMap: Record<AlertRow['status'], string> = {
    'Aberto':     'text-red-500',
    'Em análise': 'text-amber-600',
    'Resolvido':  'text-emerald-600',
  };
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-[13px] font-medium', styleMap[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{labelMap[status]}
    </span>
  );
}
