import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Order } from '../../../types/order.js';
import type { ScanResponse } from '../../../types/fulfillment.js';

const mockNavigate = vi.fn();
const mockGetById = vi.fn();
const mockUndoWithReason = vi.fn();
const mockManualFulfill = vi.fn();
const mockOpenPinModal = vi.fn();
const mockScanApi = vi.fn();
const mockPlayError = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/api/orders.js', () => ({
  ordersApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    complete: vi.fn(),
  },
}));

vi.mock('@/api/fulfillment.js', () => ({
  fulfillmentApi: {
    scan: (...args: unknown[]) => mockScanApi(...args),
    undoLastScan: vi.fn(),
    undoLastScanWithReason: (...args: unknown[]) => mockUndoWithReason(...args),
    manualFulfill: (...args: unknown[]) => mockManualFulfill(...args),
    forceComplete: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('@/components/shared/audioFeedbackContext.js', () => ({
  useAudio: () => ({
    playSuccess: vi.fn(),
    playError: mockPlayError,
    playWarning: vi.fn(),
    setMode: vi.fn(),
  }),
}));

vi.mock('@/stores/appStore.js', () => ({
  useAppStore: <T,>(selector: (s: { saleClosed: boolean }) => T) => selector({ saleClosed: false }),
}));
vi.mock('@/stores/authStore.js', () => ({
  useAuthStore: <T,>(selector: (s: { openPinModal: typeof mockOpenPinModal }) => T) =>
    selector({ openPinModal: mockOpenPinModal }),
}));
vi.mock('@/stores/kioskStore.js', () => ({
  useKioskStore: <T,>(selector: (s: { session: null }) => T) => selector({ session: null }),
}));

vi.mock('@/components/pickup/ScanSuccessFlash.js', () => ({
  ScanSuccessFlash: (props: { visible: boolean; remainingForOrder?: number }) =>
    props.visible ? <div data-testid="scan-flash">remaining {props.remainingForOrder}</div> : null,
}));
vi.mock('@/components/pickup/OrderCompleteCelebration.js', () => ({
  OrderCompleteCelebration: () => null,
}));
vi.mock('@/components/shared/BackToStationHomeButton.js', () => ({
  BackToStationHomeButton: () => null,
}));

import { PickupScanPage } from '../PickupScanPage.js';

function makeOrder(partial: Partial<Order> = {}): Order {
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
        qtyFulfilled: 1,
        notes: null,
        createdAt: '2026-05-07T00:00:00Z',
        updatedAt: '2026-05-07T00:00:00Z',
      },
    ],
    createdAt: '2026-05-07T00:00:00Z',
    updatedAt: '2026-05-07T00:00:00Z',
    ...partial,
  };
}

const ACCEPTED: ScanResponse = {
  result: 'Accepted',
  orderId: 'o-1',
  plant: { sku: 'PL-HYD', name: 'Hydrangea' },
  line: { qtyOrdered: 2, qtyFulfilled: 0, qtyRemaining: 2 },
  orderRemainingItems: 2,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pickup/o-1']}>
      <Routes>
        <Route path="/pickup/:orderId" element={<PickupScanPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openUndoModal() {
  await screen.findByText('Order 100123');
  fireEvent.click(screen.getByRole('button', { name: 'Undo Last Scan' }));
  return screen.getByLabelText('Why are you undoing this scan?') as HTMLTextAreaElement;
}

describe('PickupScanPage undo last scan', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetById.mockReset();
    mockUndoWithReason.mockReset();
    mockManualFulfill.mockReset();
    mockOpenPinModal.mockReset();
    mockGetById.mockResolvedValue(makeOrder());
  });

  afterEach(() => cleanup());

  it('collects the reason in an in-page modal (no window.prompt) and sends it with the undo', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');
    mockUndoWithReason.mockResolvedValue(ACCEPTED);

    renderPage();
    const reason = await openUndoModal();
    fireEvent.change(reason, { target: { value: 'Scanned the wrong pot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Undo scan' }));

    await waitFor(() =>
      expect(mockUndoWithReason).toHaveBeenCalledWith('o-1', 'Scanned the wrong pot', 'Station Operator'),
    );
    expect(promptSpy).not.toHaveBeenCalled();
    expect(await screen.findByText('RECOVERY:UNDO')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Why are you undoing this scan?')).not.toBeInTheDocument());
  });

  it('does not record "undid last scan" when the undo request fails', async () => {
    mockUndoWithReason.mockRejectedValue(new Error('Network error — could not reach the server.'));

    renderPage();
    await openUndoModal();
    fireEvent.click(screen.getByRole('button', { name: 'Undo scan' }));

    await waitFor(() => expect(mockUndoWithReason).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/could not reach the server/)).toBeInTheDocument();
    expect(screen.queryByText('RECOVERY:UNDO')).not.toBeInTheDocument();
  });

  it('does not record "undid last scan" when the server declined the undo', async () => {
    mockUndoWithReason.mockResolvedValue({ ...ACCEPTED, result: 'NotFound', plant: null, line: null });

    renderPage();
    await openUndoModal();
    fireEvent.click(screen.getByRole('button', { name: 'Undo scan' }));

    await waitFor(() => expect(mockUndoWithReason).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByLabelText('Why are you undoing this scan?')).not.toBeInTheDocument());
    expect(screen.queryByText('RECOVERY:UNDO')).not.toBeInTheDocument();
  });
});

describe('PickupScanPage manual fulfill', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetById.mockReset();
    mockUndoWithReason.mockReset();
    mockManualFulfill.mockReset();
    mockOpenPinModal.mockReset();
    mockGetById.mockResolvedValue(makeOrder());
  });

  afterEach(() => cleanup());

  async function openManualModal() {
    await screen.findByText('Order 100123');
    fireEvent.click(screen.getByRole('button', { name: 'Manual Fulfill' }));
    const line = screen.getByLabelText('Unfulfilled Line') as HTMLSelectElement;
    const reason = screen.getByLabelText('Reason') as HTMLTextAreaElement;
    fireEvent.change(line, { target: { value: 'l1' } });
    fireEvent.change(reason, { target: { value: 'Tag unreadable' } });
    return { line, reason };
  }

  it('keeps the modal and its fields, and shows the error, when the request fails', async () => {
    mockManualFulfill.mockRejectedValue(new Error('The request timed out before the server responded.'));

    renderPage();
    const { line, reason } = await openManualModal();
    fireEvent.click(screen.getByRole('button', { name: 'Fulfill' }));

    await waitFor(() => expect(mockManualFulfill).toHaveBeenCalledTimes(1));
    expect(mockManualFulfill).toHaveBeenCalledWith('o-1', {
      orderLineId: 'l1',
      reason: 'Tag unreadable',
      operatorName: 'Station Operator',
      requestId: expect.any(String),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/timed out/);
    expect(screen.getByLabelText('Unfulfilled Line')).toBeInTheDocument();
    expect(line.value).toBe('l1');
    expect(reason.value).toBe('Tag unreadable');
    expect(screen.getByRole('button', { name: 'Fulfill' })).not.toBeDisabled();
  });

  it('resends a failed manual fulfil with the same request id', async () => {
    mockManualFulfill
      .mockRejectedValueOnce(new Error('The request timed out before the server responded.'))
      .mockResolvedValue(ACCEPTED);

    renderPage();
    await openManualModal();
    fireEvent.click(screen.getByRole('button', { name: 'Fulfill' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Fulfill' }));
    await waitFor(() => expect(mockManualFulfill).toHaveBeenCalledTimes(2));

    const [first, second] = mockManualFulfill.mock.calls.map((c) => (c[1] as { requestId?: string }).requestId);
    expect(first).toEqual(expect.any(String));
    expect(second).toBe(first);
  });

  it('disables submit while pending and closes only after success', async () => {
    let resolveFulfill: (r: ScanResponse) => void = () => {};
    mockManualFulfill.mockImplementation(
      () =>
        new Promise<ScanResponse>((resolve) => {
          resolveFulfill = resolve;
        }),
    );

    renderPage();
    await openManualModal();
    const submit = screen.getByRole('button', { name: 'Fulfill' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Fulfilling...' })).toBeDisabled());
    expect(mockManualFulfill).toHaveBeenCalledTimes(1);

    resolveFulfill(ACCEPTED);
    await waitFor(() => expect(screen.queryByLabelText('Unfulfilled Line')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('PickupScanPage scanning', () => {
  beforeEach(() => {
    mockGetById.mockReset();
    mockScanApi.mockReset();
    mockPlayError.mockReset();
    mockGetById.mockResolvedValue(makeOrder({
      lines: [{
        id: 'l1', orderId: 'o-1', plantCatalogId: 'p1', plantName: 'Hydrangea', plantSku: 'PL-HYD',
        qtyOrdered: 5, qtyFulfilled: 3, notes: null, createdAt: '2026-05-07T00:00:00Z', updatedAt: '2026-05-07T00:00:00Z',
      }, {
        id: 'l2', orderId: 'o-1', plantCatalogId: 'p2', plantName: 'Fern', plantSku: 'PL-FERN',
        qtyOrdered: 4, qtyFulfilled: 0, notes: null, createdAt: '2026-05-07T00:00:00Z', updatedAt: '2026-05-07T00:00:00Z',
      }],
    }));
  });

  afterEach(() => cleanup());

  async function scan(value: string) {
    const input = (await screen.findByPlaceholderText('Scan barcode or type SKU...')) as HTMLInputElement;
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter' });
  }

  it('shows the remaining count the server reports, not total minus the requested quantity', async () => {
    // Qty 5 on a line with 2 left applies 2: 6 remain, not 6 - 5 = 1.
    mockScanApi.mockResolvedValue({
      result: 'Accepted', orderId: 'o-1', plant: { sku: 'PL-HYD', name: 'Hydrangea' },
      line: { qtyOrdered: 5, qtyFulfilled: 5, qtyRemaining: 0 }, orderRemainingItems: 4,
    } satisfies ScanResponse);
    renderPage();
    await screen.findByText('Order 100123');
    fireEvent.click(screen.getByRole('button', { name: 'Set scan quantity to 5' }));
    await scan('PL-HYD');

    expect(await screen.findByTestId('scan-flash')).toHaveTextContent('remaining 4');
  });

  it('keeps the quantity and sounds an error when a scan gets no answer', async () => {
    mockScanApi
      .mockRejectedValueOnce(new Error('The request timed out before the server responded.'))
      .mockResolvedValue(ACCEPTED);
    renderPage();
    await screen.findByText('Order 100123');
    fireEvent.click(screen.getByRole('button', { name: 'Set scan quantity to 3' }));
    await scan('PL-HYD');
    await waitFor(() => expect(mockScanApi).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockPlayError).toHaveBeenCalled());

    await new Promise((r) => setTimeout(r, 450)); // past ScanInput's double-read window
    await scan('PL-HYD');
    await waitFor(() => expect(mockScanApi).toHaveBeenCalledTimes(2));
    const [first, second] = mockScanApi.mock.calls.map((c) => c[1] as { quantity: number; scanId: string });
    expect(second.quantity).toBe(3);
    expect(second.scanId).toBe(first.scanId);
  });
});

describe('PickupScanPage when the order cannot be loaded', () => {
  afterEach(() => cleanup());

  it('says the load failed and retries, instead of "Order not found"', async () => {
    mockGetById.mockReset();
    mockGetById
      .mockRejectedValueOnce(new Error('The request timed out before the server responded.'))
      .mockResolvedValue(makeOrder());

    renderPage();
    expect(await screen.findByText(/Could not load this order: The request timed out/)).toBeInTheDocument();
    expect(screen.queryByText('Order not found')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Order 100123')).toBeInTheDocument();
  });
});
