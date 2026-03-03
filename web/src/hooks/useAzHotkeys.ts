import { useEffect } from 'react';

export function useAzHotkeys(onSelect: (letter: string) => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      const key = e.key.toUpperCase();
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        e.preventDefault();
        onSelect(key);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelect]);
}
