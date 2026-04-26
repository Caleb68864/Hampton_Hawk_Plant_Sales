import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { walkupRegisterApi } from '@/api/walkupRegister.js';
import {
  type DraftOrder,
  type DraftOrderLine,
  type PlantPriceMap,
  grandTotal,
  lineSubtotal,
} from '@/types/walkupRegister.js';
import { plantsApi } from '@/api/plants.js';
import { ScanInput, type ScanInputHandle } from '@/components/pickup/ScanInput.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useAppStore } from '@/stores/appStore.js';
import { useKioskStore } from '@/stores/kioskStore.js';

/**
 * Walk-Up Cash Register page.
 *
 * Renders a barcode-scan input + ticket table + grand total, persists the
 * `draftId` per workstation in `appStore`, and resumes on reload. Each scan
 * generates a fresh `crypto.randomUUID()` idempotency key. Cancel/Void are
 * admin-pin gated. Close Sale captures `paymentMethod` + `amountTendered`.
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
  const [overrideTarget, setOverrideTarget] = useState<{ plantBarcode: string; lineId?: string } | null>(null);
  const [closeModal, setCloseModal] = useState<CloseModalState>(DEFAULT_CLOSE_MODAL);
  const [closing, setClosing] = useState(false);
  const [prices, setPrices] = useState<PlantPriceMap>({});
  const scanRef = useRef<ScanInputHandle>(null);
  const initRef = useRef(false);

  const refocusScan = useCallback(() => {
    // Defer focus to next tick so the scan input is mounted/enabled.
    setTimeout(() => scanRef.current?.focus(), 0);
  }, []);

  const updateDraftAndPersist = useCallback(
    async (next: DraftOrder) => {
      setDraft(next);
      // Hydrate prices for new plants we haven't fetched yet.
      const missing = next.lines
        .map((l) => l.plantCatalogId)
        .filter((id) => !(id in prices));
      if (missing.length > 0) {
        try {
          const fetched = await Promise.all(
            missing.map((id) => plantsApi.getById(id).then((p) => [id, p.price] as const).catch(() => [id, null] as const)),
          );
          setPrices((prev) => {
            const merged: PlantPriceMap = { ...prev };
            for (const [id, price] of fetched) merged[id] = price ?? null;
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
          try {
            const openDrafts = await walkupRegisterApi.getOpenDrafts(workstationName ?? undefined);
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
          } catch {
            // fall through to creating a new draft
          }
          // Cached draft no longer open -- clear and create a fresh one.
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
      const trimmed = barcode.trim();
      if (!trimmed) return;
      setScanning(true);
      setError(null);
      try {
        // Generate a fresh idempotency key per scan. The backend uses this to
        // dedupe retries; never reuse it for distinct user actions.
        const scanId = crypto.randomUUID();
        const next = await walkupRegisterApi.scan(draft.id, { plantBarcode: trimmed, scanId });
        await updateDraftAndPersist(next);
        setOverrideTarget(null);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Scan failed';
        setError(message);
        // Surface override option for "out of stock" / availability failures.
        if (/availab|stock|exceed|walk[-\s]?up/i.test(message)) {
          setOverrideTarget({ plantBarcode: trimmed });
        }
      } finally {
        setScanning(false);
        refocusScan();
      }
    },
    [draft, updateDraftAndPersist, refocusScan],
  );

  // ---------- Manager override (re-enter via adjustLine) ----------
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
      // Use a scan to attempt to match the plant via barcode, but the backend
      // will reject for availability. Instead, look up the plant and use
      // adjustLine on an existing line if present, else create-and-adjust.
      const scanId = crypto.randomUUID();
      // Try a scan first under override headers via adjustLine on an existing
      // line for this plant; if no line yet, perform a normal scan call (the
      // backend may accept since the override action is a separate flow).
      const existing = draft.lines.find(
        (l) => l.plantSku === overrideTarget.plantBarcode || l.plantName === overrideTarget.plantBarcode,
      );
      if (existing) {
        const next = await walkupRegisterApi.adjustLine(
          draft.id,
          existing.id,
          { plantCatalogId: existing.plantCatalogId, newQty: existing.qtyOrdered + 1 },
          auth.pin,
          auth.reason,
        );
        await updateDraftAndPersist(next);
      } else {
        // Fallback: try the scan again. Some backends allow a single retry under
        // admin reason (the override flow is server-side gated). If the server
        // still rejects, we surface the error to the operator.
        const next = await walkupRegisterApi.scan(draft.id, {
          plantBarcode: overrideTarget.plantBarcode,
          scanId,
        });
        await updateDraftAndPersist(next);
      }
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
    if (!draft) return;
    const tenderedNum = closeModal.amountTendered ? Number.parseFloat(closeModal.amountTendered) : null;
    if (closeModal.amountTendered && (tenderedNum == null || Number.isNaN(tenderedNum))) {
      setError('Amount tendered must be a number');
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
      // Navigate to receipt (existing print page).
      navigate(`/print/order/${closed.id}?returnTo=/station`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close sale');
    } finally {
      setClosing(false);
    }
  }, [draft, closeModal, clearWalkUpDraftId, workstationName, navigate]);

  // ---------- Render ----------
  const lineCount = draft?.lines.reduce((sum, l) => sum + (l.qtyOrdered || 0), 0) ?? 0;
  const change =
    closeModal.amountTendered && total >= 0
      ? Math.max(0, Number.parseFloat(closeModal.amountTendered) - total)
      : 0;

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
              <ScanInput onScan={handleScan} disabled={scanning || !draft} ref={scanRef} />
              <p className="text-xs text-gray-500">
                Each scan +1 to the ticket. Idempotent on retry. Use the right-rail buttons to close or cancel.
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
                {closeModal.amountTendered && (
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
              <TouchButton variant="primary" disabled={closing} onClick={() => void submitClose()}>
                {closing ? 'Closing...' : 'Confirm Close'}
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
