import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { walkupRegisterApi } from '@/api/walkupRegister.js';
import {
  type DraftOrder,
  type DraftOrderLine,
  type PlantPriceMap,
  unpricedLineCount,
  cashShortfall,
  grandTotal,
  lineSubtotal,
} from '@/types/walkupRegister.js';
import { plantsApi } from '@/api/plants.js';
import { ScanInput, type ScanInputHandle } from '@/components/pickup/ScanInput.js';
import { QuantitySelector } from '@/components/pickup/QuantitySelector.js';
import { ScanSuccessFlash } from '@/components/pickup/ScanSuccessFlash.js';
import { OrderCompleteCelebration } from '@/components/pickup/OrderCompleteCelebration.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useAppStore } from '@/stores/appStore.js';
import { useKioskStore } from '@/stores/kioskStore.js';
import { toScanLookupValue } from '@/utils/barcode.js';
import type { ApiError } from '@/api/errorMessage.js';

/**
 * Walk-Up Cash Register page.
 *
 * Renders a barcode-scan input + ticket table + grand total, persists the
 * `draftId` per workstation in `appStore`, and resumes on reload. Each scan
 * carries a `crypto.randomUUID()` idempotency key that is reused when the same
 * barcode+quantity is retried after a request that never got a response.
 * Cancel/Void are admin-pin gated. Close Sale captures `paymentMethod` +
 * `amountTendered`.
 */

function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '--';
  return `$${value.toFixed(2)}`;
}

interface CloseModalState {
  open: boolean;
  paymentMethod: 'Cash' | 'Card' | 'Check' | 'Other';
  amountTendered: string;
}

const DEFAULT_CLOSE_MODAL: CloseModalState = {
  open: false,
  paymentMethod: 'Cash',
  amountTendered: '',
};

export function WalkUpRegisterPage() {
  const navigate = useNavigate();
  const { draftId: routeDraftId } = useParams<{ draftId?: string }>();
  const openPinModal = useAuthStore((s) => s.openPinModal);
  const setWalkUpDraftId = useAppStore((s) => s.setWalkUpDraftId);
  const clearWalkUpDraftId = useAppStore((s) => s.clearWalkUpDraftId);
  const getWalkUpDraftId = useAppStore((s) => s.getWalkUpDraftId);
  const kioskWorkstation = useKioskStore((s) => s.session?.workstationName ?? null);

  const workstationName = kioskWorkstation;

  const [draft, setDraft] = useState<DraftOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<{ plantBarcode: string; quantity: number } | null>(null);
  const [closeModal, setCloseModal] = useState<CloseModalState>(DEFAULT_CLOSE_MODAL);
  const [closing, setClosing] = useState(false);
  const [prices, setPrices] = useState<PlantPriceMap>({});
  const scanRef = useRef<ScanInputHandle>(null);
  const initRef = useRef(false);
  // Scan id of the most recent submission that never got a server response, so
  // a retry of that same barcode+quantity reuses it (see handleScan).
  const pendingScanRef = useRef<{ key: string; scanId: string } | null>(null);

  // Multi-quantity scanning: volunteer "set N, scan, set N, scan" workflow.
  // Reset to 1 after each successful scan to match the pickup-screen pattern.
  const [scanQuantity, setScanQuantity] = useState(1);

  // Joy Pass overlays: scan success flash + sale-complete celebration.
  // For walkup we omit the `remainingForOrder` pill since the basket grows
  // (no preset order quantity to count down from).
  const [showScanFlash, setShowScanFlash] = useState(false);
  const [scanFlashData, setScanFlashData] = useState<{
    plantName: string;
    sku?: string;
    barcode?: string;
  } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationOrderNumber, setCelebrationOrderNumber] = useState<string>('Sale');
  const pendingNavigateRef = useRef<string | null>(null);

  const refocusScan = useCallback(() => {
    // Defer focus to next tick so the scan input is mounted/enabled.
    setTimeout(() => scanRef.current?.focus(), 0);
  }, []);

  // Tapping a preset / +/- moves focus to that button. Put it straight back on
  // the scan input so the next wedge scan lands in the buffer, not on the
  // button (where its digits would be lost and Enter would re-click it).
  const handleScanQuantityChange = useCallback(
    (n: number) => {
      setScanQuantity(n);
      refocusScan();
    },
    [refocusScan],
  );

  const updateDraftAndPersist = useCallback(
    async (next: DraftOrder) => {
      setDraft(next);
      // Hydrate prices for new plants we haven't fetched yet.
      const missing = next.lines
        .map((l) => l.plantCatalogId)
        .filter((id) => !(id in prices));
      if (missing.length > 0) {
        try {
          // A failed fetch is left out of the map (not cached as null) so the next
          // draft update retries it; only a catalog price of null is cached as null.
          const fetched = await Promise.all(
            missing.map((id) => plantsApi.getById(id).then((p) => [id, p.price ?? null] as const).catch(() => undefined)),
          );
          setPrices((prev) => {
            const merged: PlantPriceMap = { ...prev };
            for (const entry of fetched) {
              if (entry) merged[entry[0]] = entry[1];
            }
            return merged;
          });
        } catch {
          // Non-fatal: we still render qty/sku/name; price column shows --.
        }
      }
    },
    [prices],
  );

  // ---------- Initial draft resolution (resume or create) ----------
  // Set when the open-drafts lookup could not be made; Retry runs init again.
  const [resumeFailed, setResumeFailed] = useState(false);
  const [initAttempt, setInitAttempt] = useState(0);
  const retryResume = useCallback(() => {
    initRef.current = false;
    setResumeFailed(false);
    setError(null);
    setInitAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const cachedId = getWalkUpDraftId(workstationName);
        const explicitId = routeDraftId === 'new' ? undefined : routeDraftId;
        const targetId = explicitId ?? cachedId;

        if (targetId) {
          // Try to resume by listing open drafts and matching the cached id.
          let openDrafts;
          try {
            openDrafts = await walkupRegisterApi.getOpenDrafts(workstationName ?? undefined);
          } catch (lookupError) {
            // Could not find out whether the sale is still open. Opening a fresh
            // draft here abandoned the one being rung up, whose units the register
            // had already taken off the shelf. Keep it and let the cashier retry.
            if (!cancelled) {
              setResumeFailed(true);
              setError(
                `Could not reach the server to reopen this sale (${
                  lookupError instanceof Error ? lookupError.message : 'network error'
                }). Check the connection, then press Retry.`,
              );
            }
            return;
          }
          const match = openDrafts.find((o) => o.id === targetId);
          if (match) {
            if (cancelled) return;
            await updateDraftAndPersist(match);
            setWalkUpDraftId(workstationName, match.id);
            if (routeDraftId !== match.id) {
              navigate(`/walkup/register/${match.id}`, { replace: true });
            }
            return;
          }
          // The server says that draft is no longer open -- clear and create a fresh one.
          clearWalkUpDraftId(workstationName);
        }

        const created = await walkupRegisterApi.createDraft({ workstationName: workstationName ?? undefined });
        if (cancelled) return;
        await updateDraftAndPersist(created);
        setWalkUpDraftId(workstationName, created.id);
        navigate(`/walkup/register/${created.id}`, { replace: true });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to open register draft');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [
    initAttempt,
    routeDraftId,
    workstationName,
    getWalkUpDraftId,
    setWalkUpDraftId,
    clearWalkUpDraftId,
    updateDraftAndPersist,
    navigate,
  ]);

  // ---------- Scan handler ----------
  const handleScan = useCallback(
    async (barcode: string) => {
      if (!draft) return;
      // Printed labels are the SKU zero-padded to 12 digits and the server
      // matches exactly; strip the padding the same way the pickup scan does,
      // otherwise a label that scans at pickup is "not found" at the register.
      const trimmed = toScanLookupValue(barcode);
      if (!trimmed) return;
      setScanning(true);
      setError(null);
      // Snapshot pre-scan line state so we can detect which line was touched
      // and surface the actual plant name in the success flash.
      const beforeLines = new Map(draft.lines.map((l) => [l.plantCatalogId, l.qtyOrdered]));
      const requestedQty = scanQuantity;
      // Retry-stable idempotency key. A scan that times out or drops on the LAN
      // may still have been applied server-side; re-scanning the same barcode at
      // the same quantity reuses the id so the server treats it as a replay
      // instead of adding the item twice. The id is retired on any completed
      // response, so a deliberate second scan of the same item gets a fresh one.
      const attemptKey = `${trimmed}|${requestedQty}`;
      const scanId =
        pendingScanRef.current?.key === attemptKey
          ? pendingScanRef.current.scanId
          : crypto.randomUUID();
      pendingScanRef.current = { key: attemptKey, scanId };
      let answered = true;
      try {
        const next = await walkupRegisterApi.scan(draft.id, {
          plantBarcode: trimmed,
          scanId,
          quantity: requestedQty,
        });
        pendingScanRef.current = null;
        await updateDraftAndPersist(next);
        setOverrideTarget(null);

        // Joy Pass: find the line whose qty changed (or appeared) and flash it.
        const touched = next.lines.find((l) => {
          const prev = beforeLines.get(l.plantCatalogId) ?? 0;
          return l.qtyOrdered > prev;
        });
        if (touched) {
          setScanFlashData({
            plantName: touched.plantName,
            sku: touched.plantSku,
            barcode: trimmed,
          });
          setShowScanFlash(true);
        }
      } catch (e) {
        // The server answered (4xx/5xx): that attempt is settled, so the next
        // scan of this item must not replay its id. No status means the request
        // never came back -- keep the id, and the quantity it is keyed on, for
        // the retry.
        answered = (e as ApiError | null)?.status !== undefined;
        if (answered) {
          pendingScanRef.current = null;
        }
        const message = e instanceof Error ? e.message : 'Scan failed';
        setError(message);
        // Surface override option for "out of stock" / availability failures.
        if (/availab|stock|exceed|walk[-\s]?up/i.test(message)) {
          setOverrideTarget({ plantBarcode: trimmed, quantity: requestedQty });
        }
      } finally {
        // Reset multi-qty back to 1 so the next scan defaults to single, unless
        // the request got no answer: resetting then gave the retry a new scan id
        // (the id is keyed on barcode + quantity) and the server applied both.
        if (answered) setScanQuantity(1);
        setScanning(false);
        refocusScan();
      }
    },
    [draft, scanQuantity, updateDraftAndPersist, refocusScan],
  );

  const handleScanFlashEnd = useCallback(() => {
    setShowScanFlash(false);
    setScanFlashData(null);
  }, []);

  // ---------- Manager override (re-send the refused scan with the PIN) ----------
  const handleManagerOverride = useCallback(async () => {
    if (!draft || !overrideTarget) return;
    const auth = await openPinModal({
      title: 'Manager Override',
      description: 'A manager must approve adding this item past walk-up availability.',
      reasonLabel: 'Override reason',
    });
    if (!auth) return;
    setError(null);
    try {
      // Lines carry no barcode, so the client cannot find the line to adjust.
      // The server applies the override on the scan itself, under the same
      // locks, and still never sells past on-hand inventory. The refused scan
      // was settled by the server, so this one takes a fresh id.
      const next = await walkupRegisterApi.scan(
        draft.id,
        {
          plantBarcode: overrideTarget.plantBarcode,
          scanId: crypto.randomUUID(),
          quantity: overrideTarget.quantity,
        },
        auth.pin,
        auth.reason,
      );
      await updateDraftAndPersist(next);
      setOverrideTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Override failed');
    } finally {
      refocusScan();
    }
  }, [draft, overrideTarget, openPinModal, updateDraftAndPersist, refocusScan]);

  // ---------- Void a single line (admin pin) ----------
  const handleVoidLine = useCallback(
    async (line: DraftOrderLine) => {
      if (!draft) return;
      const auth = await openPinModal({
        title: 'Void Line',
        description: `Remove ${line.plantName} from this sale.`,
        reasonLabel: 'Void reason',
      });
      if (!auth) return;
      try {
        const next = await walkupRegisterApi.voidLine(draft.id, line.id, auth.pin, auth.reason);
        await updateDraftAndPersist(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to void line');
      } finally {
        refocusScan();
      }
    },
    [draft, openPinModal, updateDraftAndPersist, refocusScan],
  );

  // ---------- Cancel sale (admin pin) ----------
  const handleCancelSale = useCallback(async () => {
    if (!draft) return;
    const auth = await openPinModal({
      title: 'Cancel Sale',
      description: 'Discard this draft and restore inventory.',
      reasonLabel: 'Cancel reason',
    });
    if (!auth) return;
    try {
      await walkupRegisterApi.cancel(draft.id, auth.pin, auth.reason);
      clearWalkUpDraftId(workstationName);
      navigate('/station');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel sale');
    }
  }, [draft, openPinModal, clearWalkUpDraftId, workstationName, navigate]);

  // ---------- Close sale ----------
  const total = useMemo(() => grandTotal(draft, prices), [draft, prices]);
  const unpricedCount = useMemo(() => unpricedLineCount(draft, prices), [draft, prices]);

  const openCloseModal = useCallback(() => {
    setCloseModal({
      open: true,
      paymentMethod: 'Cash',
      amountTendered: total > 0 ? total.toFixed(2) : '',
    });
  }, [total]);

  const closeCloseModal = useCallback(() => {
    setCloseModal(DEFAULT_CLOSE_MODAL);
    refocusScan();
  }, [refocusScan]);

  const submitClose = useCallback(async () => {
    if (!draft || closing) return;
    const tenderedNum = closeModal.amountTendered ? Number.parseFloat(closeModal.amountTendered) : null;
    if (closeModal.amountTendered && (tenderedNum == null || Number.isNaN(tenderedNum) || tenderedNum < 0)) {
      setError('Amount tendered must be a number of zero or more');
      return;
    }
    if (cashShortfall(closeModal.paymentMethod, closeModal.amountTendered, total) > 0) {
      setError('Cash tendered is less than the total due.');
      return;
    }
    setClosing(true);
    setError(null);
    try {
      const closed = await walkupRegisterApi.close(draft.id, {
        paymentMethod: closeModal.paymentMethod,
        amountTendered: tenderedNum,
      });
      clearWalkUpDraftId(workstationName);
      // Joy Pass: show the celebration overlay first, then navigate when it
      // dismisses (auto after ~700ms or on tap/keypress).
      pendingNavigateRef.current = `/print/order/${closed.id}?returnTo=/station`;
      setCelebrationOrderNumber(closed.orderNumber || 'Sale');
      setCloseModal(DEFAULT_CLOSE_MODAL);
      setShowCelebration(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close sale');
    } finally {
      setClosing(false);
    }
  }, [draft, closing, closeModal, total, clearWalkUpDraftId, workstationName]);

  const handleCelebrationComplete = useCallback(() => {
    setShowCelebration(false);
    const target = pendingNavigateRef.current;
    pendingNavigateRef.current = null;
    if (target) navigate(target);
  }, [navigate]);

  // ---------- Render ----------
  const lineCount = draft?.lines.reduce((sum, l) => sum + (l.qtyOrdered || 0), 0) ?? 0;
  const change =
    closeModal.amountTendered && total >= 0
      ? Math.max(0, Number.parseFloat(closeModal.amountTendered) - total)
      : 0;
  // Cash short of the total used to close as paid, showing "Change due $0.00".
  const cashShortBy = cashShortfall(closeModal.paymentMethod, closeModal.amountTendered, total);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <BackToStationHomeButton />
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Walk-Up Register
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Cash Register
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {workstationName ? <>Workstation: <span className="font-medium">{workstationName}</span> &middot; </> : null}
            Draft: <span className="font-mono">{draft ? draft.orderNumber : '...'}</span> &middot; Items: {lineCount}
          </p>
        </div>
      </header>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {resumeFailed && (
        <TouchButton variant="primary" onClick={retryResume}>
          Retry
        </TouchButton>
      )}

      {/* Joy Pass: Scan Success Flash (omits remainingForOrder for walkup -- the
          basket grows; there is no preset order qty to count down from). */}
      {showScanFlash && scanFlashData && (
        <ScanSuccessFlash
          visible={showScanFlash}
          plantName={scanFlashData.plantName}
          sku={scanFlashData.sku}
          barcode={scanFlashData.barcode}
          onAnimationEnd={handleScanFlashEnd}
        />
      )}

      {/* Joy Pass: Sale Complete Celebration. customerName is undefined for
          walkup (no customer), which renders the generic "Hand to the customer"
          copy. Holds ~700ms then navigates to the receipt print page. */}
      {showCelebration && (
        <OrderCompleteCelebration
          visible={showCelebration}
          orderNumber={celebrationOrderNumber}
          onComplete={handleCelebrationComplete}
        />
      )}

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
          Opening register...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Left: scan input + ticket */}
          <section className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">Scan plant barcode</label>
              {/* Multi-quantity scanning: prominently visible above ScanInput.
                  Resets to 1 after each successful scan (matches PickupScanPage). */}
              <QuantitySelector
                value={scanQuantity}
                onChange={handleScanQuantityChange}
                disabled={scanning || !draft}
              />
              {/* Off while the Close Sale dialog is open or closing: a barcode read
                  there was added to the sale behind the dialog, after the total
                  and change had been shown. */}
              <ScanInput onScan={handleScan} busy={scanning} disabled={!draft || closeModal.open || closing} ref={scanRef} />
              <p className="text-xs text-gray-500">
                Set qty then scan once to add multiple. Idempotent on retry. Use the right-rail buttons to close or cancel.
              </p>
              {overrideTarget && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-sm text-red-700">
                    "{overrideTarget.plantBarcode}" is over walk-up availability. Manager override required.
                  </p>
                  <TouchButton variant="danger" onClick={() => void handleManagerOverride()}>
                    Manager Override
                  </TouchButton>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Void</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {draft && draft.lines.length > 0 ? (
                    draft.lines.map((line) => {
                      const unitPrice = prices[line.plantCatalogId];
                      const subtotal = lineSubtotal(line, prices);
                      return (
                        <tr key={line.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{line.plantName}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 font-mono">{line.plantSku}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatMoney(unitPrice ?? null)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right font-semibold">{line.qtyOrdered}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatMoney(subtotal)}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                              onClick={() => void handleVoidLine(line)}
                            >
                              Void
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        Scan a plant barcode to start the ticket.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right rail: total + actions */}
          <aside className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Grand Total</p>
              <p className="text-4xl font-bold text-hawk-900 tabular-nums">{formatMoney(total)}</p>
              <p className="text-xs text-gray-500">{lineCount} item{lineCount === 1 ? '' : 's'}</p>
              {unpricedCount > 0 && (
                <p className="text-xs font-medium text-amber-700" role="status">
                  {unpricedCount} line{unpricedCount === 1 ? '' : 's'} without a price — not included in the total.
                </p>
              )}
            </div>
            <TouchButton
              variant="primary"
              className="w-full"
              disabled={!draft || draft.lines.length === 0 || closing}
              onClick={openCloseModal}
            >
              Close Sale
            </TouchButton>
            <TouchButton variant="danger" className="w-full" disabled={!draft} onClick={() => void handleCancelSale()}>
              Cancel Sale
            </TouchButton>
          </aside>
        </div>
      )}

      {closeModal.open && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Close Sale</h2>
            <p className="text-sm text-gray-600">
              Capture payment method and amount tendered. Total due:{' '}
              <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment method</label>
                <select
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={closeModal.paymentMethod}
                  onChange={(e) =>
                    setCloseModal((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value as CloseModalState['paymentMethod'],
                    }))
                  }
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Check">Check</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount tendered</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={closeModal.amountTendered}
                  onChange={(e) => setCloseModal((prev) => ({ ...prev, amountTendered: e.target.value }))}
                />
                {closeModal.amountTendered && cashShortBy > 0 && (
                  <p role="alert" className="text-xs text-red-600 mt-1">
                    Cash tendered is short by <span className="font-semibold tabular-nums">{formatMoney(cashShortBy)}</span>.
                  </p>
                )}
                {closeModal.amountTendered && cashShortBy === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Change due: <span className="font-semibold tabular-nums">{formatMoney(change)}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                onClick={closeCloseModal}
                disabled={closing}
              >
                Back
              </button>
              <TouchButton variant="primary" disabled={closing || cashShortBy > 0} onClick={() => void submitClose()}>
                {closing ? 'Closing...' : 'Confirm Close'}
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
