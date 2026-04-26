import { get } from './client.js';
import type {
  DailySalesResponse,
  DashboardMetrics,
  LowInventoryItem,
  OutstandingAgingResponse,
  PaymentBreakdownResponse,
  ProblemOrder,
  SalesByCustomerRow,
  SalesByPlantRow,
  SalesBySellerRow,
  SellerOrderSummary,
  StatusFunnelResponse,
  TopMoversResponse,
  WalkupVsPreorderResponse,
} from '@/types/reports.js';

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

function normalizeSalesBySeller(items: unknown): SalesBySellerRow[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const r = asRecord(raw);
    return {
      sellerId: asString(r.sellerId ?? r.SellerId),
      sellerDisplayName: asString(r.sellerDisplayName ?? r.SellerDisplayName),
      orderCount: asNumber(r.orderCount ?? r.OrderCount),
      itemsOrdered: asNumber(r.itemsOrdered ?? r.ItemsOrdered),
      itemsFulfilled: asNumber(r.itemsFulfilled ?? r.ItemsFulfilled),
      revenueOrdered: asNumber(r.revenueOrdered ?? r.RevenueOrdered),
      revenueFulfilled: asNumber(r.revenueFulfilled ?? r.RevenueFulfilled),
    };
  });
}

function normalizeSalesByCustomer(items: unknown): SalesByCustomerRow[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const r = asRecord(raw);
    return {
      customerId: asString(r.customerId ?? r.CustomerId),
      customerDisplayName: asString(r.customerDisplayName ?? r.CustomerDisplayName),
      orderCount: asNumber(r.orderCount ?? r.OrderCount),
      itemsOrdered: asNumber(r.itemsOrdered ?? r.ItemsOrdered),
      itemsFulfilled: asNumber(r.itemsFulfilled ?? r.ItemsFulfilled),
      revenueOrdered: asNumber(r.revenueOrdered ?? r.RevenueOrdered),
      revenueFulfilled: asNumber(r.revenueFulfilled ?? r.RevenueFulfilled),
    };
  });
}

function normalizeSalesByPlant(items: unknown): SalesByPlantRow[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const r = asRecord(raw);
    return {
      plantCatalogId: asString(r.plantCatalogId ?? r.PlantCatalogId),
      plantName: asString(r.plantName ?? r.PlantName),
      plantSku: asString(r.plantSku ?? r.PlantSku),
      orderCount: asNumber(r.orderCount ?? r.OrderCount),
      itemsOrdered: asNumber(r.itemsOrdered ?? r.ItemsOrdered),
      itemsFulfilled: asNumber(r.itemsFulfilled ?? r.ItemsFulfilled),
      revenueOrdered: asNumber(r.revenueOrdered ?? r.RevenueOrdered),
      revenueFulfilled: asNumber(r.revenueFulfilled ?? r.RevenueFulfilled),
    };
  });
}

// SS-03 (Wave 3): normalizers for the new report DTOs.

function normalizeDailySales(raw: unknown): DailySalesResponse {
  const r = asRecord(raw);
  const days = Array.isArray(r.days ?? r.Days) ? (r.days ?? r.Days) as unknown[] : [];
  return {
    days: days.map((d) => {
      const row = asRecord(d);
      return {
        date: asString(row.date ?? row.Date),
        orderCount: asNumber(row.orderCount ?? row.OrderCount),
        itemCount: asNumber(row.itemCount ?? row.ItemCount),
        revenue: asNumber(row.revenue ?? row.Revenue),
        walkUpCount: asNumber(row.walkUpCount ?? row.WalkUpCount),
        preorderCount: asNumber(row.preorderCount ?? row.PreorderCount),
      };
    }),
  };
}

function normalizePaymentBreakdown(raw: unknown): PaymentBreakdownResponse {
  const r = asRecord(raw);
  const methods = Array.isArray(r.methods ?? r.Methods) ? (r.methods ?? r.Methods) as unknown[] : [];
  return {
    methods: methods.map((m) => {
      const row = asRecord(m);
      return {
        method: asString(row.method ?? row.Method),
        orderCount: asNumber(row.orderCount ?? row.OrderCount),
        revenue: asNumber(row.revenue ?? row.Revenue),
        averageOrder: asNumber(row.averageOrder ?? row.AverageOrder),
      };
    }),
  };
}

function normalizeChannel(raw: unknown) {
  const r = asRecord(raw);
  return {
    orderCount: asNumber(r.orderCount ?? r.OrderCount),
    itemCount: asNumber(r.itemCount ?? r.ItemCount),
    revenue: asNumber(r.revenue ?? r.Revenue),
    averageOrder: asNumber(r.averageOrder ?? r.AverageOrder),
  };
}

function normalizeWalkupVsPreorder(raw: unknown): WalkupVsPreorderResponse {
  const r = asRecord(raw);
  return {
    walkUp: normalizeChannel(r.walkUp ?? r.WalkUp),
    preorder: normalizeChannel(r.preorder ?? r.Preorder),
    walkUpRatio: asNumber(r.walkUpRatio ?? r.WalkUpRatio),
  };
}

function normalizeStatusFunnel(raw: unknown): StatusFunnelResponse {
  const r = asRecord(raw);
  const buckets = Array.isArray(r.buckets ?? r.Buckets) ? (r.buckets ?? r.Buckets) as unknown[] : [];
  return {
    total: asNumber(r.total ?? r.Total),
    buckets: buckets.map((b) => {
      const row = asRecord(b);
      return {
        status: asString(row.status ?? row.Status),
        count: asNumber(row.count ?? row.Count),
        percent: asNumber(row.percent ?? row.Percent),
      };
    }),
  };
}

function normalizeTopMovers(raw: unknown): TopMoversResponse {
  const r = asRecord(raw);
  const plants = Array.isArray(r.plants ?? r.Plants) ? (r.plants ?? r.Plants) as unknown[] : [];
  return {
    plants: plants.map((p) => {
      const row = asRecord(p);
      return {
        plantCatalogId: asString(row.plantCatalogId ?? row.PlantCatalogId),
        plantName: asString(row.plantName ?? row.PlantName),
        qtyOrdered: asNumber(row.qtyOrdered ?? row.QtyOrdered),
        qtyFulfilled: asNumber(row.qtyFulfilled ?? row.QtyFulfilled),
        orderCount: asNumber(row.orderCount ?? row.OrderCount),
      };
    }),
  };
}

function normalizeOutstandingAging(raw: unknown): OutstandingAgingResponse {
  const r = asRecord(raw);
  const buckets = Array.isArray(r.buckets ?? r.Buckets) ? (r.buckets ?? r.Buckets) as unknown[] : [];
  return {
    buckets: buckets.map((b) => {
      const row = asRecord(b);
      return {
        bucket: asString(row.bucket ?? row.Bucket),
        count: asNumber(row.count ?? row.Count),
        oldestAgeHours: asNumber(row.oldestAgeHours ?? row.OldestAgeHours),
      };
    }),
  };
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

  salesBySeller: async () => normalizeSalesBySeller(await get<unknown>('/reports/sales-by-seller')),

  salesByCustomer: async () => normalizeSalesByCustomer(await get<unknown>('/reports/sales-by-customer')),

  salesByPlant: async () => normalizeSalesByPlant(await get<unknown>('/reports/sales-by-plant')),

  // SS-03 (Wave 3): six new aggregations from Wave 2.
  getDailySales: async (from?: string, to?: string) => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return normalizeDailySales(await get<unknown>('/reports/daily-sales', params));
  },

  getPaymentBreakdown: async (from?: string, to?: string) => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return normalizePaymentBreakdown(await get<unknown>('/reports/payment-breakdown', params));
  },

  getWalkupVsPreorder: async (from?: string, to?: string) => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return normalizeWalkupVsPreorder(await get<unknown>('/reports/walkup-vs-preorder', params));
  },

  getStatusFunnel: async () =>
    normalizeStatusFunnel(await get<unknown>('/reports/status-funnel')),

  getTopMovers: async (limit?: number) => {
    const params: Record<string, unknown> = {};
    if (typeof limit === 'number') params.limit = limit;
    return normalizeTopMovers(await get<unknown>('/reports/top-movers', params));
  },

  getOutstandingAging: async () =>
    normalizeOutstandingAging(await get<unknown>('/reports/outstanding-aging')),
};
