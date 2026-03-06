import { get, post, put, del } from './client.js';
import type { Order, CreateOrderRequest, OrderLine, CreateOrderLineRequest, UpdateOrderRequest } from '@/types/order.js';
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

  update: async (id: string, data: UpdateOrderRequest) => mapApiOrder(await put<ApiOrder>(`/orders/${id}`, data)),

  delete: (id: string) => del(`/orders/${id}`),

  addLine: (orderId: string, data: CreateOrderLineRequest) =>
    post<OrderLine>(`/orders/${orderId}/lines`, data),

  updateLine: (orderId: string, lineId: string, data: Partial<CreateOrderLineRequest>) =>
    put<OrderLine>(`/orders/${orderId}/lines/${lineId}`, data),

  deleteLine: (orderId: string, lineId: string) =>
    del(`/orders/${orderId}/lines/${lineId}`),

  complete: (orderId: string) =>
    post<boolean>(`/orders/${orderId}/complete`),

  reset: (orderId: string) =>
    post<boolean>(`/orders/${orderId}/reset`),

  getEvents: (orderId: string) =>
    get<FulfillmentEvent[]>(`/orders/${orderId}/events`),
};
