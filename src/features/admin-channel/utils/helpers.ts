/**
 * TIS TIS PLATFORM - Admin Channel Shared Helpers
 *
 * Funciones de utilidad compartidas entre servicios y nodos.
 * Centraliza validaciones, timeouts y type-safe extractors.
 *
 * @module admin-channel/utils/helpers
 */

// =====================================================
// UUID VALIDATION
// =====================================================

/** UUID validation regex (RFC 4122 compliant) */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID.
 * Throws an error if validation fails.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error message
 * @throws Error if value is not a valid UUID
 */
export function validateUUID(value: string, fieldName: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${fieldName} format: not a valid UUID`);
  }
}

/**
 * Check if a string is a valid UUID without throwing.
 *
 * @param value - The value to check
 * @returns true if valid UUID, false otherwise
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

// =====================================================
// TIMEOUT WRAPPER
// =====================================================

/**
 * Wrap a promise with a timeout.
 * Compatible with both Promise and PromiseLike (Supabase query builders).
 *
 * @param promiseOrLike - The promise or promise-like to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Name of the operation for error message
 * @returns Promise that rejects if timeout is exceeded
 */
export async function withTimeout<T>(
  promiseOrLike: PromiseLike<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)),
      timeoutMs
    )
  );
  return Promise.race([Promise.resolve(promiseOrLike), timeoutPromise]);
}

// =====================================================
// TYPE-SAFE EXTRACTORS
// =====================================================

/**
 * Safely extract string from unknown value.
 *
 * @param value - The value to extract from
 * @param fallback - Default value if extraction fails
 * @returns Extracted string or fallback
 */
export function extractString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/**
 * Safely extract number from unknown value.
 *
 * @param value - The value to extract from
 * @param fallback - Default value if extraction fails
 * @returns Extracted number or fallback
 */
export function extractNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Safely extract boolean from unknown value.
 *
 * @param value - The value to extract from
 * @param fallback - Default value if extraction fails
 * @returns Extracted boolean or fallback
 */
export function extractBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

// =====================================================
// SQL PATTERN ESCAPING
// =====================================================

/**
 * Escape special characters for LIKE/ILIKE patterns.
 * Prevents SQL injection via pattern matching.
 * Characters % and _ have special meaning in LIKE patterns.
 *
 * @param value - The pattern string to escape
 * @returns Escaped pattern string
 */
export function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // Escape backslash first
    .replace(/%/g, '\\%')   // Escape percent
    .replace(/_/g, '\\_');  // Escape underscore
}

// =====================================================
// CONTENT SANITIZATION
// =====================================================

/**
 * Sanitize user-provided text for safe inclusion in messages.
 * Removes control characters and limits length.
 * Does NOT escape markdown - that's handled per-channel.
 *
 * @param value - The user-provided string to sanitize
 * @param maxLength - Maximum length (default 200)
 * @returns Sanitized string
 */
export function sanitizeUserContent(value: string, maxLength = 200): string {
  if (!value || typeof value !== 'string') return '';

  return value
    // Remove control characters except newline/tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Trim and limit length
    .trim()
    .slice(0, maxLength);
}
