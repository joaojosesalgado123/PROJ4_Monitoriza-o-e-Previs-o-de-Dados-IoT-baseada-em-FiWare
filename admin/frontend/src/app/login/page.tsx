'use client'

import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { AuthShell } from '../../components/auth/auth-shell';

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-10">
        <h2 className="text-4xl font-bold tracking-tight text-slate-900">Welcome back</h2>
        <p className="mt-3 text-lg text-slate-500">
          Sign in to your Orion account to access the dashboard.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="username" className="text-base font-semibold text-slate-700">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="name@company.com"
            required
            autoComplete="username"
            className="h-14 w-full rounded-xl border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-base font-semibold text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="h-14 w-full rounded-xl border border-slate-200 bg-white px-5 pr-14 text-base text-slate-900 outline-none placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-base text-red-600 bg-red-50 rounded-xl px-5 py-3 border border-red-100">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full h-14 flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white text-lg font-semibold transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          Sign in
        </button>
      </form>

      <p className="mt-10 text-center text-sm text-slate-400">
        Access restricted to authorised operators. To obtain credentials,
        contact your system administrator.
      </p>
    </AuthShell>
  );
}
