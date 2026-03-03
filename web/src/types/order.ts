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

export interface CreateOrderLineRequest {
  plantCatalogId: string;
  qtyOrdered: number;
  notes?: string | null;
}
