import { createContext, useContext } from 'react';

export interface AnnounceOptions {
  politeness?: 'polite' | 'assertive';
  ttlMs?: number;
}

export type AnnounceFn = (message: string, opts?: AnnounceOptions) => void;

export const JoyAnnounceContext = createContext<AnnounceFn | null>(null);

const NOOP_ANNOUNCE: AnnounceFn = () => {};

export function useJoyAnnounce(): AnnounceFn {
  const fn = useContext(JoyAnnounceContext);
  // Safe no-op outside provider; a stable reference so callers can list it in deps.
  return fn ?? NOOP_ANNOUNCE;
}
