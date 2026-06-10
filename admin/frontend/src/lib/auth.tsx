'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { setApiToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export interface AuthUser {
  username: string;
  role: 'admin' | 'trabalhador';
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setApiToken(storedToken);
      }
    } catch {
      // ignore parse errors
    }
    setIsReady(true);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? 'Credenciais inválidas');
    }
    const data = await res.json() as { token: string; user: AuthUser };
    setToken(data.token);
    setUser(data.user);
    setApiToken(data.token);
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    document.cookie = `auth_token=${data.token}; path=/; max-age=86400; SameSite=Lax`;
    router.push('/');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setApiToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    document.cookie = 'auth_token=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin: user?.role === 'admin', isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
