'use client'

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Plus, Sparkles, Sun, Moon, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useLang } from '../lib/lang';
import { NotificationsButton } from './notifications-button';

export default function Header() {
    const pathname = usePathname();
    const { user, isAdmin } = useAuth();
    const { theme, toggle: toggleTheme } = useTheme();
    const { lang, toggle: toggleLang, t } = useLang();
    const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);

    const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '??';

    const [title, subtitle] = t.header[pathname] ?? [
        pathname.replace('/', '').charAt(0).toUpperCase() + pathname.slice(2),
        '',
    ];

    const closeAddMachine = () => setIsAddMachineOpen(false);

    const handleProvisionAgent = (event: React.SyntheticEvent) => {
        event.preventDefault();
        closeAddMachine();
    };

    return (
        <>
            <header className='fixed top-0 right-0 left-64 h-18 border-b border-slate-200 dark:border-slate-700 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur flex items-center justify-between px-8 z-30'>

                <div className='flex flex-col'>
                    <span className='text-lg font-bold text-slate-900 dark:text-slate-100'>
                        {title}
                    </span>
                    <span className='text-[13px] text-slate-500 dark:text-slate-400'>
                        {subtitle}
                    </span>
                </div>

                <div className='flex items-center gap-3'>

                    {/* Notificações */}
                    <NotificationsButton />

                    {/* Modo escuro / claro */}
                    <button
                        onClick={toggleTheme}
                        className='p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
                        title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
                    >
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>

                    {/* Idioma */}
                    <button
                        onClick={toggleLang}
                        className='flex items-center gap-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors tracking-wide'
                        title='Mudar idioma'
                    >
                        <span className={lang === 'pt' ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}>PT</span>
                        <span className='text-slate-300 dark:text-slate-600'>/</span>
                        <span className={lang === 'en' ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}>EN</span>
                    </button>

                    {/* Adicionar Máquina — só para admin */}
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => setIsAddMachineOpen(true)}
                            className='flex items-center gap-2 bg-[#0070f3] hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm'
                        >
                            <Plus size={18} />
                            {t.addMachine}
                        </button>
                    )}

                    {/* Avatar */}
                    <div className='w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm'>
                        {initials}
                    </div>

                </div>
            </header>

            {/* Modal — Adicionar Máquina */}
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
                        onClick={(e) => e.stopPropagation()}
                        className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
                        style={{ boxSizing: 'border-box', width: '100%', maxWidth: 660, padding: 28 }}
                    >
                        <button
                            type="button"
                            onClick={closeAddMachine}
                            className="absolute right-5 top-5 text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-100"
                            aria-label="Fechar modal"
                        >
                            <X size={22} />
                        </button>

                        <div className="pr-8" style={{ display: 'grid', gridTemplateColumns: '24px 1fr', columnGap: 12, alignItems: 'start' }}>
                            <Sparkles className="mt-1 text-[#0070f3]" size={24} strokeWidth={2.4} />
                            <div>
                                <h2 id="add-machine-title" className="text-[22px] font-bold leading-tight text-slate-900 dark:text-slate-100" style={{ margin: 0 }}>
                                    {t.modal.title}
                                </h2>
                                <p className="text-[16px] leading-relaxed text-slate-500 dark:text-slate-400" style={{ marginTop: 8, maxWidth: 570 }}>
                                    {t.modal.description}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>
                            <label className="flex min-w-0 flex-col gap-3 text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                                {t.modal.labelId}
                                <input type="text" defaultValue="M-004"
                                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-[16px] font-normal text-slate-700 dark:text-slate-200 outline-none transition-all focus:border-[#0070f3] focus:ring-4 focus:ring-blue-500/10" />
                            </label>
                            <label className="flex min-w-0 flex-col gap-3 text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                                {t.modal.labelName}
                                <input type="text" defaultValue="Tear Circular D"
                                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-[16px] font-normal text-slate-700 dark:text-slate-200 outline-none transition-all focus:border-[#0070f3] focus:ring-4 focus:ring-blue-500/10" />
                            </label>
                        </div>

                        <fieldset className="mt-8">
                            <legend className="text-[18px] font-bold text-slate-900 dark:text-slate-100">{t.modal.limitsLegend}</legend>
                            <div className="mt-5" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>
                                {([[t.modal.limitBase, '12.0', 'kW'], [t.modal.limitMax, '18.0', 'kW'], [t.modal.limitYarn, '20', '%']] as [string, string, string][]).map(([label, def, unit]) => (
                                    <label key={label} className="flex min-w-0 flex-col gap-3 text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                                        {label}
                                        <input type="number" step="0.1" defaultValue={def}
                                            className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-[16px] font-normal text-slate-700 dark:text-slate-200 outline-none transition-all focus:border-[#0070f3] focus:ring-4 focus:ring-blue-500/10" />
                                        <span className="text-[16px] font-normal text-slate-600 dark:text-slate-400">{unit}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <div className="mt-8" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button type="button" onClick={closeAddMachine}
                                className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-6 text-[16px] font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-600">
                                {t.modal.btnCancel}
                            </button>
                            <button type="submit"
                                className="h-11 rounded-xl bg-[#0070f3] px-6 text-[16px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-600">
                                {t.modal.btnProvision}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
