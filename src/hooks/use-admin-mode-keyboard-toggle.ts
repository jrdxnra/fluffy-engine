import { useEffect, useCallback } from 'react';

/**
 * Hook to listen for keyboard shortcut to toggle admin mode
 * Shortcut: Ctrl+Shift+A (or Cmd+Shift+A on Mac)
 */
export function useAdminModeKeyboardToggle(
  onToggle: (secret?: string) => boolean
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+A or Cmd+Shift+A
      const isCtrlKey = event.ctrlKey || event.metaKey;
      const isShiftKey = event.shiftKey;
      const isAKey = event.key === 'a' || event.key === 'A';

      if (isCtrlKey && isShiftKey && isAKey) {
        // Prevent default browser behavior
        event.preventDefault();
        
        // Toggle admin mode
        const success = onToggle();
        
        if (success) {
          // Visual feedback
          console.log('Admin mode toggled');
        }
      }
    },
    [onToggle]
  );

  useEffect(() => {
    // Only add listener on client-side
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
