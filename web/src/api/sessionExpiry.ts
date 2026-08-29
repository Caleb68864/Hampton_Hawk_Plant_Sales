import type { ApiError } from './errorMessage.ts';

/**
 * Minimal view of the auth store the 401 handler needs. Typed structurally so
 * the pure logic can be exercised under node:test with a stub store, without
 * loading zustand or the browser-only API modules.
 */
export interface SessionStoreLike {
  getState: () => { sessionStatus: string };
  setState: (partial: { currentUser: null; sessionStatus: 'unauthenticated' }) => void;
}

export type LoadSessionStore = () => Promise<SessionStoreLike>;

// Loaded lazily: authStore -> api/auth -> api/client -> (this) would otherwise be
// an import cycle, and authStore itself uses the same dynamic-import trick.
const loadAuthStore: LoadSessionStore = async () => (await import('../stores/authStore.js')).useAuthStore;

export function isSessionExpired(error: Pick<ApiError, 'status'> | null | undefined): boolean {
  return error?.status === 401;
}

/**
 * Drops an authenticated session to 'unauthenticated' so ProtectedRoute
 * redirects to /login. Resolves to true when the store was changed.
 *
 * Only an *authenticated* session is downgraded: while the session is still
 * 'loading', restoreSession owns the outcome of its own 401, and a login
 * attempt that fails with 401 must not be mistaken for expiry.
 */
export async function expireSession(loadStore: LoadSessionStore = loadAuthStore): Promise<boolean> {
  const store = await loadStore();
  if (store.getState().sessionStatus !== 'authenticated') return false;
  store.setState({ currentUser: null, sessionStatus: 'unauthenticated' });
  return true;
}

/**
 * Interceptor hook: when a response is 401, expire the session in the
 * background. Never throws and never delays the caller's rejection -- the
 * request still fails with its ApiError; the redirect follows from the store.
 */
export function handleUnauthorized(
  error: Pick<ApiError, 'status'> | null | undefined,
  loadStore: LoadSessionStore = loadAuthStore,
): void {
  if (!isSessionExpired(error)) return;
  void expireSession(loadStore).catch(() => {
    // Store failed to load (e.g. during teardown); nothing more to do.
  });
}
