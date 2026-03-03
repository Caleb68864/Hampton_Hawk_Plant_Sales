export interface DashboardMetrics {
  totalOrders: number;
  openOrders: number;
  completedOrders: number;
  totalCustomers: number;
  totalSellers: number;
  totalPlants: number;
  totalInventoryItems: number;
  lowInventoryCount: number;
  problemOrderCount: number;
}

export interface LowInventoryItem {
  plantCatalogId: string;
  plantName: string;
  sku: string;
  onHandQty: number;
  preorderRemaining: number;
}

export interface ProblemOrder {
  orderId: string;
  orderNumber: string;
  customerDisplayName: string;
  status: string;
  hasIssue: boolean;
  issueDescription: string | null;
}
