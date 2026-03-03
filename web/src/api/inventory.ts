import { get, put, post } from './client.js';
import type { InventoryItem, UpdateInventoryRequest, AdjustInventoryRequest } from '@/types/inventory.js';
import type { PagedResult, PaginationParams } from '@/types/api.js';

export const inventoryApi = {
  list: (params?: PaginationParams) =>
    get<PagedResult<InventoryItem>>('/inventory', params as Record<string, unknown>),

  update: (plantId: string, data: UpdateInventoryRequest) =>
    put<InventoryItem>(`/inventory/${plantId}`, data),

  adjust: (data: AdjustInventoryRequest) => post<InventoryItem>('/inventory/adjust', data),
};
