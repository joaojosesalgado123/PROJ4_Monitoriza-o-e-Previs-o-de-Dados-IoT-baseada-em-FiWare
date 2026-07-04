'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/header';
import Sidebar from '../../components/sidebar';
import { ForecastView } from '../../components/charts';
import { useAuth } from '../../lib/auth';

export default function PrevisaoPage() {
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && user?.department === 'Manutenção') {
      router.replace('/');
    }
  }, [isReady, user, router]);

  if (!isReady || user?.department === 'Manutenção') return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <Header />
      <main className="ml-64 px-8 pb-10 pt-24">
        <ForecastView />
      </main>
    </div>
  );
}
