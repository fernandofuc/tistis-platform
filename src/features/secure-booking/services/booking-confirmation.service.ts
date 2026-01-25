// =====================================================
// TIS TIS PLATFORM - Booking Confirmation Service
// API service for booking confirmations (voice-to-message, reminders)
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// - Types: src/features/secure-booking/types/index.ts
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  BookingConfirmation,
  ConfirmationFormData,
  ConfirmationStatus,
  ConfirmationResponse,
  ReferenceType,
} from '../types';

const API_BASE = '/api/secure-booking/confirmations';

// ======================
// HELPERS
// ======================

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    console.warn('[booking-confirmation.service] No session found - requests may fail with 401');
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
 * Get confirmations with filters
 */
export async function getConfirmations(params: {
  reference_type?: ReferenceType;
  reference_id?: string;
  status?: ConfirmationStatus[];
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<BookingConfirmation[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  if (params.reference_type) searchParams.set('reference_type', params.reference_type);
  if (params.reference_id) searchParams.set('reference_id', params.reference_id);
  if (params.status?.length) searchParams.set('status', params.status.join(','));
  if (params.date_from) searchParams.set('date_from', params.date_from);
  if (params.date_to) searchParams.set('date_to', params.date_to);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}?${searchParams}`, { headers });
  return handleResponse<BookingConfirmation[]>(response);
}

/**
 * Get a single confirmation by ID
 */
export async function getConfirmation(confirmationId: string): Promise<BookingConfirmation> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${confirmationId}`, { headers });
  return handleResponse<BookingConfirmation>(response);
}

/**
 * Get pending confirmations for a reference
 */
export async function getPendingConfirmation(
  referenceType: ReferenceType,
  referenceId: string
): Promise<BookingConfirmation | null> {
  const confirmations = await getConfirmations({
    reference_type: referenceType,
    reference_id: referenceId,
    status: ['pending', 'sent', 'delivered', 'read'],
    limit: 1,
  });
  return confirmations.length > 0 ? confirmations[0] : null;
}

/**
 * Get all pending confirmations (for dashboard)
 */
export async function getPendingConfirmations(limit: number = 50): Promise<BookingConfirmation[]> {
  return getConfirmations({
    status: ['pending', 'sent', 'delivered', 'read'],
    limit,
  });
}

/**
 * Get confirmation by WhatsApp message ID
 */
export async function getConfirmationByMessageId(
  messageId: string
): Promise<BookingConfirmation | null> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams({
    whatsapp_message_id: messageId,
    limit: '1',
  });

  const response = await fetch(`${API_BASE}?${searchParams}`, { headers });
  const confirmations = await handleResponse<BookingConfirmation[]>(response);
  return confirmations.length > 0 ? confirmations[0] : null;
}

// ======================
// WRITE OPERATIONS
// ======================

/**
 * Create a new confirmation request
 */
export async function createConfirmation(
  data: ConfirmationFormData
): Promise<BookingConfirmation> {
  const headers = await getAuthHeaders();
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<BookingConfirmation>(response);
}

/**
 * Send a confirmation (triggers WhatsApp/SMS/Email)
 */
export async function sendConfirmation(
  confirmationId: string
): Promise<BookingConfirmation> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${confirmationId}/send`, {
    method: 'POST',
    headers,
  });
  return handleResponse<BookingConfirmation>(response);
}

/**
 * Create and send confirmation in one call
 */
export async function createAndSendConfirmation(
  data: ConfirmationFormData
): Promise<BookingConfirmation> {
  const confirmation = await createConfirmation(data);
  return sendConfirmation(confirmation.id);
}

/**
 * Process a response from the customer
 */
export async function processResponse(
  confirmationId: string,
  response: ConfirmationResponse,
  rawResponse?: string
): Promise<BookingConfirmation> {
  const headers = await getAuthHeaders();
  const fetchResponse = await fetch(`${API_BASE}/${confirmationId}/respond`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ response, raw_response: rawResponse }),
  });
  return handleResponse<BookingConfirmation>(fetchResponse);
}

/**
 * Mark confirmation as delivered
 */
export async function markAsDelivered(confirmationId: string): Promise<BookingConfirmation> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${confirmationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'delivered' }),
  });
  return handleResponse<BookingConfirmation>(response);
}

/**
 * Mark confirmation as read
 */
export async function markAsRead(confirmationId: string): Promise<BookingConfirmation> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${confirmationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'read' }),
  });
  return handleResponse<BookingConfirmation>(response);
}

/**
 * Mark confirmation as failed
 */
export async function markAsFailed(
  confirmationId: string,
  reason?: string
): Promise<BookingConfirmation> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${confirmationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'failed', failure_reason: reason }),
  });
  return handleResponse<BookingConfirmation>(response);
}

/**
 * Process expired confirmations (for CRON)
 */
export async function processExpiredConfirmations(): Promise<{
  processed: number;
  cancelled: number;
  notified: number;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/process-expired`, {
    method: 'POST',
    headers,
  });
  return handleResponse<{
    processed: number;
    cancelled: number;
    notified: number;
  }>(response);
}

/**
 * Resend a confirmation
 */
export async function resendConfirmation(confirmationId: string): Promise<BookingConfirmation> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${confirmationId}/resend`, {
    method: 'POST',
    headers,
  });
  return handleResponse<BookingConfirmation>(response);
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Check if confirmation is still active (not expired or responded)
 */
export function isConfirmationActive(confirmation: BookingConfirmation): boolean {
  const activeStatuses: ConfirmationStatus[] = ['pending', 'sent', 'delivered', 'read'];
  if (!activeStatuses.includes(confirmation.status)) return false;

  const expiresAt = new Date(confirmation.expires_at);
  return expiresAt > new Date();
}

/**
 * Get time remaining until expiration
 */
export function getTimeUntilExpiration(confirmation: BookingConfirmation): {
  hours: number;
  minutes: number;
  expired: boolean;
} {
  const expiresAt = new Date(confirmation.expires_at);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { hours: 0, minutes: 0, expired: true };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return { hours, minutes, expired: false };
}

/**
 * Format expiration for display
 */
export function formatExpirationTime(confirmation: BookingConfirmation): string {
  const { hours, minutes, expired } = getTimeUntilExpiration(confirmation);

  if (expired) return 'Expirado';
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Detect confirmation response from message text
 */
export function detectResponseFromText(text: string): ConfirmationResponse | null {
  const normalizedText = text.toLowerCase().trim();

  // Confirmed patterns
  const confirmedPatterns = [
    'si', 'sí', 'confirmo', 'confirmado', 'ok', 'listo', 'correcto',
    'perfecto', 'de acuerdo', 'va', 'sale', 'ahi estare', 'ahí estaré',
    '1', 'confirmar',
  ];

  // Cancelled patterns
  const cancelledPatterns = [
    'no', 'cancelar', 'cancelo', 'cancela', 'no puedo', 'no podre',
    'no podré', '2', 'eliminar', 'quitar',
  ];

  // Need change patterns
  const changePatterns = [
    'cambiar', 'reagendar', 'mover', 'cambio', 'otra fecha', 'otro dia',
    'otro día', '3', 'modificar',
  ];

  for (const pattern of confirmedPatterns) {
    if (normalizedText.includes(pattern)) return 'confirmed';
  }

  for (const pattern of cancelledPatterns) {
    if (normalizedText.includes(pattern)) return 'cancelled';
  }

  for (const pattern of changePatterns) {
    if (normalizedText.includes(pattern)) return 'need_change';
  }

  return null;
}
