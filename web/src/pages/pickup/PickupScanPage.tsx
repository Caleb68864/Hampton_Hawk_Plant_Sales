import { useRef, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAudio } from '@/components/shared/AudioFeedback.js';
import type { FeedbackMode } from '@/hooks/useAudioFeedback.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { ConfirmModal } from '@/components/shared/ConfirmModal.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { ScanInput, type ScanInputHandle } from '@/components/pickup/ScanInput.js';
import { ScanFeedbackBanner } from '@/components/pickup/ScanFeedbackBanner.js';
import { ItemsRemainingCounter } from '@/components/pickup/ItemsRemainingCounter.js';
import { ScanHistoryList } from '@/components/pickup/ScanHistoryList.js';
import { ManualFulfillModal } from '@/components/pickup/ManualFulfillModal.js';
import { getScanDisplayFields, getScanResultMessage } from '@/components/pickup/scanFeedbackText.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { useScanWorkflow } from '@/hooks/useScanWorkflow.js';
import { useAppStore } from '@/stores/appStore.js';
import { useAuthStore } from '@/stores/authStore.js';
import { ordersApi } from '@/api/orders.js';
import { fulfillmentApi } from '@/api/fulfillment.js';
import type { FulfillmentResultType } from '@/types/fulfillment.js';

const FEEDBACK_MODE_KEY = 'pickup-feedback-mode';
const OPERATOR_NAME = 'Station Operator';

function getNextAction(result: FulfillmentResultType | null): string | undefined {
  if (!result || result === 'Accepted') return undefined;
  if (result === 'WrongOrder') return 'Wrong order: scan correct plant or switch order';
  if (result === 'AlreadyFulfilled') return 'Plant already done. Scan a remaining item or complete order';
  if (result === 'NotFound') return 'Rescan tag or manually look up the plant';
  if (result === 'OutOfStock') return 'Use Recover to undo/lookup or ask lead for inventory check';
  return 'Ask admin to reopen the sale from Settings';
}

export function PickupScanPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const audio = useAudio();
  const saleClosed = useAppStore((s) => s.saleClosed);
  const openPinModal = useAuthStore((s) => s.openPinModal);

  const scanInputRef = useRef<ScanInputHandle>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>(() => {
    const stored = localStorage.getItem(FEEDBACK_MODE_KEY);
    return stored === 'loud' || stored === 'quiet' || stored === 'off' ? stored : 'loud';
  });

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
    addHistoryEntry,
  } = useScanWorkflow(orderId);

  useEffect(() => {
    audio.setMode(feedbackMode);
  }, [audio, feedbackMode]);

  const handleFeedbackModeChange = useCallback((mode: FeedbackMode) => {
    setFeedbackMode(mode);
    audio.setMode(mode);
    localStorage.setItem(FEEDBACK_MODE_KEY, mode);
  }, [audio]);

  const refocusScanInput = useCallback(() => {
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }, []);

  function triggerHaptic(result: FulfillmentResultType) {
    if (feedbackMode === 'off' || typeof navigator === 'undefined' || !navigator.vibrate) return;
    if (feedbackMode === 'quiet') {
      navigator.vibrate(20);
      return;
    }

    if (result === 'Accepted') {
      navigator.vibrate([25, 20, 25]);
    } else if (result === 'AlreadyFulfilled') {
      navigator.vibrate([35, 30, 35]);
    } else {
      navigator.vibrate([70, 40, 70]);
    }
  }

  function playAudioForResult(result: FulfillmentResultType) {
    if (result === 'Accepted') {
      audio.playSuccess();
    } else if (result === 'AlreadyFulfilled') {
      audio.playWarning();
    } else {
      audio.playError();
    }
    triggerHaptic(result);
  }

  async function handleScan(barcode: string) {
    const result = await scan(barcode);
    if (result) {
      playAudioForResult(result.result);
    }
    refocusScanInput();
  }

  async function confirmUndoLastScan() {
    setShowUndoConfirm(false);
    const reason = window.prompt('Why are you undoing this scan?', 'Correcting accidental scan')?.trim();
    if (!reason) {
      refocusScanInput();
      return;
    }

    await undoLastScan(reason, OPERATOR_NAME);
    addHistoryEntry({
      barcode: 'RECOVERY:UNDO',
      result: 'Accepted',
      message: `Operator ${OPERATOR_NAME} undid last scan. Reason: ${reason}`,
      timestamp: Date.now(),
    });
    refocusScanInput();
  }

  async function handleResetOrder() {
    if (!orderId) return;
    const auth = await openPinModal();
    if (!auth) {
      refocusScanInput();
      return;
    }

    await fulfillmentApi.reset(orderId, auth.pin, auth.reason, OPERATOR_NAME);
    addHistoryEntry({
      barcode: 'RECOVERY:RESET',
      result: 'Accepted',
      message: `Operator ${OPERATOR_NAME} reset order. Reason: ${auth.reason}`,
      timestamp: Date.now(),
    });
    await refreshOrder();
    refocusScanInput();
  }

  async function handleMarkPartial() {
    if (!orderId) return;
    const auth = await openPinModal();
    if (!auth) {
      refocusScanInput();
      return;
    }

    await fulfillmentApi.forceComplete(orderId, auth.pin, auth.reason, OPERATOR_NAME);
    addHistoryEntry({
      barcode: 'RECOVERY:PARTIAL',
      result: 'Accepted',
      message: `Operator ${OPERATOR_NAME} marked order partial. Reason: ${auth.reason}`,
      timestamp: Date.now(),
    });
    await refreshOrder();
    refocusScanInput();
  }

  async function handleManualFulfill(lineId: string, reason: string) {
    if (!orderId) return;
    try {
      await fulfillmentApi.manualFulfill(orderId, { orderLineId: lineId, reason, operatorName: OPERATOR_NAME });
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
      const auth = await openPinModal();
      if (auth) {
        try {
          await fulfillmentApi.forceComplete(orderId, auth.pin, auth.reason, OPERATOR_NAME);
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

  function handleUndo() {
    setShowUndoConfirm(true);
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
  const scanDisplay = getScanDisplayFields(lastScanResult);

  return (
    <div className="space-y-4">
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

      <ScanFeedbackBanner
        result={lastScanResult}
        message={getScanResultMessage(lastScanResult)}
        plantName={scanDisplay.plantName}
        nextAction={getNextAction(lastScanResult?.result ?? null)}
      />

      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="feedback-mode" className="text-sm font-medium text-gray-700">
            Feedback
          </label>
          <select
            id="feedback-mode"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={feedbackMode}
            onChange={(e) => handleFeedbackModeChange(e.target.value as FeedbackMode)}
          >
            <option value="loud">Loud</option>
            <option value="quiet">Quiet</option>
            <option value="off">Off</option>
          </select>
          <span className="text-xs text-gray-500">Audio + haptics preference for this device.</span>
        </div>
      </div>

      {!isComplete && (
        <div className="space-y-2">
          <ScanInput
            ref={scanInputRef}
            onScan={handleScan}
            disabled={isScanning}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              onClick={() => setShowUndoConfirm(true)}
              disabled={isScanning}
            >
              Undo last scan
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              onClick={handleResetOrder}
              disabled={isScanning}
            >
              Reset current order
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
              onClick={handleMarkPartial}
              disabled={isScanning}
            >
              Mark partial + reason
            </button>
          </div>
        </div>
      )}

      <ItemsRemainingCounter lines={currentOrder.lines} />

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
                scanDisplay.plantName === line.plantName;

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

      {!isComplete && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            onClick={handleManualOpen}
          >
            Manual Fulfill
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
            onClick={handleUndo}
            disabled={isScanning}
          >
            Recover
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-amber-900 bg-amber-100 rounded-md hover:bg-amber-200"
            onClick={() => navigate('/pickup')}
          >
            Reopen Lookup
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

      <ScanHistoryList entries={scanHistory} />

      {networkError && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <ErrorBanner message={`Network Error: ${networkError}`} onDismiss={clearNetworkError} />
        </div>
      )}

      <ManualFulfillModal
        isOpen={showManualModal}
        lines={currentOrder.lines}
        saleClosed={saleClosed}
        onFulfill={handleManualFulfill}
        onCancel={handleManualClose}
      />

      <ConfirmModal
        isOpen={showUndoConfirm}
        title="Undo last scan?"
        message="This will remove the last accepted scan from this order."
        confirmLabel="Undo scan"
        variant="warning"
        onCancel={() => {
          setShowUndoConfirm(false);
          refocusScanInput();
        }}
        onConfirm={confirmUndoLastScan}
      />
    </div>
  );
}

