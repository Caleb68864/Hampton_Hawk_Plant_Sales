import { get, putWithHeaders } from './client.js';
import { buildAdminHeaders } from './adminHeaders.js';
import type { AppSettings } from '@/types/settings.js';

export const settingsApi = {
  get: () => get<AppSettings>('/settings'),

  setSaleClosed: (saleClosed: boolean, adminPin: string, reason: string) =>
    putWithHeaders<AppSettings>(
      '/settings/sale-closed',
      { saleClosed },
      buildAdminHeaders(adminPin, reason),
    ),
};
