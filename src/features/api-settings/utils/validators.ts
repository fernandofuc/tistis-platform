// =====================================================
// TIS TIS PLATFORM - API Settings Validators
// Centralized validation utilities for API settings
// =====================================================

// ======================
// UUID VALIDATION
// ======================

/**
 * UUID v4 regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 *
 * @param id - The string to validate
 * @returns true if the string is a valid UUID v4
 */
export function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

// ======================
// IP ADDRESS VALIDATION
// ======================

/**
 * IPv4 address regex with optional CIDR notation
 * Supports: 192.168.1.1, 10.0.0.0/24, etc.
 */
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:3[0-2]|[12]?[0-9]))?$/;

/**
 * IPv6 address regex with optional CIDR notation (simplified)
 * Note: This is a simplified regex for common IPv6 formats
 */
const IPV6_REGEX =
  /^([a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}(?:\/(?:12[0-8]|1[01][0-9]|[1-9]?[0-9]))?$/;

/**
 * Validate a single IP address (IPv4 or IPv6, with optional CIDR)
 *
 * @param ip - The IP address to validate
 * @returns true if the IP address is valid
 */
export function isValidIP(ip: string): boolean {
  return typeof ip === 'string' && (IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip));
}

/**
 * Validate and filter IP whitelist
 *
 * For CREATE operations: Returns null if empty or no valid IPs (null = allow all)
 * For UPDATE operations: Use validateIPWhitelistForUpdate instead
 *
 * @param ips - Array of IP addresses to validate
 * @returns Array of valid IPs or null if none valid
 */
export function validateIPWhitelist(ips: unknown): string[] | null {
  if (!Array.isArray(ips) || ips.length === 0) {
    return null;
  }

  const validIps = ips.filter(
    (ip): ip is string => typeof ip === 'string' && isValidIP(ip)
  );

  // Return null if no valid IPs (allow all) instead of empty array
  return validIps.length > 0 ? validIps : null;
}

/**
 * Validate IP whitelist for UPDATE operations
 * Returns undefined if not provided (don't update), null to clear, or array of valid IPs
 *
 * @param ips - IP whitelist from request body
 * @returns undefined (don't update), null (clear), or array of valid IPs
 */
export function validateIPWhitelistForUpdate(
  ips: unknown
): string[] | null | undefined {
  if (ips === undefined) {
    return undefined; // Not provided, don't update
  }
  if (ips === null || (Array.isArray(ips) && ips.length === 0)) {
    return null; // Explicitly clear whitelist
  }
  if (!Array.isArray(ips)) {
    return undefined; // Invalid type, don't update
  }

  const validIps = ips.filter(
    (ip): ip is string => typeof ip === 'string' && isValidIP(ip)
  );

  return validIps.length > 0 ? validIps : null;
}

// ======================
// NAME VALIDATION
// ======================

/**
 * Validate API Key name
 *
 * @param name - The name to validate
 * @returns Object with valid flag and optional error message
 */
export function validateAPIKeyName(name: unknown): {
  valid: boolean;
  value?: string;
  error?: string;
} {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: 'El nombre de la API Key es requerido' };
  }

  const trimmed = name.trim();

  if (trimmed.length > 100) {
    return { valid: false, error: 'El nombre no puede exceder 100 caracteres' };
  }

  return { valid: true, value: trimmed };
}

// ======================
// EXPIRATION VALIDATION
// ======================

/**
 * Validate expiration date for CREATE operations
 *
 * @param expiresAt - The expiration date string
 * @returns Object with valid flag, parsed ISO string, and optional error
 */
export function validateExpirationDate(expiresAt: unknown): {
  valid: boolean;
  value?: string | null;
  error?: string;
} {
  if (!expiresAt) {
    return { valid: true, value: null };
  }

  const expirationDate = new Date(expiresAt as string);

  if (isNaN(expirationDate.getTime())) {
    return { valid: false, error: 'Fecha de expiración inválida' };
  }

  if (expirationDate <= new Date()) {
    return { valid: false, error: 'La fecha de expiración debe ser en el futuro' };
  }

  return { valid: true, value: expirationDate.toISOString() };
}

/**
 * Validate expiration date for UPDATE operations
 * Returns undefined if not provided, null to clear, or ISO string
 *
 * @param expiresAt - The expiration date from request body
 * @returns Object with valid flag, value, and optional error
 */
export function validateExpirationDateForUpdate(expiresAt: unknown): {
  valid: boolean;
  value?: string | null | undefined;
  error?: string;
} {
  if (expiresAt === undefined) {
    return { valid: true, value: undefined }; // Not provided, don't update
  }

  if (expiresAt === null) {
    return { valid: true, value: null }; // Explicitly clear expiration
  }

  return validateExpirationDate(expiresAt);
}
