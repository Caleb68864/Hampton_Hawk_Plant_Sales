import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Order } from '../../../types/order.js';
import type { CurrentUser } from '../../../types/auth.js';

const mockNavigate = vi.fn();
const mockListOrders = vi.fn();
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
    list: (...args: unknown[]) => mockListOrders(...args),
  },
}));

vi.mock('../../../stores/authStore.js', () => ({
  useAuthStore: <T,>(selector: (s: { currentUser: CurrentUser | null }) => T) =>
    selector({ currentUser: mockCurrentUser }),
}));

vi.mock('../../../components/mobile/MobileAccessDeniedScene.js', () => ({
  MobileAccessDeniedScene: () => <div data-testid="access-denied">access-denied</div>,
}));

vi.mock('../../../components/mobile/MobileConnectionRequiredScene.js', () => ({
  MobileConnectionRequiredScene: () => (
    <div data-testid="connection-required">connection-required</div>
  ),
}));

let capturedScannerOnScan:
  | ((r: { code: string; source: 'mobile-camera' | 'manual-entry'; scannedAtUtc: string }) => void)
  | null = null;
vi.mock('../../../components/mobile/BarcodeScanner.js', () => ({
  BarcodeScanner: (props: {
    onScan: (r: { code: string; source: 'mobile-camera' | 'manual-entry'; scannedAtUtc: string }) => void;
    paused?: boolean;
  }) => {
    capturedScannerOnScan = props.onScan;
    return <div data-testid="barcode-scanner-mock" data-paused={String(!!props.paused)} />;
  },
}));

vi.mock('../../../components/mobile/joy/Seed.js', () => ({
  Seed: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div data-testid="seed">{emptyMessage}</div>
  ),
}));

vi.mock('../../../components/mobile/joy/Checkbloom.js', () => ({
  Checkbloom: () => <div data-testid="checkbloom" />,
}));

import { MobileOrderLookupPage } from '../MobileOrderLookupPage.js';

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
    lines: partial.lines ?? [],
    createdAt: '2026-05-07T00:00:00Z',
    updatedAt: '2026-05-07T00:00:00Z',
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MobileOrderLookupPage />
    </MemoryRouter>,
  );
}

const PICKUP_USER: CurrentUser = {
  id: 1, username: 'pickup', displayName: 'Pickup User', roles: ['Pickup'],
};
const LOOKUP_USER: CurrentUser = {
  id: 2, username: 'lookup', displayName: 'Lookup', roles: ['LookupPrint'],
};

function pageResp(items: Order[], totalCount?: number) {
  return {
    items,
    totalCount: totalCount ?? items.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };
}

function typeValue(value: string) {
  const input = screen.getByLabelText('Order lookup search') as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

function submitForm() {
  const input = screen.getByLabelText('Order lookup search') as HTMLInputElement;
  fireEvent.submit(input.closest('form')!);
}

describe('MobileOrderLookupPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockListOrders.mockReset();
    mockCurrentUser = PICKUP_USER;
    capturedScannerOnScan = null;
  });

  // SS-02: REQ-014, REQ-024 — access-denied for users with no lookup roles.
  it('renders MobileAccessDeniedScene for a user with no LookupPrint/Pickup/Admin role', () => {
    mockCurrentUser = { ...PICKUP_USER, roles: ['Volunteer'] };
    renderPage();
    expect(screen.getByTestId('access-denied')).toBeInTheDocument();
  });

  // SS-02: REQ-005, REQ-028(d) — Pickup user, single exact match → navigate.
  it('navigates to /mobile/pickup/:orderId on a single exact match for Pickup user', async () => {
    const order = makeOrder({ id: 'o-1001', orderNumber: '100123' });
    mockListOrders.mockResolvedValue(pageResp([order]));

    renderPage();
    typeValue('100123');
    submitForm();

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith('/mobile/pickup/o-1001');
      },
      { timeout: 2000 },
    );
  });

  // SS-02: REQ-006, REQ-028(e) — LookupPrint-only user with single exact match: no nav, ghost View Order only.
  it('does not auto-navigate for LookupPrint-only user; shows View Order ghost only', async () => {
    mockCurrentUser = LOOKUP_USER;
    const order = makeOrder({ id: 'o-1001', orderNumber: '100123', customerDisplayName: 'Patel' });
    mockListOrders.mockResolvedValue(pageResp([order]));

    renderPage();
    typeValue('100123');
    submitForm();

    await waitFor(() => {
      expect(screen.getByText('#100123')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByText(/Open Scan/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/View order 100123/i)).toBeInTheDocument();
  });

  // SS-02: REQ-007, REQ-028(c) — multiple matches: render list, no navigation.
  it('renders a list of matches without auto-navigating when ambiguous (broad results)', async () => {
    const a = makeOrder({ id: 'a', orderNumber: '100123', customerDisplayName: 'Alice Patel' });
    const b = makeOrder({ id: 'b', orderNumber: '100124', customerDisplayName: 'Bob Patel' });
    mockListOrders.mockResolvedValue(pageResp([a, b]));

    renderPage();
    typeValue('Patel');
    submitForm();

    await waitFor(() => {
      expect(screen.getByText('#100123')).toBeInTheDocument();
      expect(screen.getByText('#100124')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // SS-02: REQ-009, REQ-028(f) — item-shaped input → wrong-code-type toast, no nav.
  it('shows wrong-code-type toast for item-shaped barcode and preserves typed query', () => {
    renderPage();
    typeValue('PL-12345');
    submitForm();
    expect(screen.getByText(/looks like a plant barcode/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockListOrders).not.toHaveBeenCalled();
    const input = screen.getByLabelText('Order lookup search') as HTMLInputElement;
    expect(input.value).toBe('PL-12345');
  });

  // SS-02: REQ-010, REQ-028(g) — zero matches: Seed empty state + Clear filters preserves query.
  it('renders Seed empty state on zero matches and Clear filters empties the input', async () => {
    mockListOrders.mockResolvedValue(pageResp([]));

    renderPage();
    typeValue('100123');
    submitForm();

    await waitFor(() => {
      expect(screen.getByTestId('seed')).toBeInTheDocument();
    });
    const input = screen.getByLabelText('Order lookup search') as HTMLInputElement;
    expect(input.value).toBe('100123'); // query preserved
    fireEvent.click(screen.getByText('Clear filters'));
    expect((screen.getByLabelText('Order lookup search') as HTMLInputElement).value).toBe('');
  });

  // SS-03: REQ-011, REQ-028(h) — backend error: inline retry, query preserved, retry re-runs search.
  it('shows inline retry on generic backend error and Retry re-invokes search with same value', async () => {
    mockListOrders.mockRejectedValueOnce(new Error('Internal server error'));

    renderPage();
    typeValue('100123');
    submitForm();

    await waitFor(() => {
      expect(screen.getByText(/Couldn’t reach the server/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText('Order lookup search') as HTMLInputElement;
    expect(input.value).toBe('100123');

    const order = makeOrder({ id: 'o-1', orderNumber: '100123' });
    mockListOrders.mockResolvedValueOnce(pageResp([order]));
    fireEvent.click(screen.getByLabelText('Retry search'));
    await waitFor(() => {
      expect(mockListOrders).toHaveBeenCalledTimes(2);
    });
    const lastCall = mockListOrders.mock.calls[mockListOrders.mock.calls.length - 1];
    expect(lastCall[0]).toMatchObject({ search: '100123', pageSize: 20 });
  });

  // SS-03: REQ-013 — 401 → navigate to /login with from state.
  it('navigates to /login with from-state on a 401 from the backend', async () => {
    const err = Object.assign(new Error('Unauthorized'), { response: { status: 401 } });
    mockListOrders.mockRejectedValueOnce(err);

    renderPage();
    typeValue('100123');
    submitForm();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { from: '/mobile/lookup' },
      });
    });
  });

  // SS-03: REQ-012, REQ-028(i) — offline event renders connection-required scene.
  it('renders MobileConnectionRequiredScene on offline event', async () => {
    renderPage();
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('connection-required')).toBeInTheDocument();
  });

  // SS-03: REQ-020 — 20 results renders the cap hint.
  it('renders the "Showing first 20 — refine your search" hint when 20 results return', async () => {
    const orders = Array.from({ length: 20 }, (_, i) =>
      makeOrder({ id: `o-${i}`, orderNumber: `2000${i.toString().padStart(2, '0')}` }),
    );
    mockListOrders.mockResolvedValue(pageResp(orders, 50));

    renderPage();
    typeValue('Patel');
    submitForm();
    await waitFor(() => {
      expect(screen.getByText(/Showing first 20/i)).toBeInTheDocument();
    });
  });

  // SS-04: REQ-003, REQ-005 — scanner emits order-shaped → navigate.
  it('navigates when BarcodeScanner emits an order-shaped scan with single match (Pickup)', async () => {
    const order = makeOrder({ id: 'o-1001', orderNumber: '100123' });
    mockListOrders.mockResolvedValue(pageResp([order]));

    renderPage();
    fireEvent.click(screen.getByText(/Scan order code instead/i));
    expect(screen.getByTestId('barcode-scanner-mock')).toBeInTheDocument();
    expect(capturedScannerOnScan).not.toBeNull();
    capturedScannerOnScan!({
      code: '100123',
      source: 'mobile-camera',
      scannedAtUtc: '2026-05-07T20:00:00Z',
    });

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith('/mobile/pickup/o-1001');
      },
      { timeout: 2000 },
    );
  });

  // SS-04: REQ-009 — scanner emits item-shaped → wrong-code-type toast, no nav.
  it('shows wrong-code-type toast when scanner emits an item-shaped scan', async () => {
    renderPage();
    fireEvent.click(screen.getByText(/Scan order code instead/i));
    await act(async () => {
      capturedScannerOnScan!({
        code: 'PL-12345',
        source: 'mobile-camera',
        scannedAtUtc: '2026-05-07T20:00:00Z',
      });
    });
    expect(screen.getByText(/looks like a plant barcode/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockListOrders).not.toHaveBeenCalled();
  });

  // SS-04: REQ-021 — scan telemetry on console.debug only.
  it('emits mobile-lookup-scan to console.debug with source/code/scannedAtUtc on scan', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      mockListOrders.mockResolvedValue(pageResp([]));
      renderPage();
      fireEvent.click(screen.getByText(/Scan order code instead/i));
      await act(async () => {
        capturedScannerOnScan!({
          code: '100123',
          source: 'mobile-camera',
          scannedAtUtc: '2026-05-07T20:00:00Z',
        });
      });
      expect(debugSpy).toHaveBeenCalledWith(
        'mobile-lookup-scan',
        expect.objectContaining({
          source: 'mobile-camera',
          code: '100123',
          scannedAtUtc: '2026-05-07T20:00:00Z',
        }),
      );
    } finally {
      debugSpy.mockRestore();
    }
  });
});
