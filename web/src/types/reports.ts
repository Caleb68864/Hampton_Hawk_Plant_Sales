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

export interface SalesBySellerRow {
  sellerId: string;
  sellerDisplayName: string;
  orderCount: number;
  itemsOrdered: number;
  itemsFulfilled: number;
  revenueOrdered: number;
  revenueFulfilled: number;
}

export interface SalesByCustomerRow {
  customerId: string;
  customerDisplayName: string;
  orderCount: number;
  itemsOrdered: number;
  itemsFulfilled: number;
  revenueOrdered: number;
  revenueFulfilled: number;
}

export interface SalesByPlantRow {
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  orderCount: number;
  itemsOrdered: number;
  itemsFulfilled: number;
  revenueOrdered: number;
  revenueFulfilled: number;
}
