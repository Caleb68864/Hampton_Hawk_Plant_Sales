import { create } from 'zustand';

interface AdminAuthResult {
  pin: string;
  reason: string;
}

interface AuthState {
  showPinModal: boolean;
  pinResolve: ((result: AdminAuthResult | null) => void) | null;
  openPinModal: () => Promise<AdminAuthResult | null>;
  submitPin: (pin: string, reason: string) => void;
  cancelPin: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  showPinModal: false,
  pinResolve: null,

  openPinModal: () =>
    new Promise<AdminAuthResult | null>((resolve) => {
      set({ showPinModal: true, pinResolve: resolve });
    }),

  submitPin: (pin: string, reason: string) => {
    const { pinResolve } = get();
    pinResolve?.({ pin, reason });
    set({ showPinModal: false, pinResolve: null });
  },

  cancelPin: () => {
    const { pinResolve } = get();
    pinResolve?.(null);
    set({ showPinModal: false, pinResolve: null });
  },
}));
