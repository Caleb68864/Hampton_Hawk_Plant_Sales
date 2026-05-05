import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminApi } from '@/api/admin.js';
import { ordersApi } from '@/api/orders.js';
import { settingsApi } from '@/api/settings.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { useAdminAuth } from '@/hooks/useAdminAuth.js';
import { getKioskLandingRoute } from '@/routes/kioskRouteConfig.js';
import { useAppStore } from '@/stores/appStore.js';
import { buildKioskSessionDraft, getDefaultWorkstationName } from '@/stores/kioskSession.js';
import { useKioskStore } from '@/stores/kioskStore.js';
import { useAuthStore } from '@/stores/authStore.js';
import type { KioskProfile } from '@/types/kiosk.js';
import type { AppSettings, PickupAutoJumpMode } from '@/types/settings.js';

const DEBOUNCE_MIN = 50;
const DEBOUNCE_MAX = 500;

export function SettingsPage() {
  const navigate = useNavigate();
  const { requestAdminAuth } = useAdminAuth();
  const isAdmin = useAuthStore((s) => s.hasRole('Admin'));
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

  // Scanner Tuning (SS-09)
  const [tuningDebounce, setTuningDebounce] = useState<number>(120);
  const [tuningAutoJumpMode, setTuningAutoJumpMode] = useState<PickupAutoJumpMode>('BestMatchWhenSingle');
  const [tuningMultiScanEnabled, setTuningMultiScanEnabled] = useState<boolean>(true);
  const [tuningSaving, setTuningSaving] = useState(false);
  const [tuningMessage, setTuningMessage] = useState<string | null>(null);
  const [tuningError, setTuningError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    settingsApi
      .get()
      .then((s) => {
        setSettings(s);
        setTuningDebounce(s.pickupSearchDebounceMs ?? 120);
        setTuningAutoJumpMode(s.pickupAutoJumpMode ?? 'BestMatchWhenSingle');
        setTuningMultiScanEnabled(s.pickupMultiScanEnabled ?? true);
      })
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

  async function handleSaveScannerTuning() {
    setTuningError(null);
    setTuningMessage(null);

    if (
      !Number.isFinite(tuningDebounce) ||
      tuningDebounce < DEBOUNCE_MIN ||
      tuningDebounce > DEBOUNCE_MAX
    ) {
      setTuningError(`Debounce must be between ${DEBOUNCE_MIN} and ${DEBOUNCE_MAX} ms.`);
      return;
    }

    const auth = await requestAdminAuth({
      title: 'Update Scanner Tuning',
      description: 'Enter admin PIN to save scanner tuning changes.',
      confirmLabel: 'Save scanner tuning',
    });
    if (!auth) return;

    setTuningSaving(true);
    try {
      const updated = await settingsApi.updateScannerTuning(
        {
          pickupSearchDebounceMs: tuningDebounce,
          pickupAutoJumpMode: tuningAutoJumpMode,
          pickupMultiScanEnabled: tuningMultiScanEnabled,
        },
        auth.pin,
        auth.reason ?? 'Update scanner tuning',
      );
      setSettings(updated);
      setTuningDebounce(updated.pickupSearchDebounceMs ?? tuningDebounce);
      setTuningAutoJumpMode(updated.pickupAutoJumpMode ?? tuningAutoJumpMode);
      setTuningMultiScanEnabled(updated.pickupMultiScanEnabled ?? tuningMultiScanEnabled);
      setTuningMessage('Scanner tuning saved.');
      // Refresh global store so PickupLookupPage / PickupScanPage pick up new values immediately.
      await fetchSettings();
    } catch (e) {
      setTuningError(e instanceof Error ? e.message : 'Failed to save scanner tuning');
    } finally {
      setTuningSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="paper-grain max-w-3xl mx-auto space-y-4 relative">
      <div className="relative z-10 space-y-4">
      <BackToStationHomeButton />
      <div className="space-y-1">
        <SectionHeading level={1} eyebrow="Admin">Settings</SectionHeading>
        <p
          className="text-sm text-hawk-600"
          style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}
        >
          Global sale controls stay separate from kiosk mode, which only affects this browser.
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-hawk-200 p-6 space-y-3 joy-shadow-plum">
          <SectionHeading level={3} eyebrow="Admin">User Management</SectionHeading>
          <p className="text-sm text-gray-600">
            Create and manage station, mobile, and admin accounts. Changes take effect on next login.
          </p>
          <Link to="/admin/users">
            <TouchButton variant="primary">Manage users →</TouchButton>
          </Link>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-hawk-200 p-6 space-y-4 joy-shadow-plum">
        <SectionHeading level={3} eyebrow="Global">Sale Status</SectionHeading>

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

      <div className="bg-white rounded-2xl border border-hawk-200 p-6 space-y-4 joy-shadow-plum">
        <div className="space-y-1">
          <SectionHeading level={3} eyebrow="Global">Scanner Tuning</SectionHeading>
          <p
            className="text-sm text-hawk-600"
            style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}
          >
            Tune pickup-station scan behavior. Changes apply on next page load. Admin PIN required.
          </p>
        </div>

        {tuningError && <ErrorBanner message={tuningError} onDismiss={() => setTuningError(null)} />}
        {tuningMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {tuningMessage}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-gray-700">
            <span className="font-medium">Search debounce (ms)</span>
            <input
              type="number"
              min={DEBOUNCE_MIN}
              max={DEBOUNCE_MAX}
              step={10}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={tuningDebounce}
              onChange={(e) => setTuningDebounce(Number(e.target.value))}
            />
            <span className="block text-xs text-gray-500">
              Range: {DEBOUNCE_MIN}-{DEBOUNCE_MAX}. Lower = more responsive scanner; higher = fewer queries while typing.
            </span>
          </label>

          <label className="space-y-1 text-sm text-gray-700">
            <span className="font-medium">Auto-jump mode</span>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={tuningAutoJumpMode}
              onChange={(e) => setTuningAutoJumpMode(e.target.value as PickupAutoJumpMode)}
            >
              <option value="ExactMatchOnly">Exact match only (strict order-number format)</option>
              <option value="BestMatchWhenSingle">Best match when single (recommended)</option>
            </select>
            <span className="block text-xs text-gray-500">
              Controls whether lookup auto-navigates to a single matching order.
            </span>
          </label>
        </div>

        <label className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={tuningMultiScanEnabled}
            onChange={(e) => setTuningMultiScanEnabled(e.target.checked)}
          />
          <span>
            <span className="font-medium">Multi-scan enabled</span>
            <span className="block text-xs text-gray-500">Allow rapid consecutive scans without modal interruption.</span>
          </span>
        </label>

        <div>
          <TouchButton
            variant="primary"
            disabled={tuningSaving}
            onClick={handleSaveScannerTuning}
          >
            {tuningSaving ? 'Saving…' : 'Save scanner tuning'}
          </TouchButton>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-hawk-200 p-6 space-y-4 joy-shadow-plum">
        <div className="space-y-1">
          <SectionHeading level={3} eyebrow="This Device">Kiosk Mode</SectionHeading>
          <p
            className="text-sm text-hawk-600"
            style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}
          >
            Lock only this browser into a volunteer-safe station workflow.
          </p>
        </div>

        {kioskSession ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Kiosk mode is active on this browser.</p>
              <p className="mt-1">
                {kioskSession.profile === 'pickup' ? 'Pickup Station' : 'Lookup & Print Station'} • {kioskSession.workstationName}
              </p>
            </div>
            <TouchButton
              variant="ghost"
              disabled={kioskBusy}
              onClick={handleDisableKiosk}
            >
              {kioskBusy ? 'Checking PIN...' : 'Disable kiosk mode on this browser'}
            </TouchButton>
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

            <TouchButton
              variant="primary"
              disabled={kioskBusy}
              onClick={handleEnableKiosk}
            >
              {kioskBusy ? 'Checking PIN...' : 'Enable kiosk mode on this browser'}
            </TouchButton>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-red-300 bg-red-50 p-6 space-y-4">
        <div>
          <span
            className="block text-xs font-bold uppercase tracking-[0.28em] text-red-700 mb-1"
            style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}
          >
            Danger Zone
          </span>
          <h2
            className="text-2xl text-red-800"
            style={{
              fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
              fontVariationSettings: "'opsz' 144, 'SOFT' 80, 'wght' 500",
              letterSpacing: '-0.015em',
            }}
          >
            Bulk Order Actions
          </h2>
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
          <TouchButton
            variant="primary"
            disabled={dangerBusy}
            onClick={handleRegenerateBarcodes}
          >
            {dangerBusy ? 'Working…' : 'Regenerate all order barcodes'}
          </TouchButton>
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
          <TouchButton
            variant="danger"
            disabled={dangerBusy || deleteConfirmText.trim().toUpperCase() !== 'DELETE ALL ORDERS'}
            onClick={handleDeleteAllOrders}
          >
            {dangerBusy ? 'Working…' : 'Delete ALL orders'}
          </TouchButton>
        </div>
      </div>
      </div>
    </div>
  );
}
