import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { adminApi } from '../api/admin.js';
import { ErrorBanner } from '../components/shared/ErrorBanner.js';
import { useAdminAuth } from '../hooks/useAdminAuth.js';
import { getKioskStationLabel } from '../routes/kioskRouteConfig.js';
import { useAppStore } from '../stores/appStore.js';
import { useKioskStore } from '../stores/kioskStore.js';

export function KioskLayout() {
  const navigate = useNavigate();
  const { requestAdminAuth } = useAdminAuth();
  const session = useKioskStore((s) => s.session);
  const deactivateKiosk = useKioskStore((s) => s.deactivateKiosk);
  const saleClosed = useAppStore((s) => s.saleClosed);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenNote, setFullscreenNote] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (!session?.preferFullscreen || typeof document === 'undefined') {
      return;
    }

    if (!document.documentElement.requestFullscreen || document.fullscreenElement) {
      return;
    }

    let cancelled = false;
    document.documentElement.requestFullscreen().catch(() => {
      if (!cancelled) {
        setFullscreenNote('Fullscreen was blocked. Kiosk mode is still active on this browser.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [session?.enabledAt, session?.preferFullscreen]);

  const stationLabel = useMemo(() => {
    if (!session) {
      return 'Kiosk Station';
    }

    return getKioskStationLabel(session.profile);
  }, [session]);

  async function handleUnlock() {
    const auth = await requestAdminAuth({
      requireReason: false,
      title: `Unlock ${stationLabel}`,
      description: 'Enter the admin PIN to exit kiosk mode on this browser.',
      confirmLabel: 'Unlock',
    });

    if (!auth) {
      return;
    }

    setUnlocking(true);
    setError(null);

    try {
      await adminApi.verifyPin(auth.pin);
      deactivateKiosk();
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => undefined);
      }
      navigate('/settings', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlock kiosk mode');
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-hawk-50 via-white to-gold-50">
      <header className="border-b-4 border-gold-300 bg-gradient-to-r from-hawk-700 via-hawk-800 to-hawk-900 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white p-1 shadow-sm">
              <img src="/hawk-logo.png" alt="Hampton Hawks" className="h-11 w-11 rounded-full" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-200">Volunteer Station</p>
              <h1 className="text-2xl font-bold">{stationLabel}</h1>
              <p className="text-sm text-hawk-100">
                {session?.workstationName ?? stationLabel}
                {session?.enabledAt ? ` • Locked ${new Date(session.enabledAt).toLocaleTimeString()}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md border border-gold-200 bg-white px-4 py-2 text-sm font-semibold text-hawk-800 shadow-sm transition hover:bg-gold-50 disabled:opacity-60"
            disabled={unlocking}
            onClick={handleUnlock}
          >
            {unlocking ? 'Unlocking...' : 'Admin Unlock'}
          </button>
        </div>
      </header>

      {saleClosed && (
        <div className="border-y border-red-800 bg-red-700 py-2 text-center text-sm font-semibold text-white">
          SALE CLOSED: scanning disabled
        </div>
      )}

      <main className="paper-grain relative">
        <div className="relative z-10 mx-auto max-w-6xl space-y-4 p-6">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
          {fullscreenNote && <ErrorBanner message={fullscreenNote} onDismiss={() => setFullscreenNote(null)} />}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
