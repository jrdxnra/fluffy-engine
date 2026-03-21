import { useState, useEffect, useCallback } from 'react';

const ADMIN_MODE_KEY = 'powerlift:adminMode';
const ADMIN_MODE_SECRET = 'powerlift-admin-2026'; // Can be changed or env var

/**
 * Hook for managing admin mode state
 * Uses localStorage safely with SSR support and error handling
 */
export function useAdminMode() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize admin mode from localStorage on client-side mount
  useEffect(() => {
    try {
      // Only access localStorage on client-side
      if (typeof window === 'undefined') {
        return;
      }

      const stored = localStorage.getItem(ADMIN_MODE_KEY);
      const adminMode = stored === 'true';
      setIsAdminMode(adminMode);
      setIsLoaded(true);
    } catch (err) {
      // Handle cases where localStorage is not available (private browsing, etc.)
      console.warn('Admin mode: localStorage not available', err);
      setError('Storage unavailable');
      setIsLoaded(true);
    }
  }, []);

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
