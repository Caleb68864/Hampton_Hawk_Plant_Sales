import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { settingsApi } from '@/api/settings.js';

/**
 * Per-workstation draft id map. Keyed by workstation name (or `__default__`
 * when no workstation is set) so a register reload can resume the open
 * cash-register draft for that station.
 */
export type WalkUpDraftIdByWorkstation = Record<string, string>;

interface AppState {
  saleClosed: boolean;
  settingsLoading: boolean;
  settingsError: string | null;
  fetchSettings: () => Promise<void>;

  // Walk-up register draft persistence (per workstation)
  walkUpDraftIdByWorkstation: WalkUpDraftIdByWorkstation;
  setWalkUpDraftId: (workstationName: string | null | undefined, draftId: string) => void;
  clearWalkUpDraftId: (workstationName: string | null | undefined) => void;
  getWalkUpDraftId: (workstationName: string | null | undefined) => string | undefined;
}

const DEFAULT_WORKSTATION_KEY = '__default__';

function workstationKey(workstationName: string | null | undefined): string {
  const trimmed = workstationName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_WORKSTATION_KEY;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      saleClosed: false,
      settingsLoading: false,
      settingsError: null,
      walkUpDraftIdByWorkstation: {},

      fetchSettings: async () => {
        set({ settingsLoading: true, settingsError: null });
        try {
          const settings = await settingsApi.get();
          set({ saleClosed: settings.saleClosed, settingsLoading: false });
        } catch (e) {
          set({
            settingsLoading: false,
            settingsError: e instanceof Error ? e.message : 'Failed to load settings',
          });
        }
      },

      setWalkUpDraftId: (workstationName, draftId) => {
        const key = workstationKey(workstationName);
        set((state) => ({
          walkUpDraftIdByWorkstation: {
            ...state.walkUpDraftIdByWorkstation,
            [key]: draftId,
          },
        }));
      },

      clearWalkUpDraftId: (workstationName) => {
        const key = workstationKey(workstationName);
        set((state) => {
          if (!(key in state.walkUpDraftIdByWorkstation)) return state;
          const next = { ...state.walkUpDraftIdByWorkstation };
          delete next[key];
          return { walkUpDraftIdByWorkstation: next };
        });
      },

      getWalkUpDraftId: (workstationName) => {
        const key = workstationKey(workstationName);
        return get().walkUpDraftIdByWorkstation[key];
      },
    }),
    {
      name: 'hh-app-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist the draft map; settings should always be re-fetched.
      partialize: (state) => ({
        walkUpDraftIdByWorkstation: state.walkUpDraftIdByWorkstation,
      }),
    },
  ),
);
