'use client'

import { FormEvent, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Plus, Search, Sparkles, Sun, X } from 'lucide-react';

export default function Header(){
    const pathname = usePathname();
    const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
    
    const getTitle = () => {
        if (pathname === '/') return 'Dashboard Overview';
        if (pathname === '/maquinas') return 'Gestão de Máquinas';
        if (pathname === '/previsao') return 'Previsão com IA';
        if (pathname === '/alertas') return 'Centro de Alertas';
        return pathname.replace('/', '').charAt(0).toUpperCase() + pathname.slice(2);
    };

    const getSubtitle = () => {
        if (pathname === '/maquinas') return 'Agentes IoT registados no Orion Context Broker';
        if (pathname === '/previsao') return 'Modelo LSTM · consumo e ocorrências nas próximas horas';
        if (pathname === '/alertas') return 'Ocorrências críticas, em manutenção e resolvidas';
        return 'Monitorização preditiva · 3 máquinas · Orion Context Broker';
    };

    const closeAddMachine = () => {
        setIsAddMachineOpen(false);
    };

    const handleProvisionAgent = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        closeAddMachine();
    };

    return (
        <>
            <header className='fixed top-0 right-0 left-64 h-18 border-b border-slate-200 bg-slate-50/95 flex items-center justify-between px-8 z-30'>
                
                <div className='flex flex-col'>
                    <span className='text-lg font-bold text-slate-900'>
                        {getTitle()}
                    </span>
                    <span className='text-[13px] text-slate-500 '>
                        {getSubtitle()}
                    </span>
                </div>

                <div className='flex items-center gap-4'>
                    
                    {/* Barra de Pesquisa */}
                    <div className='relative flex items-center'>
                        <Search className='absolute left-3 text-slate-400' size={18}/>
                        <input 
                            type="text" 
                            placeholder="Pesquisar máquina, alerta..." 
                            className="pl-10 pr-4 py-2 border border-slate-200 hover:border-slate-300 bg-white placeholder:text-slate-400 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all w-72"
                        />
                    </div>

                    {/* Notificação */}
                    <button className='relative p-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors'>
                        <Bell size={18} />
                    </button>

                    {/* Modo Escuro */}
                    <button className='p-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors'>
                        <Sun size={18} />
                    </button>

                    {/* Adicionar Máquina */}
                    <button
                        type="button"
                        onClick={() => setIsAddMachineOpen(true)}
                        className='flex items-center gap-2 bg-[#0070f3] hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ml-1 shadow-sm'
                    >
                        <Plus size={18} />
                        Adicionar máquina
                    </button>

                    {/* Avatar do Utilizador (verificar se vai ser necessário haver um login antes de abir sessão */}
                    <div className='w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-700 text-sm ml-2'>
                        PM
                    </div>
                    
                </div>
            </header>

            {isAddMachineOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        overflowY: 'auto',
                        backgroundColor: 'rgba(15, 23, 42, 0.45)',
                        paddingTop: 68,
                        paddingBottom: 24,
                        paddingLeft: 16,
                        paddingRight: 16,
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="add-machine-title"
                    onClick={closeAddMachine}
                >
                    <form
                        onSubmit={handleProvisionAgent}
                        onClick={(event) => event.stopPropagation()}
                        className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl"
                        style={{
                            boxSizing: 'border-box',
                            width: '100%',
                            maxWidth: 660,
                            padding: 28,
                        }}
                    >
                        <button
                            type="button"
                            onClick={closeAddMachine}
                            className="absolute right-5 top-5 text-slate-500 transition-colors hover:text-slate-900"
                            aria-label="Fechar modal"
                        >
                            <X size={22} />
                        </button>

                        <div
                            className="pr-8"
                            style={{ display: 'grid', gridTemplateColumns: '24px 1fr', columnGap: 12, alignItems: 'start' }}
                        >
                            <Sparkles className="mt-1 text-[#0070f3]" size={24} strokeWidth={2.4} />
                            <div>
                                <h2 id="add-machine-title" className="text-[22px] font-bold leading-tight text-slate-900" style={{ margin: 0 }}>
                                    Provisionar novo Agente IoT
                                </h2>
                                <p className="text-[16px] leading-relaxed text-slate-500" style={{ marginTop: 8, maxWidth: 570 }}>
                                    Define os parâmetros base. A máquina será registada no Orion Context Broker e começará a enviar telemetria automaticamente.
                                </p>
                            </div>
                        </div>

                        <div
                            className="mt-6"
                            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20 }}
                        >
                            <label className="flex min-w-0 flex-col gap-3 text-[15px] font-semibold text-slate-900">
                                ID da máquina
                                <input
                                    type="text"
                                    defaultValue="M-004"
                                    className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[16px] font-normal text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-[#0070f3] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                />
                            </label>

                            <label className="flex min-w-0 flex-col gap-3 text-[15px] font-semibold text-slate-900">
                                Nome
                                <input
                                    type="text"
                                    defaultValue="Tear Circular D"
                                    className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[16px] font-normal text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-[#0070f3] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                />
                            </label>
                        </div>

                        <p className="mt-4 text-[16px] text-slate-500">
                            Identificador único no broker.
                        </p>

                        <fieldset className="mt-8">
                            <legend className="text-[18px] font-bold text-slate-900">
                                Limites de segurança
                            </legend>

                            <div
                                className="mt-5"
                                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 20 }}
                            >
                                <label className="flex min-w-0 flex-col gap-3 text-[15px] font-semibold text-slate-900">
                                    Consumo base
                                    <input
                                        type="number"
                                        step="0.1"
                                        defaultValue="12.0"
                                        className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[16px] font-normal text-slate-700 shadow-sm outline-none transition-all focus:border-[#0070f3] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                    />
                                    <span className="text-[16px] font-normal text-slate-600">kW</span>
                                </label>

                                <label className="flex min-w-0 flex-col gap-3 text-[15px] font-semibold text-slate-900">
                                    Consumo máx.
                                    <input
                                        type="number"
                                        step="0.1"
                                        defaultValue="18.0"
                                        className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[16px] font-normal text-slate-700 shadow-sm outline-none transition-all focus:border-[#0070f3] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                    />
                                    <span className="text-[16px] font-normal text-slate-600">kW</span>
                                </label>

                                <label className="flex min-w-0 flex-col gap-3 text-[15px] font-semibold text-slate-900">
                                    Fio mín.
                                    <input
                                        type="number"
                                        defaultValue="20"
                                        className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[16px] font-normal text-slate-700 shadow-sm outline-none transition-all focus:border-[#0070f3] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                    />
                                    <span className="text-[16px] font-normal text-slate-600">%</span>
                                </label>
                            </div>
                        </fieldset>

                        <div
                            className="mt-8"
                            style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}
                        >
                            <button
                                type="button"
                                onClick={closeAddMachine}
                                className="h-11 rounded-xl border border-slate-200 bg-white px-6 text-[16px] font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="h-11 rounded-xl bg-[#0070f3] px-6 text-[16px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-600"
                            >
                                Provisionar agente
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    )
}
