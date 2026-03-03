import { get, post } from './client.js';
import type { Order } from '@/types/order.js';
import apiClient from './client.js';
import type { ApiResponse } from '@/types/api.js';

export interface WalkUpAvailability {
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  onHandQty: number;
  preorderRemaining: number;
  availableForWalkup: number;
}

export interface CreateWalkUpOrderRequest {
  displayName: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  customerId?: string | null;
}

export interface AddWalkUpLineRequest {
  plantCatalogId: string;
  qtyOrdered: number;
  notes?: string | null;
}

export const walkupApi = {
  createOrder: (data: CreateWalkUpOrderRequest) =>
    post<Order>('/walkup/orders', data),

  getAvailability: (plantCatalogId: string) =>
    get<WalkUpAvailability>('/walkup/availability', { plantCatalogId }),

  addLine: async (orderId: string, data: AddWalkUpLineRequest, adminPin?: string, adminReason?: string) => {
    const headers: Record<string, string> = {};
    if (adminPin) headers['X-Admin-Pin'] = adminPin;
    if (adminReason) headers['X-Admin-Reason'] = adminReason;
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/walkup/orders/${orderId}/lines`,
      data,
      { headers },
    );
    return response.data.data;
  },
};
