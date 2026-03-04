import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFallbackOrderMatches } from './globalQuickFindFallback.ts';
import type { Customer } from '@/types/customer.js';
import type { Order } from '@/types/order.js';

const customer: Customer = {
  id: 'customer-1',
  firstName: 'Alex',
  lastName: 'Gardener',
  displayName: 'Alex Gardener',
  phone: null,
  email: null,
  pickupCode: 'ABC123',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const order: Order = {
  id: 'order-1',
  customerId: customer.id,
  customerDisplayName: customer.displayName,
  sellerId: null,
  sellerDisplayName: null,
  orderNumber: 'HH-1001',
  status: 'Open',
  isWalkUp: false,
  hasIssue: false,
  lines: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('returns direct navigation for one partial order fallback match', () => {
  const result = resolveFallbackOrderMatches([order], [customer]);

  assert.equal(result.navigateToOrderId, 'order-1');
  assert.deepEqual(result.options, []);
});

test('returns selectable options for multiple fallback matches', () => {
  const secondOrder: Order = { ...order, id: 'order-2', orderNumber: 'HH-1002' };
  const result = resolveFallbackOrderMatches([order, secondOrder], [customer]);

  assert.equal(result.navigateToOrderId, null);
  assert.equal(result.options.length, 2);
  assert.equal(result.options[0].reason, 'Possible match');
});
