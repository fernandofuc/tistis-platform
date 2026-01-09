// =====================================================
// TIS TIS PLATFORM - Shared API Client
// Centralized authenticated fetch utility for client-side services
// =====================================================
// This module provides a unified way to make authenticated
// API requests from client-side code. It handles:
// - Supabase session retrieval
// - Authorization header injection
// - Response parsing and error handling
// =====================================================

import { supabase } from './supabase';

// ======================
// TYPES
// ======================

export interface APIResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface FetchWithAuthOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /**
   * If true, throws an error when the response is not ok.
   * If false, returns the error response without throwing.
   * Default: true
   */
  throwOnError?: boolean;
}

// ======================
// MAIN FETCH FUNCTION
// ======================

/**
 * Makes an authenticated fetch request to the TIS TIS API.
 *
 * Automatically:
 * - Retrieves the current Supabase session
 * - Adds Authorization header with Bearer token
 * - Adds Content-Type: application/json header (can be overridden)
 * - Parses JSON response
 * - Handles errors consistently
 *
 * @example
 * ```typescript
 * // GET request
 * const data = await fetchWithAuth('/api/loyalty/programs');
 *
 * // POST request
 * const result = await fetchWithAuth('/api/loyalty/programs', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'New Program' }),
 * });
 *
 * // With custom headers
 * const response = await fetchWithAuth('/api/upload', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'multipart/form-data' },
 *   body: formData,
 * });
 * ```
 */
export async function fetchWithAuth<T = unknown>(
  url: string,
  options: FetchWithAuthOptions = {}
): Promise<T> {
  const { throwOnError = true, headers: customHeaders, ...fetchOptions } = options;

  // Get current session from shared Supabase client
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('[API Client] Session error:', sessionError.message);
    throw new Error('Failed to get authentication session');
  }

  if (!session?.access_token) {
    throw new Error('No active session. Please log in.');
  }

  // Build headers - custom headers take precedence
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
    // Authorization always comes last to ensure it's not overridden
    'Authorization': `Bearer ${session.access_token}`,
  };

  // Make the request
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Parse response
  let data: T;
  try {
    data = await response.json();
  } catch {
    // Response is not JSON
    if (!response.ok && throwOnError) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return {} as T;
  }

  // Handle error responses
  if (!response.ok) {
    const errorMessage =
      (data as APIResponse).error ||
      (data as APIResponse).message ||
      `Request failed with status ${response.status}`;

    if (throwOnError) {
      throw new Error(errorMessage);
    }

    console.error('[API Client] Request failed:', errorMessage);
  }

  return data;
}

// ======================
// CONVENIENCE METHODS
// ======================

/**
 * Makes a GET request with authentication.
 */
export async function apiGet<T = unknown>(
  url: string,
  options?: Omit<FetchWithAuthOptions, 'method' | 'body'>
): Promise<T> {
  return fetchWithAuth<T>(url, { ...options, method: 'GET' });
}

/**
 * Makes a POST request with authentication.
 */
export async function apiPost<T = unknown>(
  url: string,
  body: unknown,
  options?: Omit<FetchWithAuthOptions, 'method' | 'body'>
): Promise<T> {
  return fetchWithAuth<T>(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Makes a PUT request with authentication.
 */
export async function apiPut<T = unknown>(
  url: string,
  body: unknown,
  options?: Omit<FetchWithAuthOptions, 'method' | 'body'>
): Promise<T> {
  return fetchWithAuth<T>(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Makes a PATCH request with authentication.
 */
export async function apiPatch<T = unknown>(
  url: string,
  body: unknown,
  options?: Omit<FetchWithAuthOptions, 'method' | 'body'>
): Promise<T> {
  return fetchWithAuth<T>(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Makes a DELETE request with authentication.
 */
export async function apiDelete<T = unknown>(
  url: string,
  options?: Omit<FetchWithAuthOptions, 'method'>
): Promise<T> {
  return fetchWithAuth<T>(url, { ...options, method: 'DELETE' });
}

// ======================
// UTILITIES
// ======================

/**
 * Builds a URL with query parameters.
 *
 * @example
 * ```typescript
 * const url = buildUrl('/api/items', { status: 'active', limit: 10 });
 * // Returns: '/api/items?status=active&limit=10'
 * ```
 */
export function buildUrl(
  baseUrl: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  if (!params) {
    return baseUrl;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  if (!queryString) {
    return baseUrl;
  }

  return `${baseUrl}?${queryString}`;
}

/**
 * Checks if the current user has an active session.
 * Useful for conditional rendering or pre-flight checks.
 */
export async function hasActiveSession(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session?.access_token;
  } catch {
    return false;
  }
}

/**
 * Gets the current access token if available.
 * Returns null if no session exists.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}
