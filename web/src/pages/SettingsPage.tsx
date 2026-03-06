import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/api/admin.js';
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
    </div>
  );
}
