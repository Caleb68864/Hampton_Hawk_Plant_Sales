import { DEFAULT_KIOSK_STORAGE_KEY, type KioskProfile, type KioskSession } from '../types/kiosk.ts';

interface PersistedKioskEnvelope {
  state?: {
    session?: unknown;
  } | null;
  version?: number;
}

export function isKioskProfile(value: unknown): value is KioskProfile {
  return value === 'pickup' || value === 'lookup-print';
}

export function getDefaultWorkstationName(profile: KioskProfile): string {
  return profile === 'pickup' ? 'Pickup Station' : 'Lookup & Print Station';
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function normalizeStoredKioskSession(value: unknown): KioskSession | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const session = value as Record<string, unknown>;
  if (session.enabled !== true || !isKioskProfile(session.profile)) {
    return null;
  }

  const workstationName = typeof session.workstationName === 'string' ? session.workstationName.trim() : '';
  const enabledAt = typeof session.enabledAt === 'string' ? session.enabledAt : '';
  const preferFullscreen = Boolean(session.preferFullscreen);

  if (!workstationName || !isIsoDate(enabledAt)) {
    return null;
  }

  return {
    enabled: true,
    profile: session.profile,
    workstationName,
    enabledAt,
    preferFullscreen,
  };
}

export function buildKioskSessionDraft(
  profile: KioskProfile,
  workstationName: string,
  preferFullscreen = false,
): KioskSession {
  const trimmedName = workstationName.trim();

  return {
    enabled: true,
    profile,
    workstationName: trimmedName || getDefaultWorkstationName(profile),
    enabledAt: new Date().toISOString(),
    preferFullscreen: Boolean(preferFullscreen),
  };
}

export function readPersistedKioskSession(raw: string | null | undefined): KioskSession | null {
  if (!raw?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedKioskEnvelope | unknown;
    const wrappedSession = parsed && typeof parsed === 'object' && 'state' in parsed
      ? (parsed as PersistedKioskEnvelope).state?.session ?? null
      : parsed;

    return normalizeStoredKioskSession(wrappedSession);
  } catch {
    return null;
  }
}

export function getStoredKioskSession(): KioskSession | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return readPersistedKioskSession(localStorage.getItem(DEFAULT_KIOSK_STORAGE_KEY));
}
