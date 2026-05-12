import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../../api/orders.js';
import { fulfillmentApi } from '../../api/fulfillment.js';
import { ScanInputShell } from '../../components/mobile/ScanInputShell.js';
import { BarcodeScanner } from '../../components/mobile/BarcodeScanner.js';
import { MobileAccessDeniedScene } from '../../components/mobile/MobileAccessDeniedScene.js';
import { MobileConnectionRequiredScene } from '../../components/mobile/MobileConnectionRequiredScene.js';
import { Checkbloom } from '../../components/mobile/joy/Checkbloom.js';
import { Stamp } from '../../components/mobile/joy/Stamp.js';
import { JoyAriaLive, useJoyAnnounce } from '../../components/mobile/joy/JoyAriaLive.js';
import { MobilePrimaryButton } from '../../components/mobile/buttons/MobilePrimaryButton.js';
import { MobileGhostButton } from '../../components/mobile/buttons/MobileGhostButton.js';
import { useAuthStore } from '../../stores/authStore.js';
import {
  getScanDisplayFields,
  getScanResultMessage,
} from '../../components/pickup/scanFeedbackText.js';
import type { Order } from '../../types/order.js';
import type { ScanResponse } from '../../types/fulfillment.js';
import type { NormalizedScanResult, ScanSource } from '../../types/scanner.js';
import { classifyMobileScanInput } from './pickupScanLogic.js';
import { isExactOrderNumberMatch } from '../../utils/orderLookup.js';

const ACCEPTED_SCENE_DURATION_MS = 900;

interface PendingScan {
  barcode: string;
  source: ScanSource;
}

type SceneState =
  | { kind: 'ready' }
  | { kind: 'in-flight' }
  | { kind: 'accepted'; response: ScanResponse }
  | { kind: 'recoverable'; response: ScanResponse }
  | { kind: 'complete' }
  | { kind: 'danger'; message: string };

function isAuthError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { status?: number; response?: { status?: number } };
  return e.status === 401 || e.response?.status === 401;
}

function isNetworkError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; message?: string; response?: unknown };
  if (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED') return true;
  if (e.response === undefined && typeof e.message === 'string' && /network/i.test(e.message)) return true;
  return false;
}

export function MobilePickupScanPageInner() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId ?? '';
  const navigate = useNavigate();
  const location = useLocation();
  const announce = useJoyAnnounce();

  const currentUser = useAuthStore((s) => s.currentUser);
  const hasPickupAccess = useMemo(
    () => !!currentUser?.roles.some((r) => r === 'Pickup' || r === 'Admin'),
    [currentUser],
  );

  const [order, setOrder] = useState<Order | null>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [scene, setScene] = useState<SceneState>({ kind: 'ready' });
  const [manualValue, setManualValue] = useState('');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
  );
  const lastPendingRef = useRef<PendingScan | null>(null);
  const acceptedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Online/offline tracking (SS-05)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load order on mount / orderId change
  useEffect(() => {
    if (!orderId) {
      setOrderLoading(false);
      setOrderError('Missing order id');
      return;
    }
    let cancelled = false;
    setOrderLoading(true);
    setOrderError(null);
    ordersApi
      .getById(orderId)
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        setOrderLoading(false);
        if (o.status === 'Complete') setScene({ kind: 'complete' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOrderLoading(false);
        const message = err instanceof Error ? err.message : 'Order not found';
        setOrderError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Auto-dismiss accepted scene after ~900ms
  useEffect(() => {
    if (scene.kind !== 'accepted') return;
    if (acceptedTimerRef.current) clearTimeout(acceptedTimerRef.current);
    acceptedTimerRef.current = setTimeout(() => {
      setScene((s) => (s.kind === 'accepted' ? { kind: 'ready' } : s));
    }, ACCEPTED_SCENE_DURATION_MS);
    return () => {
      if (acceptedTimerRef.current) clearTimeout(acceptedTimerRef.current);
    };
  }, [scene]);

  const refreshOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const fresh = await ordersApi.getById(orderId);
      setOrder(fresh);
      if (fresh.status === 'Complete') setScene({ kind: 'complete' });
    } catch {
      // non-fatal — leave existing order in view
    }
  }, [orderId]);

  const submitScan = useCallback(
    async (pending: PendingScan) => {
      if (!orderId) return;
      lastPendingRef.current = pending;
      // Audit telemetry stopgap (REQ-021).
      // eslint-disable-next-line no-console
      console.debug('mobile-pickup-scan', {
        orderId,
        source: pending.source,
        scannedAtUtc: new Date().toISOString(),
      });

      setScene({ kind: 'in-flight' });
      try {
        const response = await fulfillmentApi.scan(orderId, {
          barcode: pending.barcode,
          quantity: 1,
        });

        const result = response.result;
        if (result === 'Accepted') {
          // Update local order from server-truth: refresh full order after every accept,
          // since ScanResponse only carries the changed line.
          await refreshOrder();
          // After refresh, decide between accepted vs complete.
          // If refresh set scene to 'complete' (status === 'Complete'), keep it.
          setScene((current) => (current.kind === 'complete' ? current : { kind: 'accepted', response }));
          announce(getScanResultMessage(response), { politeness: 'polite' });
          return;
        }

        if (
          result === 'AlreadyFulfilled' ||
          result === 'WrongOrder' ||
          result === 'NotFound' ||
          result === 'OutOfStock'
        ) {
          setScene({ kind: 'recoverable', response });
          announce(getScanResultMessage(response), { politeness: 'assertive' });
          return;
        }

        if (result === 'SaleClosedBlocked') {
          setScene({ kind: 'danger', message: 'Sale is closed. Scanning is blocked.' });
          return;
        }

        // Unknown result — treat as danger.
        setScene({ kind: 'danger', message: getScanResultMessage(response) || 'Unexpected response' });
      } catch (err: unknown) {
        if (isAuthError(err)) {
          navigate('/login', { state: { from: location.pathname } });
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setIsOnline(false);
          setScene({ kind: 'ready' });
          return;
        }
        const message =
          isNetworkError(err)
            ? 'We could not reach the server. Please retry.'
            : err instanceof Error
              ? err.message
              : 'Unexpected error';
        setScene({ kind: 'danger', message });
      }
    },
    [orderId, refreshOrder, announce, navigate, location.pathname],
  );

  const retryLast = useCallback(() => {
    if (lastPendingRef.current) {
      void submitScan(lastPendingRef.current);
    } else {
      setScene({ kind: 'ready' });
    }
  }, [submitScan]);

  const handleManualSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = manualValue.trim();
    if (!trimmed) return;
    setManualValue('');
    void submitScan({ barcode: trimmed, source: 'manual-entry' });
  };

  const [wrongCodeType, setWrongCodeType] = useState(false);
  const handleCameraScan = useCallback(
    (result: NormalizedScanResult) => {
      // eslint-disable-next-line no-console
      console.debug('mobile-pickup-scan', {
        page: 'scan',
        orderId,
        source: result.source,
        scannedAtUtc: result.scannedAtUtc,
      });
      const classification = classifyMobileScanInput(result.code);
      // If it's clearly order-shaped AND not the current order, treat as wrong code type.
      // Otherwise, defer to the backend (WrongOrder result handles cross-order rejection).
      if (
        classification === 'order-number' &&
        order &&
        !isExactOrderNumberMatch(order.orderNumber, result.code)
      ) {
        setWrongCodeType(true);
        return;
      }
      setWrongCodeType(false);
      void submitScan({ barcode: result.code, source: result.source });
    },
    [order, submitScan],
  );

  const dismissRecoverable = () => {
    setScene({ kind: 'ready' });
  };

  // Role gate
  if (!hasPickupAccess) {
    return <MobileAccessDeniedScene />;
  }

  // Offline scene (SS-05)
  if (!isOnline) {
    return <MobileConnectionRequiredScene />;
  }

  if (orderLoading) {
    return (
      <div className="mobile-pickup-scan mobile-page-bg" data-testid="mobile-pickup-scan-loading">
        <p>Loading order…</p>
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div className="mobile-pickup-scan mobile-page-bg">
        <div className="mobile-pickup-scan__notfound">
          <h1>Order not found</h1>
          <p>{orderError ?? 'We could not load that order.'}</p>
          <MobileGhostButton onClick={() => navigate('/mobile/pickup')}>
            Back to lookup
          </MobileGhostButton>
        </div>
      </div>
    );
  }

  const totalOrdered = order.lines.reduce((acc, l) => acc + l.qtyOrdered, 0);
  const totalFulfilled = order.lines.reduce((acc, l) => acc + l.qtyFulfilled, 0);
  const inFlight = scene.kind === 'in-flight';

  return (
    <div className="mobile-pickup-scan mobile-page-bg" data-orderid={order.id}>
      <header className="mobile-pickup-scan__header">
        <div className="mobile-pickup-scan__order-line">
          <span className="mobile-pickup-scan__order-number">#{order.orderNumber}</span>
          <span className={`mobile-pickup-scan__pill mobile-pickup-scan__pill--${order.status.toLowerCase()}`}>
            {order.status}
          </span>
        </div>
        <div className="mobile-pickup-scan__customer">{order.customerDisplayName}</div>
        <div className="mobile-pickup-scan__progress">
          <div
            className="mobile-pickup-scan__progress-bar"
            style={{
              width: `${totalOrdered > 0 ? Math.round((totalFulfilled / totalOrdered) * 100) : 0}%`,
            }}
          />
        </div>
        <div className="mobile-pickup-scan__progress-label tabular-nums">
          {totalFulfilled} of {totalOrdered}
        </div>
      </header>

      {scene.kind === 'complete' ? (
        <div className="mobile-pickup-scan__complete" data-testid="mobile-pickup-complete">
          <Stamp orderNumber={order.orderNumber} />
          <h2 className="mobile-pickup-scan__complete-title">
            #{order.orderNumber} is on its way.
          </h2>
          <div className="mobile-pickup-scan__complete-actions">
            <MobilePrimaryButton onClick={() => navigate('/mobile/pickup')}>
              Open next order
            </MobilePrimaryButton>
            <MobileGhostButton onClick={() => navigate('/mobile/pickup')}>
              Back to lookup
            </MobileGhostButton>
          </div>
        </div>
      ) : (
        <>
          <section className="mobile-pickup-scan__main">
            <p className="mobile-pickup-scan__eyebrow mobile-type-eyebrow">
              Picking for {order.customerDisplayName}
            </p>

            <BarcodeScanner
              reticleShape="1d"
              eyebrow={`Picking for ${order.customerDisplayName}`}
              onScan={handleCameraScan}
              paused={inFlight || scene.kind === 'accepted'}
              hideManualEntry
            />

            {wrongCodeType && (
              <div className="mobile-pickup-scan__warn" role="alert">
                Wrong code type — scan an item barcode for this order.
              </div>
            )}

            <form onSubmit={handleManualSubmit}>
              <ScanInputShell
                label="Manual entry"
                hint="Type or paste a barcode, then press Enter."
                value={manualValue}
                onChange={(e) => setManualValue(e.currentTarget.value)}
                placeholder="Barcode"
                disabled={inFlight}
                aria-label="Manual barcode entry"
              />
            </form>

            {scene.kind === 'in-flight' && (
              <p className="mobile-pickup-scan__status">Submitting…</p>
            )}
          </section>

          {scene.kind === 'accepted' && (() => {
            const fields = getScanDisplayFields(scene.response);
            return (
              <div className="mobile-pickup-scan__accepted" data-testid="mobile-pickup-accepted">
                <Checkbloom
                  visible
                  itemName={fields.plantName ?? 'Item'}
                  remaining={scene.response.orderRemainingItems}
                />
                <h2 className="mobile-pickup-scan__plant">
                  {fields.plantName ?? 'Item'}
                </h2>
                {scene.response.plant?.sku && (
                  <p className="mobile-pickup-scan__sku">{scene.response.plant.sku}</p>
                )}
                <div className="mobile-pickup-scan__remaining-pill">
                  Remaining for this order <strong>{scene.response.orderRemainingItems}</strong>
                </div>
              </div>
            );
          })()}

          {scene.kind === 'recoverable' && (
            <div
              className="mobile-pickup-scan__recoverable"
              role="alert"
              data-testid="mobile-pickup-recoverable"
            >
              <h2>{getScanResultMessage(scene.response)}</h2>
              <MobileGhostButton onClick={dismissRecoverable}>Dismiss</MobileGhostButton>
            </div>
          )}

          {scene.kind === 'danger' && (
            <div
              className="mobile-pickup-scan__danger"
              role="alert"
              data-testid="mobile-pickup-danger"
            >
              <h2>{scene.message || 'Something went wrong'}</h2>
              <div className="mobile-pickup-scan__danger-actions">
                <MobilePrimaryButton onClick={retryLast}>Retry</MobilePrimaryButton>
                <MobileGhostButton onClick={() => navigate('/mobile/pickup')}>
                  Back to lookup
                </MobileGhostButton>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .mobile-pickup-scan {
          min-height: 100svh;
          padding: 16px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .mobile-pickup-scan__header {
          position: sticky;
          top: 0;
          z-index: 5;
          background: var(--joy-paper, #faf7f2);
          padding: 12px 14px;
          border-radius: var(--mobile-radius, 16px);
          border: 1px solid var(--joy-rule, #e8e0f0);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mobile-pickup-scan__order-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .mobile-pickup-scan__order-number {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 22px;
          font-weight: 700;
          color: var(--color-hawk-800, #2d1152);
        }
        .mobile-pickup-scan__customer {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-weight: 600;
          color: var(--color-hawk-700, #441d55);
        }
        .mobile-pickup-scan__pill {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--color-hawk-50, #f5f0fa);
          color: var(--color-hawk-700, #441d55);
        }
        .mobile-pickup-scan__progress {
          height: 8px;
          width: 100%;
          background: var(--color-hawk-50, #f5f0fa);
          border-radius: 999px;
          overflow: hidden;
        }
        .mobile-pickup-scan__progress-bar {
          height: 100%;
          background: linear-gradient(to right, var(--color-gold-400, #d4a021), var(--color-hawk-600, #4b2e6e));
          transition: width 240ms ease-out;
        }
        .mobile-pickup-scan__progress-label {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 13px;
          color: var(--color-hawk-600, #4b2e6e);
        }
        .mobile-pickup-scan__main {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mobile-pickup-scan__eyebrow {
          color: var(--color-hawk-600, #4b2e6e);
        }
        .mobile-pickup-scan__warn {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 14px;
          padding: 10px 12px;
          border-radius: 12px;
          background: var(--color-gold-50, #fffbf0);
          border: 1px solid var(--color-gold-300, #f0c84a);
          color: var(--color-hawk-800, #2d1152);
        }
        .mobile-pickup-scan__status {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 14px;
          color: var(--color-hawk-600, #4b2e6e);
        }
        .mobile-pickup-scan__accepted {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 20px;
          background: white;
          border-radius: var(--mobile-radius, 16px);
          border: 1px solid var(--joy-rule, #e8e0f0);
          text-align: center;
        }
        .mobile-pickup-scan__plant {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 28px;
          font-weight: 700;
          color: var(--color-hawk-800, #2d1152);
          margin: 0;
        }
        .mobile-pickup-scan__sku {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 13px;
          color: var(--color-hawk-600, #4b2e6e);
          margin: 0;
        }
        .mobile-pickup-scan__remaining-pill {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 14px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid var(--color-gold-300, #f0c84a);
          background: var(--color-gold-50, #fffbf0);
          color: var(--color-hawk-800, #2d1152);
        }
        .mobile-pickup-scan__recoverable {
          padding: 16px;
          border-radius: var(--mobile-radius, 16px);
          border: 1px solid var(--color-gold-300, #f0c84a);
          background: linear-gradient(180deg, var(--color-gold-50, #fffbf0), white);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mobile-pickup-scan__recoverable h2 {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 22px;
          color: var(--color-hawk-800, #2d1152);
          margin: 0;
        }
        .mobile-pickup-scan__danger {
          padding: 16px;
          border-radius: var(--mobile-radius, 16px);
          border: 1px solid var(--color-hawk-200, #c4a8e0);
          background: white;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mobile-pickup-scan__danger h2 {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 22px;
          color: var(--color-hawk-800, #2d1152);
          margin: 0;
        }
        .mobile-pickup-scan__danger-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mobile-pickup-scan__complete {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 32px 16px;
          text-align: center;
        }
        .mobile-pickup-scan__complete-title {
          font-family: var(--font-display, "Fraunces", serif);
          font-size: 36px;
          font-weight: 700;
          color: var(--color-hawk-800, #2d1152);
          margin: 0;
        }
        .mobile-pickup-scan__complete-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          max-width: 320px;
        }
        .mobile-pickup-scan__notfound {
          padding: 32px 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }
      `}</style>
    </div>
  );
}

export function MobilePickupScanPage() {
  return (
    <JoyAriaLive>
      <MobilePickupScanPageInner />
    </JoyAriaLive>
  );
}
