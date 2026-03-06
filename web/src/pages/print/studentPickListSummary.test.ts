import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStudentPickListSummary } from './studentPickListSummary.ts';
import type { Order } from '@/types/order.js';

function makeOrder(id: string, customerDisplayName: string, lines: Order['lines']): Order {
  return {
    id,
    customerId: `customer-${id}`,
    customerDisplayName,
    sellerId: 'seller-1',
    sellerDisplayName: 'Emma Johnson',
    orderNumber: `ORD-${id}`,
    status: 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines,
    createdAt: '2026-03-06T00:00:00.000Z',
    updatedAt: '2026-03-06T00:00:00.000Z',
  };
}

test('buildStudentPickListSummary groups by plant name and sums quantities across orders', () => {
  const orders: Order[] = [
    makeOrder('1', 'Jane Smith', [
      {
        id: 'line-1',
        orderId: '1',
        plantCatalogId: 'plant-1',
        plantName: 'Daisies',
        plantSku: 'DAI-1',
        qtyOrdered: 5,
        qtyFulfilled: 0,
        notes: null,
        createdAt: '2026-03-06T00:00:00.000Z',
        updatedAt: '2026-03-06T00:00:00.000Z',
      },
    ]),
    makeOrder('2', 'Bob Jones', [
      {
        id: 'line-2',
        orderId: '2',
        plantCatalogId: 'plant-1',
        plantName: 'Daisies',
        plantSku: 'DAI-1',
        qtyOrdered: 3,
        qtyFulfilled: 0,
        notes: null,
        createdAt: '2026-03-06T00:00:00.000Z',
        updatedAt: '2026-03-06T00:00:00.000Z',
      },
      {
        id: 'line-3',
        orderId: '2',
        plantCatalogId: 'plant-2',
        plantName: 'Marigolds',
        plantSku: 'MAR-1',
        qtyOrdered: 2,
        qtyFulfilled: 0,
        notes: null,
        createdAt: '2026-03-06T00:00:00.000Z',
        updatedAt: '2026-03-06T00:00:00.000Z',
      },
    ]),
  ];

  assert.deepEqual(buildStudentPickListSummary(orders), [
    { plantName: 'Daisies', totalNeeded: 8 },
    { plantName: 'Marigolds', totalNeeded: 2 },
  ]);
});

test('buildStudentPickListSummary returns an empty list when there are no orders', () => {
  assert.deepEqual(buildStudentPickListSummary([]), []);
});

