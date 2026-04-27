import type { BulkOperationResult } from '@/types/order.js';

export interface BulkResultModalProps {
  isOpen: boolean;
  result: BulkOperationResult | null;
  /**
   * Optional lookup so the modal can render order numbers instead of raw IDs.
   * When the lookup misses, the modal falls back to displaying the order ID.
   */
  orderNumberById?: Record<string, string>;
  onClose: () => void;
}

const outcomeStyles: Record<string, string> = {
  Completed: 'bg-green-100 text-green-800',
  StatusChanged: 'bg-blue-100 text-blue-800',
  Skipped: 'bg-amber-100 text-amber-800',
};

export function BulkResultModal({
  isOpen,
  result,
  orderNumberById,
  onClose,
}: BulkResultModalProps) {
  if (!isOpen || !result) return null;

  const total = result.outcomes.length;
  const skipped = result.outcomes.filter((o) => o.outcome === 'Skipped').length;
  const succeeded = total - skipped;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">Bulk operation result</h2>
        <p className="mt-1 text-sm text-gray-600">
          {succeeded} of {total} order{total === 1 ? '' : 's'} processed
          {skipped > 0 ? `; ${skipped} skipped` : ''}.
        </p>

        <div className="mt-4 overflow-y-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {result.outcomes.map((outcome) => {
                const display = orderNumberById?.[outcome.orderId] ?? outcome.orderId;
                const chipClass = outcomeStyles[outcome.outcome] ?? 'bg-gray-100 text-gray-800';
                return (
                  <tr key={outcome.orderId}>
                    <td className="px-3 py-2 font-medium text-gray-900">{display}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${chipClass}`}>
                        {outcome.outcome}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{outcome.reason ?? '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
