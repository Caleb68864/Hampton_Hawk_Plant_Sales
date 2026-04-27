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

// SS-03 (Wave 3): TS mirrors of the new Wave 2 report DTOs. Date-typed fields
// arrive over JSON as ISO strings, so we use `string` here.

export interface DailySalesDay {
  date: string;
  orderCount: number;
  itemCount: number;
  revenue: number;
  walkUpCount: number;
  preorderCount: number;
}

export interface DailySalesResponse {
  days: DailySalesDay[];
}

export interface PaymentBreakdownRow {
  method: string;
  orderCount: number;
  revenue: number;
  averageOrder: number;
}

export interface PaymentBreakdownResponse {
  methods: PaymentBreakdownRow[];
}

export interface ChannelMetrics {
  orderCount: number;
  itemCount: number;
  revenue: number;
  averageOrder: number;
}

export interface WalkupVsPreorderResponse {
  walkUp: ChannelMetrics;
  preorder: ChannelMetrics;
  walkUpRatio: number;
}

export interface StatusFunnelBucket {
  status: string;
  count: number;
  percent: number;
}

export interface StatusFunnelResponse {
  buckets: StatusFunnelBucket[];
  total: number;
}

export interface TopMoverRow {
  plantCatalogId: string;
  plantName: string;
  qtyOrdered: number;
  qtyFulfilled: number;
  orderCount: number;
}

export interface TopMoversResponse {
  plants: TopMoverRow[];
}

export interface OutstandingAgingBucket {
  bucket: string;
  count: number;
  oldestAgeHours: number;
}

export interface OutstandingAgingResponse {
  buckets: OutstandingAgingBucket[];
}
