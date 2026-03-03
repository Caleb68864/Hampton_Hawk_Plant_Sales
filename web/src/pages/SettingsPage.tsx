import { useState, useEffect } from 'react';
import { settingsApi } from '@/api/settings.js';
import { useAppStore } from '@/stores/appStore.js';
import { useAdminAuth } from '@/hooks/useAdminAuth.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import type { AppSettings } from '@/types/settings.js';

export function SettingsPage() {
  const { requestAdminAuth } = useAdminAuth();
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    setLoading(true);
    settingsApi
      .get()
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleSaleClosed() {
    if (!settings) return;
    const auth = await requestAdminAuth();
    if (!auth) return;
    setToggling(true);
    setError(null);
    try {
      const updated = await settingsApi.setSaleClosed(!settings.saleClosed, auth.pin, auth.reason);
      setSettings(updated);
      await fetchSettings(); // Update global store
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update settings');
    } finally {
      setToggling(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <BackToStationHomeButton />
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Sale Status</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Sale Closed</p>
            <p className="text-xs text-gray-500">
              {settings?.saleClosed
                ? `Closed at ${settings.saleClosedAt ? new Date(settings.saleClosedAt).toLocaleString() : 'unknown'}`
                : 'Sale is currently open. Scanning and pickup are active.'}
            </p>
          </div>
          <button
            type="button"
            disabled={toggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings?.saleClosed ? 'bg-red-500' : 'bg-green-500'
            } disabled:opacity-50`}
            onClick={handleToggleSaleClosed}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings?.saleClosed ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {settings?.saleClosed && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            Sale is CLOSED. Barcode scanning and pickup fulfillment are disabled. Toggle above to re-open (requires admin PIN).
          </div>
        )}
      </div>
    </div>
  );
}
