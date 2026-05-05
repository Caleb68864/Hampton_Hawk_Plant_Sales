import { get, post } from './client.js';
import type { CurrentUser } from '../types/auth.js';

export interface LoginRequest {
  username: string;
  password: string;
}

export async function login(credentials: LoginRequest): Promise<CurrentUser> {
  return post<CurrentUser>('/auth/login', credentials);
}

export async function logout(): Promise<void> {
  await post<void>('/auth/logout');
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return get<CurrentUser>('/auth/me');
}
