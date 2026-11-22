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
const mockClose = vi.fn();

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
    close: (...args: unknown[]) => mockClose(...args),
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

// ScanInput drops an identical barcode submitted within 2 s; the tests advance
// this fake clock instead of sleeping.
const clock = { now: 0 };

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

    clock.now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock.now);

    let uuidSeq = 0;
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => `uuid-${++uuidSeq}`,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('reuses the scanId when the same scan is retried after a network failure', async () => {
    mockScan
      .mockRejectedValueOnce(new Error('The request timed out before the server responded.'))
      .mockResolvedValue(makeDraft());

    renderPage();
    let input = await scanInput();
    submitScan(input, '47');
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));
    await screen.findByText(/timed out/);

    // Volunteer re-scans the same label after the dropped request (past the
    // ScanInput 2 s duplicate window).
    input = await scanInput();
    clock.now += 5000;
    submitScan(input, '47');
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(2));

    const first = mockScan.mock.calls[0][1] as { scanId: string };
    const second = mockScan.mock.calls[1][1] as { scanId: string };
    expect(second.scanId).toBe(first.scanId);

    // After a completed response a deliberate re-scan is a new sale unit.
    input = await scanInput();
    clock.now += 5000;
    submitScan(input, '47');
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(3));
    const third = mockScan.mock.calls[2][1] as { scanId: string };
    expect(third.scanId).not.toBe(first.scanId);
  });

  it('retires the scanId when the server rejected the scan', async () => {
    const rejected = Object.assign(new Error('Plant is over walk-up availability'), { status: 400 });
    mockScan.mockRejectedValueOnce(rejected).mockResolvedValue(makeDraft());

    renderPage();
    let input = await scanInput();
    submitScan(input, '47');
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));

    input = await scanInput();
    clock.now += 5000;
    submitScan(input, '47');
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(2));

    const first = mockScan.mock.calls[0][1] as { scanId: string };
    const second = mockScan.mock.calls[1][1] as { scanId: string };
    expect(second.scanId).not.toBe(first.scanId);
  });

  it('manager override re-sends the refused scan with the PIN and reason', async () => {
    const rejected = Object.assign(new Error('Plant is over walk-up availability'), { status: 400 });
    mockScan.mockRejectedValueOnce(rejected).mockResolvedValue(makeDraft());
    mockOpenPinModal.mockResolvedValue({ pin: '1234', reason: 'preorder no-show' });

    renderPage();
    const input = await scanInput();
    submitScan(input, '000000000047');
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Manager Override' }));
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(2));

    const [draftId, body, pin, reason] = mockScan.mock.calls[1] as [
      string,
      { plantBarcode: string; scanId: string; quantity: number },
      string,
      string,
    ];
    expect(draftId).toBe('d-1');
    expect(body).toMatchObject({ plantBarcode: '47', quantity: 1 });
    expect(body.scanId).not.toBe((mockScan.mock.calls[0][1] as { scanId: string }).scanId);
    expect(pin).toBe('1234');
    expect(reason).toBe('preorder no-show');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Manager Override' })).not.toBeInTheDocument(),
    );
  });

  it('manager override does nothing when the PIN prompt is cancelled', async () => {
    const rejected = Object.assign(new Error('Plant is over walk-up availability'), { status: 400 });
    mockScan.mockRejectedValueOnce(rejected);
    mockOpenPinModal.mockResolvedValue(null);

    renderPage();
    const input = await scanInput();
    submitScan(input, '47');
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Manager Override' }));
    await waitFor(() => expect(mockOpenPinModal).toHaveBeenCalledTimes(1));
    expect(mockScan).toHaveBeenCalledTimes(1);
  });

  describe('Close Sale dialog', () => {
    const lineDraft = () =>
      makeDraft({
        lines: [
          {
            id: 'l-1', orderId: 'd-1', plantCatalogId: 'p-47', plantName: 'Fern', plantSku: '47',
            qtyOrdered: 3, qtyFulfilled: 3, notes: null, lastScanIdempotencyKey: null,
            createdAt: '2026-05-07T00:00:00Z', updatedAt: '2026-05-07T00:00:00Z', deletedAt: null,
          } as unknown as DraftOrder['lines'][number],
        ],
      });

    async function openClose() {
      mockGetOpenDrafts.mockResolvedValue([lineDraft()]);
      renderPage();
      await scanInput();
      await screen.findByText('$13.50', undefined, { timeout: 3000 }).catch(() => undefined);
      fireEvent.click(screen.getAllByRole('button', { name: 'Close Sale' })[0]);
      return screen.findByRole('dialog');
    }

    it('does not take barcode reads into the sale while the dialog is open', async () => {
      await openClose();
      const input = screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement;
      expect(input).toBeDisabled();
      submitScan(input, '47');
      fireEvent.keyDown(document.body, { key: '4' });
      fireEvent.keyDown(document.body, { key: '7' });
      fireEvent.keyDown(document.body, { key: 'Enter' });
      await new Promise((r) => setTimeout(r, 50));
      expect(mockScan).not.toHaveBeenCalled();
    });

    it('will not close a cash sale for less than the total', async () => {
      const dialog = await openClose();
      await waitFor(() => expect(dialog.textContent).toContain('$13.50'));
      const amount = dialog.querySelector('input[type="number"]') as HTMLInputElement;
      fireEvent.change(amount, { target: { value: '5' } });

      expect(await screen.findByText(/short by/i)).toBeInTheDocument();
      const confirm = screen.getByRole('button', { name: 'Confirm Close' });
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(mockClose).not.toHaveBeenCalled();

      fireEvent.change(amount, { target: { value: '20' } });
      expect(screen.getByRole('button', { name: 'Confirm Close' })).not.toBeDisabled();
    });
  });

  describe('flaky network', () => {
    it('keeps the open sale when the open-drafts lookup fails, and resumes on Retry', async () => {
      // The register used to treat "could not ask" as "the sale is gone" and open
      // a fresh draft, abandoning the one being rung up (its stock already taken).
      mockGetOpenDrafts.mockReset();
      mockGetOpenDrafts
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValue([makeDraft()]);

      renderPage();
      const retry = await screen.findByRole('button', { name: 'Retry' });
      expect(screen.getByText(/Could not reach the server to reopen this sale/)).toBeInTheDocument();
      expect(mockCreateDraft).not.toHaveBeenCalled();
      expect(appState.clearWalkUpDraftId).not.toHaveBeenCalled();

      fireEvent.click(retry);
      await scanInput();
      expect(mockGetOpenDrafts).toHaveBeenCalledTimes(2);
      expect(mockCreateDraft).not.toHaveBeenCalled();
    });

    it('keeps the quantity after a scan that got no answer, so the retry reuses its scan id', async () => {
      mockScan
        .mockRejectedValueOnce(new Error('The request timed out before the server responded.'))
        .mockResolvedValue(makeDraft());

      renderPage();
      let input = await scanInput();
      fireEvent.click(screen.getByRole('button', { name: 'Set scan quantity to 3' }));
      submitScan(input, '47');
      await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));
      await screen.findByText(/timed out/);

      input = await scanInput();
      clock.now += 5000;
      submitScan(input, '47');
      await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(2));

      const [first, second] = mockScan.mock.calls.map((c) => c[1] as { scanId: string; quantity: number });
      expect(second.quantity).toBe(3);
      expect(second.scanId).toBe(first.scanId);
    });
  });

  it('does not drop a second scan that arrives while the first is still in flight', async () => {
    let release!: (d: DraftOrder) => void;
    mockScan
      .mockImplementationOnce(() => new Promise<DraftOrder>((r) => { release = r; }))
      .mockResolvedValue(makeDraft());

    renderPage();
    const input = await scanInput();
    submitScan(input, '47');
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));
    clock.now += 50;
    submitScan(screen.getByPlaceholderText('Scan barcode or type SKU...') as HTMLInputElement, '48');
    expect(mockScan).toHaveBeenCalledTimes(1);

    release(makeDraft());
    await waitFor(() => expect(mockScan).toHaveBeenCalledTimes(2));
    expect((mockScan.mock.calls[1][1] as { plantBarcode: string }).plantBarcode).toBe('48');
  });
});
