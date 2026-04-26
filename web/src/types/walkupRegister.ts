/**
 * Walk-Up Register Types
 * Mirrors backend DTOs for the WalkUpRegisterController API (SS-07).
 *
 * Backend returns OrderResponse / OrderLineResponse shapes. Unit price comes
 * from the PlantCatalog (priced separately client-side via plantsApi cache);
 * line totals and grand totals are computed client-side from those prices.
 */
import type { Customer } from './customer.js';

export type CustomerSummary = Customer;

// Re-export a friendly alias so the page can hold the price lookup keyed by plant id.
export type PlantPriceMap = Record<string, number | null | undefined>;

export type DraftOrderStatus =
  | 'Draft'
  | 'Open'
  | 'InProgress'
  | 'Complete'
  | 'Cancelled';

export interface DraftOrderLine {
  id: string;
  orderId: string;
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  qtyOrdered: number;
  qtyFulfilled: number;
  notes: string | null;
  lastScanIdempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerSummary {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

export interface DraftOrder {
  id: string;
  customerId: string | null;
  sellerId: string | null;
  orderNumber: string;
  barcode?: string | null;
  status: DraftOrderStatus;
  isWalkUp: boolean;
  hasIssue: boolean;
  paymentMethod: string | null;
  amountTendered: number | null;
  customer: CustomerSummary | null;
  seller: SellerSummary | null;
  lines: DraftOrderLine[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateDraftRequest {
  workstationName?: string;
}

export interface ScanIntoDraftRequest {
  plantBarcode: string;
  scanId: string;
}

/**
 * Adjust a draft line. The backend (WalkUpRegisterController PATCH) infers the
 * line by lineId and updates qtyOrdered/qtyFulfilled to newQty. PlantCatalogId
 * is sent for audit + safety.
 */
export interface AdjustLineRequest {
  plantCatalogId: string;
  newQty: number;
}

export interface CloseDraftRequest {
  paymentMethod?: string | null;
  amountTendered?: number | null;
}

/**
 * Compute the line subtotal using a price lookup. Returns 0 when price unknown.
 */
export function lineSubtotal(line: DraftOrderLine, prices: PlantPriceMap): number {
  const price = prices[line.plantCatalogId];
  if (price == null) return 0;
  return price * Math.max(line.qtyOrdered, 0);
}

/**
 * Compute the grand total using a price lookup. Skips lines without a known price.
 */
export function grandTotal(draft: DraftOrder | null, prices: PlantPriceMap): number {
  if (!draft) return 0;
  return draft.lines.reduce((sum, line) => sum + lineSubtotal(line, prices), 0);
}
