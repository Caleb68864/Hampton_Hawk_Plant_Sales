import test from 'node:test';
import assert from 'node:assert/strict';
import { cashShortfall } from './walkupRegister.ts';

test('cash below the total is short by the difference', () => {
  assert.equal(cashShortfall('Cash', '5', 17.35), 12.35);
});

test('exact or more cash is not short, including float sums of prices', () => {
  assert.equal(cashShortfall('Cash', '17.35', 17.35), 0);
  assert.equal(cashShortfall('Cash', '0.30', 0.1 + 0.2), 0);
  assert.equal(cashShortfall('Cash', '20', 17.35), 0);
});

test('non-cash methods and a blank amount are never short', () => {
  assert.equal(cashShortfall('Card', '0', 17.35), 0);
  assert.equal(cashShortfall('Cash', '', 17.35), 0);
  assert.equal(cashShortfall('Cash', 'abc', 17.35), 0);
});
