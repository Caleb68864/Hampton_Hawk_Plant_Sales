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
    scan: vi.fn(),
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
    playError: vi.fn(),
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

vi.mock('@/components/pickup/ScanSuccessFlash.js', () => ({ ScanSuccessFlash: () => null }));
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
