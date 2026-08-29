/**
 * Map `items` through an async `fn` with at most `limit` calls in flight at
 * once. Results come back in input order. A rejection from `fn` rejects the
 * whole call, so callers that want per-item tolerance should catch inside
 * `fn` (see `settleWithConcurrency`).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const size = Math.max(1, Math.floor(limit));
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(size, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export type Settled<R> = { ok: true; value: R } | { ok: false; error: unknown };

/**
 * Like `mapWithConcurrency`, but never rejects: each item settles to
 * `{ ok: true, value }` or `{ ok: false, error }` so one bad id cannot blank
 * out an entire batch.
 */
export function settleWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Settled<R>[]> {
  return mapWithConcurrency(items, limit, async (item, index) => {
    try {
      return { ok: true, value: await fn(item, index) } as const;
    } catch (error) {
      return { ok: false, error } as const;
    }
  });
}

/** Default fan-out for print pages that fetch one record per id. */
export const PRINT_FETCH_CONCURRENCY = 6;
