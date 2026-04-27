export type FulfillmentResultType =
  | 'Accepted'
  | 'NotFound'
  | 'WrongOrder'
  | 'AlreadyFulfilled'
  | 'SaleClosedBlocked'
  | 'OutOfStock';

export interface ScanRequest {
  barcode: string;
  /**
   * Multi-quantity scanning: number of units to fulfill in one scan.
   * Optional; backend defaults to 1 when omitted. Volunteer "set 6, scan once"
   * workflow drives this from the QuantitySelector on PickupScanPage.
   */
  quantity?: number;
}

export interface ScanResponse {
  result: FulfillmentResultType;
  orderId?: string | null;
  plant?: {
    sku: string;
    name: string;
  } | null;
  line?: {
    qtyOrdered: number;
    qtyFulfilled: number;
    qtyRemaining: number;
  } | null;
  orderRemainingItems: number;
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


export interface ManualFulfillRequest {
  orderLineId: string;
  reason: string;
  operatorName: string;
}
