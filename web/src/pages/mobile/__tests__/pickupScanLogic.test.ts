import { describe, it, expect } from 'vitest';
import { classifyMobileScanInput, selectExactOrderMatch } from '../pickupScanLogic.js';
import type { Order } from '../../../types/order.js';

function makeOrder(partial: Partial<Order> & { id: string; orderNumber: string }): Order {
  return {
    id: partial.id,
    customerId: 'c1',
    customerDisplayName: 'Customer',
    sellerId: null,
    sellerDisplayName: null,
    orderNumber: partial.orderNumber,
    barcode: partial.barcode ?? null,
    status: partial.status ?? 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: partial.lines ?? [],
    createdAt: '2026-05-07T00:00:00Z',
    updatedAt: '2026-05-07T00:00:00Z',
  };
}

describe('classifyMobileScanInput', () => {
  it('classifies a 6+ digit numeric value as order-number', () => {
    expect(classifyMobileScanInput('100123')).toBe('order-number');
  });

  it('classifies a zero-padded scanned order barcode as order-number', () => {
    expect(classifyMobileScanInput('OR0000100123')).toBe('order-number');
  });

  it('classifies a PL- item-shaped barcode as item-barcode', () => {
    expect(classifyMobileScanInput('PL-12345')).toBe('item-barcode');
  });

  it('classifies a PLB- buyer pick-list as item-barcode', () => {
    expect(classifyMobileScanInput('PLB-ABCD1')).toBe('item-barcode');
  });

  it('classifies a PLS- student pick-list as item-barcode', () => {
    expect(classifyMobileScanInput('PLS-ABCD1')).toBe('item-barcode');
  });

  it('classifies a too-short numeric value as ambiguous', () => {
    expect(classifyMobileScanInput('12')).toBe('ambiguous');
  });

  it('classifies empty string as ambiguous', () => {
    expect(classifyMobileScanInput('')).toBe('ambiguous');
  });

  it('classifies a non-numeric short token as ambiguous', () => {
    expect(classifyMobileScanInput('AB')).toBe('ambiguous');
  });
});

describe('selectExactOrderMatch', () => {
  const orderA = makeOrder({ id: 'a', orderNumber: '1001' });
  const orderB = makeOrder({ id: 'b', orderNumber: '1002' });
  const orderDup = makeOrder({ id: 'b2', orderNumber: '1001' });

  it('returns the single matching order when there is one exact match', () => {
    expect(selectExactOrderMatch([orderA, orderB], '1001')).toBe(orderA);
  });

  it('returns null when there are zero matches', () => {
    expect(selectExactOrderMatch([orderA, orderB], '9999')).toBeNull();
  });

  it('returns null when there are multiple matches (caller renders a list)', () => {
    expect(selectExactOrderMatch([orderA, orderDup], '1001')).toBeNull();
  });

  it('matches by scanned barcode prefix as well as plain order number', () => {
    // OR-prefix normalizes to "1001" → identical to orderA.orderNumber.
    expect(selectExactOrderMatch([orderA, orderB], 'OR0000001001')).toBe(orderA);
  });

  it('returns null for an empty list', () => {
    expect(selectExactOrderMatch([], '1001')).toBeNull();
  });
});
