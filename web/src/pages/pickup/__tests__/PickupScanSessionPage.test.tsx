import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ScanSessionResponse } from '../../../types/scanSession.js';

const mockNavigate = vi.fn();
const mockGet = vi.fn();
const mockClose = vi.fn();
const mockScan = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/api/scanSessions.js', () => ({
  scanSessionsApi: {
    get: (...args: unknown[]) => mockGet(...args),
    close: (...args: unknown[]) => mockClose(...args),
    scan: (...args: unknown[]) => mockScan(...args),
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

vi.mock('@/stores/kioskStore.js', () => ({
  useKioskStore: <T,>(selector: (s: { session: null }) => T) => selector({ session: null }),
}));

vi.mock('@/components/pickup/ScanSuccessFlash.js', () => ({ ScanSuccessFlash: () => null }));
vi.mock('@/components/shared/BackToStationHomeButton.js', () => ({
  BackToStationHomeButton: () => null,
}));

import { PickupScanSessionPage } from '../PickupScanSessionPage.js';

function makeSession(partial: Partial<ScanSessionResponse> = {}): ScanSessionResponse {
  return {
    id: 's-1',
    entityKind: 'Customer',
    entityId: 'c-1',
    entityName: 'Jane Doe',
    workstationName: 'Pickup 1',
    includedOrderIds: [],
    aggregatedLines: [],
    remainingTotal: 3,
    expiresAt: '2026-05-07T12:00:00Z',
    closedAt: null,
    ...partial,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pickup/session/s-1']}>
      <Routes>
        <Route path="/pickup/session/:id" element={<PickupScanSessionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PickupScanSessionPage end session', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGet.mockReset();
    mockClose.mockReset();
    mockScan.mockReset();
    mockGet.mockResolvedValue(makeSession());
  });

  afterEach(() => cleanup());

  it('stays on the page and shows the error when closing the session fails', async () => {
    mockClose.mockRejectedValue(new Error('The request timed out before the server responded.'));

    renderPage();
    const end = await screen.findByRole('button', { name: 'End and return' });
    fireEvent.click(end);

    await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/timed out/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    // Button is usable again for a retry.
    expect(screen.getByRole('button', { name: 'End and return' })).not.toBeDisabled();
  });

  it('navigates back to lookup only after the close succeeds, and ignores a double-tap', async () => {
    let resolveClose: (s: ScanSessionResponse) => void = () => {};
    mockClose.mockImplementation(
      () =>
        new Promise<ScanSessionResponse>((resolve) => {
          resolveClose = resolve;
        }),
    );

    renderPage();
    const end = await screen.findByRole('button', { name: 'End and return' });
    fireEvent.click(end);
    fireEvent.click(end);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Ending...' })).toBeDisabled());
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();

    resolveClose(makeSession({ closedAt: '2026-05-07T10:00:00Z', remainingTotal: 0 }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/pickup'));
  });
});
