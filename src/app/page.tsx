import Sidebar from '../components/sidebar';
import Header from '../components/header';
import { Zap, Factory, TriangleAlert, BrainCircuit, ChevronDown } from 'lucide-react';

// 1. Definir os tipos de dados que seriam devolvidos pela tua API
type KpiItem = {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  type: 'energy' | 'status' | 'alert' | 'prediction';
  badge?: { text: string; style: 'success' | 'danger' | 'purple' };
};

type MachineStatus = 'running' | 'error' | 'offline';

type MachineItem = {
  id: string;
  name: string;
  line: string;
  status: MachineStatus;
  yarnRemaining: number; // 0-100
  consumption: number;   // kW
  lastError: { code: string; message: string } | null;
  lastUpdate: string;
};

// 2. Simular uma chamada a uma API ou base de dados (Ex: Orion Context Broker)
async function fetchKpiData(): Promise<KpiItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return [
    { id: '1', title: 'ENERGIA CONSUMIDA (HOJE)', value: '182.4 kWh', subtitle: 'Acumulado nas 3 máquinas\ndesde 00:00', type: 'energy', badge: { text: '-4.1% vs ontem', style: 'success' }},
    { id: '2', title: 'ESTADO DA FÁBRICA', value: '2 / 3 operacionais', subtitle: '1 em manutenção · 0 em paragem crítica', type: 'status' },
    { id: '3', title: 'ALERTA MAIS RECENTE', value: 'E-204 · Máquina 002', subtitle: 'Falha de tensão detetada há 12 segundos', type: 'alert', badge: { text: 'Crítico', style: 'danger' }},
    { id: '4', title: 'PREVISÃO PRÓXIMA HORA', value: '21.6 kWh', subtitle: 'Estimativa do modelo LSTM\npara consumo agregado', type: 'prediction', badge: { text: 'LSTM', style: 'purple' }}
  ];
}

async function fetchMachineData(): Promise<MachineItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  return [
    { id: 'M-001', name: 'Tear Circular A',  line: 'Linha Norte', status: 'running', yarnRemaining: 78, consumption: 14.2, lastError: null,                                                lastUpdate: 'há 3s' },
    { id: 'M-002', name: 'Tear Jacquard B',  line: 'Linha Norte', status: 'error',   yarnRemaining: 22, consumption: 3.1,  lastError: { code: 'E-204', message: 'Falha de tensão' },        lastUpdate: 'há 12s' },
    { id: 'M-003', name: 'Tear Retilíneo C', line: 'Linha Sul',   status: 'offline', yarnRemaining: 54, consumption: 0.0,  lastError: { code: 'E-101', message: 'Manutenção programada' }, lastUpdate: 'há 4m' },
  ];
}

// 3. Dicionários de aspeto: Mapeia o 'type' que vem da API para ícones e cores do Tailwind
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
  const kpiData = await fetchKpiData();
  const machineData = await fetchMachineData();

  return (
    // Removido o 'flex' daqui para respeitar as margens
    <div className="min-h-screen bg-slate-50">
      {/* Componentes de Navegação */}
      <Sidebar />
      <Header />

      {/* Área Principal de Conteúdo */}
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
                {/* Borda superior colorida */}
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
                  
                  {/* Badge */}
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
            
            {/* Título e Subtítulo */}
            <div>
              <h2 className="text-[16px] font-bold text-slate-900">
                Consumo energético · histórico + previsão
              </h2>
              <p className="text-[13px] text-slate-500 mt-1">
                Últimos 60 minutos de telemetria e projeção dos próximos 30 minutos pelo modelo LSTM.
              </p>
            </div>

            {/* Ações da direita: Legenda e Select */}
            <div className="flex items-center gap-6">
              
              {/* Legenda do Gráfico */}
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

              {/* Caixa de Seleção da Máquina */}
              <div className="relative">
                <select className="appearance-none bg-white border border-slate-200 hover:border-blue-500 text-slate-700 text-[13px] py-1.5 pl-3 pr-8 rounded-lg outline-none transition-colors cursor-pointer w-64 shadow-sm">
                  <option>Máquina 001 · Tear Circular</option>
                  <option>Máquina 002</option>
                  <option>Máquina 003</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
              
            </div>
          </div>

          <div className="w-full h-72 flex items-center justify-center border-t border-slate-100 pt-6 mt-6">
            <span className="text-slate-400 text-sm">Área reservada para o Gráfico (Recharts / Chart.js)</span>
          </div>

        </div>

        {/* === SECÇÃO 3: ESTADO DAS MÁQUINAS · TEMPO REAL === */}
        <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Cabeçalho do cartão */}
          <div className="flex items-start justify-between p-6">
            <div>
              <h2 className="text-[16px] font-bold text-slate-900">
                Estado das máquinas · tempo real
              </h2>
              <p className="text-[13px] text-slate-500 mt-1">
                Telemetria enviada pelos Agentes IoT para o Orion Context Broker.
              </p>
            </div>

            {/* Pill "atualizado há 3s" */}
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-[12px] font-medium px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>atualizado há 3s</span>
            </div>
          </div>

          {/* Cabeçalhos de coluna */}
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

          {/* Linhas de dados */}
          <div>
            {machineData.map((machine) => {
              const s = machineStatusMap[machine.status];

              return (
                <div
                  key={machine.id}
                  className="grid gap-4 px-6 py-4 border-t border-slate-100 items-center"
                  style={{ gridTemplateColumns: '90px 1.4fr 130px 1.6fr 110px 1.6fr 80px' }}
                >
                  {/* ID */}
                  <span className="font-mono text-[13px] text-slate-700">
                    {machine.id}
                  </span>

                  {/* Máquina + Linha */}
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-slate-900">
                      {machine.name}
                    </span>
                    <span className="text-[12px] text-slate-500">
                      {machine.line}
                    </span>
                  </div>

                  {/* Status badge */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full ${s.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                      {s.label}
                    </span>
                  </div>

                  {/* Fio restante (barra + %) */}
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

                  {/* Consumo */}
                  <div className="text-[14px] text-slate-900">
                    <span className="font-semibold">{machine.consumption.toFixed(1)}</span>
                    <span className="text-slate-400 ml-1">kW</span>
                  </div>

                  {/* Último erro */}
                  <div className={`font-mono text-[12.5px] ${s.errorTxt}`}>
                    {machine.lastError
                      ? `${machine.lastError.code} · ${machine.lastError.message}`
                      : '—'}
                  </div>

                  {/* Atualizado */}
                  <span className="text-[12px] text-slate-400 text-right">
                    {machine.lastUpdate}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        </main>
    </div>
  );
}