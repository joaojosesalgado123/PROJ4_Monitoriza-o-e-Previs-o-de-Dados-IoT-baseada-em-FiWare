import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dashboard IoT',
  description: 'Monitorização de Máquinas Têxteis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT">
      <body className="bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}