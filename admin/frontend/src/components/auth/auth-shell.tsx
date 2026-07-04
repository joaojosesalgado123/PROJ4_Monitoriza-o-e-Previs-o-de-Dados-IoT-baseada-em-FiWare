'use client'

import { Activity, BrainCircuit, Cpu, ShieldCheck } from 'lucide-react';

const features = [
  { icon: Activity,     label: 'Real-time NGSI-v2 telemetry' },
  { icon: BrainCircuit, label: 'AI-powered energy forecast (LSTM)' },
  { icon: ShieldCheck,  label: 'Predictive anomaly alerts' },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">

      {/* Painel esquerdo — 50% */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center py-14 px-12"
        style={{ background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 60%, #1e88e5 100%)' }}
      >
        {/* Logo */}
        <div className="w-full flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Cpu size={26} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-2xl leading-none">Orion</div>
            <div className="text-blue-200 text-sm mt-1">IoT Predictive · FiWare</div>
          </div>
        </div>

        {/* Conteúdo central — centrado vertical e horizontalmente */}
        <div className="flex-1 flex flex-col justify-center items-center text-center">
          <h1 className="text-6xl font-bold text-white leading-tight mb-8">
            Predictive monitoring<br />for your textile plant.
          </h1>
          <p className="text-blue-100 text-xl leading-relaxed mb-14 max-w-md">
            Real-time telemetry via Orion Context Broker and energy
            consumption forecasting with LSTM models. Anticipate failures
            before they happen.
          </p>
          <div className="flex flex-col gap-7 w-full max-w-xs">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-5">
                <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                  <Icon size={24} className="text-white" />
                </div>
                <span className="text-white/90 text-lg font-medium text-left">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-blue-200 text-sm">Project IV · Predictive maintenance platform</p>
      </div>

      {/* Painel direito — 50%, centrado */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 px-8 py-12">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-slate-100 px-16 py-14">
          {children}
        </div>
      </div>

    </div>
  );
}
