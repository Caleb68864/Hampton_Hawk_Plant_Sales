import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/api/admin.js';
import { ordersApi } from '@/api/orders.js';
import { settingsApi } from '@/api/settings.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { useAdminAuth } from '@/hooks/useAdminAuth.js';
import { getKioskLandingRoute } from '@/routes/kioskRouteConfig.js';
import { useAppStore } from '@/stores/appStore.js';
import { buildKioskSessionDraft, getDefaultWorkstationName } from '@/stores/kioskSession.js';
import { useKioskStore } from '@/stores/kioskStore.js';
import type { KioskProfile } from '@/types/kiosk.js';
import type { AppSettings } from '@/types/settings.js';

export function SettingsPage() {
  const navigate = useNavigate();
  const { requestAdminAuth } = useAdminAuth();
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const kioskSession = useKioskStore((s) => s.session);
  const activateKiosk = useKioskStore((s) => s.activateKiosk);
  const deactivateKiosk = useKioskStore((s) => s.deactivateKiosk);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [kioskBusy, setKioskBusy] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<KioskProfile>('pickup');
  const [workstationName, setWorkstationName] = useState(getDefaultWorkstationName('pickup'));
  const [preferFullscreen, setPreferFullscreen] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerMessage, setDangerMessage] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    setLoading(true);
    settingsApi
      .get()
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const profile = kioskSession?.profile ?? 'pickup';
    setSelectedProfile(profile);
    setWorkstationName(kioskSession?.workstationName ?? getDefaultWorkstationName(profile));
    setPreferFullscreen(kioskSession?.preferFullscreen ?? false);
  }, [kioskSession]);

  function handleProfileChange(profile: KioskProfile) {
    setSelectedProfile(profile);
    setWorkstationName((current) => {
      const trimmed = current.trim();
      const pickupDefault = getDefaultWorkstationName('pickup');
      const lookupDefault = getDefaultWorkstationName('lookup-print');
      if (!trimmed || trimmed === pickupDefault || trimmed === lookupDefault) {
        return getDefaultWorkstationName(profile);
      }
      return current;
    });
  }

  async function handleToggleSaleClosed() {
    if (!settings) return;
    const auth = await requestAdminAuth();
    if (!auth) return;
    setToggling(true);
    setError(null);
    try {
      const updated = await settingsApi.setSaleClosed(!settings.saleClosed, auth.pin, auth.reason);
      setSettings(updated);
      await fetchSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update settings');
    } finally {
      setToggling(false);
    }
  }

  async function handleEnableKiosk() {
    const auth = await requestAdminAuth({
      requireReason: false,
      title: 'Enable Kiosk Mode',
      description: 'Enter the admin PIN to lock this browser into the selected station profile.',
      confirmLabel: 'Enable kiosk',
    });

    if (!auth) {
      return;
    }

    setKioskBusy(true);
    setError(null);

    try {
      await adminApi.verifyPin(auth.pin);
      const session = buildKioskSessionDraft(selectedProfile, workstationName, preferFullscreen);
      activateKiosk(session);
      navigate(getKioskLandingRoute(session.profile), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable kiosk mode');
    } finally {
      setKioskBusy(false);
    }
  }

  async function handleDisableKiosk() {
    const auth = await requestAdminAuth({
      requireReason: false,
      title: 'Disable Kiosk Mode',
      description: 'Enter the admin PIN to unlock this browser and return to the full app.',
      confirmLabel: 'Disable kiosk',
    });

    if (!auth) {
      return;
    }

    setKioskBusy(true);
    setError(null);

    try {
      await adminApi.verifyPin(auth.pin);
      deactivateKiosk();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disable kiosk mode');
    } finally {
      setKioskBusy(false);
    }
  }

  async function handleDeleteAllOrders() {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE ALL ORDERS') {
      setDangerMessage('Type DELETE ALL ORDERS exactly to confirm.');
      return;
    }
    if (!window.confirm('This PERMANENTLY deletes every order, order line, and scan event. This cannot be undone. Continue?')) {
      return;
    }
    if (!window.confirm('Last chance. Really delete EVERY order in the database?')) {
      return;
    }
    const auth = await requestAdminAuth({
      title: 'Delete ALL Orders',
      description: 'This wipes the orders table so you can re-import. Enter admin PIN and a reason.',
      confirmLabel: 'Delete all orders',
    });
    if (!auth) return;
    setDangerBusy(true);
    setDangerMessage(null);
    try {
      const deleted = await ordersApi.deleteAll(auth.pin, auth.reason ?? 'Bulk delete orders');
      setDangerMessage(`Deleted ${deleted} orders. You can now re-import.`);
      setDeleteConfirmText('');
    } catch (e) {
      setDangerMessage(e instanceof Error ? e.message : 'Failed to delete orders');
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleRegenerateBarcodes() {
    const auth = await requestAdminAuth({
      title: 'Regenerate Order Barcodes',
      description: 'Rebuilds the Barcode column for every order from its order number.',
      confirmLabel: 'Regenerate barcodes',
    });
    if (!auth) return;
    setDangerBusy(true);
    setDangerMessage(null);
    try {
      const updated = await ordersApi.regenerateBarcodes(auth.pin, auth.reason ?? 'Regenerate order barcodes');
      setDangerMessage(`Updated ${updated} order barcodes.`);
    } catch (e) {
      setDangerMessage(e instanceof Error ? e.message : 'Failed to regenerate barcodes');
    } finally {
      setDangerBusy(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <BackToStationHomeButton />
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">Global sale controls stay separate from kiosk mode, which only affects this browser.</p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Global</p>
          <h2 className="text-lg font-semibold text-gray-800">Sale Status</h2>
        </div>

        <div className="flex items-center justify-between gap-4">
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
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            Sale is CLOSED. Barcode scanning and pickup fulfillment are disabled. Toggle above to re-open (requires admin PIN).
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">This Device</p>
          <h2 className="text-lg font-semibold text-gray-800">Kiosk Mode</h2>
          <p className="mt-1 text-sm text-gray-600">Lock only this browser into a volunteer-safe station workflow.</p>
        </div>

        {kioskSession ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Kiosk mode is active on this browser.</p>
              <p className="mt-1">
                {kioskSession.profile === 'pickup' ? 'Pickup Station' : 'Lookup & Print Station'} • {kioskSession.workstationName}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              disabled={kioskBusy}
              onClick={handleDisableKiosk}
            >
              {kioskBusy ? 'Checking PIN...' : 'Disable kiosk mode on this browser'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">Station profile</span>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={selectedProfile}
                  onChange={(e) => handleProfileChange(e.target.value as KioskProfile)}
                >
                  <option value="pickup">Pickup</option>
                  <option value="lookup-print">Lookup & Print</option>
                </select>
              </label>

              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">Workstation name</span>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={workstationName}
                  onChange={(e) => setWorkstationName(e.target.value)}
                  placeholder={getDefaultWorkstationName(selectedProfile)}
                />
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={preferFullscreen}
                onChange={(e) => setPreferFullscreen(e.target.checked)}
              />
              Prefer fullscreen on launch for this browser
            </label>

            <button
              type="button"
              className="rounded-md bg-hawk-600 px-4 py-2 text-sm font-medium text-white hover:bg-hawk-700 disabled:opacity-60"
              disabled={kioskBusy}
              onClick={handleEnableKiosk}
            >
              {kioskBusy ? 'Checking PIN...' : 'Enable kiosk mode on this browser'}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-red-300 bg-red-50 p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Danger Zone</p>
          <h2 className="text-lg font-semibold text-red-800">Bulk Order Actions</h2>
          <p className="mt-1 text-sm text-red-700">Destructive actions. Admin PIN + reason required. Use with care.</p>
        </div>

        {dangerMessage && (
          <div className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-800">
            {dangerMessage}
          </div>
        )}

        <div className="rounded-md border border-red-200 bg-white p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Regenerate order barcodes</p>
            <p className="text-xs text-gray-600">Fills/refreshes the Barcode column for every order (OR + 10-digit zero-padded order number).</p>
          </div>
          <button
            type="button"
            disabled={dangerBusy}
            onClick={handleRegenerateBarcodes}
            className="rounded-md bg-hawk-600 px-4 py-2 text-sm font-medium text-white hover:bg-hawk-700 disabled:opacity-60"
          >
            {dangerBusy ? 'Working…' : 'Regenerate all order barcodes'}
          </button>
        </div>

        <div className="rounded-md border border-red-300 bg-white p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-red-800">Delete ALL orders</p>
            <p className="text-xs text-red-700">
              Permanently deletes every order, order line, and scan event. Plants, inventory, sellers, and customers are kept.
              Intended for wiping the orders table before a re-import.
            </p>
          </div>
          <label className="block text-xs font-medium text-red-800">
            Type <span className="font-mono">DELETE ALL ORDERS</span> to enable the button:
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="mt-1 w-full rounded-md border border-red-300 px-3 py-2 font-mono text-sm"
              placeholder="DELETE ALL ORDERS"
            />
          </label>
          <button
            type="button"
            disabled={dangerBusy || deleteConfirmText.trim().toUpperCase() !== 'DELETE ALL ORDERS'}
            onClick={handleDeleteAllOrders}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {dangerBusy ? 'Working…' : 'Delete ALL orders'}
          </button>
        </div>
      </div>
    </div>
  );
}
