import axios from 'axios';
import type { ApiResponse } from '../types/api.js';
import { getApiErrorMessage } from './errorMessage.js';

// Sale-day networking is a field LAN, not a datacenter: a dropped AP association
// leaves a socket open with nothing on the other end. Without a ceiling the request
// hangs forever, the volunteer sees a spinner that never resolves, and they re-tap --
// which is how duplicate scans get submitted. Fail fast and let them retry knowingly.
const REQUEST_TIMEOUT_MS = 10_000;

const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
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

export async function getWithHeaders<T>(url: string, headers: Record<string, string>): Promise<T> {
  return unwrap<T>(await apiClient.get<ApiResponse<T>>(url, { headers }));
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

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  return unwrap<T>(await apiClient.patch<ApiResponse<T>>(url, data));
}

export async function patchWithHeaders<T>(url: string, data: unknown, headers: Record<string, string>): Promise<T> {
  return unwrap<T>(await apiClient.patch<ApiResponse<T>>(url, data, { headers }));
}

export async function putWithHeaders<T>(url: string, data: unknown, headers: Record<string, string>): Promise<T> {
  return unwrap<T>(await apiClient.put<ApiResponse<T>>(url, data, { headers }));
}

export async function del<T = void>(url: string): Promise<T> {
  return unwrap<T>(await apiClient.delete<ApiResponse<T>>(url));
}

export async function delWithHeaders<T = void>(url: string, headers: Record<string, string>): Promise<T> {
  return unwrap<T>(await apiClient.delete<ApiResponse<T>>(url, { headers }));
}

// File imports parse a whole spreadsheet server-side and legitimately outrun the
// interactive timeout, so uploads get their own much larger ceiling.
const UPLOAD_TIMEOUT_MS = 120_000;

export async function postForm<T>(url: string, formData: FormData, params?: Record<string, unknown>): Promise<T> {
  return unwrap<T>(
    await apiClient.post<ApiResponse<T>>(url, formData, {
      params,
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    }),
  );
}

export default apiClient;
