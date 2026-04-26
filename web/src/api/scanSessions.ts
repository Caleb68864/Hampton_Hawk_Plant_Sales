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

  scan: (id: string, data: ScanInSessionRequest) =>
    post<ScanSessionScanResponse>(`/scan-sessions/${id}/scan`, data),

  close: (id: string) =>
    post<ScanSessionResponse>(`/scan-sessions/${id}/close`),

  expand: (id: string, additionalOrderIds: string[]) =>
    post<ScanSessionResponse>(`/scan-sessions/${id}/expand`, additionalOrderIds),
};
