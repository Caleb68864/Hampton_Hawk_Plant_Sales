export interface Plant {
  id: string;
  sku: string;
  name: string;
  variant: string | null;
  price: number | null;
  barcode: string;
  barcodeLockedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlantRequest {
  sku: string;
  name: string;
  variant?: string | null;
  price?: number | null;
  barcode: string;
  isActive?: boolean;
}

export interface UpdatePlantRequest {
  sku?: string;
  name?: string;
  variant?: string | null;
  price?: number | null;
  barcode?: string;
  isActive?: boolean;
}
