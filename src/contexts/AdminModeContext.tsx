'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAdminMode } from '@/hooks/use-admin-mode';

interface AdminModeContextType {
  isAdminMode: boolean;
  isLoaded: boolean;
  error: string | null;
  toggleAdminMode: (secret?: string) => boolean;
  clearAdminMode: () => void;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const adminMode = useAdminMode();

  return (
    <AdminModeContext.Provider value={adminMode}>
      {children}
    </AdminModeContext.Provider>
  );
}

/**
 * Hook to access admin mode state and controls
 * Must be used within AdminModeProvider
 */
export function useAdminModeContext() {
  const context = useContext(AdminModeContext);
  if (context === undefined) {
    throw new Error('useAdminModeContext must be used within AdminModeProvider');
  }
  return context;
}
