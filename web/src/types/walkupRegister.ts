/**
 * Walk-Up Register Types
 * Mirrors backend DTOs for the WalkUpRegisterController API
 */

export type DraftOrderStatus = 'Draft' | 'Open' | 'InProgress' | 'Complete' | 'Cancelled';

export interface DraftOrderLine {
  id: string;
  orderId: string;
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  unitPrice: number | null;
  qtyOrdered: number;
  qtyFulfilled: number;
  lineTotal: number;
  notes: string | null;
  isDeleted: boolean;
  lastScanIdempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftOrder {
  id: string;
  customerId: string | null;
  customerDisplayName: string | null;
  orderNumber: string;
  barcode: string | null;
  status: DraftOrderStatus;
  isWalkUp: boolean;
  workstationName: string | null;
  paymentMethod: string | null;
  amountTendered: number | null;
  grandTotal: number;
  lines: DraftOrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDraftRequest {
  workstationName: string;
}

export interface ScanIntoDraftRequest {
  plantBarcode: string;
  scanId: string;
}

export interface ScanIntoDraftResponse {
  draft: DraftOrder;
  scannedLine: DraftOrderLine;
  message: string | null;
}

export interface AdjustLineRequest {
  newQty: number;
}

export interface CloseDraftRequest {
  paymentMethod: string;
  amountTendered: number;
}

export interface CancelDraftRequest {
  reason: string;
}

export interface OpenDraftsResponse {
  drafts: DraftOrder[];
}
