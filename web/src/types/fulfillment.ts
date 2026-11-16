export type FulfillmentResultType =
  | 'Accepted'
  | 'NotFound'
  | 'WrongOrder'
  | 'AlreadyFulfilled'
  | 'SaleClosedBlocked'
  | 'OutOfStock'
  // Audit-only: written when an accepted scan is reversed (mirrors the API's
  // FulfillmentResult.Undone). A scan response never carries it.
  | 'Undone';

export interface ScanRequest {
  barcode: string;
  /**
   * Multi-quantity scanning: number of units to fulfill in one scan.
   * Optional; backend defaults to 1 when omitted. Volunteer "set 6, scan once"
   * workflow drives this from the QuantitySelector on PickupScanPage.
   */
  quantity?: number;
  /**
   * Stable id for this physical scan, reused when retrying a submission that
   * failed or timed out. The backend treats a repeat of an id it has already
   * accepted on this order as a replay and does not fulfill a second unit.
   * Optional: omitting it preserves the previous at-least-once behaviour.
   */
  scanId?: string;
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

/** Mirrors the API's FulfillmentEventSource (serialized as its name). */
export type FulfillmentEventSource = 'PickupScan' | 'SessionScan' | 'ManualFulfill' | 'Undo';

export interface FulfillmentEvent {
  id: string;
  orderId: string;
  plantCatalogId: string | null;
  barcode: string;
  result: FulfillmentResultType;
  message: string | null;
  /**
   * Signed-in account that wrote the event (sale-day accounts are per station, so
   * this names the station login, not the volunteer). Null for rows written before
   * attribution landed or without a signed-in user.
   */
  userId: string | null;
  /** Write path that produced the event, set by the server. Null on older rows. */
  source: FulfillmentEventSource | null;
  createdAt: string;
}


export interface ManualFulfillRequest {
  orderLineId: string;
  reason: string;
  operatorName: string;
}
