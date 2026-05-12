import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '../../api/orders.js';
import { ScanInputShell } from '../../components/mobile/ScanInputShell.js';
import { BarcodeScanner } from '../../components/mobile/BarcodeScanner.js';
import { MobileAccessDeniedScene } from '../../components/mobile/MobileAccessDeniedScene.js';
import { MobileConnectionRequiredScene } from '../../components/mobile/MobileConnectionRequiredScene.js';
import { MobileGhostButton } from '../../components/mobile/buttons/MobileGhostButton.js';
import { MobileGoldButton } from '../../components/mobile/buttons/MobileGoldButton.js';
import { Seed } from '../../components/mobile/joy/Seed.js';
import { Checkbloom } from '../../components/mobile/joy/Checkbloom.js';
import { useAuthStore } from '../../stores/authStore.js';
import type { Order } from '../../types/order.js';
import type { NormalizedScanResult } from '../../types/scanner.js';
import { classifyMobileScanInput } from './pickupScanLogic.js';
import {
  partitionLookupResults,
  canScanIntoOrders,
} from './orderLookupSelection.js';
import { normalizeOrderLookupValue } from '../../utils/orderLookup.js';

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 20;
const LOOKUP_PATH = '/mobile/lookup';

type AxiosLikeError = { response?: { status?: number } } & Error;

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'navigating'; orderId: string }
  | { kind: 'matches'; orders: Order[]; exactSingle: boolean; capped: boolean }
  | { kind: 'no-matches' }
  | { kind: 'wrong-code-type' }
  | { kind: 'error'; message: string };

function isAuthExpired(err: unknown): boolean {
  const e = err as AxiosLikeError | undefined;
  return !!e && typeof e === 'object' && e.response?.status === 401;
}

function isNetworkLikeError(err: unknown): boolean {
  // Treat fetch/axios network failures as offline-like.
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { message?: string; code?: string; response?: unknown };
  if (e.response) return false; // got a response, not a network failure
  const msg = (e.message ?? '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    e.code === 'ERR_NETWORK'
  );
}

export function MobileOrderLookupPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const hasLookupAccess = useMemo(
    () =>
      !!currentUser?.roles.some(
        (r) => r === 'LookupPrint' || r === 'Pickup' || r === 'Admin',
      ),
    [currentUser],
  );
  const canScan = canScanIntoOrders(currentUser);

  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [state, setState] = useState<LookupState>({ kind: 'idle' });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Track offline transitions.
  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const performLookup = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setState({ kind: 'idle' });
        return;
      }

      const classification = classifyMobileScanInput(trimmed);
      if (classification === 'item-barcode') {
        setState({ kind: 'wrong-code-type' });
        return;
      }

      setState({ kind: 'searching' });
      const requestId = ++requestIdRef.current;
      try {
        const normalized = normalizeOrderLookupValue(trimmed);
        const response = await ordersApi.list({
          search: normalized,
          pageSize: PAGE_SIZE,
        });
        if (requestId !== requestIdRef.current) return; // stale

        const items = response.items ?? [];
        if (items.length === 0) {
          setState({ kind: 'no-matches' });
          return;
        }

        const partition = partitionLookupResults(items, trimmed);

        if (partition.exact && canScan) {
          // Scan-permitted user with single exact match — auto-navigate.
          setState({ kind: 'navigating', orderId: partition.exact.id });
          // Brief Joy moment, then navigate.
          window.setTimeout(() => {
            navigate(`/mobile/pickup/${partition.exact!.id}`);
          }, 350);
          return;
        }

        // Either (a) lookup-only user with single exact match OR
        // (b) ambiguous matches OR (c) broad results — render list.
        const orders =
          partition.exact != null
            ? [partition.exact]
            : partition.ambiguous.length > 0
              ? partition.ambiguous
              : partition.broad;

        setState({
          kind: 'matches',
          orders,
          exactSingle: partition.exact != null,
          capped: items.length === PAGE_SIZE,
        });
      } catch (err) {
        if (requestId !== requestIdRef.current) return;

        if (isAuthExpired(err)) {
          navigate('/login', { state: { from: LOOKUP_PATH } });
          return;
        }

        if (isNetworkLikeError(err)) {
          setOffline(true);
          return;
        }

        const message = err instanceof Error ? err.message : 'Lookup failed';
        setState({ kind: 'error', message });
      }
    },
    [navigate, canScan],
  );

  // Debounced search on typed value.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (offline) return;
    if (!value.trim()) {
      setState({ kind: 'idle' });
      return;
    }
    debounceRef.current = setTimeout(() => {
      void performLookup(value);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, performLookup, offline]);

  const handleCameraScan = useCallback(
    (result: NormalizedScanResult) => {
      // REQ-021: scan-source telemetry — debug channel only, no console.log of code.
      // eslint-disable-next-line no-console
      console.debug('mobile-lookup-scan', {
        source: result.source,
        code: result.code,
        scannedAtUtc: result.scannedAtUtc,
      });
      setValue(result.code);
      void performLookup(result.code);
    },
    [performLookup],
  );

  const handleRetry = useCallback(() => {
    void performLookup(value);
  }, [performLookup, value]);

  const handleClear = useCallback(() => {
    setValue('');
    setState({ kind: 'idle' });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const isNavigating = state.kind === 'navigating';

  if (!hasLookupAccess) {
    return <MobileAccessDeniedScene />;
  }

  if (offline) {
    return <MobileConnectionRequiredScene onRetry={() => setOffline(!navigator.onLine)} />;
  }

  return (
    <div className="mobile-order-lookup mobile-page-bg">
      <div className="mobile-order-lookup__inner">
        <header className="mobile-order-lookup__header">
          <div className="mobile-order-lookup__eyebrow">LOOKUP</div>
          <h1 className="mobile-order-lookup__title">Find an order</h1>
        </header>

        <div className="mobile-order-lookup__layout">
          <div className="mobile-order-lookup__left">
            {state.kind === 'error' && (
              <div className="mobile-order-lookup__retry" role="alert">
                <p className="mobile-order-lookup__retry-msg">
                  Couldn’t reach the server. Your search is preserved — try again.
                </p>
                <MobileGoldButton onClick={handleRetry} aria-label="Retry search">
                  Retry
                </MobileGoldButton>
              </div>
            )}

            {state.kind === 'wrong-code-type' && (
              <div className="mobile-order-lookup__warn" role="alert">
                That looks like a plant barcode. Try an order code or search by name.
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void performLookup(value);
              }}
            >
              <ScanInputShell
                ref={inputRef}
                label="Order lookup"
                hint="Type an order number or name, or scan an order code."
                value={value}
                onChange={(e) => setValue(e.currentTarget.value)}
                placeholder="OR-00184 — Patel — Daniel Kim"
                inputMode="search"
                autoFocus
                aria-label="Order lookup search"
              />
            </form>

            <MobileGhostButton
              onClick={() => setScannerOpen((s) => !s)}
              aria-expanded={scannerOpen}
              aria-controls="mobile-lookup-scanner"
            >
              {scannerOpen ? 'Hide scanner' : 'Scan order code instead'}
            </MobileGhostButton>

            {scannerOpen && (
              <div id="mobile-lookup-scanner" className="mobile-order-lookup__scanner">
                <BarcodeScanner
                  reticleShape="qr"
                  eyebrow="Scan order code"
                  onScan={handleCameraScan}
                  paused={isNavigating}
                  hideManualEntry
                />
              </div>
            )}
          </div>

          <div className="mobile-order-lookup__right">
            <div
              className="mobile-order-lookup__feedback"
              role="status"
              aria-live="polite"
            >
              {state.kind === 'searching' && <p>Searching…</p>}
              {state.kind === 'navigating' && (
                <div className="mobile-order-lookup__navigating">
                  <Checkbloom visible itemName="Order" remaining={0} />
                  <p>Opening order…</p>
                </div>
              )}
              {state.kind === 'no-matches' && (
                <div className="mobile-order-lookup__empty">
                  <Seed emptyMessage="Nothing matches that filter." size={72} />
                  <MobileGhostButton onClick={handleClear}>
                    Clear filters
                  </MobileGhostButton>
                </div>
              )}
            </div>

            {state.kind === 'matches' && (
              <>
                {state.capped && (
                  <p className="mobile-order-lookup__hint">
                    Showing first 20 — refine your search.
                  </p>
                )}
                <ul
                  className="mobile-order-lookup__list"
                  aria-label="Matching orders"
                >
                  {state.orders.map((order) => (
                    <li key={order.id}>
                      <ResultCard
                        order={order}
                        canScan={canScan}
                        onOpenScan={() =>
                          navigate(`/mobile/pickup/${order.id}`)
                        }
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .mobile-order-lookup {
          min-height: 100svh;
          padding: 24px 16px;
          box-sizing: border-box;
        }
        .mobile-order-lookup__inner {
          display: flex;
          flex-direction: column;
          gap: 18px;
          max-width: 1080px;
          margin: 0 auto;
        }
        .mobile-order-lookup__eyebrow {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-hawk-500, #7d52a0);
        }
        .mobile-order-lookup__title {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 24px;
          font-weight: 700;
          color: var(--color-hawk-900, #1e0a35);
          margin: 4px 0 0;
        }
        @media (min-width: 768px) {
          .mobile-order-lookup__title {
            font-size: 26px;
          }
        }
        .mobile-order-lookup__layout {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        @media (min-width: 768px) {
          .mobile-order-lookup__layout {
            flex-direction: row;
            align-items: flex-start;
          }
          .mobile-order-lookup__left,
          .mobile-order-lookup__right {
            flex: 1 1 0;
            min-width: 0;
          }
        }
        .mobile-order-lookup__left,
        .mobile-order-lookup__right {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .mobile-order-lookup__retry {
          background: var(--color-gold-50, #fffbeb);
          border: 1px solid var(--color-gold-300, #f0c84a);
          border-radius: var(--mobile-radius, 16px);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .mobile-order-lookup__retry-msg {
          margin: 0;
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 14px;
          color: var(--color-hawk-800, #2d1152);
        }
        .mobile-order-lookup__warn {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--color-gold-50, #fffbf0);
          border: 1px solid var(--color-gold-300, #f0c84a);
          color: var(--color-hawk-800, #2d1152);
        }
        .mobile-order-lookup__scanner {
          margin-top: 4px;
        }
        .mobile-order-lookup__feedback p {
          font-family: var(--font-body, "Manrope", sans-serif);
          color: var(--color-hawk-700, #441d55);
          margin: 0;
        }
        .mobile-order-lookup__navigating {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
        }
        .mobile-order-lookup__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px;
          text-align: center;
        }
        .mobile-order-lookup__hint {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 12px;
          color: var(--color-hawk-500, #7d52a0);
          margin: 0 0 6px;
        }
        .mobile-order-lookup__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
      `}</style>
    </div>
  );
}

interface ResultCardProps {
  order: Order;
  canScan: boolean;
  onOpenScan: () => void;
}

function ResultCard({ order, canScan, onOpenScan }: ResultCardProps) {
  const fulfilled = order.lines.reduce((sum, l) => sum + (l.qtyFulfilled ?? 0), 0);
  const total = order.lines.reduce((sum, l) => sum + (l.qtyOrdered ?? 0), 0);
  const itemCount = order.lines.length;

  return (
    <div className="lookup-card">
      <div className="lookup-card__row">
        <span className="lookup-card__number">#{order.orderNumber}</span>
        <span
          className={`lookup-card__pill lookup-card__pill--${order.status.toLowerCase()}`}
        >
          {order.status}
        </span>
      </div>
      <div className="lookup-card__name">{order.customerDisplayName}</div>
      <div className="lookup-card__meta">
        <span className="lookup-card__progress">
          {fulfilled} of {total}
        </span>
        {itemCount > 0 && (
          <span className="lookup-card__items">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>
      <div className="lookup-card__action">
        {canScan ? (
          <MobileGoldButton onClick={onOpenScan} aria-label={`Open scan for ${order.orderNumber}`}>
            Open Scan
          </MobileGoldButton>
        ) : (
          <MobileGhostButton aria-label={`View order ${order.orderNumber}`} disabled>
            View Order
          </MobileGhostButton>
        )}
      </div>

      <style>{`
        .lookup-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px;
          border-radius: var(--mobile-radius, 16px);
          background: white;
          border: 1px solid var(--joy-rule, #e8e0f0);
          min-height: var(--mobile-touch-min, 56px);
        }
        .lookup-card__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .lookup-card__number {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 18px;
          font-weight: 700;
          color: var(--color-hawk-900, #1e0a35);
        }
        .lookup-card__name {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-weight: 600;
          font-size: 15px;
          color: var(--color-hawk-700, #441d55);
        }
        .lookup-card__meta {
          display: flex;
          gap: 12px;
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 13px;
          color: var(--color-hawk-500, #7d52a0);
        }
        .lookup-card__progress {
          font-variant-numeric: tabular-nums;
        }
        .lookup-card__pill {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--color-gold-50, #fffbf0);
          color: var(--color-hawk-700, #441d55);
        }
        .lookup-card__action {
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}
