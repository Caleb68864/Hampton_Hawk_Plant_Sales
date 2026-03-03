import { useEffect } from 'react';

export function useKeyboardShortcut(key: string, modifier: 'ctrl' | 'meta' | 'alt', callback: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const modMatch =
        (modifier === 'ctrl' && (e.ctrlKey || e.metaKey)) ||
        (modifier === 'meta' && e.metaKey) ||
        (modifier === 'alt' && e.altKey);

      if (modMatch && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        callback();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, modifier, callback]);
}
