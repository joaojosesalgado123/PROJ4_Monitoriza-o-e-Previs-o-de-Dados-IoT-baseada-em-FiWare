'use client'

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/header';
import { useAuth } from '../../lib/auth';
import { useLang } from '../../lib/lang';
import { UserPlus, Trash2, User, Building2, X, Eye, EyeOff, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const DEPARTMENTS = ['Fiação', 'Tecelagem', 'Tingimento', 'Manutenção', 'Qualidade'];

interface Worker { username: string; name: string; department: string; role: string }
interface FormState { name: string; username: string; password: string; confirmPassword: string; department: string }
const EMPTY_FORM: FormState = { name: '', username: '', password: '', confirmPassword: '', department: '' };

export default function TrabalhadoresPage() {
  const { token } = useAuth();
  const { t } = useLang();
  const [workers, setWorkers]           = useState<Worker[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState<FormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, { headers: authHeaders });
      if (res.ok) setWorkers(await res.json());
    } catch (e) {
      console.error('Erro ao carregar trabalhadores:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  const handleCreate = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('As palavras-passe não coincidem');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ username: form.username, password: form.password, name: form.name, department: form.department }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao criar trabalhador'); return; }
      setWorkers((prev) => [...prev, data]);
      setShowModal(false);
      setForm(EMPTY_FORM);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (username: string) => {
    const res = await fetch(`${API_URL}/api/users/${username}`, { method: 'DELETE', headers: authHeaders });
    if (res.ok) setWorkers((prev) => prev.filter((w) => w.username !== username));
    setDeleteTarget(null);
  };

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const count = workers.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <Header />

      <main className="ml-64 px-8 pb-10 pt-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.workers.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {count} {count !== 1 ? t.workers.countPlural : t.workers.countSingle}
            </p>
          </div>
          <button
            onClick={() => { setShowModal(true); setError(''); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <UserPlus size={16} />
            {t.workers.newBtn}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <Loader2 size={24} className="animate-spin mr-2" /> {t.workers.loadingMsg}
          </div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <User size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{t.workers.emptyTitle}</p>
            <p className="text-sm">
              {t.workers.emptyAction} <strong>{t.workers.emptyActionBtn}</strong> {t.workers.emptyActionEnd}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {workers.map((w) => (
              <div key={w.username}
                className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-sm">
                    {(w.name || w.username).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{w.name || w.username}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">@{w.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {w.department && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Building2 size={13} />{w.department}
                    </div>
                  )}
                  <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 capitalize">
                    {w.role}
                  </span>
                  <button onClick={() => setDeleteTarget(w.username)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title={t.workers.btnRemove}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal — criar trabalhador */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.workers.modalTitle}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t.workers.modalSub}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.workers.labelName}</label>
                <input type="text" placeholder={t.workers.placeholderName} required
                  className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  {...field('name')} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.workers.labelUsername}</label>
                <input type="text" placeholder={t.workers.placeholderUsername} required autoComplete="off"
                  className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  {...field('username')} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.workers.labelDept}</label>
                <select className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  {...field('department')}>
                  <option value="">{t.workers.noDept}</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.workers.labelPassword}</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} placeholder={t.workers.placeholderPwd} required autoComplete="new-password"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 pr-10 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all"
                      {...field('password')} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.workers.labelConfirm}</label>
                  <input type={showPassword ? 'text' : 'password'} placeholder={t.workers.placeholderConfirm} required autoComplete="new-password"
                    className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    {...field('confirmPassword')} />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5 border border-red-100 dark:border-red-800">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="h-10 px-5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                  {t.workers.btnCancel}
                </button>
                <button type="submit" disabled={submitting}
                  className="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 transition-colors">
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {t.workers.btnCreate}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — confirmar remoção */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">{t.workers.removeTitle}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              {t.workers.removeMsg(deleteTarget)}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                {t.workers.btnCancel}
              </button>
              <button onClick={() => handleDelete(deleteTarget)}
                className="h-9 px-4 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
                {t.workers.btnRemove}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
