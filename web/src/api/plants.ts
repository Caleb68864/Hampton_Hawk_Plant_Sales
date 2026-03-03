import { get, post, put, del } from './client.js';
import type { Plant, CreatePlantRequest, UpdatePlantRequest } from '@/types/plant.js';
import type { PagedResult, PaginationParams } from '@/types/api.js';

export const plantsApi = {
  list: (params?: PaginationParams & { activeOnly?: boolean; includeDeleted?: boolean }) =>
    get<PagedResult<Plant>>('/plants', params as Record<string, unknown>),

  getById: (id: string) => get<Plant>(`/plants/${id}`),

  create: (data: CreatePlantRequest) => post<Plant>('/plants', data),

  update: (id: string, data: UpdatePlantRequest) => put<Plant>(`/plants/${id}`, data),

  delete: (id: string) => del(`/plants/${id}`),
};
