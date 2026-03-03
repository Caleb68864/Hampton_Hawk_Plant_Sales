import { useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAudio } from '@/components/shared/AudioFeedback.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { ScanInput, type ScanInputHandle } from '@/components/pickup/ScanInput.js';
import { ScanFeedbackBanner } from '@/components/pickup/ScanFeedbackBanner.js';
import { ItemsRemainingCounter } from '@/components/pickup/ItemsRemainingCounter.js';
import { ScanHistoryList } from '@/components/pickup/ScanHistoryList.js';
import { ManualFulfillModal } from '@/components/pickup/ManualFulfillModal.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { useScanWorkflow } from '@/hooks/useScanWorkflow.js';
import { useAppStore } from '@/stores/appStore.js';
import { useAuthStore } from '@/stores/authStore.js';
import { ordersApi } from '@/api/orders.js';
import { fulfillmentApi } from '@/api/fulfillment.js';
import type { FulfillmentResultType } from '@/types/fulfillment.js';

export function PickupScanPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const audio = useAudio();
  const saleClosed = useAppStore((s) => s.saleClosed);
  const openPinModal = useAuthStore((s) => s.openPinModal);

  const scanInputRef = useRef<ScanInputHandle>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  const {
    currentOrder,
    scanHistory,
    lastScanResult,
    isScanning,
    isLoading,
    networkError,
    scan,
    undoLastScan,
    refreshOrder,
    clearNetworkError,
  } = useScanWorkflow(orderId);

  const refocusScanInput = useCallback(() => {
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }, []);

  function playAudioForResult(result: FulfillmentResultType) {
    if (result === 'Accepted') {
      audio.playSuccess();
    } else if (result === 'AlreadyFulfilled') {
      audio.playWarning();
    } else {
      audio.playError();
    }
  }

  async function handleScan(barcode: string) {
    const result = await scan(barcode);
    if (result) {
      playAudioForResult(result.result);
      // result tracked via lastScanResult in workflow state
    }
    refocusScanInput();
  }

  async function handleUndo() {
    await undoLastScan();
    refocusScanInput();
  }

  async function handleManualFulfill(lineId: string, reason: string) {
    if (!orderId) return;
    try {
      await fulfillmentApi.scan(orderId, { barcode: `MANUAL:${lineId}:${reason}` });
      setShowManualModal(false);
      await refreshOrder();
    } catch {
      // Error handled by scan workflow
    }
    refocusScanInput();
  }

  async function handleComplete() {
    if (!orderId || !currentOrder) return;

    const allFulfilled = currentOrder.lines.every(
      (l) => l.qtyFulfilled >= l.qtyOrdered,
    );

    if (allFulfilled) {
      try {
        await ordersApi.complete(orderId);
        await refreshOrder();
      } catch {
        // error shown via networkError
      }
    } else {
      // Force complete requires admin PIN
      const auth = await openPinModal();
      if (auth) {
        try {
          await ordersApi.complete(orderId, auth.pin, auth.reason);
          await refreshOrder();
        } catch {
          // error shown via networkError
        }
      }
    }
    refocusScanInput();
  }

  function handleManualOpen() {
    setShowManualModal(true);
  }

  function handleManualClose() {
    setShowManualModal(false);
    refocusScanInput();
  }

  if (isLoading && !currentOrder) {
    return <LoadingSpinner message="Loading order..." />;
  }

  if (!currentOrder) {
    return (
      <div className="space-y-4">
        <BackToStationHomeButton />
        <ErrorBanner message="Order not found" />
        <button
          type="button"
          className="text-sm text-hawk-600 hover:text-hawk-800"
          onClick={() => navigate('/station')}
        >
          Back to Station Home
        </button>
      </div>
    );
  }

  const allFulfilled = currentOrder.lines.every(
    (l) => l.qtyFulfilled >= l.qtyOrdered,
  );
  const isComplete = currentOrder.status === 'Complete';

  return (
    <div className="space-y-4">
      <BackToStationHomeButton />
      {/* Order header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-700 mb-1"
            onClick={() => navigate('/station')}
          >
            &larr; Back to Lookup
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            Order {currentOrder.orderNumber}
          </h1>
          <p className="text-sm text-gray-600">
            {currentOrder.customerDisplayName}
            {currentOrder.sellerDisplayName && (
              <span> &middot; Seller: {currentOrder.sellerDisplayName}</span>
            )}
          </p>
        </div>
        <StatusChip status={currentOrder.status} hasIssue={currentOrder.hasIssue} />
      </div>

      {/* Scan feedback banner */}
      <ScanFeedbackBanner
        result={lastScanResult?.result ?? null}
        message={lastScanResult?.message ?? ''}
        plantName={lastScanResult?.plantName}
      />

      {/* Scan input */}
      {!isComplete && (
        <ScanInput
          ref={scanInputRef}
          onScan={handleScan}
          disabled={isScanning}
        />
      )}

      {/* Items remaining counter */}
      <ItemsRemainingCounter lines={currentOrder.lines} />

      {/* Order lines table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plant
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ordered
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fulfilled
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Remaining
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentOrder.lines.map((line) => {
              const remaining = line.qtyOrdered - line.qtyFulfilled;
              const isLastFulfilled =
                lastScanResult?.result === 'Accepted' &&
                lastScanResult?.plantName === line.plantName;

              return (
                <tr
                  key={line.id}
                  className={`${
                    isLastFulfilled
                      ? 'bg-green-50 ring-2 ring-green-400 ring-inset'
                      : remaining === 0
                        ? 'bg-gray-50 opacity-60'
                        : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {line.plantName}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {line.plantSku}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-900">
                    {line.qtyOrdered}
                  </td>
                  <td className="px-4 py-3 text-sm text-center font-semibold text-green-700">
                    {line.qtyFulfilled}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-center font-semibold ${
                      remaining === 0 ? 'text-green-600' : 'text-gray-900'
                    }`}
                  >
                    {remaining}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action bar */}
      {!isComplete && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            onClick={handleUndo}
            disabled={isScanning}
          >
            Undo Last Scan
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            onClick={handleManualOpen}
          >
            Manual Fulfill
          </button>
          <button
            type="button"
            className={`ml-auto px-6 py-2 text-sm font-medium text-white rounded-md ${
              allFulfilled
                ? 'bg-hawk-600 hover:bg-hawk-700'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
            onClick={handleComplete}
            disabled={isScanning}
          >
            {allFulfilled ? 'Complete Order' : 'Force Complete'}
          </button>
        </div>
      )}

      {isComplete && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-center">
          <p className="text-lg font-semibold text-green-700">Order Complete</p>
        </div>
      )}

      {/* Scan history */}
      <ScanHistoryList entries={scanHistory} />

      {/* Network failure banner */}
      {networkError && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <ErrorBanner message={`Network Error: ${networkError}`} onDismiss={clearNetworkError} />
        </div>
      )}

      {/* Manual fulfill modal */}
      <ManualFulfillModal
        isOpen={showManualModal}
        lines={currentOrder.lines}
        saleClosed={saleClosed}
        onFulfill={handleManualFulfill}
        onCancel={handleManualClose}
      />
    </div>
  );
}
