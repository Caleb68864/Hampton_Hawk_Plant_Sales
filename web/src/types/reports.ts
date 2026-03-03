export interface DashboardMetrics {
  totalOrders: number;
  openOrders: number;
  completedOrders: number;
  totalCustomers: number;
  totalSellers: number;
  lowInventoryCount: number;
  problemOrderCount: number;
  ordersByStatus: Record<string, number>;
  totalItemsOrdered: number;
  totalItemsFulfilled: number;
  saleProgressPercent: number;
}

export interface LowInventoryItem {
  plantCatalogId: string;
  plantName: string;
  sku: string;
  onHandQty: number;
}

export interface ProblemOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  sellerName?: string | null;
  status: string;
  lineCount: number;
  createdAt: string;
}

export interface SellerOrderSummary {
  orderId: string;
  orderNumber: string;
  customerName: string;
  status: string;
  hasIssue: boolean;
  totalItemsOrdered: number;
  totalItemsFulfilled: number;
  createdAt: string;
}
