import { create } from 'zustand';
import { settingsApi } from '@/api/settings.js';

interface AppState {
  saleClosed: boolean;
  settingsLoading: boolean;
  settingsError: string | null;
  fetchSettings: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  saleClosed: false,
  settingsLoading: false,
  settingsError: null,

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
}));
