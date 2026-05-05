import type { AppRole } from './auth.js';

export interface AppUser {
  id: number;
  username: string;
  displayName: string;
  isActive: boolean;
  roles: AppRole[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  displayName: string;
  isActive: boolean;
  roles: AppRole[];
}

export interface UpdateUserRequest {
  displayName: string;
  isActive: boolean;
  roles: AppRole[];
}

export interface ResetPasswordRequest {
  newPassword: string;
}
