// SS-13: TypeScript mirrors of the backend ScanSession DTOs (see
// api/src/HamptonHawksPlantSales.Core/DTOs/ScanSessionDtos.cs and the matching
// enums under HamptonHawksPlantSales.Core.Enums). The JSON serializer emits
// camelCase; keep these names aligned with that wire format.

export type ScanSessionEntityKind = 'Customer' | 'Seller' | 'AdHoc';

export type ScanSessionResult =
  | 'Accepted'
  | 'NotFound'
  | 'AlreadyFulfilled'
  | 'NotInSession'
  | 'OutOfStock'
  | 'SaleClosedBlocked'
  | 'Expired';

export interface CreateScanSessionRequest {
  scannedBarcode: string;
  workstationName: string;
}

export interface ScanInSessionRequest {
  plantBarcode: string;
}

export interface ScanSessionAggregatedLine {
  plantCatalogId: string;
  plantSku: string;
  plantName: string;
  qtyOrdered: number;
  qtyFulfilled: number;
  qtyRemaining: number;
}

export interface ScanSessionPlantInfo {
  sku: string;
  name: string;
}

export interface ScanSessionResponse {
  id: string;
  entityKind: ScanSessionEntityKind;
  entityId: string | null;
  entityName: string;
  workstationName: string;
  includedOrderIds: string[];
  aggregatedLines: ScanSessionAggregatedLine[];
  remainingTotal: number;
  expiresAt: string;
  closedAt: string | null;
}

export interface ScanSessionScanResponse {
  result: ScanSessionResult;
  message: string | null;
  plant: ScanSessionPlantInfo | null;
  session: ScanSessionResponse;
}
