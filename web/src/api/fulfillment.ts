import { post, postWithHeaders } from './client.js';
import type { ScanRequest, ScanResponse } from '@/types/fulfillment.js';

export const fulfillmentApi = {
  scan: (orderId: string, data: ScanRequest) =>
    post<ScanResponse>(`/orders/${orderId}/scan`, data),

  undoLastScan: (orderId: string) =>
    post<ScanResponse>(`/orders/${orderId}/undo-last-scan`),

  undoLastScanWithReason: (orderId: string, reason: string, operator: string) =>
    postWithHeaders<ScanResponse>(`/orders/${orderId}/undo-last-scan`, {}, {
      'X-Admin-Reason': reason,
      'X-Operator': operator,
    }),

  forceComplete: (orderId: string, adminPin: string, reason: string, operator: string) =>
    postWithHeaders<boolean>(`/orders/${orderId}/force-complete`, {}, {
      'X-Admin-Pin': adminPin,
      'X-Admin-Reason': reason,
      'X-Operator': operator,
    }),

  reset: (orderId: string, adminPin: string, reason: string, operator: string) =>
    postWithHeaders<boolean>(`/orders/${orderId}/reset`, {}, {
      'X-Admin-Pin': adminPin,
      'X-Admin-Reason': reason,
      'X-Operator': operator,
    }),
};
