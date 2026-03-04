import { get, postForm } from './client.js';
import type { ImportBatch, ImportResult } from '@/types/import.js';
import type { PagedResult } from '@/types/api.js';

export const importsApi = {
  list: () => get<PagedResult<ImportBatch>>('/import'),

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
