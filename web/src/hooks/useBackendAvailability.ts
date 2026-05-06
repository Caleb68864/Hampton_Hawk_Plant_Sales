import { useState, useEffect, useCallback, useRef } from 'react';

const POLL_INTERVAL_MS = 30_000;

export interface BackendAvailabilityState {
  available: boolean;
  lastCheckedAt: Date | null;
  retry: () => void;
}

async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch('/api/', { method: 'HEAD', cache: 'no-store' });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export function useBackendAvailability(): BackendAvailabilityState {
  const [available, setAvailable] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCheck = useCallback(async () => {
    const result = await checkBackend();
    setAvailable(result);
    setLastCheckedAt(new Date());
  }, []);

  const scheduleNext = useCallback(() => {
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
    void runCheck().then(scheduleNext);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { available, lastCheckedAt, retry };
}
