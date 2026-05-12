import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '../../api/orders.js';
import { ScanInputShell } from '../../components/mobile/ScanInputShell.js';
import { BarcodeScanner } from '../../components/mobile/BarcodeScanner.js';
import { MobileAccessDeniedScene } from '../../components/mobile/MobileAccessDeniedScene.js';
import { Seed } from '../../components/mobile/joy/Seed.js';
import { useAuthStore } from '../../stores/authStore.js';
import type { Order } from '../../types/order.js';
import type { NormalizedScanResult } from '../../types/scanner.js';
import {
  classifyMobileScanInput,
  selectExactOrderMatch,
} from './pickupScanLogic.js';
import { normalizeOrderLookupValue } from '../../utils/orderLookup.js';

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 20;

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'too-many' }
  | { kind: 'matches'; orders: Order[] }
  | { kind: 'no-matches' }
  | { kind: 'wrong-code-type' }
  | { kind: 'error'; message: string };

export function MobilePickupLookupPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const hasPickupAccess = useMemo(
    () => !!currentUser?.roles.some((r) => r === 'Pickup' || r === 'Admin'),
    [currentUser],
  );

  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [state, setState] = useState<LookupState>({ kind: 'idle' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

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

        const total = response.totalCount ?? response.items.length;
        if (total > PAGE_SIZE) {
          setState({ kind: 'too-many' });
          return;
        }

        if (response.items.length === 0) {
          setState({ kind: 'no-matches' });
          return;
        }

        const exact = selectExactOrderMatch(response.items, trimmed);
        if (exact) {
          navigate(`/mobile/pickup/${exact.id}`);
          return;
        }

        setState({ kind: 'matches', orders: response.items });
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        const message = err instanceof Error ? err.message : 'Lookup failed';
        setState({ kind: 'error', message });
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
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
  }, [value, performLookup]);

  const handleCameraScan = useCallback(
    (result: NormalizedScanResult) => {
      // eslint-disable-next-line no-console
      console.debug('mobile-pickup-scan', {
        page: 'lookup',
        source: result.source,
        scannedAtUtc: result.scannedAtUtc,
      });
      const classification = classifyMobileScanInput(result.code);
      if (classification === 'item-barcode') {
        setState({ kind: 'wrong-code-type' });
        return;
      }
      setValue(result.code);
      void performLookup(result.code);
    },
    [performLookup],
  );

  const isNavigating = state.kind === 'searching';

  if (!hasPickupAccess) {
    return <MobileAccessDeniedScene />;
  }

  return (
    <div className="mobile-pickup-lookup mobile-page-bg">
      <div className="mobile-pickup-lookup__inner">
        <header className="mobile-pickup-lookup__header">
          <h1 className="mobile-pickup-lookup__title">Pickup</h1>
          <p className="mobile-pickup-lookup__subtitle">
            Scan an order code or type the order number.
          </p>
        </header>

        <BarcodeScanner
          reticleShape="qr"
          eyebrow="Scan order code"
          onScan={handleCameraScan}
          paused={isNavigating}
          hideManualEntry
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void performLookup(value);
          }}
        >
          <ScanInputShell
            label="Order lookup"
            hint="Type or scan an order code, then press Enter."
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            placeholder="Order number"
            inputMode="search"
            autoFocus
            aria-label="Order number lookup"
          />
        </form>

        <div className="mobile-pickup-lookup__feedback" role="status" aria-live="polite">
          {state.kind === 'searching' && <p>Searching…</p>}
          {state.kind === 'wrong-code-type' && (
            <div className="mobile-pickup-lookup__warn" role="alert">
              Wrong code type — scan an order code or type the order number.
            </div>
          )}
          {state.kind === 'too-many' && (
            <div className="mobile-pickup-lookup__warn">
              Too many matches — please refine your search.
            </div>
          )}
          {state.kind === 'no-matches' && (
            <div className="mobile-pickup-lookup__empty">
              <Seed emptyMessage="No orders match yet" size={64} />
              <p>Manual entry stays available — keep typing or scan an order code.</p>
            </div>
          )}
          {state.kind === 'error' && (
            <div className="mobile-pickup-lookup__warn" role="alert">
              {state.message}
            </div>
          )}
        </div>

        {state.kind === 'matches' && (
          <ul className="mobile-pickup-lookup__list" aria-label="Matching orders">
            {state.orders.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  className="mobile-pickup-lookup__card"
                  onClick={() => navigate(`/mobile/pickup/${order.id}`)}
                >
                  <span className="mobile-pickup-lookup__card-number">
                    #{order.orderNumber}
                  </span>
                  <span className="mobile-pickup-lookup__card-name">
                    {order.customerDisplayName}
                  </span>
                  <span className={`mobile-pickup-lookup__pill mobile-pickup-lookup__pill--${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .mobile-pickup-lookup {
          min-height: 100svh;
          padding: 24px 16px;
          box-sizing: border-box;
        }
        .mobile-pickup-lookup__inner {
          display: flex;
          flex-direction: column;
          gap: 18px;
          max-width: 560px;
          margin: 0 auto;
        }
        .mobile-pickup-lookup__title {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 28px;
          font-weight: 700;
          color: var(--color-hawk-800, #2d1152);
          margin: 0;
        }
        .mobile-pickup-lookup__subtitle {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 14px;
          color: var(--color-hawk-600, #4b2e6e);
          margin: 4px 0 0;
        }
        .mobile-pickup-lookup__feedback p {
          font-family: var(--font-body, "Manrope", sans-serif);
          color: var(--color-hawk-700, #441d55);
          margin: 0;
        }
        .mobile-pickup-lookup__warn {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--color-gold-50, #fffbf0);
          border: 1px solid var(--color-gold-300, #f0c84a);
          color: var(--color-hawk-800, #2d1152);
        }
        .mobile-pickup-lookup__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px;
          text-align: center;
        }
        .mobile-pickup-lookup__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mobile-pickup-lookup__card {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          width: 100%;
          min-height: var(--mobile-touch-min, 56px);
          padding: 12px 14px;
          border-radius: var(--mobile-radius, 16px);
          background: white;
          border: 1px solid var(--joy-rule, #e8e0f0);
          font-family: var(--font-body, "Manrope", sans-serif);
          text-align: left;
          cursor: pointer;
        }
        .mobile-pickup-lookup__card:active {
          transform: translateY(1px);
        }
        .mobile-pickup-lookup__card-number {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 18px;
          font-weight: 700;
          color: var(--color-hawk-800, #2d1152);
        }
        .mobile-pickup-lookup__card-name {
          font-weight: 600;
          color: var(--color-hawk-700, #441d55);
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mobile-pickup-lookup__pill {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--color-hawk-50, #f5f0fa);
          color: var(--color-hawk-700, #441d55);
        }
      `}</style>
    </div>
  );
}
