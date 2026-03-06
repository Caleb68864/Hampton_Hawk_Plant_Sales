import test from 'node:test';
import assert from 'node:assert/strict';
import type { Order } from '../types/order.js';
import {
  findExactOrderNumberMatches,
  getScannerSettleDelayMs,
  looksLikeOrderNumberLookup,
  normalizeOrderLookupValue,
  shouldAutoSubmitScannerValue,
} from './orderLookup.ts';

const now = '2026-01-01T00:00:00.000Z';

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 'order-1',
    customerId: 'customer-1',
    customerDisplayName: 'Jane Doe',
    sellerId: null,
    sellerDisplayName: null,
    orderNumber: 'HH-1001',
    status: 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('normalizeOrderLookupValue trims, strips whitespace, and uppercases values', () => {
  assert.equal(normalizeOrderLookupValue('  hh-1001\r\n '), 'HH-1001');
  assert.equal(normalizeOrderLookupValue(' ord 2002 '), 'ORD2002');
});

test('looksLikeOrderNumberLookup identifies scanner-friendly order number searches', () => {
  assert.equal(looksLikeOrderNumberLookup('hh-1001'), true);
  assert.equal(looksLikeOrderNumberLookup('smith family'), false);
});

test('findExactOrderNumberMatches keeps only exact normalized order-number matches', () => {
  const orders = [
    makeOrder({ id: 'exact-1', orderNumber: 'HH-1001' }),
    makeOrder({ id: 'fuzzy-1', orderNumber: 'HH-10010' }),
    makeOrder({ id: 'exact-2', orderNumber: 'hh 1001' }),
  ];

  const matches = findExactOrderNumberMatches(' hh 1001 ', orders);

  assert.deepEqual(matches.map((order) => order.id), ['exact-2']);
});

test('shouldAutoSubmitScannerValue recognizes fast scanner bursts', () => {
  assert.equal(
    shouldAutoSubmitScannerValue({
      value: 'HH-1001',
      intervalsMs: [12, 14, 15, 13, 16],
    }),
    true,
  );
});

test('shouldAutoSubmitScannerValue ignores slower human typing patterns', () => {
  assert.equal(
    shouldAutoSubmitScannerValue({
      value: 'HH-1001',
      intervalsMs: [140, 220, 180, 260],
    }),
    false,
  );
});

test('getScannerSettleDelayMs keeps the no-enter fallback short', () => {
  assert.equal(getScannerSettleDelayMs(), 120);
});

