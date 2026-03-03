export interface InventoryItem {
  id: string;
  plantCatalogId: string;
  onHandQty: number;
  plantName: string;
  plantSku: string;
  barcode: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInventoryRequest {
  onHandQty: number;
  adminPin?: string;
  reason?: string;
}

export interface AdjustInventoryRequest {
  plantCatalogId: string;
  deltaQty: number;
  reason: string;
  adminPin?: string;
}
