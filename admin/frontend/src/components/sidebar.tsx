'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gauge, Cpu, BrainCircuit, TriangleAlert } from 'lucide-react';

const links = [
    { href : '/', label: 'Overview', icon : Gauge}, 
    { href : '/maquinas', label: 'Máquinas', icon : Cpu},
    { href : '/previsao', label: 'Previsão IA', icon : BrainCircuit, badge: 'LSTM'},
    { href : '/alertas', label: 'Alertas', icon : TriangleAlert, badge: '3'}
]

export default function Sidebar(){
    const pathname = usePathname();

    return (
        <aside className='fixed top-0 left-0 h-screen w-64 border-r border-slate-200 bg-slate-50'>
            <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 min-w-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Cpu size={24} className='text-white'/>
                </div>
                <div className="flex flex-col">
                    <span className='text-sm font-semibold'>Orion</span>
                    <span className='text-[12px] text-gray-500'>IoT Predictive · FiWare</span>
                </div>
            </div>

        {/* Menu */}
        <div className="flex-1 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-4 px-3">
                MONITORIZAÇÃO
            </div>

                <nav className="space-y-1.5">
                        {links.map((link) => {
                            const isActive = pathname === link.href;
                            
                            return (
                                <Link 
                                    key={link.href} 
                                    href={link.href}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                                        isActive 
                                        ? "bg-[#eef2f6] text-slate-900 font-medium" 
                                        : "text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <link.icon 
                                            size={20} 
                                            className={isActive ? "text-blue-600" : "text-slate-500"} 
                                        />
                                        {link.label}
                                    </div>
                                    {link.badge && (
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                            link.badge === 'LSTM'
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-rose-100 text-rose-500'
                                        }`}>
                                            {link.badge}
                                        </span>
                                    )}
                                    
                                </Link>
                            );
                        })}
                </nav>
            </div>

            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-slate-200 bg-slate-100/60 p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Broker FiWare
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    Orion Context Broker online · 3 agentes ativos
                </p>
            </div>
        </aside>

    )
}
