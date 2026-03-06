import { getWithHeaders } from './client.js';
import { buildAdminHeaders } from './adminHeaders.js';

export interface AdminPinValidationResponse {
  valid: boolean;
  validatedAt: string;
}

export const adminApi = {
  verifyPin: (pin: string) =>
    getWithHeaders<AdminPinValidationResponse>('/admin-actions/verify-pin', buildAdminHeaders(pin)),
};

export { buildAdminHeaders } from './adminHeaders.js';
