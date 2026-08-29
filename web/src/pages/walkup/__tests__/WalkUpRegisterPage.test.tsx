import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { DraftOrder } from '../../../types/walkupRegister.js';

const mockNavigate = vi.fn();
const mockScan = vi.fn();
const mockCreateDraft = vi.fn();
const mockGetOpenDrafts = vi.fn();
const mockGetPlant = vi.fn();
const mockOpenPinModal = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/api/walkupRegister.js', () => ({
  walkupRegisterApi: {
    scan: (...args: unknown[]) => mockScan(...args),
    createDraft: (...args: unknown[]) => mockCreateDraft(...args),
    getOpenDrafts: (...args: unknown[]) => mockGetOpenDrafts(...args),
    adjustLine: vi.fn(),
    voidLine: vi.fn(),
    close: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock('@/api/plants.js', () => ({
  plantsApi: { getById: (...args: unknown[]) => mockGetPlant(...args) },
}));

vi.mock('@/stores/authStore.js', () => ({
  useAuthStore: <T,>(selector: (s: { openPinModal: typeof mockOpenPinModal }) => T) =>
    selector({ openPinModal: mockOpenPinModal }),
}));

const appState = {
  setWalkUpDraftId: vi.fn(),
  clearWalkUpDraftId: vi.fn(),
  getWalkUpDraftId: vi.fn(() => undefined as string | undefined),
};
vi.mock('@/stores/appStore.js', () => ({
  useAppStore: <T,>(selector: (s: typeof appState) => T) => selector(appState),
}));

vi.mock('@/stores/kioskStore.js', () => ({
  useKioskStore: <T,>(selector: (s: { session: { workstationName: string } | null }) => T) =>
    selector({ session: { workstationName: 'Register 1' } }),
}));

vi.mock('@/components/pickup/ScanSuccessFlash.js', () => ({
  ScanSuccessFlash: () => null,
}));
vi.mock('@/components/pickup/OrderCompleteCelebration.js', () => ({
  OrderCompleteCelebration: () => null,
}));
vi.mock('@/components/shared/BackToStationHomeButton.js', () => ({
  BackToStationHomeButton: () => null,
}));

import { WalkUpRegisterPage } from '../WalkUpRegisterPage.js';

function makeDraft(partial: Partial<DraftOrder> = {}): DraftOrder {
  return {
    id: 'd-1',
    customerId: null,
    sellerId: null,
    orderNumber: 'W-0001',
    status: 'Draft',
    isWalkUp: true,
    hasIssue: false,
    paymentMethod: null,
    amountTendered: null,
    customer: null,
    seller: null,
    lines: [],
    createdAt: '2026-05-07T00:00:00Z',
    updatedAt: '2026-05-07T00:00:00Z',
    deletedAt: null,
    ...partial,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/walkup/register/d-1']}>
      <Routes>
        <Route path="/walkup/register/:draftId" element={<WalkUpRegisterPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function scanInput(): Promise<HTMLInputElement> {
  const input = (await screen.findByPlaceholderText('Scan barcode or type SKU...')) as HTMLInputElement;
  await waitFor(() => expect(input).not.toBeDisabled());
  return input;
}

function submitScan(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('WalkUpRegisterPage scanning', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockScan.mockReset();
    mockCreateDraft.mockReset();
    mockGetOpenDrafts.mockReset();
    mockGetPlant.mockReset();
    mockOpenPinModal.mockReset();
    appState.setWalkUpDraftId.mockReset();
    appState.clearWalkUpDraftId.mockReset();
    appState.getWalkUpDraftId.mockReset();
    appState.getWalkUpDraftId.mockReturnValue(undefined);

    mockGetOpenDrafts.mockResolvedValue([makeDraft()]);
    mockGetPlant.mockResolvedValue({ id: 'p-47', price: 4.5 });

    let uuidSeq = 0;
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => `uuid-${++uuidSeq}`,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('strips the 12-digit label padding so a printed label resolves to its SKU', async () => {
    mockScan.mockResolvedValue(
      makeDraft({
        lines: [
          {
            id: 'l1',
            orderId: 'd-1',
            plantCatalogId: 'p-47',
            plantName: 'Hosta',
            plantSku: '47',
            qtyOrdered: 1,
            qtyFulfilled: 1,
            notes: null,
            lastScanIdempotencyKey: null,
            createdAt: '2026-05-07T00:00:00Z',
            updatedAt: '2026-05-07T00:00:00Z',
          },
        ],
      }),
    );

    renderPage();
    const input = await scanInput();
    submitScan(input, '000000000047');

    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));
    expect(mockScan.mock.calls[0][1]).toMatchObject({ plantBarcode: '47', quantity: 1 });
    expect(await screen.findByText('Hosta')).toBeInTheDocument();
  });
});
