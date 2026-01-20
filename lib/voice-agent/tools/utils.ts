/**
 * TIS TIS Platform - Voice Agent v2.0
 * Tool Utilities
 *
 * Shared utility functions for all tools.
 */

// =====================================================
// PHONE UTILITIES
// =====================================================

/**
 * Normalize phone number by removing non-digit characters
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Validate phone number format
 * Returns true if valid Mexican/US phone format
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // Accept 10 digits (local) or 11-13 digits (with country code)
  return normalized.length >= 10 && normalized.length <= 13;
}

/**
 * Format phone for display
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhone(phone);

  if (normalized.length === 10) {
    // Format: (XXX) XXX-XXXX
    return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }

  if (normalized.length === 12 && normalized.startsWith('52')) {
    // Mexican format: +52 (XXX) XXX-XXXX
    return `+52 (${normalized.slice(2, 5)}) ${normalized.slice(5, 8)}-${normalized.slice(8)}`;
  }

  return phone; // Return as-is if format not recognized
}

// =====================================================
// DATE UTILITIES
// =====================================================

/**
 * Check if a date string is in the past (considering local timezone)
 */
export function isDateInPast(dateStr: string): boolean {
  const requestedDate = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return requestedDate < today;
}

/**
 * Check if a date string is today
 */
export function isToday(dateStr: string): boolean {
  const requested = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  requested.setHours(0, 0, 0, 0);
  return requested.getTime() === today.getTime();
}

/**
 * Get current date in YYYY-MM-DD format (local timezone)
 */
export function getCurrentDateStr(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// =====================================================
// STRING UTILITIES
// =====================================================

/**
 * Sanitize user input for safe storage
 * Removes potential XSS/injection patterns
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, '') // Remove special chars
    .slice(0, 500); // Limit length
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =====================================================
// CONFIRMATION CODE UTILITIES
// =====================================================

/**
 * Generate a unique confirmation code
 * Format: PREFIX-TIMESTAMPRAND (e.g., RES-X4K9M2)
 */
export function generateConfirmationCode(prefix: string = 'COD'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters (0/O, 1/I/L)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
}

/**
 * Generate restaurant-specific confirmation code
 */
export function generateReservationCode(): string {
  return generateConfirmationCode('RES');
}

/**
 * Generate dental-specific confirmation code
 */
export function generateAppointmentCode(): string {
  return generateConfirmationCode('CIT');
}

/**
 * Generate order-specific confirmation code
 */
export function generateOrderCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).toUpperCase().slice(2, 4);
  return `ORD-${timestamp}${random}`;
}
