import { useState, useCallback, useRef, useEffect } from 'react';
import type { Order } from '@/types/order.js';
import type { ScanResponse } from '@/types/fulfillment.js';
import { ordersApi } from '@/api/orders.js';
import { fulfillmentApi } from '@/api/fulfillment.js';
import type { ScanHistoryEntry } from '@/components/pickup/ScanHistoryList.js';
import { getScanDisplayFields, getScanResultMessage } from '@/components/pickup/scanFeedbackText.js';

interface ScanWorkflowState {
  currentOrder: Order | null;
  scanHistory: ScanHistoryEntry[];
  lastScanResult: ScanResponse | null;
  isScanning: boolean;
  isLoading: boolean;
  networkError: string | null;
}

export function useScanWorkflow(orderId: string | undefined) {
  const [state, setState] = useState<ScanWorkflowState>({
    currentOrder: null,
    scanHistory: [],
    lastScanResult: null,
    isScanning: false,
    isLoading: false,
    networkError: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setState((s) => ({ ...s, isLoading: true, networkError: null }));
    try {
      const order = await ordersApi.getById(orderId);
      setState((s) => ({ ...s, currentOrder: order, isLoading: false, networkError: null }));
    } catch (e) {
      setState((s) => ({
        ...s,
        isLoading: false,
        networkError: e instanceof Error ? e.message : 'Failed to load order',
      }));
    }
  }, [orderId]);

  const refreshOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const order = await ordersApi.getById(orderId);
      setState((s) => ({ ...s, currentOrder: order, networkError: null }));
    } catch (e) {
      setState((s) => ({
        ...s,
        networkError: e instanceof Error ? e.message : 'Failed to refresh order',
      }));
    }
  }, [orderId]);

  const scan = useCallback(
    async (barcode: string): Promise<ScanResponse | null> => {
      if (!orderId) return null;
      setState((s) => ({ ...s, isScanning: true, networkError: null }));
      try {
        const result = await fulfillmentApi.scan(orderId, { barcode });
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
    [orderId, refreshOrder],
  );

  const undoLastScan = useCallback(async (reason?: string, operator = 'Pickup Operator') => {
    if (!orderId) return null;
    setState((s) => ({ ...s, isScanning: true, networkError: null }));
    try {
      const result = reason
        ? await fulfillmentApi.undoLastScanWithReason(orderId, reason, operator)
        : await fulfillmentApi.undoLastScan(orderId);
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
  }, [orderId, refreshOrder]);


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

  // Initial load
  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!orderId) return;
    intervalRef.current = setInterval(refreshOrder, 10000);
    return () => clearInterval(intervalRef.current);
  }, [orderId, refreshOrder]);

  return {
    ...state,
    loadOrder,
    scan,
    undoLastScan,
    refreshOrder,
    clearNetworkError,
    setLastScanResult,
    addHistoryEntry,
  };
}
