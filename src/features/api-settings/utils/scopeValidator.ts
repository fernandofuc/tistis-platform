// =====================================================
// TIS TIS PLATFORM - API Scope Validator
// Utilities for validating and working with API scopes
// =====================================================

import type {
  APIScope,
  CommonScope,
  DentalScope,
  RestaurantScope,
  Vertical,
  ScopeValidationResult,
  PermissionCheckResult,
} from '../types';

// ======================
// SCOPE DEFINITIONS
// ======================

/**
 * All common scopes (available to all verticals)
 */
export const COMMON_SCOPES: readonly CommonScope[] = [
  'leads:read',
  'leads:write',
  'conversations:read',
  'conversations:write',
  'appointments:read',
  'appointments:write',
  'webhooks:manage',
  'analytics:read',
  'ai:chat',
  'ai:chat:read',
  'ai:config:read',
  'ai:config:write',
  'ai:knowledge:read',
  'ai:knowledge:write',
] as const;

/**
 * Dental-specific scopes
 */
export const DENTAL_SCOPES: readonly DentalScope[] = [
  'patients:read',
  'patients:write',
  'treatments:read',
  'treatments:write',
  'quotes:read',
  'quotes:write',
  'services:read',
  'services:write',
] as const;

/**
 * Restaurant-specific scopes
 */
export const RESTAURANT_SCOPES: readonly RestaurantScope[] = [
  'menu:read',
  'menu:write',
  'orders:read',
  'orders:write',
  'inventory:read',
  'inventory:write',
  'tables:read',
  'tables:write',
  'kitchen:read',
  'kitchen:write',
  'reservations:read',
  'reservations:write',
] as const;

/**
 * All valid scopes combined
 */
export const ALL_SCOPES: readonly APIScope[] = [
  ...COMMON_SCOPES,
  ...DENTAL_SCOPES,
  ...RESTAURANT_SCOPES,
] as const;

/**
 * Set of all valid scopes for fast lookup
 */
const VALID_SCOPES_SET = new Set<string>(ALL_SCOPES);

// ======================
// SCOPE DEPENDENCIES
// ======================

/**
 * Scope dependencies - some scopes require others
 * Format: { scope: [required_scopes] }
 */
export const SCOPE_DEPENDENCIES: Partial<Record<APIScope, APIScope[]>> = {
  // Write scopes typically require read scopes
  'leads:write': ['leads:read'],
  'conversations:write': ['conversations:read'],
  'appointments:write': ['appointments:read'],
  'patients:write': ['patients:read'],
  'treatments:write': ['treatments:read'],
  'quotes:write': ['quotes:read'],
  'services:write': ['services:read'],
  'menu:write': ['menu:read'],
  'orders:write': ['orders:read'],
  'inventory:write': ['inventory:read'],
  'tables:write': ['tables:read'],
  'kitchen:write': ['kitchen:read'],
  'reservations:write': ['reservations:read'],
  'ai:config:write': ['ai:config:read'],
  'ai:knowledge:write': ['ai:knowledge:read'],
};

// ======================
// VALIDATION FUNCTIONS
// ======================

/**
 * Check if a scope is valid
 *
 * @param scope - The scope to validate
 * @returns true if the scope is a valid TIS TIS scope
 */
export function isValidScope(scope: string): scope is APIScope {
  return VALID_SCOPES_SET.has(scope);
}

/**
 * Validate an array of scopes
 *
 * @param scopes - Array of scopes to validate
 * @returns Validation result with invalid scopes and missing dependencies
 */
export function validateScopes(scopes: string[]): ScopeValidationResult {
  const invalidScopes: string[] = [];
  const missingDependencies: { scope: APIScope; requires: APIScope[] }[] = [];

  const scopeSet = new Set(scopes);

  for (const scope of scopes) {
    // Check if scope is valid
    if (!isValidScope(scope)) {
      invalidScopes.push(scope);
      continue;
    }

    // Check dependencies
    const dependencies = SCOPE_DEPENDENCIES[scope];
    if (dependencies) {
      const missing = dependencies.filter((dep) => !scopeSet.has(dep));
      if (missing.length > 0) {
        missingDependencies.push({
          scope,
          requires: missing,
        });
      }
    }
  }

  return {
    valid: invalidScopes.length === 0 && missingDependencies.length === 0,
    invalidScopes,
    missingDependencies,
  };
}

/**
 * Filter out invalid scopes from an array
 *
 * @param scopes - Array of scopes to filter
 * @returns Array of only valid scopes
 */
export function filterValidScopes(scopes: string[]): APIScope[] {
  return scopes.filter(isValidScope);
}

/**
 * Add missing dependencies to a list of scopes
 *
 * @param scopes - Array of scopes
 * @returns Array with all necessary dependencies added
 */
export function addMissingDependencies(scopes: APIScope[]): APIScope[] {
  const scopeSet = new Set(scopes);

  for (const scope of scopes) {
    const dependencies = SCOPE_DEPENDENCIES[scope];
    if (dependencies) {
      for (const dep of dependencies) {
        scopeSet.add(dep);
      }
    }
  }

  return Array.from(scopeSet);
}

// ======================
// VERTICAL FUNCTIONS
// ======================

/**
 * Get all scopes available for a specific vertical
 *
 * @param vertical - The vertical to get scopes for
 * @returns Array of available scopes for the vertical
 */
export function getScopesForVertical(vertical: Vertical): APIScope[] {
  switch (vertical) {
    case 'dental':
      return [...COMMON_SCOPES, ...DENTAL_SCOPES];
    case 'restaurant':
      return [...COMMON_SCOPES, ...RESTAURANT_SCOPES];
    default:
      return [...COMMON_SCOPES];
  }
}

/**
 * Check if a scope is available for a specific vertical
 *
 * @param scope - The scope to check
 * @param vertical - The vertical to check against
 * @returns true if the scope is available for the vertical
 */
export function isScopeAvailableForVertical(
  scope: APIScope,
  vertical: Vertical
): boolean {
  const availableScopes = getScopesForVertical(vertical);
  return availableScopes.includes(scope);
}

/**
 * Filter scopes to only those available for a vertical
 *
 * @param scopes - Array of scopes to filter
 * @param vertical - The vertical to filter for
 * @returns Array of scopes available for the vertical
 */
export function filterScopesForVertical(
  scopes: APIScope[],
  vertical: Vertical
): APIScope[] {
  const availableScopes = new Set(getScopesForVertical(vertical));
  return scopes.filter((scope) => availableScopes.has(scope));
}

// ======================
// PERMISSION CHECKING
// ======================

/**
 * Check if a key has a specific scope
 *
 * @param keyScopes - Array of scopes the key has
 * @param requiredScope - The scope to check for
 * @returns true if the key has the required scope
 */
export function hasScope(keyScopes: string[], requiredScope: APIScope): boolean {
  return keyScopes.includes(requiredScope);
}

/**
 * Check if a key has all required scopes
 *
 * @param keyScopes - Array of scopes the key has
 * @param requiredScopes - Array of scopes to check for
 * @returns true if the key has all required scopes
 */
export function hasAllScopes(
  keyScopes: string[],
  requiredScopes: APIScope[]
): boolean {
  return requiredScopes.every((scope) => keyScopes.includes(scope));
}

/**
 * Check if a key has any of the required scopes
 *
 * @param keyScopes - Array of scopes the key has
 * @param requiredScopes - Array of scopes to check for
 * @returns true if the key has at least one of the required scopes
 */
export function hasAnyScope(
  keyScopes: string[],
  requiredScopes: APIScope[]
): boolean {
  return requiredScopes.some((scope) => keyScopes.includes(scope));
}

/**
 * Check permission for a specific action
 *
 * @param keyScopes - Array of scopes the key has
 * @param requiredScope - The scope required for the action
 * @returns Permission check result
 */
export function checkPermission(
  keyScopes: string[],
  requiredScope: APIScope
): PermissionCheckResult {
  if (hasScope(keyScopes, requiredScope)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    missing_scope: requiredScope,
    message: `Missing required scope: ${requiredScope}`,
  };
}

// ======================
// ENDPOINT TO SCOPE MAPPING
// ======================

/**
 * Map of endpoint patterns to required scopes
 */
export const ENDPOINT_SCOPE_MAP: Record<string, { read?: APIScope; write?: APIScope }> = {
  '/api/v1/leads': { read: 'leads:read', write: 'leads:write' },
  '/api/v1/conversations': { read: 'conversations:read', write: 'conversations:write' },
  '/api/v1/appointments': { read: 'appointments:read', write: 'appointments:write' },
  '/api/v1/webhooks': { read: 'webhooks:manage', write: 'webhooks:manage' },
  '/api/v1/analytics': { read: 'analytics:read' },
  '/api/v1/chat': { read: 'ai:chat:read', write: 'ai:chat' },
  '/api/v1/patients': { read: 'patients:read', write: 'patients:write' },
  '/api/v1/treatments': { read: 'treatments:read', write: 'treatments:write' },
  '/api/v1/quotes': { read: 'quotes:read', write: 'quotes:write' },
  '/api/v1/services': { read: 'services:read', write: 'services:write' },
  '/api/v1/menu': { read: 'menu:read', write: 'menu:write' },
  '/api/v1/orders': { read: 'orders:read', write: 'orders:write' },
  '/api/v1/inventory': { read: 'inventory:read', write: 'inventory:write' },
  '/api/v1/tables': { read: 'tables:read', write: 'tables:write' },
  '/api/v1/kitchen': { read: 'kitchen:read', write: 'kitchen:write' },
  '/api/v1/reservations': { read: 'reservations:read', write: 'reservations:write' },
};

/**
 * Get the required scope for an endpoint and method
 *
 * @param endpoint - The API endpoint path
 * @param method - The HTTP method
 * @returns The required scope or undefined if not found
 */
export function getScopeForEndpoint(
  endpoint: string,
  method: string
): APIScope | undefined {
  // Normalize endpoint (remove query string and trailing slash)
  const normalizedEndpoint = endpoint.split('?')[0].replace(/\/$/, '');

  // Find matching endpoint pattern
  for (const [pattern, scopes] of Object.entries(ENDPOINT_SCOPE_MAP)) {
    if (normalizedEndpoint.startsWith(pattern)) {
      const isReadMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
      return isReadMethod ? scopes.read : scopes.write;
    }
  }

  return undefined;
}
