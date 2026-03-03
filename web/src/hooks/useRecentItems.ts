import { useState, useCallback } from 'react';

interface RecentItem {
  id: string;
  label: string;
  timestamp: number;
}

const MAX_RECENT = 10;

export function useRecentItems(storageKey: string) {
  const [items, setItems] = useState<RecentItem[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as RecentItem[]) : [];
    } catch {
      return [];
    }
  });

  const addRecent = useCallback(
    (id: string, label: string) => {
      setItems((prev) => {
        const filtered = prev.filter((i) => i.id !== id);
        const next = [{ id, label, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey],
  );

  const clearRecent = useCallback(() => {
    localStorage.removeItem(storageKey);
    setItems([]);
  }, [storageKey]);

  return { recentItems: items, addRecent, clearRecent };
}
