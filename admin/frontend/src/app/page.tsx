'use client'

import Header from '../components/header';
import Sidebar from '../components/sidebar';
import { DashboardOverview, MaintenanceOverview } from '../components/charts';
import { useAuth } from '../lib/auth';

export default function Home() {
  const { user, isReady } = useAuth();
  const isMaintenance = user?.department === 'Manutenção';

  if (!isReady) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <Header />
      <main className="ml-64 px-8 pb-10 pt-24">
        {isMaintenance ? <MaintenanceOverview /> : <DashboardOverview />}
      </main>
    </div>
  );
}
