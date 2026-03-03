import axios from 'axios';
import type { ApiResponse } from '@/types/api.js';
import { getApiErrorMessage } from './errorMessage.js';

const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const message = getApiErrorMessage(error);
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  },
);

function unwrap<T>(response: { data: ApiResponse<T> }): T {
  return response.data.data;
}

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return unwrap<T>(await apiClient.get<ApiResponse<T>>(url, { params }));
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  return unwrap<T>(await apiClient.post<ApiResponse<T>>(url, data));
}

export async function postWithHeaders<T>(url: string, data: unknown, headers: Record<string, string>): Promise<T> {
  return unwrap<T>(await apiClient.post<ApiResponse<T>>(url, data, { headers }));
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  return unwrap<T>(await apiClient.put<ApiResponse<T>>(url, data));
}

export async function del<T = void>(url: string): Promise<T> {
  return unwrap<T>(await apiClient.delete<ApiResponse<T>>(url));
}

export async function postForm<T>(url: string, formData: FormData): Promise<T> {
  return unwrap<T>(
    await apiClient.post<ApiResponse<T>>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}

export default apiClient;
