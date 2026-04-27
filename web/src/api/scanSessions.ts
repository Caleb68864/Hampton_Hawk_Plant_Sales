import { get, post } from './client.js';
import type {
  CreateScanSessionRequest,
  ScanInSessionRequest,
  ScanSessionResponse,
  ScanSessionScanResponse,
} from '@/types/scanSession.js';

// SS-13: Frontend client for ScanSessionsController (see
// api/src/HamptonHawksPlantSales.Api/Controllers/ScanSessionsController.cs).
// Routes are kebab-case per project convention.
export const scanSessionsApi = {
  create: (data: CreateScanSessionRequest) =>
    post<ScanSessionResponse>('/scan-sessions', data),

  get: (id: string) =>
    get<ScanSessionResponse>(`/scan-sessions/${id}`),

  // Multi-quantity session scan: callers may pass `data.quantity` to fulfill
  // multiple units across pending lines in one round-trip. Omitted/undefined
  // defaults to 1 server-side; the wire payload always carries quantity so the
  // backend distribution log stays explicit.
  scan: (id: string, data: ScanInSessionRequest) => {
    const quantity = data.quantity ?? 1;
    return post<ScanSessionScanResponse>(`/scan-sessions/${id}/scan`, { ...data, quantity });
  },

  close: (id: string) =>
    post<ScanSessionResponse>(`/scan-sessions/${id}/close`),

  expand: (id: string, additionalOrderIds: string[]) =>
    post<ScanSessionResponse>(`/scan-sessions/${id}/expand`, additionalOrderIds),
};
