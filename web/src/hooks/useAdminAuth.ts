import { useCallback } from 'react';
import { useAuthStore, type AdminAuthOptions } from '@/stores/authStore.js';

export function useAdminAuth() {
  const openPinModal = useAuthStore((s) => s.openPinModal);

  const requestAdminAuth = useCallback((options?: AdminAuthOptions) => {
    return openPinModal(options);
  }, [openPinModal]);

  return { requestAdminAuth };
}
