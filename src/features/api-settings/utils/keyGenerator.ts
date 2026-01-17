// =====================================================
// TIS TIS PLATFORM - API Key Generator
// Secure API key generation utilities
// =====================================================

import crypto from 'crypto';
import type {
  APIKeyEnvironment,
  APIKeyPrefix,
  GeneratedAPIKey,
} from '../types';

// ======================
// CONSTANTS
// ======================

/**
 * Prefixes for API keys based on environment
 */
export const KEY_PREFIXES: Record<APIKeyEnvironment, APIKeyPrefix> = {
  live: 'tis_live_',
  test: 'tis_test_',
};

/**
 * Regex pattern for validating API key format
 * Format: tis_{env}_{timestamp}_{48_hex_chars}
 */
export const API_KEY_REGEX = /^tis_(live|test)_[a-z0-9]+_[a-f0-9]{48}$/;

/**
 * Number of random bytes to generate (results in 48 hex chars)
 */
const RANDOM_BYTES = 24;

// ======================
// KEY GENERATION
// ======================

/**
 * Generate a new secure API key
 *
 * Key format: tis_{environment}_{timestamp}_{random}
 * - environment: 'live' or 'test'
 * - timestamp: Base36 encoded Unix timestamp (for uniqueness)
 * - random: 48 hex characters from crypto.randomBytes
 *
 * @param environment - The environment for the key ('live' or 'test')
 * @returns Object containing the full key, hash, hint, and prefix
 *
 * @example
 * const { key, hash, hint, prefix } = generateAPIKey('live');
 * // key: "tis_live_lx8h5kg_a1b2c3d4e5f6..."
 * // hash: "sha256 hash of key"
 * // hint: "...f6g7"
 * // prefix: "tis_live_"
 */
export function generateAPIKey(environment: APIKeyEnvironment): GeneratedAPIKey {
  const prefix = KEY_PREFIXES[environment];
  const timestamp = Date.now().toString(36); // Base36 for compactness
  const random = crypto.randomBytes(RANDOM_BYTES).toString('hex');

  const key = `${prefix}${timestamp}_${random}`;
  const hash = hashAPIKey(key);
  const hint = `...${key.slice(-4)}`;

  return {
    key,
    hash,
    hint,
    prefix,
  };
}

// ======================
// HASHING
// ======================

/**
 * Generate SHA-256 hash of an API key
 *
 * @param key - The full API key to hash
 * @returns The hex-encoded SHA-256 hash
 */
export function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ======================
// VALIDATION
// ======================

/**
 * Validate API key format
 *
 * @param key - The API key to validate
 * @returns true if the key matches the expected format
 *
 * @example
 * validateAPIKeyFormat('tis_live_lx8h5kg_a1b2c3...'); // true
 * validateAPIKeyFormat('invalid_key'); // false
 */
export function validateAPIKeyFormat(key: string): boolean {
  if (typeof key !== 'string') {
    return false;
  }
  return API_KEY_REGEX.test(key);
}

/**
 * Extract environment from API key
 *
 * @param key - The API key
 * @returns The environment ('live' or 'test') or null if invalid
 */
export function extractEnvironment(key: string): APIKeyEnvironment | null {
  if (!validateAPIKeyFormat(key)) {
    return null;
  }

  if (key.startsWith('tis_live_')) {
    return 'live';
  }
  if (key.startsWith('tis_test_')) {
    return 'test';
  }

  return null;
}

/**
 * Extract the prefix from an API key
 *
 * @param key - The API key
 * @returns The prefix or null if invalid
 */
export function extractPrefix(key: string): APIKeyPrefix | null {
  if (!validateAPIKeyFormat(key)) {
    return null;
  }

  if (key.startsWith('tis_live_')) {
    return 'tis_live_';
  }
  if (key.startsWith('tis_test_')) {
    return 'tis_test_';
  }

  return null;
}

/**
 * Get the hint (last 4 chars) from an API key
 *
 * @param key - The API key
 * @returns The hint in "...xxxx" format or null if invalid
 */
export function getKeyHint(key: string): string | null {
  if (!validateAPIKeyFormat(key)) {
    return null;
  }
  return `...${key.slice(-4)}`;
}

// ======================
// COMPARISON
// ======================

/**
 * Securely compare an API key with a hash
 * Uses timing-safe comparison to prevent timing attacks
 *
 * @param key - The API key to check
 * @param storedHash - The stored SHA-256 hash
 * @returns true if the key matches the hash
 */
export function verifyAPIKey(key: string, storedHash: string): boolean {
  if (!validateAPIKeyFormat(key)) {
    return false;
  }

  const keyHash = hashAPIKey(key);

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(keyHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    // If buffers have different lengths, they don't match
    return false;
  }
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Mask an API key for safe display
 *
 * @param key - The API key to mask
 * @returns The masked key showing only prefix and hint
 *
 * @example
 * maskAPIKey('tis_live_lx8h5kg_a1b2c3...f6g7');
 * // Returns: "tis_live_...f6g7"
 */
export function maskAPIKey(key: string): string {
  if (!validateAPIKeyFormat(key)) {
    return '***invalid***';
  }

  const prefix = extractPrefix(key);
  const hint = key.slice(-4);

  return `${prefix}...${hint}`;
}

/**
 * Check if an API key is for the test environment
 *
 * @param key - The API key to check
 * @returns true if the key is for the test environment
 */
export function isTestKey(key: string): boolean {
  return extractEnvironment(key) === 'test';
}

/**
 * Check if an API key is for the live/production environment
 *
 * @param key - The API key to check
 * @returns true if the key is for the live environment
 */
export function isLiveKey(key: string): boolean {
  return extractEnvironment(key) === 'live';
}
