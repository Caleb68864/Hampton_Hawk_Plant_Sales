import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAsyncData } from '../useAsyncData.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsyncData', () => {
  it('resolves data and clears loading', async () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.resolve('hello'), 'k'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  it('maps a rejection to an error string with null data', async () => {
    const { result } = renderHook(() =>
      useAsyncData<string>(() => Promise.reject(new Error('boom')), 'k'),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('uses the fallback message for non-Error rejections and sync throws', async () => {
    const { result: rejected } = renderHook(() =>
      useAsyncData<string>(() => Promise.reject('nope'), 'k', 'Fallback text'),
    );
    await waitFor(() => expect(rejected.current.loading).toBe(false));
    expect(rejected.current.error).toBe('Fallback text');

    const { result: thrown } = renderHook(() =>
      useAsyncData<string>(
        () => {
          throw new Error('sync boom');
        },
        'k',
      ),
    );
    await waitFor(() => expect(thrown.current.loading).toBe(false));
    expect(thrown.current.error).toBe('sync boom');
  });

  it('ignores a slow response for an old key', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<string>>>();
    const load = (key: string) => {
      const d = deferred<string>();
      pending.set(key, d);
      return d.promise;
    };

    const { result, rerender } = renderHook(({ key }) => useAsyncData(() => load(key), key), {
      initialProps: { key: 'old' },
    });
    expect(result.current.loading).toBe(true);

    rerender({ key: 'new' });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending.get('new')!.resolve('new-data');
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('new-data');

    // The stale response lands last and must not overwrite the newer result.
    await act(async () => {
      pending.get('old')!.resolve('old-data');
    });
    expect(result.current.data).toBe('new-data');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('reload() re-runs the loader and reports loading meanwhile', async () => {
    let calls = 0;
    const pending: Array<ReturnType<typeof deferred<number>>> = [];
    const load = () => {
      calls += 1;
      const d = deferred<number>();
      pending.push(d);
      return d.promise;
    };

    const { result } = renderHook(() => useAsyncData(load, 'k'));
    await act(async () => {
      pending[0].resolve(1);
    });
    await waitFor(() => expect(result.current.data).toBe(1));
    expect(calls).toBe(1);

    act(() => {
      result.current.reload();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(calls).toBe(2);

    await act(async () => {
      pending[1].resolve(2);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(2);
  });
});
