import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DashboardMetrics } from '../../../types/reports.js';

const mockNavigate = vi.fn();
const mockDashboardMetrics = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/api/reports.js', () => ({
  reportsApi: { dashboardMetrics: (...args: unknown[]) => mockDashboardMetrics(...args) },
}));

const appState = { saleClosed: false };
const kioskState = { session: null as { profile: string; workstationName: string } | null };
vi.mock('@/stores/appStore.js', () => ({
  useAppStore: <T,>(selector: (s: typeof appState) => T) => selector(appState),
}));
vi.mock('@/stores/kioskStore.js', () => ({
  useKioskStore: <T,>(selector: (s: typeof kioskState) => T) => selector(kioskState),
}));

import { StationHomePage } from '../StationHomePage.js';

function makeMetrics(partial: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    totalOrders: 120,
    openOrders: 7,
    completedOrders: 61,
    totalCustomers: 90,
    totalSellers: 30,
    lowInventoryCount: 2,
    problemOrderCount: 1,
    ordersByStatus: {},
    totalItemsOrdered: 900,
    totalItemsFulfilled: 415,
    saleProgressPercent: 46,
    ...partial,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StationHomePage />
    </MemoryRouter>,
  );
}

describe('StationHomePage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockDashboardMetrics.mockReset();
    appState.saleClosed = false;
    kioskState.session = null;
  });

  afterEach(() => cleanup());

  it('shows live dashboard counts, the kiosk workstation name and the real sale status', async () => {
    mockDashboardMetrics.mockResolvedValue(makeMetrics());
    kioskState.session = { profile: 'pickup', workstationName: 'Pickup Station 3' };
    appState.saleClosed = true;

    renderPage();

    expect(await screen.findByText('61')).toBeInTheDocument();
    expect(screen.getByText('415')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/Pickup Station 3/)).toBeInTheDocument();
    expect(screen.getByText(/Spring Sale · Closed/)).toBeInTheDocument();
    expect(screen.queryByText('38')).not.toBeInTheDocument();
    expect(screen.queryByText('241')).not.toBeInTheDocument();
  });

  it('omits the counts (never fakes them) when the metrics request fails', async () => {
    mockDashboardMetrics.mockRejectedValue(new Error('Network error — could not reach the server.'));

    renderPage();

    expect(await screen.findByRole('status')).toHaveTextContent(/could not reach the server/);
    expect(screen.queryByText('38')).not.toBeInTheDocument();
    expect(screen.queryByText('241')).not.toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
    expect(screen.getByText(/Spring Sale · Open/)).toBeInTheDocument();
    expect(screen.getByText(/Station\./)).toBeInTheDocument();
  });

  it('fetches the metrics once, not on every render', async () => {
    mockDashboardMetrics.mockResolvedValue(makeMetrics());
    const view = renderPage();
    await screen.findByText('61');
    view.rerender(
      <MemoryRouter>
        <StationHomePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mockDashboardMetrics).toHaveBeenCalledTimes(1));
  });
});
