import { create } from 'zustand';
import type { CurrentUser, AppRole, SessionStatus } from '../types/auth.ts';

// ── Admin PIN modal ───────────────────────────────────────────────────────────

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

// ── User session ──────────────────────────────────────────────────────────────

interface AuthState {
  // PIN modal
  showPinModal: boolean;
  modalOptions: ResolvedAdminAuthOptions;
  pinResolve: ((result: AdminAuthResult | null) => void) | null;
  openPinModal: (options?: AdminAuthOptions) => Promise<AdminAuthResult | null>;
  submitPin: (pin: string, reason: string) => void;
  cancelPin: () => void;

  // User session
  currentUser: CurrentUser | null;
  sessionStatus: SessionStatus;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // ── PIN modal state ─────────────────────────────────────────────────────────
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

  // ── User session state ──────────────────────────────────────────────────────
  currentUser: null,
  sessionStatus: 'loading',

  // Dynamic imports prevent auth.js from being resolved at module-load time,
  // allowing authStore to be imported in node:test without a browser environment.
  login: async (username, password) => {
    const { login: apiLogin } = await import('../api/auth.js');
    const user = await apiLogin({ username, password });
    set({ currentUser: user, sessionStatus: 'authenticated' });
  },

  logout: async () => {
    const { logout: apiLogout } = await import('../api/auth.js');
    await apiLogout();
    set({ currentUser: null, sessionStatus: 'unauthenticated' });
  },

  restoreSession: async () => {
    try {
      const { getCurrentUser } = await import('../api/auth.js');
      const user = await getCurrentUser();
      set({ currentUser: user, sessionStatus: 'authenticated' });
    } catch {
      set({ currentUser: null, sessionStatus: 'unauthenticated' });
    }
  },

  hasRole: (role) => {
    const { currentUser } = get();
    return currentUser?.roles.includes(role) ?? false;
  },
}));
