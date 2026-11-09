import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ScanSessionResponse } from '../../../types/scanSession.js';

const mockNavigate = vi.fn();
const mockCreateSession = vi.fn();
const mockCustomersList = vi.fn();
const mockOrdersList = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/api/scanSessions.js', () => ({
  scanSessionsApi: { create: (...args: unknown[]) => mockCreateSession(...args) },
}));
vi.mock('@/api/customers.js', () => ({
  customersApi: { list: (...args: unknown[]) => mockCustomersList(...args), getById: vi.fn() },
}));
vi.mock('@/api/orders.js', () => ({
  ordersApi: { list: (...args: unknown[]) => mockOrdersList(...args) },
}));

// Mutable store state so a test can change a setting mid-request and re-render,
// which re-runs the lookup effect (its deps include these values).
const appState = { pickupSearchDebounceMs: 0, pickupAutoJumpMode: 'ExactMatchOnly' as string };
const kioskState = { session: null as { profile: string; workstationName: string } | null };
vi.mock('@/stores/appStore.js', () => ({
  useAppStore: <T,>(selector: (s: typeof appState) => T) => selector(appState),
}));
vi.mock('@/stores/kioskStore.js', () => ({
  useKioskStore: <T,>(selector: (s: typeof kioskState) => T) => selector(kioskState),
}));
vi.mock('@/components/shared/BackToStationHomeButton.js', () => ({
  BackToStationHomeButton: () => null,
}));

import { PickupLookupPage } from '../PickupLookupPage.js';

function makeSession(): ScanSessionResponse {
  return {
    id: 's-77',
    entityKind: 'Customer',
    entityId: 'c-1',
    entityName: 'Jane Doe',
    workstationName: 'Pickup 1',
    includedOrderIds: [],
    aggregatedLines: [],
    remainingTotal: 3,
    expiresAt: '2026-05-07T12:00:00Z',
    closedAt: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PickupLookupPage />
    </MemoryRouter>,
  );
}

describe('PickupLookupPage pick-list barcode', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateSession.mockReset();
    mockCustomersList.mockReset();
    mockOrdersList.mockReset();
    mockCustomersList.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 });
    mockOrdersList.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 });
    appState.pickupAutoJumpMode = 'ExactMatchOnly';
    kioskState.session = null;
  });

  afterEach(() => cleanup());

  it('still navigates (and clears the spinner) when a setting changes while the create is in flight', async () => {
    let resolveCreate: (s: ScanSessionResponse) => void = () => {};
    mockCreateSession.mockImplementation(
      () =>
        new Promise<ScanSessionResponse>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const view = renderPage();
    const input = screen.getByPlaceholderText(/Scan order sheet barcode/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'PLB-ABCD12' } });

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Looking up order...')).toBeInTheDocument();

    // Settings fetch lands mid-request: the lookup effect re-runs with new deps.
    appState.pickupAutoJumpMode = 'BestMatchWhenSingle';
    kioskState.session = { profile: 'pickup', workstationName: 'Pickup 2' };
    view.rerender(
      <MemoryRouter>
        <PickupLookupPage />
      </MemoryRouter>,
    );

    // The re-run must adopt the pending create, not start a second one.
    expect(mockCreateSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate(makeSession());
    });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/pickup/session/s-77'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Looking up order...')).not.toBeInTheDocument();
  });

  it('shows the error and allows a retry when the create fails', async () => {
    mockCreateSession
      .mockRejectedValueOnce(new Error('Network error — could not reach the server.'))
      .mockResolvedValueOnce(makeSession());

    renderPage();
    const input = screen.getByPlaceholderText(/Scan order sheet barcode/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'PLB-ABCD12' } });

    expect(await screen.findByText(/could not reach the server/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    // Clear and rescan the same sheet: the failed attempt must not be "in flight".
    fireEvent.click(screen.getByRole('button', { name: 'Clear for Next Order' }));
    fireEvent.change(screen.getByPlaceholderText(/Scan order sheet barcode/), { target: { value: 'PLB-ABCD12' } });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/pickup/session/s-77'));
    expect(mockCreateSession).toHaveBeenCalledTimes(2);
  });
});

function customer(id: string) {
  return { id, firstName: 'C', lastName: id, displayName: id } as unknown;
}
function page(items: unknown[]) {
  return { items, totalCount: items.length, page: 1, pageSize: 50, totalPages: 1 };
}
function perCustomerCalls() {
  return mockOrdersList.mock.calls.filter(
    (args) => (args[0] as { customerId?: string } | undefined)?.customerId !== undefined,
  );
}

describe('PickupLookupPage search fan-out', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCustomersList.mockReset();
    mockOrdersList.mockReset();
    mockOrdersList.mockResolvedValue(page([]));
    appState.pickupAutoJumpMode = 'ExactMatchOnly';
    kioskState.session = null;
  });

  afterEach(() => cleanup());

  it('a superseded search does not fire its per-customer order requests', async () => {
    const pending: Array<(v: unknown) => void> = [];
    mockCustomersList.mockImplementation(
      () => new Promise((resolve) => pending.push(resolve)),
    );

    renderPage();
    await waitFor(() => expect(pending.length).toBe(1)); // initial empty search
    const input = screen.getByPlaceholderText(/Scan order sheet barcode/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sm' } });
    await waitFor(() => expect(pending.length).toBe(2));
    fireEvent.change(input, { target: { value: 'smith' } });
    await waitFor(() => expect(pending.length).toBe(3));

    // The two stale searches answer late with many customers each.
    const stale = Array.from({ length: 20 }, (_, i) => customer(`stale-${i}`));
    await act(async () => {
      pending[0](page(stale));
      pending[1](page(stale));
    });
    expect(perCustomerCalls()).toHaveLength(0);

    // The live search still fans out for its own customers.
    await act(async () => {
      pending[2](page([customer('live-1')]));
    });
    await waitFor(() => expect(perCustomerCalls()).toHaveLength(1));
    expect((perCustomerCalls()[0][0] as { customerId: string }).customerId).toBe('live-1');
  });

  it('caps concurrent per-customer order requests at 4', async () => {
    mockCustomersList.mockResolvedValue(
      page(Array.from({ length: 12 }, (_, i) => customer(`c-${i}`))),
    );
    let inFlight = 0;
    let peak = 0;
    const release: Array<() => void> = [];
    mockOrdersList.mockImplementation((params: { customerId?: string }) => {
      if (params?.customerId === undefined) return Promise.resolve(page([]));
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise((resolve) => {
        release.push(() => {
          inFlight -= 1;
          resolve(page([]));
        });
      });
    });

    renderPage();
    await waitFor(() => expect(release.length).toBeGreaterThan(0));
    // Drain: release whatever is queued until all 12 customers were asked.
    for (let guard = 0; guard < 50 && perCustomerCalls().length < 12; guard++) {
      await act(async () => {
        release.splice(0).forEach((r) => r());
      });
    }
    await act(async () => {
      release.splice(0).forEach((r) => r());
    });

    expect(perCustomerCalls()).toHaveLength(12);
    expect(peak).toBeLessThanOrEqual(4);
  });
});
