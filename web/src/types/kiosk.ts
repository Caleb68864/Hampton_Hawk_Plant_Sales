export const DEFAULT_KIOSK_STORAGE_KEY = 'hampton-hawks-kiosk-session';

export type KioskProfile = 'pickup' | 'lookup-print';

export interface KioskSession {
  enabled: true;
  profile: KioskProfile;
  workstationName: string;
  enabledAt: string;
  preferFullscreen: boolean;
}
