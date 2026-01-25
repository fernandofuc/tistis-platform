// =====================================================
// TIS TIS PLATFORM - Booking Hold Service
// API service for temporary booking holds
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// - RPC: create_booking_hold, convert_hold_to_appointment, release_booking_hold
// - Types: src/features/secure-booking/types/index.ts
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  BookingHold,
  BookingHoldFormData,
  HoldStatus,
  CreateHoldResult,
} from '../types';

const API_BASE = '/api/secure-booking/holds';

// ======================
// HELPERS
// ======================

/**
 * Get auth headers using the shared Supabase client
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    console.warn('[booking-hold.service] No session found - requests may fail with 401');
  }

  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data.data;
}

// ======================
// READ OPERATIONS
// ======================

/**
 * Get active holds for a branch
 */
export async function getActiveHolds(params: {
  branch_id: string;
  date_from?: string;
  date_to?: string;
}): Promise<BookingHold[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  searchParams.set('branch_id', params.branch_id);
  searchParams.set('status', 'active');
  if (params.date_from) searchParams.set('date_from', params.date_from);
  if (params.date_to) searchParams.set('date_to', params.date_to);

  const response = await fetch(`${API_BASE}?${searchParams}`, { headers });
  return handleResponse<BookingHold[]>(response);
}

/**
 * Get all holds with filters
 */
export async function getHolds(params: {
  branch_id?: string;
  status?: HoldStatus[];
  session_id?: string;
  lead_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<BookingHold[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  if (params.branch_id) searchParams.set('branch_id', params.branch_id);
  if (params.status?.length) searchParams.set('status', params.status.join(','));
  if (params.session_id) searchParams.set('session_id', params.session_id);
  if (params.lead_id) searchParams.set('lead_id', params.lead_id);
  if (params.date_from) searchParams.set('date_from', params.date_from);
  if (params.date_to) searchParams.set('date_to', params.date_to);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}?${searchParams}`, { headers });
  return handleResponse<BookingHold[]>(response);
}

/**
 * Get a single hold by ID
 */
export async function getHold(holdId: string): Promise<BookingHold> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${holdId}`, { headers });
  return handleResponse<BookingHold>(response);
}

/**
 * Get hold by session ID (for voice/chat integration)
 */
export async function getHoldBySession(sessionId: string): Promise<BookingHold | null> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams({
    session_id: sessionId,
    status: 'active',
    limit: '1',
  });

  const response = await fetch(`${API_BASE}?${searchParams}`, { headers });
  const holds = await handleResponse<BookingHold[]>(response);
  return holds.length > 0 ? holds[0] : null;
}

/**
 * Check if a slot is available (no active holds or appointments)
 */
export async function checkSlotAvailability(params: {
  branch_id: string;
  slot_datetime: string;
  duration_minutes: number;
}): Promise<{ available: boolean; reason?: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/check-availability`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return handleResponse<{ available: boolean; reason?: string }>(response);
}

// ======================
// WRITE OPERATIONS
// ======================

/**
 * Create a new booking hold using RPC
 * This uses advisory locks to prevent race conditions
 */
export async function createHold(data: BookingHoldFormData): Promise<CreateHoldResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<CreateHoldResult>(response);
}

/**
 * Convert a hold to an appointment
 */
export async function convertToAppointment(
  holdId: string,
  appointmentId: string
): Promise<boolean> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${holdId}/convert`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ appointment_id: appointmentId }),
  });
  const result = await handleResponse<{ converted: boolean }>(response);
  return result.converted;
}

/**
 * Release a hold manually
 */
export async function releaseHold(
  holdId: string,
  reason: string = 'manual_release'
): Promise<boolean> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${holdId}/release`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  const result = await handleResponse<{ released: boolean }>(response);
  return result.released;
}

/**
 * Extend a hold's expiration time
 */
export async function extendHold(
  holdId: string,
  additionalMinutes: number = 10
): Promise<BookingHold> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${holdId}/extend`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ additional_minutes: additionalMinutes }),
  });
  return handleResponse<BookingHold>(response);
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Calculate remaining time for a hold in seconds
 */
export function getHoldRemainingSeconds(hold: BookingHold): number {
  if (hold.status !== 'active') return 0;
  const expiresAt = new Date(hold.expires_at).getTime();
  const now = Date.now();
  const remainingMs = expiresAt - now;
  return Math.max(0, Math.floor(remainingMs / 1000));
}

/**
 * Check if a hold is still active
 */
export function isHoldActive(hold: BookingHold): boolean {
  return hold.status === 'active' && getHoldRemainingSeconds(hold) > 0;
}

/**
 * Format hold expiration for display
 */
export function formatHoldExpiration(hold: BookingHold): string {
  const seconds = getHoldRemainingSeconds(hold);
  if (seconds <= 0) return 'Expirado';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}
