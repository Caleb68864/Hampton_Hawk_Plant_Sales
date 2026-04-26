import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAudio } from '@/components/shared/AudioFeedback.js';
import type { FeedbackMode } from '@/hooks/useAudioFeedback.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { ScanInput, type ScanInputHandle } from '@/components/pickup/ScanInput.js';
import { ScanFeedbackBanner } from '@/components/pickup/ScanFeedbackBanner.js';
import { ScanSuccessFlash } from '@/components/pickup/ScanSuccessFlash.js';
import { ScanHistoryList } from '@/components/pickup/ScanHistoryList.js';
import { useScanWorkflow } from '@/hooks/useScanWorkflow.js';
import { useKioskStore } from '@/stores/kioskStore.js';
import type {
  ScanSessionResult,
  ScanSessionScanResponse,
} from '@/types/scanSession.js';
import type { FulfillmentResultType, ScanResponse } from '@/types/fulfillment.js';

const FEEDBACK_MODE_KEY = 'pickup-feedback-mode';

// SS-13: human-readable banner copy per session result. Mirrors the per-order
// scan banner style from PickupScanPage. Includes the two session-only
// classifications (`NotInSession`, `Expired`) the legacy order flow does not
// produce.
const SESSION_RESULT_MESSAGES: Record<ScanSessionResult, string> = {
  Accepted: 'Plant accepted',
  AlreadyFulfilled: 'Plant already fulfilled in this session',
  NotInSession: 'Plant is not part of this pick-list',
  NotFound: 'Barcode not found',
  OutOfStock: 'Plant is out of stock',
  SaleClosedBlocked: 'Sale closed -- scanning is blocked',
  Expired: 'Session expired -- start a new pick-list session',
};

const SESSION_RESULT_NEXT_ACTION: Partial<Record<ScanSessionResult, string>> = {
  AlreadyFulfilled: 'Scan a remaining plant from the pick-list',
  NotInSession: 'Verify barcode or open the matching order separately',
  NotFound: 'Rescan the tag or look up the plant manually',
  OutOfStock: 'Ask the lead for an inventory check',
  SaleClosedBlocked: 'Ask admin to reopen the sale from Settings',
  Expired: 'Press End and rescan the pick-list barcode',
};

// SS-13: ScanFeedbackBanner is typed against FulfillmentResultType. The
// session classifications largely overlap; the two session-only values are
// mapped to the closest fulfillment variant for color treatment only --
// banner text comes from SESSION_RESULT_MESSAGES.
function toFulfillmentResultType(result: ScanSessionResult): FulfillmentResultType {
  if (result === 'NotInSession') return 'WrongOrder';
  if (result === 'Expired') return 'NotFound';
  return result;
}

function buildBannerScanResponse(
  result: ScanSessionScanResponse | null,
): ScanResponse | null {
  if (!result) return null;
  return {
    result: toFulfillmentResultType(result.result),
    plant: result.plant ? { sku: result.plant.sku, name: result.plant.name } : null,
    line: null,
    orderRemainingItems: result.session.remainingTotal,
  };
}

export function PickupScanSessionPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const audio = useAudio();
  const isPickupKiosk = useKioskStore((s) => s.session?.profile === 'pickup');

  const scanInputRef = useRef<ScanInputHandle>(null);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>(() => {
    const stored = localStorage.getItem(FEEDBACK_MODE_KEY);
    return stored === 'loud' || stored === 'quiet' || stored === 'off' ? stored : 'loud';
  });

  // SS-13: scan flash + remaining counter are stateful so we can show a
  // celebratory overlay on accepted scans, mirroring PickupScanPage.
  const [showScanFlash, setShowScanFlash] = useState(false);
  const [scanFlashData, setScanFlashData] = useState<{
    plantName: string;
    sku?: string;
    barcode?: string;
    remainingForOrder?: number;
  } | null>(null);

  const {
    currentSession,
    scanHistory,
    lastSessionScanResult,
    isScanning,
    isLoading,
    networkError,
    scanInSession,
    closeSession,
    clearNetworkError,
  } = useScanWorkflow({ mode: 'session', id: sessionId });

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

  function triggerHaptic(result: ScanSessionResult) {
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

  function playAudioForResult(result: ScanSessionResult) {
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
    const result = await scanInSession(barcode);
    if (result) {
      playAudioForResult(result.result);
      if (result.result === 'Accepted') {
        setScanFlashData({
          plantName: result.plant?.name ?? 'Unknown Plant',
          sku: result.plant?.sku,
          barcode,
          remainingForOrder: result.session.remainingTotal,
        });
        setShowScanFlash(true);
      }
    }
    refocusScanInput();
  }

  function handleScanFlashEnd() {
    setShowScanFlash(false);
    setScanFlashData(null);
  }

  async function handleEndSession() {
    if (sessionId) {
      await closeSession();
    }
    navigate('/pickup');
  }

  const bannerScanResponse = useMemo(
    () => buildBannerScanResponse(lastSessionScanResult),
    [lastSessionScanResult],
  );

  const bannerMessage = lastSessionScanResult
    ? SESSION_RESULT_MESSAGES[lastSessionScanResult.result]
    : '';
  const bannerNextAction = lastSessionScanResult
    ? SESSION_RESULT_NEXT_ACTION[lastSessionScanResult.result]
    : undefined;
  const bannerPlantName = lastSessionScanResult?.plant?.name ?? null;

  if (isLoading && !currentSession) {
    return <LoadingSpinner message="Loading pick-list session..." />;
  }

  if (!currentSession) {
    return (
      <div className="space-y-4">
        {!isPickupKiosk && <BackToStationHomeButton to="/pickup" label="Back to Pickup Lookup" />}
        <ErrorBanner message="Pick-list session not found." />
        <button
          type="button"
          className="text-sm text-hawk-600 hover:text-hawk-800"
          onClick={() => navigate('/pickup')}
        >
          Back to Pickup Lookup
        </button>
      </div>
    );
  }

  const isClosed = currentSession.closedAt !== null;
  const remainingTotal = currentSession.remainingTotal;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-700 mb-1"
            onClick={() => navigate('/pickup')}
          >
            &larr; Back to Lookup
          </button>
          <SectionHeading level={1}>Pick-list session</SectionHeading>
          <p className="text-sm text-gray-600">
            {currentSession.entityName}
            <span className="ml-2 text-xs uppercase tracking-wide text-gray-500">
              {currentSession.entityKind}
            </span>
          </p>
        </div>
      </div>

      {/* SS-13: included orders chip strip. Each chip links to the per-order
          detail page so volunteers can drill into a specific order's lines. */}
      {currentSession.includedOrderIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Orders in session:
          </span>
          {currentSession.includedOrderIds.map((orderId) => (
            <Link
              key={orderId}
              to={`/orders/${orderId}`}
              className="rounded-full border border-hawk-300 bg-hawk-50 px-3 py-1 font-mono text-xs text-hawk-800 hover:bg-hawk-100"
            >
              {orderId.slice(0, 8)}
            </Link>
          ))}
        </div>
      )}

      {showScanFlash && scanFlashData && (
        <ScanSuccessFlash
          visible={showScanFlash}
          plantName={scanFlashData.plantName}
          sku={scanFlashData.sku}
          barcode={scanFlashData.barcode}
          remainingForOrder={scanFlashData.remainingForOrder}
          onAnimationEnd={handleScanFlashEnd}
        />
      )}

      <ScanFeedbackBanner
        result={bannerScanResponse}
        message={bannerMessage}
        plantName={bannerPlantName}
        nextAction={bannerNextAction}
      />

      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="session-feedback-mode" className="text-sm font-medium text-gray-700">
            Feedback
          </label>
          <select
            id="session-feedback-mode"
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

      {!isClosed && (
        <div className="space-y-3">
          <ScanInput ref={scanInputRef} onScan={handleScan} disabled={isScanning} />

          <div className="flex flex-wrap items-center gap-3">
            <TouchButton variant="primary" onClick={handleEndSession} disabled={isScanning}>
              End and return
            </TouchButton>
          </div>
        </div>
      )}

      {/* SS-13: aggregated remaining counter. The session backend collapses
          per-order lines onto plant SKU; show the cross-order remaining
          total prominently. */}
      <div className="flex flex-col items-center justify-center py-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Items Remaining (Session Total)
        </div>
        <div
          className={`text-6xl font-bold tabular-nums transition-colors duration-300 ${
            remainingTotal === 0 ? 'text-green-600' : 'text-gray-900'
          }`}
        >
          {remainingTotal}
        </div>
      </div>

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
            {currentSession.aggregatedLines.map((line) => (
              <tr
                key={line.plantCatalogId}
                className={line.qtyRemaining === 0 ? 'bg-gray-50 opacity-60' : ''}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{line.plantName}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{line.plantSku}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-900">{line.qtyOrdered}</td>
                <td className="px-4 py-3 text-sm text-center font-semibold text-green-700">
                  {line.qtyFulfilled}
                </td>
                <td
                  className={`px-4 py-3 text-sm text-center font-semibold ${
                    line.qtyRemaining === 0 ? 'text-green-600' : 'text-gray-900'
                  }`}
                >
                  {line.qtyRemaining}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isClosed && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-center">
          <p className="text-lg font-semibold text-green-700">Session Closed</p>
        </div>
      )}

      <ScanHistoryList entries={scanHistory} />

      {networkError && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <ErrorBanner message={`Network Error: ${networkError}`} onDismiss={clearNetworkError} />
        </div>
      )}
    </div>
  );
}
