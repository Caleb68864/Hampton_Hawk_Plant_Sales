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

let capturedLookupOnScan: ((r: { code: string; source: 'mobile-camera' | 'manual-entry'; scannedAtUtc: string }) => void) | null = null;
vi.mock('../../../components/mobile/BarcodeScanner.js', () => ({
  BarcodeScanner: (props: { onScan: (r: { code: string; source: 'mobile-camera' | 'manual-entry'; scannedAtUtc: string }) => void; paused?: boolean }) => {
    capturedLookupOnScan = props.onScan;
    return <div data-testid="barcode-scanner-mock" data-paused={String(!!props.paused)} />;
  },
}));

vi.mock('../../../components/mobile/joy/Seed.js', () => ({
  Seed: ({ emptyMessage }: { emptyMessage?: string }) => <div data-testid="seed">{emptyMessage}</div>,
}));

import { MobilePickupLookupPage } from '../MobilePickupLookupPage.js';

function makeOrder(partial: Partial<Order> & { id: string; orderNumber: string }): Order {
  return {
    id: partial.id,
    customerId: 'c1',
    customerDisplayName: partial.customerDisplayName ?? 'Jane Doe',
    sellerId: null,
    sellerDisplayName: null,
    orderNumber: partial.orderNumber,
    barcode: null,
    status: partial.status ?? 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: [],
    createdAt: '2026-05-07T00:00:00Z',
    updatedAt: '2026-05-07T00:00:00Z',
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MobilePickupLookupPage />
    </MemoryRouter>,
  );
}

const PICKUP_USER: CurrentUser = {
  id: 1,
  username: 'pickup',
  displayName: 'Pickup User',
  roles: ['Pickup'],
};

const LOOKUP_USER: CurrentUser = {
  id: 2,
  username: 'lookup',
  displayName: 'Lookup',
  roles: ['LookupPrint'],
};

describe('MobilePickupLookupPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockListOrders.mockReset();
    mockCurrentUser = PICKUP_USER;
  });

  function typeValue(value: string) {
    const input = screen.getByLabelText('Order number lookup') as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
  }

  function submitForm() {
    const input = screen.getByLabelText('Order number lookup') as HTMLInputElement;
    fireEvent.submit(input.closest('form')!);
  }

  it('navigates to /mobile/pickup/:orderId on a single exact match', async () => {
    const order = makeOrder({ id: 'o-1001', orderNumber: '100123' });
    mockListOrders.mockResolvedValue({
      items: [order],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    renderPage();
    typeValue('100123');
    submitForm();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/mobile/pickup/o-1001');
    });
  });

  it('renders a list of matches without auto-navigating when ambiguous', async () => {
    const a = makeOrder({ id: 'a', orderNumber: '100123', customerDisplayName: 'Alice' });
    const b = makeOrder({ id: 'b', orderNumber: '100124', customerDisplayName: 'Bob' });
    mockListOrders.mockResolvedValue({
      items: [a, b],
      totalCount: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    renderPage();
    typeValue('100199');
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('#100123')).toBeInTheDocument();
      expect(screen.getByText('#100124')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows "Wrong code type" inline message for an item-shaped barcode', async () => {
    renderPage();
    typeValue('PL-12345');
    submitForm();
    expect(screen.getByText(/Wrong code type/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockListOrders).not.toHaveBeenCalled();
  });

  it('renders MobileAccessDeniedScene for a user without Pickup/Admin role', () => {
    mockCurrentUser = LOOKUP_USER;
    renderPage();
    expect(screen.getByTestId('access-denied')).toBeInTheDocument();
  });

  it('navigates when BarcodeScanner emits an order-shaped scan with single match', async () => {
    const order = makeOrder({ id: 'o-1001', orderNumber: '100123' });
    mockListOrders.mockResolvedValue({
      items: [order],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    renderPage();
    expect(screen.getByTestId('barcode-scanner-mock')).toBeInTheDocument();
    expect(capturedLookupOnScan).not.toBeNull();
    capturedLookupOnScan!({
      code: '100123',
      source: 'mobile-camera',
      scannedAtUtc: '2026-05-07T20:00:00Z',
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/mobile/pickup/o-1001');
    });
  });

  it('shows wrong code type when BarcodeScanner emits an item-shaped scan', async () => {
    renderPage();
    await act(async () => {
      capturedLookupOnScan!({
        code: 'PL-12345',
        source: 'mobile-camera',
        scannedAtUtc: '2026-05-07T20:00:00Z',
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/Wrong code type/i)).toBeInTheDocument();
    });
    expect(mockListOrders).not.toHaveBeenCalled();
  });
});
