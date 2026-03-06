import { create } from 'zustand';

export interface AdminAuthResult {
  pin: string;
  reason: string;
}

export interface AdminAuthOptions {
  requireReason?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
}

export interface ResolvedAdminAuthOptions {
  requireReason: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  reasonLabel: string;
  reasonPlaceholder: string;
}

export function normalizeAdminAuthOptions(options?: AdminAuthOptions): ResolvedAdminAuthOptions {
  return {
    requireReason: options?.requireReason ?? true,
    title: options?.title?.trim() || 'Admin Authorization',
    description:
      options?.description?.trim() || 'Enter the admin PIN to continue. Include a reason when the action changes live data.',
    confirmLabel: options?.confirmLabel?.trim() || 'Authorize',
    reasonLabel: options?.reasonLabel?.trim() || 'Reason',
    reasonPlaceholder: options?.reasonPlaceholder?.trim() || 'Why is this action needed?',
  };
}

interface AuthState {
  showPinModal: boolean;
  modalOptions: ResolvedAdminAuthOptions;
  pinResolve: ((result: AdminAuthResult | null) => void) | null;
  openPinModal: (options?: AdminAuthOptions) => Promise<AdminAuthResult | null>;
  submitPin: (pin: string, reason: string) => void;
  cancelPin: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  showPinModal: false,
  modalOptions: normalizeAdminAuthOptions(),
  pinResolve: null,

  openPinModal: (options) =>
    new Promise<AdminAuthResult | null>((resolve) => {
      set({
        showPinModal: true,
        pinResolve: resolve,
        modalOptions: normalizeAdminAuthOptions(options),
      });
    }),

  submitPin: (pin: string, reason: string) => {
    const { pinResolve } = get();
    pinResolve?.({ pin, reason });
    set({
      showPinModal: false,
      pinResolve: null,
      modalOptions: normalizeAdminAuthOptions(),
    });
  },

  cancelPin: () => {
    const { pinResolve } = get();
    pinResolve?.(null);
    set({
      showPinModal: false,
      pinResolve: null,
      modalOptions: normalizeAdminAuthOptions(),
    });
  },
}));
