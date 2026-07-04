'use client'

import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../lib/theme';
import { LangProvider } from '../lib/lang';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
