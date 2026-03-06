import { useEffect } from 'react';
import { DEFAULT_KIOSK_STORAGE_KEY, type KioskSession } from '../types/kiosk.ts';
import { useKioskStore } from '../stores/kioskStore.ts';
import { getKioskLandingRoute, getKioskStationLabel, isKioskPathAllowed, isKioskPrintRoute } from '../routes/kioskRouteConfig.ts';

export function getKioskRedirectPath(session: KioskSession | null, pathname: string): string | null {
  if (!session) {
    return null;
  }

  return isKioskPathAllowed(session.profile, pathname) ? null : getKioskLandingRoute(session.profile);
}

export function useKioskNavigation(pathname: string) {
  const session = useKioskStore((s) => s.session);
  const hasHydrated = useKioskStore((s) => s.hasHydrated);

  return {
    session,
    hasHydrated,
    landingRoute: session ? getKioskLandingRoute(session.profile) : null,
    stationLabel: session ? getKioskStationLabel(session.profile) : null,
    isAllowedPath: session ? isKioskPathAllowed(session.profile, pathname) : true,
    isPrintRoute: session ? isKioskPrintRoute(session.profile, pathname) : false,
    redirectTo: hasHydrated ? getKioskRedirectPath(session, pathname) : null,
  };
}

export function useKioskStorageSync() {
  const syncFromStorage = useKioskStore((s) => s.syncFromStorage);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    syncFromStorage(window.localStorage.getItem(DEFAULT_KIOSK_STORAGE_KEY));

    function handleStorage(event: StorageEvent) {
      if (event.key !== DEFAULT_KIOSK_STORAGE_KEY) {
        return;
      }

      syncFromStorage(event.newValue ?? window.localStorage.getItem(DEFAULT_KIOSK_STORAGE_KEY));
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [syncFromStorage]);
}
