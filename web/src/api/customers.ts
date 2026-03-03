import { get, post, put, del } from './client.js';
import type { Customer, CreateCustomerRequest } from '@/types/customer.js';
import type { PagedResult, PaginationParams } from '@/types/api.js';

export const customersApi = {
  list: (params?: PaginationParams & { includeDeleted?: boolean }) =>
    get<PagedResult<Customer>>('/customers', params as Record<string, unknown>),

  getById: (id: string) => get<Customer>(`/customers/${id}`),

  create: (data: CreateCustomerRequest) => post<Customer>('/customers', data),

  update: (id: string, data: CreateCustomerRequest) => put<Customer>(`/customers/${id}`, data),

  delete: (id: string) => del(`/customers/${id}`),
};
