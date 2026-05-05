import { get, post, put } from './client.js';
import type { AppUser, CreateUserRequest, UpdateUserRequest, ResetPasswordRequest } from '../types/user.js';

export const usersApi = {
  list: (): Promise<AppUser[]> =>
    get<AppUser[]>('/users'),

  create: (data: CreateUserRequest): Promise<AppUser> =>
    post<AppUser>('/users', data),

  update: (id: number, data: UpdateUserRequest): Promise<AppUser> =>
    put<AppUser>(`/users/${id}`, data),

  resetPassword: (id: number, data: ResetPasswordRequest): Promise<void> =>
    post<void>(`/users/${id}/reset-password`, data),
};
