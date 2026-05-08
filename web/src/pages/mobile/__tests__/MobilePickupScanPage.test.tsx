import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Order } from '../../../types/order.js';
import type { ScanResponse } from '../../../types/fulfillment.js';
import type { CurrentUser } from '../../../types/auth.js';

const mockNavigate = vi.fn();
const mockGetById = vi.fn();
const mockScan = vi.fn();
let mockCurrentUser: CurrentUser | null = null;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../api/orders.js', () => ({
  ordersApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

vi.mock('../../../api/fulfillment.js', () => ({
  fulfillmentApi: {
    scan: (...args: unknown[]) => mockScan(...args),
  },
}));

vi.mock('../../../stores/authStore.js', () => ({
  useAuthStore: <T,>(selector: (s: { currentUser: CurrentUser | null }) => T) =>
    selector({ currentUser: mockCurrentUser }),
}));

vi.mock('../../../components/mobile/MobileAccessDeniedScene.js', () => ({
  MobileAccessDeniedScene: () => <div data-testid="access-denied" />,
}));

vi.mock('../../../components/mobile/MobileConnectionRequiredScene.js', () => ({
  MobileConnectionRequiredScene: () => <div data-testid="connection-required" />,
}));

let capturedScanOnScan: ((r: { code: string; source: 'mobile-camera' | 'manual-entry'; scannedAtUtc: string }) => void) | null = null;
let lastScannerPaused = false;
vi.mock('../../../components/mobile/BarcodeScanner.js', () => ({
  BarcodeScanner: (props: { onScan: (r: { code: string; source: 'mobile-camera' | 'manual-entry'; scannedAtUtc: string }) => void; paused?: boolean }) => {
    capturedScanOnScan = props.onScan;
    lastScannerPaused = !!props.paused;
    return <div data-testid="barcode-scanner-mock" data-paused={String(!!props.paused)} />;
  },
}));

import { MobilePickupScanPage } from '../MobilePickupScanPage.js';

function makeOrder(partial: Partial<Order> & { id: string }): Order {
  return {
    id: partial.id,
    customerId: 'c1',
    customerDisplayName: partial.customerDisplayName ?? 'Jane Doe',
    sellerId: null,
    sellerDisplayName: null,
    orderNumber: partial.orderNumber ?? '100123',
    barcode: null,
    status: partial.status ?? 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: partial.lines ?? [
      {
        id: 'l1',
        orderId: partial.id,
        plantCatalogId: 'p1',
        plantName: 'Hydrangea',
        plantSku: 'PL-HYD',
        qtyOrdered: 2,
        qtyFulfilled: 0,
        notes: null,
        createdAt: '2026-05-07T00:00:00Z',
        updatedAt: '2026-05-07T00:00:00Z',
      },
    ],
    createdAt: '2026-05-07T00:00:00Z',
    updatedAt: '2026-05-07T00:00:00Z',
  };
}

const PICKUP_USER: CurrentUser = {
  id: 1,
  username: 'pickup',
  displayName: 'Pickup',
  roles: ['Pickup'],
};

function renderPage(orderId = 'o-1001') {
  return render(
    <MemoryRouter initialEntries={[`/mobile/pickup/${orderId}`]}>
      <Routes>
        <Route path="/mobile/pickup/:orderId" element={<MobilePickupScanPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function submitManual(value: string) {
  const input = screen.getByLabelText('Manual barcode entry') as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest('form')!);
}

describe('MobilePickupScanPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetById.mockReset();
    mockScan.mockReset();
    mockCurrentUser = PICKUP_USER;
    // Reset navigator.onLine
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  it('renders the Joy accepted moment after a successful scan and updates from server', async () => {
    const initial = makeOrder({ id: 'o-1001' });
    const refreshed = makeOrder({
      id: 'o-1001',
      lines: [
        {
          ...initial.lines[0],
          qtyFulfilled: 1,
        },
      ],
    });
    mockGetById.mockResolvedValueOnce(initial).mockResolvedValueOnce(refreshed);

    const accepted: ScanResponse = {
      result: 'Accepted',
      orderId: 'o-1001',
      plant: { sku: 'PL-HYD', name: 'Hydrangea' },
      line: { qtyOrdered: 2, qtyFulfilled: 1, qtyRemaining: 1 },
      orderRemainingItems: 1,
    };
    mockScan.mockResolvedValue(accepted);

    renderPage();
    await screen.findByText('#100123');
    submitManual('PL-HYD-0001');

    await waitFor(() => {
      expect(screen.getByTestId('mobile-pickup-accepted')).toBeInTheDocument();
    });
    expect(screen.getByText(/Remaining for this order/)).toBeInTheDocument();
    expect(screen.getAllByText('Hydrangea').length).toBeGreaterThan(0);
    expect(mockScan).toHaveBeenCalledWith('o-1001', { barcode: 'PL-HYD-0001', quantity: 1 });
  });

  it('renders a recoverable card on AlreadyFulfilled and dismisses to ready state', async () => {
    const initial = makeOrder({ id: 'o-1001' });
    mockGetById.mockResolvedValue(initial);

    const response: ScanResponse = {
      result: 'AlreadyFulfilled',
      orderId: 'o-1001',
      plant: { sku: 'PL-HYD', name: 'Hydrangea' },
      line: { qtyOrdered: 2, qtyFulfilled: 2, qtyRemaining: 0 },
      orderRemainingItems: 0,
    };
    mockScan.mockResolvedValue(response);

    renderPage();
    await screen.findByText('#100123');
    submitManual('PL-HYD-0001');

    await waitFor(() => {
      expect(screen.getByTestId('mobile-pickup-recoverable')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Dismiss'));
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-pickup-recoverable')).not.toBeInTheDocument();
    });
  });

  it('does not mutate qtyFulfilled before the backend response resolves', async () => {
    const initial = makeOrder({ id: 'o-1001' });
    mockGetById.mockResolvedValue(initial);

    let resolveScan: ((r: ScanResponse) => void) | null = null;
    mockScan.mockImplementation(
      () => new Promise<ScanResponse>((resolve) => {
        resolveScan = resolve;
      }),
    );

    renderPage();
    await screen.findByText('#100123');

    expect(screen.getByText('0 of 2')).toBeInTheDocument();

    submitManual('PL-HYD-0001');

    // Mid-flight: order progress unchanged.
    await waitFor(() => {
      expect(screen.getByText('Submitting…')).toBeInTheDocument();
    });
    expect(screen.getByText('0 of 2')).toBeInTheDocument();

    // Now resolve and verify post-resolve UI updates from refreshed order.
    const refreshed = makeOrder({
      id: 'o-1001',
      lines: [{ ...initial.lines[0], qtyFulfilled: 1 }],
    });
    mockGetById.mockResolvedValue(refreshed);

    await act(async () => {
      resolveScan!({
        result: 'Accepted',
        orderId: 'o-1001',
        plant: { sku: 'PL-HYD', name: 'Hydrangea' },
        line: { qtyOrdered: 2, qtyFulfilled: 1, qtyRemaining: 1 },
        orderRemainingItems: 1,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
    });
  });

  it('renders the Stamp closure scene when order status is Complete', async () => {
    const completedOrder = makeOrder({
      id: 'o-1001',
      status: 'Complete',
      lines: [
        {
          id: 'l1',
          orderId: 'o-1001',
          plantCatalogId: 'p1',
          plantName: 'Hydrangea',
          plantSku: 'PL-HYD',
          qtyOrdered: 2,
          qtyFulfilled: 2,
          notes: null,
          createdAt: '2026-05-07T00:00:00Z',
          updatedAt: '2026-05-07T00:00:00Z',
        },
      ],
    });
    mockGetById.mockResolvedValue(completedOrder);

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('mobile-pickup-complete')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Open next order'));
    expect(mockNavigate).toHaveBeenCalledWith('/mobile/pickup');
  });

  // SS-05 coverage
  it('renders the connection-required scene when window goes offline', async () => {
    const initial = makeOrder({ id: 'o-1001' });
    mockGetById.mockResolvedValue(initial);

    renderPage();
    await screen.findByText('#100123');

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('connection-required')).toBeInTheDocument();
    });
  });

  it('navigates to /login with state.from on a 401 from fulfillmentApi.scan', async () => {
    const initial = makeOrder({ id: 'o-1001' });
    mockGetById.mockResolvedValue(initial);
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    mockScan.mockRejectedValue(err);

    renderPage();
    await screen.findByText('#100123');
    submitManual('PL-HYD-0001');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { from: '/mobile/pickup/o-1001' },
      });
    });
  });

  it('renders danger retry scene on a generic network error and Retry re-invokes the scan', async () => {
    const initial = makeOrder({ id: 'o-1001' });
    mockGetById.mockResolvedValue(initial);
    const networkErr = Object.assign(new Error('Network error'), { code: 'ERR_NETWORK' });
    mockScan.mockRejectedValueOnce(networkErr);

    renderPage();
    await screen.findByText('#100123');
    submitManual('PL-HYD-0001');

    await waitFor(() => {
      expect(screen.getByTestId('mobile-pickup-danger')).toBeInTheDocument();
    });

    // Retry should re-invoke
    const accepted: ScanResponse = {
      result: 'Accepted',
      orderId: 'o-1001',
      plant: { sku: 'PL-HYD', name: 'Hydrangea' },
      line: { qtyOrdered: 2, qtyFulfilled: 1, qtyRemaining: 1 },
      orderRemainingItems: 1,
    };
    mockScan.mockResolvedValueOnce(accepted);
    mockGetById.mockResolvedValue(initial);

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(mockScan).toHaveBeenCalledTimes(2);
    });
  });

  // SS-04 coverage: camera scanner integration
  it('forwards an item-shaped camera scan into fulfillmentApi.scan and pauses scanner during call', async () => {
    const initial = makeOrder({ id: 'o-1001' });
    mockGetById.mockResolvedValue(initial);

    let resolveScan: ((r: ScanResponse) => void) | null = null;
    mockScan.mockImplementation(
      () => new Promise<ScanResponse>((resolve) => {
        resolveScan = resolve;
      }),
    );

    renderPage();
    await screen.findByText('#100123');
    expect(capturedScanOnScan).not.toBeNull();

    await act(async () => {
      capturedScanOnScan!({
        code: 'PL-HYD0001',
        source: 'mobile-camera',
        scannedAtUtc: '2026-05-07T20:00:00Z',
      });
    });

    await waitFor(() => {
      expect(mockScan).toHaveBeenCalledWith('o-1001', { barcode: 'PL-HYD0001', quantity: 1 });
    });
    // While in-flight, scanner is paused.
    await waitFor(() => {
      expect(lastScannerPaused).toBe(true);
    });

    const accepted: ScanResponse = {
      result: 'Accepted',
      orderId: 'o-1001',
      plant: { sku: 'PL-HYD', name: 'Hydrangea' },
      line: { qtyOrdered: 2, qtyFulfilled: 1, qtyRemaining: 1 },
      orderRemainingItems: 1,
    };
    mockGetById.mockResolvedValue(initial);
    await act(async () => {
      resolveScan!(accepted);
    });

    // Accepted scene shows; scanner remains paused while it's visible.
    await waitFor(() => {
      expect(screen.getByTestId('mobile-pickup-accepted')).toBeInTheDocument();
    });
    expect(lastScannerPaused).toBe(true);
  });

  it('shows wrong code type when an order-shaped barcode is scanned on the scan page', async () => {
    const initial = makeOrder({ id: 'o-1001' });
    mockGetById.mockResolvedValue(initial);

    renderPage();
    await screen.findByText('#100123');

    capturedScanOnScan!({
      code: '100199',
      source: 'mobile-camera',
      scannedAtUtc: '2026-05-07T20:00:00Z',
    });

    await waitFor(() => {
      expect(screen.getByText(/Wrong code type/i)).toBeInTheDocument();
    });
    expect(mockScan).not.toHaveBeenCalled();
  });

  it('renders danger retry scene on SaleClosedBlocked for a non-admin user', async () => {
    const initial = makeOrder({ id: 'o-1001' });
    mockGetById.mockResolvedValue(initial);

    const response: ScanResponse = {
      result: 'SaleClosedBlocked',
      orderId: 'o-1001',
      plant: null,
      line: null,
      orderRemainingItems: 2,
    };
    mockScan.mockResolvedValue(response);

    renderPage();
    await screen.findByText('#100123');
    submitManual('PL-HYD-0001');

    await waitFor(() => {
      expect(screen.getByTestId('mobile-pickup-danger')).toBeInTheDocument();
    });
  });
});
