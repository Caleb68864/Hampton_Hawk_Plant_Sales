import { useId } from 'react';
import { useDialog } from '@/hooks/useDialog.js';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  /**
   * True while the confirmed action is in flight. Disables both buttons and
   * blocks Escape / backdrop dismissal so the action cannot be re-fired or
   * abandoned half-way.
   */
  busy?: boolean;
}

const variantStyles = {
  danger: 'bg-red-600 hover:bg-red-700',
  warning: 'bg-amber-500 hover:bg-amber-600',
  default: 'bg-hawk-600 hover:bg-hawk-700',
};

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  variant = 'default',
  busy = false,
}: ConfirmModalProps) {
  const titleId = useId();
  const dialogProps = useDialog({ isOpen, onClose: busy ? undefined : onCancel, labelledBy: titleId });

  if (!isOpen) return null;

  function handleCancel() {
    if (busy) return;
    onCancel();
  }

  function handleConfirm() {
    if (busy) return;
    onConfirm();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleCancel}
      data-testid="confirm-backdrop"
    >
      <div
        {...dialogProps}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            onClick={handleCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${variantStyles[variant]}`}
            onClick={handleConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
