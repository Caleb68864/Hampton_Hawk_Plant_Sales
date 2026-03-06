import { get, postForm } from './client.js';
import type { ImportBatch, ImportIssue, ImportResult } from '@/types/import.js';
import type { PagedResult, PaginationParams } from '@/types/api.js';

export const importsApi = {
  list: (params?: PaginationParams) =>
    get<PagedResult<ImportBatch>>('/import/batches', params as Record<string, unknown>),

  getIssues: (batchId: string, params?: PaginationParams & { search?: string }) =>
    get<PagedResult<ImportIssue>>(`/import/batches/${batchId}/issues`, params as Record<string, unknown>),

  importPlants: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return postForm<ImportResult>('/import/plants', fd);
  },

  importInventory: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return postForm<ImportResult>('/import/inventory', fd);
  },

  importOrders: (file: File, resolveDuplicateOrderNumbers = false) => {
    const fd = new FormData();
    fd.append('file', file);
    return postForm<ImportResult>('/import/orders', fd, { resolveDuplicateOrderNumbers });
  },
};
