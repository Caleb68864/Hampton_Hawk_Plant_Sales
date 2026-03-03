import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore.js';

export function useAdminAuth() {
  const openPinModal = useAuthStore((s) => s.openPinModal);

  const requestAdminAuth = useCallback(() => {
    return openPinModal();
  }, [openPinModal]);

  return { requestAdminAuth };
}
