import { buildAdminHeaders } from './adminHeaders.js';
import { get, post, put, putWithHeaders, del } from './client.js';
import type { Plant, CreatePlantRequest, UpdatePlantRequest } from '@/types/plant.js';
import type { PagedResult, PaginationParams } from '@/types/api.js';

export const plantsApi = {
  list: (params?: PaginationParams & { activeOnly?: boolean; includeDeleted?: boolean }) =>
    get<PagedResult<Plant>>('/plants', params as Record<string, unknown>),

  getById: (id: string) => get<Plant>(`/plants/${id}`),

  create: (data: CreatePlantRequest) => post<Plant>('/plants', data),

  update: (id: string, data: UpdatePlantRequest) => put<Plant>(`/plants/${id}`, data),
  /** Update that may change a locked (already scanned) barcode; needs the admin PIN. */
  updateLockedBarcode: (id: string, data: UpdatePlantRequest, adminPin: string, adminReason: string) =>
    putWithHeaders<Plant>(`/plants/${id}/locked-barcode`, data, buildAdminHeaders(adminPin, adminReason)),

  delete: (id: string) => del(`/plants/${id}`),
};
