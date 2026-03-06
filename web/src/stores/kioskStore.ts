import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { DEFAULT_KIOSK_STORAGE_KEY, type KioskSession } from '../types/kiosk.ts';
import { normalizeStoredKioskSession, readPersistedKioskSession } from './kioskSession.ts';

export interface KioskState {
  session: KioskSession | null;
  isKioskEnabled: boolean;
  hasHydrated: boolean;
  activateKiosk: (session: KioskSession) => void;
  deactivateKiosk: () => void;
  replaceSession: (session: KioskSession | null) => void;
  syncFromStorage: (raw: string | null | undefined) => void;
  setHydrated: (hydrated: boolean) => void;
}

interface PersistedKioskState {
  session: KioskSession | null;
}

function createNoopStorage(): StateStorage {
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
}

function getStorage(): StateStorage {
  return typeof localStorage !== 'undefined' ? localStorage : createNoopStorage();
}

export function createKioskStore(storageFactory: () => StateStorage = getStorage) {
  return create<KioskState>()(
    persist(
      (set) => ({
        session: null,
        isKioskEnabled: false,
        hasHydrated: typeof localStorage === 'undefined',
        activateKiosk: (session) => {
          const normalized = normalizeStoredKioskSession(session);
          set({ session: normalized, isKioskEnabled: normalized !== null });
        },
        deactivateKiosk: () => {
          set({ session: null, isKioskEnabled: false });
        },
        replaceSession: (session) => {
          const normalized = normalizeStoredKioskSession(session);
          set({ session: normalized, isKioskEnabled: normalized !== null });
        },
        syncFromStorage: (raw) => {
          const session = readPersistedKioskSession(raw);
          set({ session, isKioskEnabled: session !== null });
        },
        setHydrated: (hydrated) => {
          set({ hasHydrated: hydrated });
        },
      }),
      {
        name: DEFAULT_KIOSK_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(storageFactory),
        partialize: (state) => ({ session: state.session }),
        merge: (persisted, current) => {
          const state = persisted as PersistedKioskState | undefined;
          const session = normalizeStoredKioskSession(state?.session);
          return {
            ...current,
            session,
            isKioskEnabled: session !== null,
          };
        },
        onRehydrateStorage: () => (state) => {
          state?.setHydrated(true);
        },
      },
    ),
  );
}

export const useKioskStore = createKioskStore();
