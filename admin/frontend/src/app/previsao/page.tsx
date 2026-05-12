import Header from '../../components/header';
import Sidebar from '../../components/sidebar';
import {
  BrainCircuit,
  ChevronDown,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
} from 'lucide-react';

const metrics = [
  {
    label: 'MAE · consumo',
    value: '0.41 kW',
    detail: 'Erro médio absoluto na validação das últimas 72h',
    icon: Target,
  },
  {
    label: 'Acurácia · falhas',
    value: '87.6%',
    detail: 'Classificação binária · janelas de 15 minutos',
    icon: Sparkles,
  },
  {
    label: 'Última retraining',
    value: '2h 14m',
    detail: 'Pipeline automático a cada 6 horas',
    icon: TimerReset,
  },
];

const operationalInsights = [
  {
    machine: 'M-001 · Tear Circular A',
    headline: '+2.3% consumo nas próximas 2h',
    detail: 'Sem ação necessária. Modelo sugere manter setpoint atual.',
    confidence: 92,
    tone: 'emerald',
  },
  {
    machine: 'M-002 · Tear Jacquard B',
    headline: 'Probabilidade de falha · 71%',
    detail: 'Agendar inspeção do sistema de tensão nos próximos 45 minutos.',
    confidence: 71,
    tone: 'red',
  },
  {
    machine: 'M-003 · Tear Retilíneo C',
    headline: 'Retoma em ~12 minutos',
    detail: 'Pré-aquecer cabeçote para evitar pico de consumo no arranque.',
    confidence: 84,
    tone: 'amber',
  },
];

export default function PrevisaoPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Header />

      <main className="ml-64 px-8 pb-10 pt-24">
        <section className="mx-auto max-w-[1400px]">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <BrainCircuit size={24} strokeWidth={2.4} />
            </div>
            <div>
              <h1 className="text-[22px] font-bold leading-tight text-slate-900">
                Previsão com IA · LSTM
              </h1>
              <p className="mt-2 max-w-[680px] text-[14px] leading-6 text-slate-500">
                Modelo recorrente treinado com 30 dias de telemetria agregada. Produz previsões de consumo
                energético e probabilidade de falha nos próximos 30 minutos.
              </p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div
                  key={metric.label}
                  className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
                    <Icon size={16} />
                    <span>{metric.label}</span>
                  </div>
                  <div className="mt-4 text-[26px] font-bold tracking-tight text-slate-900">
                    {metric.value}
                  </div>
                  <p className="mt-8 text-[13px] leading-5 text-slate-500">
                    {metric.detail}
                  </p>
                </div>
              );
            })}
          </div>

          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-6 p-6">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">
                  Consumo energético · histórico + previsão
                </h2>
                <p className="mt-2 text-[13px] leading-5 text-slate-500">
                  Últimos 60 minutos de telemetria e projeção dos próximos 30 minutos pelo modelo LSTM.
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 text-[13px] font-medium text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-4 rounded-full bg-[#0070f3]" />
                    <span>Histórico</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-violet-600" />
                      <span className="h-2 w-2 rounded-full bg-violet-600" />
                    </span>
                    <span>Previsão IA</span>
                  </div>
                </div>

                <button className="flex h-10 min-w-[220px] items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm">
                  Máquina 001 · Tear Circular
                  <ChevronDown size={16} className="text-slate-400" />
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 p-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-[12px] font-medium uppercase text-slate-500">
                    Consumo atual
                  </div>
                  <div className="mt-2 text-[22px] font-bold text-slate-900">
                    12.36 <span className="text-[15px] font-semibold text-slate-500">kW</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-2 text-[12px] font-medium uppercase text-slate-500">
                    <BrainCircuit size={14} className="text-violet-600" />
                    Previsão média (30 min)
                  </div>
                  <div className="mt-2 text-[22px] font-bold text-slate-900">
                    13.13 <span className="text-[15px] font-semibold text-slate-500">kW</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-[12px] font-medium uppercase text-slate-500">
                    Variação esperada
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[22px] font-bold text-red-500">
                    <TrendingUp size={18} />
                    +6.3%
                  </div>
                </div>
              </div>

              <PredictionChart />
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-[16px] font-bold text-slate-900">
              Insights operacionais
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-slate-500">
              Recomendações geradas pelo modelo para cada máquina ativa.
            </p>

            <div className="mt-5 space-y-3">
              {operationalInsights.map((insight) => (
                <div
                  key={insight.machine}
                  className="grid min-h-[72px] grid-cols-[1fr_150px] items-center gap-6 rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          insight.tone === 'emerald'
                            ? 'bg-emerald-500'
                            : insight.tone === 'red'
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-[14px] font-bold text-slate-900">
                        {insight.machine}
                      </span>
                    </div>
                    <div
                      className={`mt-1 text-[13px] font-medium ${
                        insight.tone === 'emerald'
                          ? 'text-emerald-600'
                          : insight.tone === 'red'
                            ? 'text-red-500'
                            : 'text-amber-600'
                      }`}
                    >
                      {insight.headline}
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-slate-500">
                      {insight.detail}
                    </p>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium uppercase text-slate-500">
                      Confiança
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-violet-600"
                        style={{ width: `${insight.confidence}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[12px] font-semibold text-slate-900">
                      {insight.confidence}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function PredictionChart() {
  return (
    <div className="mt-5 h-[320px] w-full overflow-hidden">
      <svg viewBox="0 0 1180 320" className="h-full w-full" role="img" aria-label="Gráfico de consumo previsto">
        <defs>
          <linearGradient id="history-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0070f3" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0070f3" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="forecast-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {[42, 104, 166, 228, 290].map((y) => (
          <line
            key={y}
            x1="56"
            x2="1158"
            y1={y}
            y2={y}
            stroke="#dbe3ee"
            strokeDasharray="3 4"
          />
        ))}

        <text x="36" y="38" className="fill-slate-500 text-[12px]">16</text>
        <text x="35" y="50" className="fill-slate-500 text-[12px]">kW</text>
        <text x="34" y="102" className="fill-slate-500 text-[12px]">12</text>
        <text x="35" y="114" className="fill-slate-500 text-[12px]">kW</text>
        <text x="39" y="174" className="fill-slate-500 text-[12px]">kW</text>
        <text x="39" y="236" className="fill-slate-500 text-[12px]">kW</text>
        <text x="39" y="298" className="fill-slate-500 text-[12px]">kW</text>

        <path
          d="M56 74 C100 94 118 101 154 98 C196 94 207 73 247 64 C286 55 303 66 336 84 C373 105 394 107 431 104 C471 100 489 82 529 80 C567 78 585 99 625 112 C667 126 692 116 731 92 C772 67 800 64 840 78 C868 88 883 96 902 96 L902 290 L56 290 Z"
          fill="url(#history-fill)"
        />
        <path
          d="M902 96 C922 78 960 86 986 94 C1028 107 1052 100 1092 84 C1125 72 1150 78 1158 72 L1158 290 L902 290 Z"
          fill="url(#forecast-fill)"
        />
        <path
          d="M56 74 C100 94 118 101 154 98 C196 94 207 73 247 64 C286 55 303 66 336 84 C373 105 394 107 431 104 C471 100 489 82 529 80 C567 78 585 99 625 112 C667 126 692 116 731 92 C772 67 800 64 840 78 C868 88 883 96 902 96"
          fill="none"
          stroke="#0070f3"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d="M902 96 C922 78 960 86 986 94 C1028 107 1052 100 1092 84 C1125 72 1150 78 1158 72"
          fill="none"
          stroke="#8b5cf6"
          strokeDasharray="5 6"
          strokeLinecap="round"
          strokeWidth="3"
        />

        <line x1="902" x2="902" y1="46" y2="292" stroke="#64748b" strokeDasharray="2 5" />
        <text x="875" y="54" className="fill-slate-500 text-[12px]">agora</text>

        {[
          ['-60m', 56],
          ['-52m', 154],
          ['-44m', 252],
          ['-36m', 350],
          ['-28m', 448],
          ['-20m', 546],
          ['-12m', 644],
          ['-4m', 742],
          ['+4m', 948],
          ['+12m', 1046],
          ['+20m', 1120],
          ['+28m', 1158],
        ].map(([label, x]) => (
          <text key={label} x={Number(x) - 16} y="314" className="fill-slate-500 text-[12px]">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
