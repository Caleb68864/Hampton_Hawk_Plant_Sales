export type OrderStatus = 'Open' | 'InProgress' | 'Complete' | 'Cancelled';

export interface OrderLine {
  id: string;
  orderId: string;
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  qtyOrdered: number;
  qtyFulfilled: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerDisplayName: string;
  sellerId: string | null;
  sellerDisplayName: string | null;
  orderNumber: string;
  barcode?: string | null;
  status: OrderStatus;
  isWalkUp: boolean;
  hasIssue: boolean;
  lines: OrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  customerId: string;
  sellerId?: string | null;
  isWalkUp?: boolean;
  lines: CreateOrderLineRequest[];
}

export interface UpdateOrderRequest {
  customerId: string;
  sellerId: string | null;
  status: OrderStatus;
  isWalkUp: boolean;
  hasIssue: boolean;
}

export interface CreateOrderLineRequest {
  plantCatalogId: string;
  qtyOrdered: number;
  notes?: string | null;
}

// Bulk operation types
export type BulkOutcome = 'Completed' | 'Skipped' | 'StatusChanged';

export interface BulkOrderOutcome {
  orderId: string;
  outcome: BulkOutcome;
  reason?: string;
}

export interface BulkOperationResult {
  outcomes: BulkOrderOutcome[];
}

export interface BulkCompleteRequest {
  orderIds: string[];
}

export interface BulkSetStatusRequest {
  orderIds: string[];
  targetStatus: OrderStatus;
}
