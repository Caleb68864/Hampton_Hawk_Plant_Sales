import { get } from './client.js';
import type { DashboardMetrics, LowInventoryItem, ProblemOrder, SellerOrderSummary } from '@/types/reports.js';

function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === 'object') ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeDashboardMetrics(raw: unknown): DashboardMetrics {
  const r = asRecord(raw);
  return {
    totalOrders: asNumber(r.totalOrders ?? r.TotalOrders),
    openOrders: asNumber(r.openOrders ?? r.OpenOrders),
    completedOrders: asNumber(r.completedOrders ?? r.CompletedOrders),
    totalCustomers: asNumber(r.totalCustomers ?? r.TotalCustomers),
    totalSellers: asNumber(r.totalSellers ?? r.TotalSellers),
    lowInventoryCount: asNumber(r.lowInventoryCount ?? r.LowInventoryCount),
    problemOrderCount: asNumber(r.problemOrderCount ?? r.ProblemOrderCount),
    ordersByStatus: asRecord(r.ordersByStatus ?? r.OrdersByStatus) as Record<string, number>,
    totalItemsOrdered: asNumber(r.totalItemsOrdered ?? r.TotalItemsOrdered),
    totalItemsFulfilled: asNumber(r.totalItemsFulfilled ?? r.TotalItemsFulfilled),
    saleProgressPercent: asNumber(r.saleProgressPercent ?? r.SaleProgressPercent),
  };
}

function normalizeLowInventory(items: unknown): LowInventoryItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const r = asRecord(raw);
    return {
      plantCatalogId: asString(r.plantCatalogId ?? r.PlantCatalogId),
      plantName: asString(r.plantName ?? r.PlantName),
      sku: asString(r.sku ?? r.Sku),
      onHandQty: asNumber(r.onHandQty ?? r.OnHandQty),
    };
  });
}

function normalizeProblemOrders(items: unknown): ProblemOrder[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const r = asRecord(raw);
    return {
      id: asString(r.id ?? r.Id),
      orderNumber: asString(r.orderNumber ?? r.OrderNumber),
      customerName: asString(r.customerName ?? r.CustomerName),
      sellerName: (r.sellerName ?? r.SellerName ?? null) as string | null,
      status: asString(r.status ?? r.Status),
      lineCount: asNumber(r.lineCount ?? r.LineCount),
      createdAt: asString(r.createdAt ?? r.CreatedAt),
    };
  });
}

function normalizeSellerOrders(items: unknown): SellerOrderSummary[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const r = asRecord(raw);
    return {
      orderId: asString(r.orderId ?? r.OrderId),
      orderNumber: asString(r.orderNumber ?? r.OrderNumber),
      customerName: asString(r.customerName ?? r.CustomerName),
      status: asString(r.status ?? r.Status),
      hasIssue: Boolean(r.hasIssue ?? r.HasIssue),
      totalItemsOrdered: asNumber(r.totalItemsOrdered ?? r.TotalItemsOrdered),
      totalItemsFulfilled: asNumber(r.totalItemsFulfilled ?? r.TotalItemsFulfilled),
      createdAt: asString(r.createdAt ?? r.CreatedAt),
    };
  });
}

export const reportsApi = {
  dashboardMetrics: async () => normalizeDashboardMetrics(await get<unknown>('/reports/dashboard-metrics')),

  lowInventory: async () => normalizeLowInventory(await get<unknown>('/reports/low-inventory')),

  problemOrders: async () => normalizeProblemOrders(await get<unknown>('/reports/problem-orders')),

  sellerOrders: async (sellerId: string) => normalizeSellerOrders(await get<unknown>(`/reports/seller/${sellerId}/orders`)),
};
