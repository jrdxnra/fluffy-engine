import { useEffect, useCallback } from 'react';

/**
 * Hook to listen for keyboard shortcut to toggle admin mode
 * Shortcut: Ctrl+Alt+A (or Cmd+Shift+A on Mac)
 */
export function useAdminModeKeyboardToggle(
  onToggle: (secret?: string) => boolean
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Chromebook-safe combo: Ctrl+Alt+A. Keep Cmd+Shift+A for macOS.
      const isMetaShiftA = event.metaKey && event.shiftKey;
      const isCtrlAltA = event.ctrlKey && event.altKey;
      const isAKey = event.key === 'a' || event.key === 'A';

      if ((isMetaShiftA || isCtrlAltA) && isAKey) {
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
