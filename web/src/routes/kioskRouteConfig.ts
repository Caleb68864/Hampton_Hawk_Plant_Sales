import type { KioskProfile } from '../types/kiosk.ts';

interface KioskProfileRouteConfig {
  landingRoute: string;
  stationLabel: string;
  appMatchers: RegExp[];
  printMatchers: RegExp[];
}

const kioskRouteConfig = {
  pickup: {
    landingRoute: '/pickup',
    stationLabel: 'Pickup Station',
    appMatchers: [/^\/pickup$/, /^\/pickup\/[^/]+$/],
    printMatchers: [/^\/print\/order\/[^/]+$/],
  },
  'lookup-print': {
    landingRoute: '/lookup-print',
    stationLabel: 'Lookup & Print Station',
    appMatchers: [/^\/lookup-print$/],
    printMatchers: [/^\/print\/order\/[^/]+$/, /^\/print\/seller\/[^/]+$/],
  },
} satisfies Record<KioskProfile, KioskProfileRouteConfig>;

export function getKioskLandingRoute(profile: KioskProfile): string {
  return kioskRouteConfig[profile].landingRoute;
}

export function getKioskStationLabel(profile: KioskProfile): string {
  return kioskRouteConfig[profile].stationLabel;
}

export function isKioskPrintRoute(profile: KioskProfile, pathname: string): boolean {
  return kioskRouteConfig[profile].printMatchers.some((matcher) => matcher.test(pathname));
}

export function isKioskPathAllowed(profile: KioskProfile, pathname: string): boolean {
  const config = kioskRouteConfig[profile];
  return [...config.appMatchers, ...config.printMatchers].some((matcher) => matcher.test(pathname));
}
