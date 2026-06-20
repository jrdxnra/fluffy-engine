import { useState, useCallback } from 'react';

const ADMIN_MODE_KEY = 'powerlift:adminMode';
const ADMIN_MODE_SECRET = 'powerlift-admin-2026'; // Can be changed or env var

/**
 * Hook for managing admin mode state
 * Uses localStorage safely with SSR support and error handling
 */
export function useAdminMode() {
  const [initialState] = useState(() => {
    try {
      if (typeof window === 'undefined') {
        return { isAdminMode: false, error: null as string | null };
      }

      const stored = localStorage.getItem(ADMIN_MODE_KEY);
      return { isAdminMode: stored === 'true', error: null as string | null };
    } catch (err) {
      console.warn('Admin mode: localStorage not available', err);
      return { isAdminMode: false, error: 'Storage unavailable' as string | null };
    }
  });

  const [isAdminMode, setIsAdminMode] = useState(initialState.isAdminMode);
  const [isLoaded] = useState(true);
  const [error, setError] = useState<string | null>(initialState.error);

  const toggleAdminMode = useCallback(
    (secret?: string) => {
      try {
        // Validate secret if provided
        if (secret && secret !== ADMIN_MODE_SECRET) {
          console.warn('Admin mode: Invalid secret');
          setError('Invalid secret');
          return false;
        }

        const newState = !isAdminMode;

        // Attempt to persist to localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(ADMIN_MODE_KEY, String(newState));
          } catch (storageErr) {
            // If localStorage fails, still allow toggle in memory for this session
            console.warn('Admin mode: Failed to persist to storage', storageErr);
          }
        }

        setIsAdminMode(newState);
        setError(null);
        return true;
      } catch (err) {
        console.error('Admin mode: Error during toggle', err);
        setError('Toggle failed');
        return false;
      }
    },
    [isAdminMode]
  );

  const clearAdminMode = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(ADMIN_MODE_KEY);
        } catch (storageErr) {
          console.warn('Admin mode: Failed to clear storage', storageErr);
        }
      }
      setIsAdminMode(false);
      setError(null);
    } catch (err) {
      console.error('Admin mode: Error during clear', err);
      setError('Clear failed');
    }
  }, []);

  return {
    isAdminMode,
    isLoaded,
    error,
    toggleAdminMode,
    clearAdminMode,
  };
}
