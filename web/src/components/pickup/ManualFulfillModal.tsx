import { useState } from 'react';
import type { OrderLine } from '@/types/order.js';

interface ManualFulfillModalProps {
  isOpen: boolean;
  lines: OrderLine[];
  saleClosed: boolean;
  /** Resolves true when the line was fulfilled (the parent closes the modal). */
  onFulfill: (lineId: string, reason: string) => Promise<boolean>;
  onCancel: () => void;
  /** Failure from the last attempt, shown inside the modal (it sits above the page banners). */
  error?: string | null;
}

export function ManualFulfillModal({
  isOpen,
  lines,
  saleClosed,
  onFulfill,
  onCancel,
  error = null,
}: ManualFulfillModalProps) {
  const [selectedLineId, setSelectedLineId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const unfulfilledLines = lines.filter((l) => l.qtyFulfilled < l.qtyOrdered);
  const canSubmit = !submitting && Boolean(selectedLineId) && Boolean(reason.trim());

  // Fields are kept until the request resolves: clearing them up front meant a
  // failed request left the operator with an empty form and no idea what was
  // (not) sent. `submitting` also blocks a double-tap from posting twice.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const ok = await onFulfill(selectedLineId, reason.trim());
      if (ok) {
        setSelectedLineId('');
        setReason('');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={submitting ? undefined : onCancel}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">Manual Fulfill</h2>

        {saleClosed ? (
          <div className="mt-4">
            <p className="text-sm text-red-600 font-medium">
              Sale is closed. Manual fulfillment is blocked.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                onClick={onCancel}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
            <div>
              <label htmlFor="manual-line" className="block text-sm font-medium text-gray-700">
                Unfulfilled Line
              </label>
              <select
                id="manual-line"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                disabled={submitting}
              >
                <option value="">Select a line...</option>
                {unfulfilledLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.plantName} ({line.plantSku}) - {line.qtyFulfilled}/{line.qtyOrdered}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="manual-reason" className="block text-sm font-medium text-gray-700">
                Reason
              </label>
              <textarea
                id="manual-reason"
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for manual fulfillment..."
                disabled={submitting}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50"
                disabled={!canSubmit}
              >
                {submitting ? 'Fulfilling...' : 'Fulfill'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
