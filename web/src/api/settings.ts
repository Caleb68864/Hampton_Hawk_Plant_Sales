import { get, putWithHeaders } from './client.js';
import { buildAdminHeaders } from './adminHeaders.js';
import type { AppSettings, UpdateScannerTuningRequest } from '@/types/settings.js';

export const settingsApi = {
  get: () => get<AppSettings>('/settings'),

  setSaleClosed: (saleClosed: boolean, adminPin: string, reason: string) =>
    putWithHeaders<AppSettings>(
      '/settings/sale-closed',
      { saleClosed },
      buildAdminHeaders(adminPin, reason),
    ),

  updateScannerTuning: (
    request: UpdateScannerTuningRequest,
    adminPin: string,
    reason: string,
  ) =>
    putWithHeaders<AppSettings>(
      '/settings/scanner-tuning',
      request,
      buildAdminHeaders(adminPin, reason),
    ),
};
