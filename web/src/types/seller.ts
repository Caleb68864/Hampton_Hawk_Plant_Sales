export interface Seller {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  grade: string | null;
  teacher: string | null;
  notes: string | null;
  picklistBarcode: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSellerRequest {
  firstName?: string | null;
  lastName?: string | null;
  displayName: string;
  grade?: string | null;
  teacher?: string | null;
  notes?: string | null;
}
