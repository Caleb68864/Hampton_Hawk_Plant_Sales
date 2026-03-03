export interface Seller {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  grade: string | null;
  teacher: string | null;
  notes: string | null;
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
