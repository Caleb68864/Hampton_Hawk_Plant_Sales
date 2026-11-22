import { get, postForm } from './client.js';
import type { ImportBatch, ImportIssue, ImportResult } from '@/types/import.js';
import type { PagedResult, PaginationParams } from '@/types/api.js';

export const importsApi = {
  list: (params?: PaginationParams) =>
    get<PagedResult<ImportBatch>>('/import/batches', params as Record<string, unknown>),

  getIssues: (batchId: string, params?: PaginationParams & { search?: string }) =>
    get<PagedResult<ImportIssue>>(`/import/batches/${batchId}/issues`, params as Record<string, unknown>),

  /**
   * Every issue of a batch, a page at a time. The page used to show the first 200
   * and drop the rest silently. Bounded by the file (uploads are capped at 10 MB).
   */
  getAllIssues: async (batchId: string): Promise<ImportIssue[]> => {
    const all: ImportIssue[] = [];
    for (let page = 1; page <= 100; page++) {
      const result = await get<PagedResult<ImportIssue>>(`/import/batches/${batchId}/issues`, { page, pageSize: 200 });
      all.push(...result.items);
      if (result.items.length === 0 || all.length >= result.totalCount) break;
    }
    return all;
  },

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
