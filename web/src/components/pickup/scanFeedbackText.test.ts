import test from 'node:test';
import assert from 'node:assert/strict';
import { getScanDisplayFields, getScanResultMessage } from './scanFeedbackText.ts';
import type { ScanResponse } from '../../types/fulfillment.js';

function makeScan(overrides: Partial<ScanResponse>): ScanResponse {
  return {
    result: 'Accepted',
    orderId: 'order-1',
    plant: { sku: 'SKU-1', name: 'Marigold' },
    line: { qtyOrdered: 3, qtyFulfilled: 1, qtyRemaining: 2 },
    orderRemainingItems: 2,
    ...overrides,
  };
}

test('Accepted rendering uses plant and quantity fields from nested response data', () => {
  const result = makeScan({ result: 'Accepted' });

  assert.deepEqual(getScanDisplayFields(result), {
    plantName: 'Marigold',
    qtyFulfilled: 1,
    qtyOrdered: 3,
  });
  assert.equal(getScanResultMessage(result), 'Marigold accepted (1/3)');
});

test('NotFound rendering ignores missing plant data and shows a direct not found message', () => {
  const result = makeScan({ result: 'NotFound', plant: null, line: null });

  assert.deepEqual(getScanDisplayFields(result), {
    plantName: undefined,
    qtyFulfilled: undefined,
    qtyOrdered: undefined,
  });
  assert.equal(getScanResultMessage(result), 'Barcode not found');
});

test('WrongOrder rendering names the plant when available', () => {
  const result = makeScan({ result: 'WrongOrder', plant: { sku: 'SKU-2', name: 'Blue Spruce' }, line: null });

  assert.equal(getScanResultMessage(result), 'Blue Spruce belongs to a different order');
});
