import { get, put } from './client.js';
import type { AppSettings } from '@/types/settings.js';

export const settingsApi = {
  get: () => get<AppSettings>('/settings'),

  setSaleClosed: (saleClosed: boolean, adminPin: string, reason: string) =>
    put<AppSettings>('/settings/sale-closed', { saleClosed, adminPin, reason }),
};
