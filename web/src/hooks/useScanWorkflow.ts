import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Order } from '@/types/order.js';
import type { ScanResponse } from '@/types/fulfillment.js';
import type {
  ScanSessionResponse,
  ScanSessionScanResponse,
} from '@/types/scanSession.js';
import { ordersApi } from '@/api/orders.js';
import { fulfillmentApi } from '@/api/fulfillment.js';
import { scanSessionsApi } from '@/api/scanSessions.js';
import type { ScanHistoryEntry } from '@/components/pickup/ScanHistoryList.js';
import { getScanDisplayFields, getScanResultMessage } from '@/components/pickup/scanFeedbackText.js';
import { toScanLookupValue } from '@/utils/barcode.js';

// SS-13: useScanWorkflow is parameterized for two operating modes.
// - 'order': legacy per-order pickup scan flow (PickupScanPage). API calls
//   route through fulfillmentApi against `/orders/{id}/...` endpoints.
// - 'session': pick-list multi-order session flow (PickupScanSessionPage).
//   API calls route through scanSessionsApi against `/scan-sessions/{id}/...`
//   endpoints. Undo and order refresh are no-ops in this mode for v1; the
//   session response is the source of truth.
//
// The legacy single-argument signature `useScanWorkflow(orderId)` is preserved
// for backwards compatibility with PickupScanPage (callers that pass a string
// or undefined behave exactly as they did pre-SS-13).
export type ScanWorkflowMode = 'order' | 'session';

export interface UseScanWorkflowOptions {
  mode: ScanWorkflowMode;
  id: string | undefined;
}

interface ScanWorkflowState {
  currentOrder: Order | null;
  currentSession: ScanSessionResponse | null;
  scanHistory: ScanHistoryEntry[];
  lastScanResult: ScanResponse | null;
  lastSessionScanResult: ScanSessionScanResponse | null;
  isScanning: boolean;
  isLoading: boolean;
  networkError: string | null;
}

function normalizeOptions(
  optionsOrOrderId: UseScanWorkflowOptions | string | undefined,
): UseScanWorkflowOptions {
  if (typeof optionsOrOrderId === 'object' && optionsOrOrderId !== null) {
    return optionsOrOrderId;
  }
  return { mode: 'order', id: optionsOrOrderId };
}

export function useScanWorkflow(orderId: string | undefined): UseOrderScanWorkflowReturn;
export function useScanWorkflow(options: UseScanWorkflowOptions): UseScanWorkflowReturn;
export function useScanWorkflow(
  optionsOrOrderId: UseScanWorkflowOptions | string | undefined,
): UseScanWorkflowReturn {
  const opts = normalizeOptions(optionsOrOrderId);
  const { mode, id } = opts;

  const [state, setState] = useState<ScanWorkflowState>({
    currentOrder: null,
    currentSession: null,
    scanHistory: [],
    lastScanResult: null,
    lastSessionScanResult: null,
    isScanning: false,
    isLoading: false,
    networkError: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Holds the scan id of the most recent submission that did not complete, so a
  // retry of that same barcode+quantity reuses it instead of counting twice.
  const pendingScanRef = useRef<{ key: string; scanId: string } | null>(null);

  // Monotonic counter for order/session fetches. loadOrder, refreshOrder and the
  // 10 s poll all write currentOrder/currentSession; without ordering, a poll
  // that was issued before a scan but resolved after the post-scan refresh
  // overwrote the fresh quantities with stale ones, and the volunteer watched a
  // just-fulfilled line flip back to unfulfilled. Any response older than the
  // latest issued request is discarded. Writers that carry the newest server
  // state by other means (scan-in-session, close) also bump the counter so
  // in-flight polls from before them are dropped too.
  const fetchSeqRef = useRef(0);
  const nextFetchSeq = useCallback(() => ++fetchSeqRef.current, []);
  const isLatestFetch = useCallback((seq: number) => seq === fetchSeqRef.current, []);

  const loadOrder = useCallback(async () => {
    if (mode !== 'order' || !id) return;
    const seq = nextFetchSeq();
    setState((s) => ({ ...s, isLoading: true, networkError: null }));
    try {
      const order = await ordersApi.getById(id);
      if (!isLatestFetch(seq)) return;
      setState((s) => ({ ...s, currentOrder: order, isLoading: false, networkError: null }));
    } catch (e) {
      if (!isLatestFetch(seq)) return;
      setState((s) => ({
        ...s,
        isLoading: false,
        networkError: e instanceof Error ? e.message : 'Failed to load order',
      }));
    }
  }, [mode, id, nextFetchSeq, isLatestFetch]);

  const loadSession = useCallback(async () => {
    if (mode !== 'session' || !id) return;
    const seq = nextFetchSeq();
    setState((s) => ({ ...s, isLoading: true, networkError: null }));
    try {
      const session = await scanSessionsApi.get(id);
      if (!isLatestFetch(seq)) return;
      setState((s) => ({ ...s, currentSession: session, isLoading: false, networkError: null }));
    } catch (e) {
      if (!isLatestFetch(seq)) return;
      setState((s) => ({
        ...s,
        isLoading: false,
        networkError: e instanceof Error ? e.message : 'Failed to load session',
      }));
    }
  }, [mode, id, nextFetchSeq, isLatestFetch]);

  const refreshOrder = useCallback(async () => {
    if (mode !== 'order' || !id) return;
    const seq = nextFetchSeq();
    try {
      const order = await ordersApi.getById(id);
      if (!isLatestFetch(seq)) return;
      setState((s) => ({ ...s, currentOrder: order, networkError: null }));
    } catch (e) {
      if (!isLatestFetch(seq)) return;
      setState((s) => ({
        ...s,
        networkError: e instanceof Error ? e.message : 'Failed to refresh order',
      }));
    }
  }, [mode, id, nextFetchSeq, isLatestFetch]);

  const refreshSession = useCallback(async () => {
    if (mode !== 'session' || !id) return;
    const seq = nextFetchSeq();
    try {
      const session = await scanSessionsApi.get(id);
      if (!isLatestFetch(seq)) return;
      setState((s) => ({ ...s, currentSession: session, networkError: null }));
    } catch (e) {
      if (!isLatestFetch(seq)) return;
      setState((s) => ({
        ...s,
        networkError: e instanceof Error ? e.message : 'Failed to refresh session',
      }));
    }
  }, [mode, id, nextFetchSeq, isLatestFetch]);

  const scan = useCallback(
    async (barcode: string, quantity: number = 1): Promise<ScanResponse | null> => {
      if (mode !== 'order' || !id) return null;
      const lookupBarcode = toScanLookupValue(barcode) || barcode;
      // Multi-quantity scanning: pass the volunteer-set quantity through.
      // Defaults to 1 so callers that don't care about multi-qty stay unchanged.
      const qty = quantity > 0 ? quantity : 1;

      // Retry-stable scan id. A submission that fails (timeout, dropped LAN) may
      // still have been applied server-side, so re-scanning the same barcode and
      // quantity reuses the id and the server recognises the replay. The id is
      // cleared on any completed response, so a deliberate second scan of the same
      // item gets a fresh id and fulfills normally.
      const attemptKey = `${lookupBarcode}|${qty}`;
      const scanId =
        pendingScanRef.current?.key === attemptKey
          ? pendingScanRef.current.scanId
          : crypto.randomUUID();
      pendingScanRef.current = { key: attemptKey, scanId };

      setState((s) => ({ ...s, isScanning: true, networkError: null }));
      try {
        const result = await fulfillmentApi.scan(id, { barcode: lookupBarcode, quantity: qty, scanId });
        pendingScanRef.current = null;
        const { plantName } = getScanDisplayFields(result);
        const entry: ScanHistoryEntry = {
          barcode,
          result: result.result,
          message: getScanResultMessage(result),
          plantName,
          timestamp: Date.now(),
        };
        setState((s) => ({
          ...s,
          lastScanResult: result,
          scanHistory: [entry, ...s.scanHistory].slice(0, 3),
          isScanning: false,
        }));
        await refreshOrder();
        return result;
      } catch (e) {
        setState((s) => ({
          ...s,
          isScanning: false,
          networkError: e instanceof Error ? e.message : 'Scan failed',
        }));
        return null;
      }
    },
    [mode, id, refreshOrder],
  );

  const scanInSession = useCallback(
    async (barcode: string, quantity: number = 1): Promise<ScanSessionScanResponse | null> => {
      if (mode !== 'session' || !id) return null;
      const lookupBarcode = toScanLookupValue(barcode) || barcode;
      // Multi-quantity session scanning: pass the volunteer-set quantity. The
      // backend distributes it across pending lines (oldest order first).
      const qty = quantity > 0 ? quantity : 1;
      setState((s) => ({ ...s, isScanning: true, networkError: null }));
      try {
        const result = await scanSessionsApi.scan(id, { plantBarcode: lookupBarcode, quantity: qty });
        const entry: ScanHistoryEntry = {
          barcode,
          // ScanSessionResult shares 'Accepted' | 'AlreadyFulfilled' |
          // 'NotFound' | 'OutOfStock' | 'SaleClosedBlocked' values with
          // FulfillmentResultType. The session-only 'NotInSession' and
          // 'Expired' values are coerced to 'WrongOrder' / 'NotFound' for
          // ScanHistoryList styling, while the banner uses the canonical
          // session result for messaging.
          result:
            result.result === 'NotInSession'
              ? 'WrongOrder'
              : result.result === 'Expired'
                ? 'NotFound'
                : result.result,
          message: result.message ?? '',
          plantName: result.plant?.name,
          timestamp: Date.now(),
        };
        // The scan response carries the newest session state; retire any poll
        // that was already in flight so it cannot overwrite this.
        nextFetchSeq();
        setState((s) => ({
          ...s,
          currentSession: result.session,
          lastSessionScanResult: result,
          scanHistory: [entry, ...s.scanHistory].slice(0, 3),
          isScanning: false,
        }));
        return result;
      } catch (e) {
        setState((s) => ({
          ...s,
          isScanning: false,
          networkError: e instanceof Error ? e.message : 'Scan failed',
        }));
        return null;
      }
    },
    [mode, id, nextFetchSeq],
  );

  const undoLastScan = useCallback(async (reason?: string, operator = 'Pickup Operator') => {
    if (mode !== 'order' || !id) return null;
    setState((s) => ({ ...s, isScanning: true, networkError: null }));
    try {
      const result = reason
        ? await fulfillmentApi.undoLastScanWithReason(id, reason, operator)
        : await fulfillmentApi.undoLastScan(id);
      const { plantName } = getScanDisplayFields(result);
      const entry: ScanHistoryEntry = {
        barcode: 'UNDO',
        result: result.result,
        message: getScanResultMessage(result),
        plantName,
        timestamp: Date.now(),
      };
      setState((s) => ({
        ...s,
        lastScanResult: result,
        scanHistory: [entry, ...s.scanHistory].slice(0, 3),
        isScanning: false,
      }));
      await refreshOrder();
      return result;
    } catch (e) {
      setState((s) => ({
        ...s,
        isScanning: false,
        networkError: e instanceof Error ? e.message : 'Undo failed',
      }));
      return null;
    }
  }, [mode, id, refreshOrder]);

  const closeSession = useCallback(async () => {
    if (mode !== 'session' || !id) return null;
    try {
      const session = await scanSessionsApi.close(id);
      nextFetchSeq();
      setState((s) => ({ ...s, currentSession: session, networkError: null }));
      return session;
    } catch (e) {
      setState((s) => ({
        ...s,
        networkError: e instanceof Error ? e.message : 'Close session failed',
      }));
      return null;
    }
  }, [mode, id, nextFetchSeq]);

  const addHistoryEntry = useCallback((entry: ScanHistoryEntry) => {
    setState((s) => ({
      ...s,
      scanHistory: [entry, ...s.scanHistory].slice(0, 10),
    }));
  }, []);

  const clearNetworkError = useCallback(() => {
    setState((s) => ({ ...s, networkError: null }));
  }, []);

  const setLastScanResult = useCallback((result: ScanResponse | null) => {
    setState((s) => ({ ...s, lastScanResult: result }));
  }, []);

  // Initial load -- per-mode dispatch.
  useEffect(() => {
    if (mode === 'order') {
      void loadOrder();
    } else {
      void loadSession();
    }
  }, [mode, loadOrder, loadSession]);

  // Auto-refresh every 10 seconds for both modes.
  useEffect(() => {
    if (!id) return;
    intervalRef.current = setInterval(() => {
      if (mode === 'order') {
        void refreshOrder();
      } else {
        void refreshSession();
      }
    }, 10000);
    return () => clearInterval(intervalRef.current);
  }, [mode, id, refreshOrder, refreshSession]);

  // Stable return surface. Order-mode callers continue to consume the
  // existing fields. Session-mode callers get currentSession +
  // scanInSession + closeSession + refreshSession on top.
  return useMemo(
    () => ({
      ...state,
      mode,
      loadOrder,
      loadSession,
      scan,
      scanInSession,
      undoLastScan,
      refreshOrder,
      refreshSession,
      closeSession,
      clearNetworkError,
      setLastScanResult,
      addHistoryEntry,
    }),
    [
      state,
      mode,
      loadOrder,
      loadSession,
      scan,
      scanInSession,
      undoLastScan,
      refreshOrder,
      refreshSession,
      closeSession,
      clearNetworkError,
      setLastScanResult,
      addHistoryEntry,
    ],
  );
}

// SS-13: Explicit return shapes so PickupScanPage (order mode) keeps a
// stable consumer surface even after the session mode parameterization.
type UseScanWorkflowSharedReturn = {
  scanHistory: ScanHistoryEntry[];
  isScanning: boolean;
  isLoading: boolean;
  networkError: string | null;
  addHistoryEntry: (entry: ScanHistoryEntry) => void;
  clearNetworkError: () => void;
};

export interface UseOrderScanWorkflowReturn extends UseScanWorkflowSharedReturn {
  mode: ScanWorkflowMode;
  currentOrder: Order | null;
  currentSession: ScanSessionResponse | null;
  lastScanResult: ScanResponse | null;
  lastSessionScanResult: ScanSessionScanResponse | null;
  loadOrder: () => Promise<void>;
  loadSession: () => Promise<void>;
  scan: (barcode: string, quantity?: number) => Promise<ScanResponse | null>;
  scanInSession: (barcode: string, quantity?: number) => Promise<ScanSessionScanResponse | null>;
  undoLastScan: (reason?: string, operator?: string) => Promise<ScanResponse | null>;
  refreshOrder: () => Promise<void>;
  refreshSession: () => Promise<void>;
  closeSession: () => Promise<ScanSessionResponse | null>;
  setLastScanResult: (result: ScanResponse | null) => void;
}

export type UseScanWorkflowReturn = UseOrderScanWorkflowReturn;
