import { post } from './client.js';
import type { ScanRequest, ScanResponse } from '@/types/fulfillment.js';

export const fulfillmentApi = {
  scan: (orderId: string, data: ScanRequest) =>
    post<ScanResponse>(`/orders/${orderId}/scan`, data),

  undoLastScan: (orderId: string) =>
    post<ScanResponse>(`/orders/${orderId}/undo-last-scan`),
};
