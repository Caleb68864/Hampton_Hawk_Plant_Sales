export type FulfillmentResultType =
  | 'Accepted'
  | 'NotFound'
  | 'WrongOrder'
  | 'AlreadyFulfilled'
  | 'SaleClosedBlocked'
  | 'OutOfStock';

export interface ScanRequest {
  barcode: string;
}

export interface ScanResponse {
  result: FulfillmentResultType;
  message: string;
  plantName?: string | null;
  qtyFulfilled?: number;
  qtyOrdered?: number;
}

export interface FulfillmentResult {
  result: FulfillmentResultType;
  message: string;
}

export interface FulfillmentEvent {
  id: string;
  orderId: string;
  plantCatalogId: string | null;
  barcode: string;
  result: FulfillmentResultType;
  message: string | null;
  createdAt: string;
}
