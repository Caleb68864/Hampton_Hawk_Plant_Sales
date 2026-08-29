import { useState, useEffect, useCallback, useRef } from 'react';

const POLL_INTERVAL_MS = 30_000;

export interface BackendAvailabilityState {
  available: boolean;
  lastCheckedAt: Date | null;
  retry: () => void;
}

async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export function useBackendAvailability(): BackendAvailabilityState {
  const [available, setAvailable] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set on unmount. Clearing the pending timer is not enough: a check that is
  // mid-fetch when the layout unmounts still resolves afterwards and would
  // schedule a fresh 30 s timer nothing can clear, leaking one poll loop per
  // mount (and setting state on an unmounted component).
  const cancelledRef = useRef(false);

  const runCheck = useCallback(async () => {
    const result = await checkBackend();
    if (cancelledRef.current) return;
    setAvailable(result);
    setLastCheckedAt(new Date());
  }, []);

  const scheduleNext = useCallback(() => {
    if (cancelledRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runCheck().then(scheduleNext);
    }, POLL_INTERVAL_MS);
  }, [runCheck]);

  const retry = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void runCheck().then(scheduleNext);
  }, [runCheck, scheduleNext]);

  useEffect(() => {
    cancelledRef.current = false;
    void runCheck().then(scheduleNext);
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { available, lastCheckedAt, retry };
}
