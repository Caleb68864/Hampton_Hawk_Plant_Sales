import { describe, it, expect } from 'vitest';
import type { Order } from '../../../types/order.js';
import type { CurrentUser } from '../../../types/auth.js';
import {
  partitionLookupResults,
  canScanIntoOrders,
} from '../orderLookupSelection.js';

function makeOrder(partial: Partial<Order> & { id: string; orderNumber: string }): Order {
  return {
    id: partial.id,
    customerId: 'c1',
    customerDisplayName: partial.customerDisplayName ?? 'Jane Doe',
    sellerId: null,
    sellerDisplayName: null,
    orderNumber: partial.orderNumber,
    barcode: partial.barcode ?? null,
    status: partial.status ?? 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: [],
    createdAt: '2026-05-07T00:00:00Z',
    updatedAt: '2026-05-07T00:00:00Z',
  };
}

describe('partitionLookupResults', () => {
  it('returns all-empty partition for empty order list', () => {
    expect(partitionLookupResults([], '100123')).toEqual({
      exact: null,
      ambiguous: [],
      broad: [],
    });
  });

  it('returns single exact match when one order matches the submitted number', () => {
    const a = makeOrder({ id: 'a', orderNumber: '100123' });
    const b = makeOrder({ id: 'b', orderNumber: '100124' });
    const result = partitionLookupResults([a, b], '100123');
    expect(result.exact).toEqual(a);
    expect(result.ambiguous).toEqual([]);
    expect(result.broad).toEqual([]);
  });

  it('returns ambiguous list when two or more orders share the same number-shape match', () => {
    // Two orders with identical orderNumber would be unusual but the helper must
    // still handle it without auto-selecting.
    const a = makeOrder({ id: 'a', orderNumber: '100123' });
    const b = makeOrder({ id: 'b', orderNumber: '100123', customerDisplayName: 'Other' });
    const result = partitionLookupResults([a, b], '100123');
    expect(result.exact).toBeNull();
    expect(result.ambiguous).toHaveLength(2);
    expect(result.broad).toEqual([]);
  });

  it('returns broad results when no exact match but server returned candidates', () => {
    const a = makeOrder({ id: 'a', orderNumber: '100123', customerDisplayName: 'Patel' });
    const b = makeOrder({ id: 'b', orderNumber: '100124', customerDisplayName: 'Patel' });
    const result = partitionLookupResults([a, b], 'Patel');
    expect(result.exact).toBeNull();
    expect(result.ambiguous).toEqual([]);
    expect(result.broad).toEqual([a, b]);
  });

  it('matches against barcode when submitted value matches barcode but not orderNumber', () => {
    const a = makeOrder({ id: 'a', orderNumber: '100123', barcode: 'OR0000100123' });
    const b = makeOrder({ id: 'b', orderNumber: '100124' });
    const result = partitionLookupResults([a, b], 'OR0000100123');
    expect(result.exact).toEqual(a);
  });
});

describe('canScanIntoOrders', () => {
  function user(roles: CurrentUser['roles']): CurrentUser {
    return { id: 1, username: 'u', displayName: 'U', roles };
  }

  it('returns false for unauthenticated user (null)', () => {
    expect(canScanIntoOrders(null)).toBe(false);
  });

  it('returns false for LookupPrint-only user', () => {
    expect(canScanIntoOrders(user(['LookupPrint']))).toBe(false);
  });

  it('returns true for Pickup user', () => {
    expect(canScanIntoOrders(user(['Pickup']))).toBe(true);
  });

  it('returns true for Admin user', () => {
    expect(canScanIntoOrders(user(['Admin']))).toBe(true);
  });

  it('returns true when LookupPrint is combined with Pickup', () => {
    expect(canScanIntoOrders(user(['LookupPrint', 'Pickup']))).toBe(true);
  });

  it('returns false for user with no relevant roles', () => {
    expect(canScanIntoOrders(user(['Volunteer']))).toBe(false);
  });
});
