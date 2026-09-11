import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncData<T> {
  /** Resolved value for the current key; `null` while loading or after an error. */
  data: T | null;
  /** Error message for the current key; `null` while loading or on success. */
  error: string | null;
  /** `true` until the load for the CURRENT key/tick has settled. */
  loading: boolean;
  /** Re-runs the loader with the same key. */
  reload: () => void;
}

type Settled<T> =
  | { key: string; tick: number; data: T; error: null }
  | { key: string; tick: number; data: null; error: string };

const DEFAULT_FALLBACK = 'Something went wrong.';

/**
 * Runs `load` whenever `key` changes (or `reload()` is called) and exposes the
 * result. A response that settles after its key/tick has been superseded is
 * discarded, so a slow response for an old key can never overwrite a newer one.
 *
 * `loading`/`data`/`error` are derived from the last settled result and the
 * current key/tick, so the effect never has to call setState synchronously.
 */
export function useAsyncData<T>(
  load: () => Promise<T>,
  key: string,
  fallbackMessage: string = DEFAULT_FALLBACK,
): AsyncData<T> {
  const latest = useRef({ load, fallbackMessage });
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  // Keep the latest loader/fallback without making them effect dependencies.
  // Updated in an effect (not during render) so the main effect below always
  // sees the values from the same commit.
  useEffect(() => {
    latest.current = { load, fallbackMessage };
  });

  useEffect(() => {
    let active = true;

    // Wrapping in an async IIFE turns a synchronous throw into a rejection.
    (async () => latest.current.load())().then(
      (data) => {
        if (active) setSettled({ key, tick, data, error: null });
      },
      (e: unknown) => {
        if (!active) return;
        const error = e instanceof Error ? e.message : latest.current.fallbackMessage;
        setSettled({ key, tick, data: null, error });
      },
    );

    return () => {
      active = false;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const current = settled !== null && settled.key === key && settled.tick === tick ? settled : null;

  return {
    data: current ? current.data : null,
    error: current ? current.error : null,
    loading: current === null,
    reload,
  };
}
