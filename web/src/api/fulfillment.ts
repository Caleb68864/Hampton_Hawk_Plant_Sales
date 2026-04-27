import { post, postWithHeaders } from './client.js';
import type { ManualFulfillRequest, ScanRequest, ScanResponse } from '@/types/fulfillment.js';

export const fulfillmentApi = {
  // Multi-quantity scanning: callers may pass `data.quantity` to fulfill
  // multiple units in a single scan (volunteer "set 6, scan once" workflow).
  // Omitted/undefined quantity defaults to 1 server-side; explicit values <=0
  // are coerced to 1 by the service. The wire payload always carries the
  // quantity field (defaults to 1) so the server-side audit trail stays
  // explicit even when the volunteer is in single-unit mode.
  scan: (orderId: string, data: ScanRequest) => {
    const quantity = data.quantity ?? 1;
    return post<ScanResponse>(`/orders/${orderId}/scan`, { ...data, quantity });
  },

  undoLastScan: (orderId: string) =>
    post<ScanResponse>(`/orders/${orderId}/undo-last-scan`),

  manualFulfill: (orderId: string, data: ManualFulfillRequest) =>
    post<ScanResponse>(`/orders/${orderId}/manual-fulfill`, data),

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
