import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Order } from '../../types/order.js';
import type { ScanResponse } from '../../types/fulfillment.js';
import type { ScanSessionResponse, ScanSessionScanResponse } from '../../types/scanSession.js';

const mockGetById = vi.fn();
const mockScan = vi.fn();
const mockSessionGet = vi.fn();
const mockSessionScan = vi.fn();

vi.mock('@/api/orders.js', () => ({
  ordersApi: { getById: (...args: unknown[]) => mockGetById(...args) },
}));
vi.mock('@/api/fulfillment.js', () => ({
  fulfillmentApi: { scan: (...args: unknown[]) => mockScan(...args) },
}));
vi.mock('@/api/scanSessions.js', () => ({
  scanSessionsApi: {
    get: (...args: unknown[]) => mockSessionGet(...args),
    scan: (...args: unknown[]) => mockSessionScan(...args),
    close: vi.fn(),
  },
}));

import { useScanWorkflow } from '../useScanWorkflow.js';

function deferred<T>() {
  let resolve: (v: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeOrder(qtyFulfilled: number): Order {
  return {
    id: 'o-1',
    customerId: 'c1',
    customerDisplayName: 'Jane Doe',
    sellerId: null,
    sellerDisplayName: null,
    orderNumber: '100123',
    barcode: null,
    status: 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: [
      {
        id: 'l1',
        orderId: 'o-1',
        plantCatalogId: 'p1',
        plantName: 'Hydrangea',
        plantSku: 'PL-HYD',
        qtyOrdered: 2,
        qtyFulfilled,
        notes: null,
        createdAt: '2026-05-07T00:00:00Z',
        updatedAt: '2026-05-07T00:00:00Z',
      },
    ],
    createdAt: '2026-05-07T00:00:00Z',
    updatedAt: '2026-05-07T00:00:00Z',
  };
}

function makeSession(remainingTotal: number): ScanSessionResponse {
  return {
    id: 's-1',
    entityKind: 'Customer',
    entityId: 'c-1',
    entityName: 'Jane Doe',
    workstationName: 'Pickup 1',
    includedOrderIds: [],
    aggregatedLines: [],
    remainingTotal,
    expiresAt: '2026-05-07T12:00:00Z',
    closedAt: null,
  };
}

describe('useScanWorkflow stale-response ordering', () => {
  beforeEach(() => {
    mockGetById.mockReset();
    mockScan.mockReset();
    mockSessionGet.mockReset();
    mockSessionScan.mockReset();
    vi.useFakeTimers();
    vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => 'uuid-1' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('order mode: a poll that resolves after the post-scan refresh cannot overwrite it', async () => {
    const initial = deferred<Order>();
    const poll = deferred<Order>();
    const postScan = deferred<Order>();
    mockGetById
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(poll.promise)
      .mockReturnValueOnce(postScan.promise);
    const accepted: ScanResponse = {
      result: 'Accepted',
      orderId: 'o-1',
      plant: { sku: 'PL-HYD', name: 'Hydrangea' },
      line: { qtyOrdered: 2, qtyFulfilled: 1, qtyRemaining: 1 },
      orderRemainingItems: 1,
    };
    mockScan.mockResolvedValue(accepted);

    const { result } = renderHook(() => useScanWorkflow('o-1'));
    await act(async () => {
      initial.resolve(makeOrder(0));
    });
    expect(result.current.currentOrder?.lines[0].qtyFulfilled).toBe(0);

    // 10 s poll fires and is now in flight (slow response).
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockGetById).toHaveBeenCalledTimes(2);

    // Volunteer scans; the post-scan refresh is issued after the poll ...
    let scanDone: Promise<ScanResponse | null> = Promise.resolve(null);
    await act(async () => {
      scanDone = result.current.scan('PL-HYD', 1);
      // Let the (resolved) scan POST settle so the refresh is issued.
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    expect(mockGetById).toHaveBeenCalledTimes(3);

    // ... and resolves first, with the fulfilled quantity.
    await act(async () => {
      postScan.resolve(makeOrder(1));
      await scanDone;
    });
    expect(result.current.currentOrder?.lines[0].qtyFulfilled).toBe(1);

    // The older poll finally comes back with pre-scan data: it must be dropped.
    await act(async () => {
      poll.resolve(makeOrder(0));
    });
    expect(result.current.currentOrder?.lines[0].qtyFulfilled).toBe(1);
  });

  it('session mode: a poll issued before a scan cannot overwrite the scan response', async () => {
    const initial = deferred<ScanSessionResponse>();
    const poll = deferred<ScanSessionResponse>();
    mockSessionGet.mockReturnValueOnce(initial.promise).mockReturnValueOnce(poll.promise);
    const scanResponse: ScanSessionScanResponse = {
      result: 'Accepted',
      message: null,
      plant: { sku: 'PL-HYD', name: 'Hydrangea' },
      session: makeSession(2),
    };
    mockSessionScan.mockResolvedValue(scanResponse);

    const { result } = renderHook(() => useScanWorkflow({ mode: 'session', id: 's-1' }));
    await act(async () => {
      initial.resolve(makeSession(3));
    });
    expect(result.current.currentSession?.remainingTotal).toBe(3);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockSessionGet).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.scanInSession('PL-HYD', 1);
    });
    expect(result.current.currentSession?.remainingTotal).toBe(2);

    await act(async () => {
      poll.resolve(makeSession(3));
    });
    expect(result.current.currentSession?.remainingTotal).toBe(2);
  });
});
