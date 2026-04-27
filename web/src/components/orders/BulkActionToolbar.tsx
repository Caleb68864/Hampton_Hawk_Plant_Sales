import { useState } from 'react';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { useAdminAuth } from '@/hooks/useAdminAuth.js';
import { ordersApi } from '@/api/orders.js';
import type { BulkOperationResult, OrderStatus } from '@/types/order.js';

const BULK_LIMIT = 500;

const STATUS_OPTIONS: OrderStatus[] = ['Open', 'InProgress', 'Complete', 'Cancelled'];

export interface BulkActionToolbarProps {
  selectedIds: string[];
  onResult: (result: BulkOperationResult) => void;
  onClearSelection: () => void;
  onBusyChange?: (busy: boolean) => void;
}

export function BulkActionToolbar({
  selectedIds,
  onResult,
  onClearSelection,
  onBusyChange,
}: BulkActionToolbarProps) {
  const { requestAdminAuth } = useAdminAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const overLimit = selectedIds.length > BULK_LIMIT;
  const disabled = busy || selectedIds.length === 0 || overLimit;

  function setBusyAndNotify(value: boolean) {
    setBusy(value);
    onBusyChange?.(value);
  }

  async function handleMassComplete() {
    setError(null);
    setStatusPickerOpen(false);
    const auth = await requestAdminAuth({
      title: 'Mass Complete Orders',
      description: `Mark ${selectedIds.length} order(s) as complete. Only fully fulfilled orders will be completed.`,
      confirmLabel: 'Complete Orders',
    });
    if (!auth) return;
    setBusyAndNotify(true);
    try {
      const result = await ordersApi.bulkComplete(selectedIds, auth.pin, auth.reason);
      onResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk complete failed');
    } finally {
      setBusyAndNotify(false);
    }
  }

  async function handleChangeStatus(target: OrderStatus) {
    setError(null);
    setStatusPickerOpen(false);
    const auth = await requestAdminAuth({
      title: `Change Status to ${target}`,
      description: `Apply status "${target}" to ${selectedIds.length} order(s).`,
      confirmLabel: 'Apply Status',
    });
    if (!auth) return;
    setBusyAndNotify(true);
    try {
      const result = await ordersApi.bulkSetStatus(selectedIds, target, auth.pin, auth.reason);
      onResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk status change failed');
    } finally {
      setBusyAndNotify(false);
    }
  }

  return (
    <div className="sticky top-0 z-30 bg-white border border-hawk-200 rounded-md shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="text-sm font-semibold text-hawk-900">
        {selectedIds.length} selected
      </span>

      {overLimit && (
        <span className="text-xs font-medium text-red-700">
          Selection exceeds {BULK_LIMIT}-order limit. Reduce selection to continue.
        </span>
      )}

      <TouchButton
        type="button"
        variant="primary"
        disabled={disabled}
        onClick={handleMassComplete}
      >
        {busy ? 'Working…' : 'Mass Complete'}
      </TouchButton>

      <div className="relative">
        <TouchButton
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={() => setStatusPickerOpen((v) => !v)}
        >
          Change Status…
        </TouchButton>
        {statusPickerOpen && !disabled && (
          <div className="absolute left-0 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg z-40">
            <ul className="py-1">
              {STATUS_OPTIONS.map((status) => (
                <li key={status}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-hawk-50"
                    onClick={() => handleChangeStatus(status)}
                  >
                    {status}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        type="button"
        className="text-xs text-gray-600 underline hover:text-gray-800 disabled:opacity-50"
        disabled={busy}
        onClick={onClearSelection}
      >
        Clear selection
      </button>

      {error && (
        <span className="text-xs text-red-700 ml-auto">{error}</span>
      )}
    </div>
  );
}
