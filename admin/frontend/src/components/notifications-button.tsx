'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useNotifications, type AppNotification, type NotifSeverity } from '../lib/useNotifications';
import { useLang } from '../lib/lang';

function NotifRow({ n }: { n: AppNotification }) {
  const { t } = useLang();
  const cfg = {
    error:   { Icon: AlertCircle,  iconClass: 'text-red-500',   rowClass: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800',     label: t.notifications.labelError },
    warning: { Icon: AlertTriangle, iconClass: 'text-amber-500', rowClass: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800', label: t.notifications.labelWarn },
  }[n.severity];

  return (
    <div className={`flex gap-3 px-5 py-4 border-b ${cfg.rowClass}`}>
      <div className="shrink-0 mt-0.5">
        <cfg.Icon size={16} className={cfg.iconClass} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{n.title}</p>
          <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
            n.severity === 'error'
              ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
          }`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.description}</p>
        <span className="inline-block mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wide">{n.machineId}</span>
      </div>
    </div>
  );
}

export function NotificationsButton() {
  const notifications = useNotifications();
  const { t } = useLang();
  const [open, setOpen]       = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const panelRef              = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;
  const errorCount  = notifications.filter(n => n.severity === 'error').length;
  const warnCount   = notifications.filter(n => n.severity === 'warning').length;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function handleToggle() {
    if (!open) setReadIds(new Set(notifications.map(n => n.id)));
    setOpen(v => !v);
  }

  return (
    <div ref={panelRef} className="relative">
      <button onClick={handleToggle}
        className="relative p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title={t.notifications.title}>
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-88 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden">

          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.notifications.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {notifications.length === 0 ? t.notifications.allOk : t.notifications.active(notifications.length)}
              </p>
            </div>
            <button onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <CheckCircle2 size={28} className="mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.notifications.none}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t.notifications.noneDesc}</p>
              </div>
            ) : (
              notifications.map(n => <NotifRow key={n.id} n={n} />)
            )}
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                {errorCount > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertCircle size={12} className="text-red-500" />
                    {t.notifications.critical(errorCount)}
                  </span>
                )}
                {warnCount > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle size={12} className="text-amber-500" />
                    {t.notifications.warning(warnCount)}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{t.notifications.refreshes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
