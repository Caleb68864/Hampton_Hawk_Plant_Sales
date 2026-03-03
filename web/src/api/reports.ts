import { get } from './client.js';
import type { DashboardMetrics, LowInventoryItem, ProblemOrder } from '@/types/reports.js';
import type { Order } from '@/types/order.js';

export const reportsApi = {
  dashboardMetrics: () => get<DashboardMetrics>('/reports/dashboard-metrics'),

  lowInventory: () => get<LowInventoryItem[]>('/reports/low-inventory'),

  problemOrders: () => get<ProblemOrder[]>('/reports/problem-orders'),

  sellerOrders: (sellerId: string) => get<Order[]>(`/reports/seller/${sellerId}/orders`),
};
