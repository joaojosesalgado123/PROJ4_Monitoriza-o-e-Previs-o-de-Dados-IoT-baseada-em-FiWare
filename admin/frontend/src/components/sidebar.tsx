'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gauge, Cpu, BrainCircuit, TriangleAlert, LogOut, Users } from 'lucide-react';
import { useMachines } from '../lib/useMachines';
import { useAuth } from '../lib/auth';
import { useLang } from '../lib/lang';

const NAV_ITEMS = [
    { href: '/',              key: 'overview' as const, icon: Gauge,         adminOnly: false, maintenanceAllowed: true  },
    { href: '/maquinas',      key: 'machines'  as const, icon: Cpu,          adminOnly: false, maintenanceAllowed: true  },
    { href: '/trabalhadores', key: 'workers'   as const, icon: Users,        adminOnly: true,  maintenanceAllowed: false },
    { href: '/previsao',      key: 'forecast'  as const, icon: BrainCircuit, adminOnly: false, maintenanceAllowed: false, badge: 'LSTM' },
    { href: '/alertas',       key: 'alerts'    as const, icon: TriangleAlert, adminOnly: false, maintenanceAllowed: true  },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { machines } = useMachines();
    const { user, logout, isAdmin } = useAuth();
    const { t } = useLang();

    const isMaintenance = user?.department === 'Manutenção';
    const errorCount = machines.filter((m) => m.status === 'Error').length;
    const links = NAV_ITEMS.filter((l) => {
        if (l.adminOnly && !isAdmin) return false;
        if (isMaintenance && !l.maintenanceAllowed) return false;
        return true;
    });
    const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '??';

    return (
        <aside className='fixed top-0 left-0 h-screen w-64 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col'>

            {/* Logo */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <div className="w-10 h-10 min-w-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Cpu size={24} className='text-white' />
                </div>
                <div className="flex flex-col">
                    <span className='text-sm font-semibold text-slate-900 dark:text-slate-100'>Orion</span>
                    <span className='text-[12px] text-slate-500 dark:text-slate-400'>IoT Predictive · FiWare</span>
                </div>
            </div>

            {/* Menu */}
            <div className="flex-1 p-4 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase mb-4 px-3 tracking-wide">
                    {t.monitoring}
                </div>

                <nav className="space-y-1.5">
                    {links.map((item) => {
                        const isActive = pathname === item.href;
                        const label = t.nav[item.key];
                        const badge = item.href === '/alertas'
                            ? (errorCount > 0 ? String(errorCount) : undefined)
                            : item.badge;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                                    isActive
                                        ? 'bg-[#eef2f6] dark:bg-slate-700/70 text-slate-900 dark:text-slate-100 font-medium'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon
                                        size={20}
                                        className={isActive ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}
                                    />
                                    {label}
                                </div>
                                {badge && (
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                        badge === 'LSTM'
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-rose-100 dark:bg-rose-900/40 text-rose-500'
                                    }`}>
                                        {badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom */}
            <div className="p-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/60 p-4">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        {t.broker}
                    </div>
                    <p className="mt-2 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                        {t.brokerSub} · {machines.length} {t.activeAgents}
                    </p>
                </div>

                {/* Utilizador + logout */}
                <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 min-w-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user?.username}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                            {user?.department ? user.department : user?.role}
                        </p>
                    </div>
                    <button
                        onClick={logout}
                        title="Terminar sessão"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
