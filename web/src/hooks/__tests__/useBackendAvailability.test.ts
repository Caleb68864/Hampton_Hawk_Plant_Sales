import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBackend } from '../useBackendAvailability.js';

describe('checkBackend', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('gives up on a request that never settles and reports the backend unavailable', async () => {
    vi.useFakeTimers();
    // A request lost mid-flight: never resolves unless aborted.
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }));

    const result = checkBackend(1_000);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toBe(false);
  });

  it('reports a healthy backend as available', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 200 }));
    await expect(checkBackend()).resolves.toBe(true);
  });
});
