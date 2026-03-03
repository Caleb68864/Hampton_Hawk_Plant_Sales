export interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  phone: string | null;
  email: string | null;
  pickupCode: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  firstName?: string | null;
  lastName?: string | null;
  displayName: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}
