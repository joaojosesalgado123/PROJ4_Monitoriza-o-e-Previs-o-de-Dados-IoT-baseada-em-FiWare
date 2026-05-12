import Sidebar from '../components/sidebar';
import Header from '../components/header';
import { Zap, Factory, TriangleAlert, BrainCircuit, ChevronDown } from 'lucide-react';
import { fetchMachines, computeKpis } from '../lib/api';
import type { KpiItem, MachineItem, MachineStatus } from '../lib/api';

const styleMap = {
  energy:     { icon: Zap,           border: 'bg-[#0070f3]', iconBg: 'bg-blue-50',    iconTxt: 'text-[#0070f3]' },
  status:     { icon: Factory,       border: 'bg-[#10b981]', iconBg: 'bg-emerald-50', iconTxt: 'text-[#10b981]' },
  alert:      { icon: TriangleAlert, border: 'bg-red-500',   iconBg: 'bg-red-50',     iconTxt: 'text-red-500'  },
  prediction: { icon: BrainCircuit,  border: 'bg-[#8b5cf6]', iconBg: 'bg-[#f5f3ff]',  iconTxt: 'text-[#8b5cf6]' },
};

const badgeStyles = {
  success: 'bg-[#dcfce7] text-[#166534]',
  danger:  'bg-red-100 text-red-600',
  purple:  'bg-[#8b5cf6] text-white'
};

const machineStatusMap: Record<MachineStatus, {
  label: string;
  badge: string;
  dot: string;
  bar: string;
  errorTxt: string;
}> = {
  running: { label: 'Running', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', bar: 'bg-emerald-500', errorTxt: 'text-slate-400' },
  error:   { label: 'Error',   badge: 'bg-red-100 text-red-600',         dot: 'bg-red-500',     bar: 'bg-red-500',     errorTxt: 'text-red-500'   },
  offline: { label: 'Offline', badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500',   bar: 'bg-emerald-500', errorTxt: 'text-amber-600' },
};

export default async function Home() {
  let machineData: MachineItem[] = [];
  let kpiData: KpiItem[] = [];

  try {
    machineData = await fetchMachines();
    kpiData = computeKpis(machineData);
  } catch {
    kpiData = computeKpis([]);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Header />

      <main className="ml-64 pl-8 pr-8 pt-28 pb-12">

        {/* === SECÇÃO 1: CARTÕES DE REFERÊNCIA (KPIs) === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiData.map((kpi) => {
            const style = styleMap[kpi.type];
            const IconComponent = style.icon;

            return (
              <div
                key={kpi.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 relative overflow-hidden flex flex-col justify-between shadow-sm min-h-[160px]"
              >
                <div className={`absolute top-0 left-0 w-full h-[3px] ${style.border}`}></div>

                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      {kpi.title}
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${style.iconBg}`}>
                      <IconComponent className={style.iconTxt} size={16} strokeWidth={2.5} />
                    </div>
                  </div>

                  <div className="text-[26px] font-bold text-slate-900 tracking-tight leading-none">
                    {kpi.value}
                  </div>
                </div>

                <div className="flex items-end justify-between mt-4">
                  <span className="text-[11px] text-slate-500 whitespace-pre-line leading-relaxed">
                    {kpi.subtitle}
                  </span>

                  {kpi.badge && (
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-md ${badgeStyles[kpi.badge.style]}`}>
                      {kpi.badge.text}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* === SECÇÃO 2: GRÁFICO E PREVISÃO === */}
        <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden">

          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div>
              <h2 className="text-[16px] font-bold text-slate-900">
                Consumo energético · histórico + previsão
              </h2>
              <p className="text-[13px] text-slate-500 mt-1">
                Últimos 60 minutos de telemetria e projeção dos próximos 30 minutos pelo modelo LSTM.
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 text-[13px] text-slate-600 font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1.5 bg-[#0070f3] rounded-full"></div>
                  <span>Histórico</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full"></div>
                  </div>
                  <span>Previsão IA</span>
                </div>
              </div>

              <div className="relative">
                <select className="appearance-none bg-white border border-slate-200 hover:border-blue-500 text-slate-700 text-[13px] py-1.5 pl-3 pr-8 rounded-lg outline-none transition-colors cursor-pointer w-64 shadow-sm">
                  {machineData.map((m) => (
                    <option key={m.id}>{m.id} · {m.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div className="w-full h-72 flex items-center justify-center border-t border-slate-100 pt-6 mt-6">
            <span className="text-slate-400 text-sm">Aguardando endpoint de séries temporais</span>
          </div>

        </div>

        {/* === SECÇÃO 3: ESTADO DAS MÁQUINAS · TEMPO REAL === */}
        <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          <div className="flex items-start justify-between p-6">
            <div>
              <h2 className="text-[16px] font-bold text-slate-900">
                Estado das máquinas · tempo real
              </h2>
              <p className="text-[13px] text-slate-500 mt-1">
                Telemetria enviada pelos Agentes IoT para o Orion Context Broker.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-[12px] font-medium px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>atualizado há 3s</span>
            </div>
          </div>

          <div
            className="grid gap-4 px-6 py-3 border-t border-slate-100 text-[12px] font-semibold text-slate-500"
            style={{ gridTemplateColumns: '90px 1.4fr 130px 1.6fr 110px 1.6fr 80px' }}
          >
            <span>ID</span>
            <span>Máquina</span>
            <span>Status</span>
            <span>Fio restante</span>
            <span>Consumo</span>
            <span>Último erro</span>
            <span className="text-right">Atualizado</span>
          </div>

          <div>
            {machineData.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm border-t border-slate-100">
                Sem dados disponíveis — verifique se o backend está a correr.
              </div>
            ) : (
              machineData.map((machine) => {
                const s = machineStatusMap[machine.status];

                return (
                  <div
                    key={machine.id}
                    className="grid gap-4 px-6 py-4 border-t border-slate-100 items-center"
                    style={{ gridTemplateColumns: '90px 1.4fr 130px 1.6fr 110px 1.6fr 80px' }}
                  >
                    <span className="font-mono text-[13px] text-slate-700">
                      {machine.id}
                    </span>

                    <div className="flex flex-col">
                      <span className="text-[14px] font-semibold text-slate-900">
                        {machine.name}
                      </span>
                      <span className="text-[12px] text-slate-500">
                        {machine.line}
                      </span>
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full ${s.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                        {s.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.bar}`}
                          style={{ width: `${machine.yarnRemaining}%` }}
                        ></div>
                      </div>
                      <span className="text-[13px] font-semibold text-slate-900 w-10 text-right">
                        {machine.yarnRemaining}%
                      </span>
                    </div>

                    <div className="text-[14px] text-slate-900">
                      <span className="font-semibold">{machine.consumption.toFixed(1)}</span>
                      <span className="text-slate-400 ml-1">kW</span>
                    </div>

                    <div className={`font-mono text-[12.5px] ${s.errorTxt}`}>
                      {machine.lastError
                        ? `${machine.lastError.code} · ${machine.lastError.message}`
                        : '—'}
                    </div>

                    <span className="text-[12px] text-slate-400 text-right">
                      {machine.lastUpdate}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
