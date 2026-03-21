'use client';

import { ReactNode } from 'react';
import { AdminModeProvider } from '@/contexts/AdminModeContext';

export function Providers({ children }: { children: ReactNode }) {
  return <AdminModeProvider>{children}</AdminModeProvider>;
}
