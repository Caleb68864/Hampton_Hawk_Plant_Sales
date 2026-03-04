import { get, putWithHeaders } from './client.js';
import type { AppSettings } from '@/types/settings.js';

export const settingsApi = {
  get: () => get<AppSettings>('/settings'),

  setSaleClosed: (saleClosed: boolean, adminPin: string, reason: string) =>
    putWithHeaders<AppSettings>(
      '/settings/sale-closed',
      { saleClosed },
      {
        'X-Admin-Pin': adminPin,
        'X-Admin-Reason': reason,
      },
    ),
};
