/**
 * Typed HTTP client - thin wrapper around fetch.
 *
 * WHY not axios: axios adds ~50 kB to the bundle. For a small set of API
 * calls, fetch + this wrapper is sufficient and tree-shakeable.
 *
 * Dev: Vite proxies /api to localhost:3001 (same-origin, BASE_URL = '').
 * Prod: VITE_API_URL points to the Railway server service URL.
 */

import type { ApiErrorBody } from '../types';

// Empty string = same-origin (dev proxy). Set VITE_API_URL in production.
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// ── Error type ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, init);

  if (!response.ok) {
    let errorBody: ApiErrorBody;
    try {
      errorBody = (await response.json()) as ApiErrorBody;
    } catch {
      throw new ApiError(response.status, 'NETWORK_ERROR', response.statusText);
    }
    throw new ApiError(
      response.status,
      errorBody.error.code,
      errorBody.error.message,
      errorBody.error.details
    );
  }

  // 204 No Content - return empty object
  if (response.status === 204) return {} as T;

  return response.json() as Promise<T>;
}

// ── Public API ─────────────────────────────────────────────────────────────

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>('GET', path);
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>('POST', path, body);
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>('PUT', path, body);
  },
  delete<T>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
};
