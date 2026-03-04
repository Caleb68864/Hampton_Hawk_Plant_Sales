import { get, post, put, del } from './client.js';
import type { Order, CreateOrderRequest, OrderLine, CreateOrderLineRequest } from '@/types/order.js';
import type { PagedResult, PaginationParams } from '@/types/api.js';
import type { FulfillmentEvent } from '@/types/fulfillment.js';
import { mapApiOrder, type ApiOrder } from './orderMappers.js';

export const ordersApi = {
  list: async (params?: PaginationParams & { status?: string; isWalkUp?: boolean; sellerId?: string; customerId?: string; includeDeleted?: boolean }) => {
    const response = await get<PagedResult<ApiOrder>>('/orders', params as Record<string, unknown>);

    return {
      ...response,
      items: response.items.map((order) => mapApiOrder(order)),
    };
  },

  getById: async (id: string) => mapApiOrder(await get<ApiOrder>(`/orders/${id}`)),

  create: (data: CreateOrderRequest) => post<Order>('/orders', data),

  update: (id: string, data: Partial<CreateOrderRequest>) => put<Order>(`/orders/${id}`, data),

  delete: (id: string) => del(`/orders/${id}`),

  addLine: (orderId: string, data: CreateOrderLineRequest) =>
    post<OrderLine>(`/orders/${orderId}/lines`, data),

  updateLine: (orderId: string, lineId: string, data: Partial<CreateOrderLineRequest>) =>
    put<OrderLine>(`/orders/${orderId}/lines/${lineId}`, data),

  deleteLine: (orderId: string, lineId: string) =>
    del(`/orders/${orderId}/lines/${lineId}`),

  complete: (orderId: string, adminPin?: string, reason?: string) =>
    post<Order>(`/orders/${orderId}/complete`, { adminPin, reason }),

  reset: (orderId: string, adminPin: string, reason: string) =>
    post<Order>(`/orders/${orderId}/reset`, { adminPin, reason }),

  getEvents: (orderId: string) =>
    get<FulfillmentEvent[]>(`/orders/${orderId}/events`),
};
