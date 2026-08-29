import test from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency, settleWithConcurrency } from './mapWithConcurrency.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('mapWithConcurrency preserves input order regardless of completion order', async () => {
  const gates = [deferred<string>(), deferred<string>(), deferred<string>()];
  const pending = mapWithConcurrency([0, 1, 2], 3, (i) => gates[i].promise);

  gates[2].resolve('c');
  gates[0].resolve('a');
  gates[1].resolve('b');

  assert.deepEqual(await pending, ['a', 'b', 'c']);
});

test('mapWithConcurrency never has more than `limit` calls in flight', async () => {
  const gates: ReturnType<typeof deferred<number>>[] = [];
  let inFlight = 0;
  let peak = 0;

  const pending = mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 2, async (n) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    const gate = deferred<number>();
    gates.push(gate);
    const value = await gate.promise;
    inFlight--;
    return value * n;
  });

  // Only the first two calls may have started.
  await Promise.resolve();
  assert.equal(gates.length, 2);

  // Release gates as they appear until all seven have run.
  for (let released = 0; released < 7; released++) {
    while (gates.length <= released) await Promise.resolve();
    gates[released].resolve(10);
    await Promise.resolve();
    await Promise.resolve();
  }

  assert.deepEqual(await pending, [10, 20, 30, 40, 50, 60, 70]);
  assert.equal(peak, 2);
});

test('mapWithConcurrency handles an empty list and clamps a bad limit', async () => {
  assert.deepEqual(await mapWithConcurrency([], 6, async () => 1), []);
  assert.deepEqual(await mapWithConcurrency(['x'], 0, async (v) => v.toUpperCase()), ['X']);
});

test('mapWithConcurrency rejects when fn rejects', async () => {
  await assert.rejects(
    mapWithConcurrency([1, 2], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    }),
    /boom/,
  );
});

test('settleWithConcurrency isolates failures per item', async () => {
  const results = await settleWithConcurrency(['a', 'b', 'c'], 2, async (id) => {
    if (id === 'b') throw new Error(`missing ${id}`);
    return id.toUpperCase();
  });

  assert.deepEqual(results[0], { ok: true, value: 'A' });
  assert.equal(results[1].ok, false);
  assert.match(String((results[1] as { ok: false; error: Error }).error.message), /missing b/);
  assert.deepEqual(results[2], { ok: true, value: 'C' });
});
