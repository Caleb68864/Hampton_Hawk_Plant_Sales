import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApiOrder } from './orderMappers.ts';
import { mapApiOrder } from './orderMappers.ts';

function createApiOrder(overrides: Partial<ApiOrder> = {}): ApiOrder {
  return {
    id: 'order-1',
    customerId: 'customer-1',
    sellerId: null,
    orderNumber: '1001',
    status: 'Open',
    isWalkUp: false,
    hasIssue: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    customer: null,
    seller: null,
    lines: [
      {
        id: 'line-1',
        orderId: 'order-1',
        plantCatalogId: 'plant-1',
        plantName: 'Rosemary',
        plantSku: 'ROSE-1',
        qtyOrdered: 3,
        qtyFulfilled: 1,
        notes: 'gift wrap',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

test('maps sellerDisplayName to null when seller is null', () => {
  const mapped = mapApiOrder(createApiOrder({ seller: null }));

  assert.equal(mapped.sellerDisplayName, null);
});

test('maps customer display name and preserves line fields', () => {
  const mapped = mapApiOrder(
    createApiOrder({
      customer: { displayName: 'Green Nursery' },
    }),
  );

  assert.equal(mapped.customerDisplayName, 'Green Nursery');
  assert.deepEqual(mapped.lines[0], {
    id: 'line-1',
    orderId: 'order-1',
    plantCatalogId: 'plant-1',
    plantName: 'Rosemary',
    plantSku: 'ROSE-1',
    qtyOrdered: 3,
    qtyFulfilled: 1,
    notes: 'gift wrap',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
});
