import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore.js';

export function AdminPinModal() {
  const { showPinModal, modalOptions, submitPin, cancelPin } = useAuthStore();
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (showPinModal) {
      setPin('');
      setReason('');
    }
  }, [showPinModal]);

  if (!showPinModal) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedPin = pin.trim();
    const trimmedReason = reason.trim();
    if (!trimmedPin) {
      return;
    }

    if (modalOptions.requireReason && !trimmedReason) {
      return;
    }

    submitPin(trimmedPin, trimmedReason);
  }

  function handleCancel() {
    cancelPin();
    setPin('');
    setReason('');
  }

  const disableSubmit = !pin.trim() || (modalOptions.requireReason && !reason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCancel}>
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900">{modalOptions.title}</h2>
        <p className="mt-2 text-sm text-gray-600">{modalOptions.description}</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="admin-pin" className="block text-sm font-medium text-gray-700">
              Admin PIN
            </label>
            <input
              id="admin-pin"
              type="password"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
          </div>
          {modalOptions.requireReason && (
            <div>
              <label htmlFor="admin-reason" className="block text-sm font-medium text-gray-700">
                {modalOptions.reasonLabel}
              </label>
              <textarea
                id="admin-reason"
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
                value={reason}
                placeholder={modalOptions.reasonPlaceholder}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700"
              disabled={disableSubmit}
            >
              {modalOptions.confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
