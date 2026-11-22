import { buildAdminHeaders } from './adminHeaders.js';
import { delWithHeaders, get, post, put } from './client.js';
import type { Seller, CreateSellerRequest } from '@/types/seller.js';
import type { PagedResult, PaginationParams } from '@/types/api.js';

export const sellersApi = {
  list: (params?: PaginationParams & { includeDeleted?: boolean }) =>
    get<PagedResult<Seller>>('/sellers', params as Record<string, unknown>),

  getById: (id: string) => get<Seller>(`/sellers/${id}`),

  create: (data: CreateSellerRequest) => post<Seller>('/sellers', data),

  update: (id: string, data: CreateSellerRequest) => put<Seller>(`/sellers/${id}`, data),

  delete: (id: string, adminPin: string, adminReason: string) =>
    delWithHeaders(`/sellers/${id}`, buildAdminHeaders(adminPin, adminReason)),
};
