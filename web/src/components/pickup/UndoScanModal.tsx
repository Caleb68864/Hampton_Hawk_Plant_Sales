import { useState } from 'react';

interface UndoScanModalProps {
  isOpen: boolean;
  /** Disables the buttons while the undo request is in flight. */
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const DEFAULT_REASON = 'Correcting accidental scan';

// In-page replacement for the window.prompt() the undo flow used to open.
// Kiosk / fullscreen browsers suppress native prompts, which made "Undo last
// scan" silently do nothing on the very devices this page runs on.
export function UndoScanModal({ isOpen, busy = false, onConfirm, onCancel }: UndoScanModalProps) {
  // The form is unmounted while closed so each open starts from the default.
  if (!isOpen) return null;
  return <UndoScanForm busy={busy} onConfirm={onConfirm} onCancel={onCancel} />;
}

function UndoScanForm({ busy, onConfirm, onCancel }: Omit<UndoScanModalProps, 'isOpen'> & { busy: boolean }) {
  const [reason, setReason] = useState(DEFAULT_REASON);
  const trimmed = reason.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={busy ? undefined : onCancel}>
      <form
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-semibold text-gray-900">Undo last scan?</h2>
        <p className="mt-2 text-sm text-gray-600">
          This will remove the last accepted scan from this order.
        </p>
        <label htmlFor="undo-reason" className="mt-4 block text-sm font-medium text-gray-700">
          Why are you undoing this scan?
        </label>
        <textarea
          id="undo-reason"
          rows={2}
          autoFocus
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onFocus={(e) => e.target.select()}
          disabled={busy}
        />
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-50"
            disabled={busy || !trimmed}
          >
            {busy ? 'Undoing...' : 'Undo scan'}
          </button>
        </div>
      </form>
    </div>
  );
}
