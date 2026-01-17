// =====================================================
// TIS TIS PLATFORM - API Key Types
// Type definitions for the API Key management feature
// =====================================================

// ======================
// ENUMS & LITERAL TYPES
// ======================

/**
 * Environment type for API Keys
 * - live: Production environment
 * - test: Development/testing environment
 */
export type APIKeyEnvironment = 'live' | 'test';

/**
 * Status of an API Key
 */
export type APIKeyStatus = 'active' | 'revoked' | 'expired';

/**
 * Prefix used for API Keys based on environment
 */
export type APIKeyPrefix = 'tis_live_' | 'tis_test_';

// ======================
// API KEY INTERFACES
// ======================

/**
 * Full API Key entity as stored in database
 * Note: key_hash is NEVER exposed to frontend
 */
export interface APIKey {
  id: string;
  tenant_id: string;
  created_by: string;

  // Identification
  name: string;
  description?: string;

  // Key display (never the full key)
  key_hint: string; // "...a4f7"
  key_prefix: APIKeyPrefix;

  // Environment
  environment: APIKeyEnvironment;

  // Permissions
  scopes: string[];

  // Rate limiting
  rate_limit_rpm: number;
  rate_limit_daily: number;

  // Security
  ip_whitelist?: string[];
  expires_at?: string;

  // State
  is_active: boolean;

  // Usage tracking
  last_used_at?: string;
  last_used_ip?: string;
  usage_count: number;

  // Audit
  created_at: string;
  updated_at: string;
  revoked_at?: string;
  revoked_by?: string;
  revoke_reason?: string;
}

/**
 * API Key with creator information for display
 */
export interface APIKeyWithCreator extends APIKey {
  created_by_user?: {
    email: string;
    full_name?: string;
  };
}

/**
 * API Key as returned in list responses (simplified)
 */
export interface APIKeyListItem {
  id: string;
  name: string;
  description?: string;
  key_hint: string;
  key_prefix: APIKeyPrefix;
  environment: APIKeyEnvironment;
  scopes: string[];
  is_active: boolean;
  last_used_at?: string;
  usage_count: number;
  created_at: string;
  expires_at?: string;
}

// ======================
// REQUEST INTERFACES
// ======================

/**
 * Request to create a new API Key
 */
export interface CreateAPIKeyRequest {
  name: string;
  description?: string;
  environment: APIKeyEnvironment;
  scopes: string[];
  rate_limit_rpm?: number;
  rate_limit_daily?: number;
  ip_whitelist?: string[];
  expires_at?: string;
}

/**
 * Request to update an existing API Key
 * Note: The key itself cannot be updated, only metadata
 */
export interface UpdateAPIKeyRequest {
  name?: string;
  description?: string;
  scopes?: string[];
  rate_limit_rpm?: number;
  rate_limit_daily?: number;
  ip_whitelist?: string[];
  expires_at?: string | null; // null to remove expiration
}

/**
 * Request to revoke an API Key
 */
export interface RevokeAPIKeyRequest {
  reason?: string;
}

// ======================
// RESPONSE INTERFACES
// ======================

/**
 * Response for API Key list endpoint
 */
export interface APIKeysListResponse {
  keys: APIKeyListItem[];
  total: number;
}

/**
 * Response for API Key detail endpoint
 */
export interface APIKeyDetailResponse {
  key: APIKeyWithCreator;
}

/**
 * Response when creating a new API Key
 * IMPORTANT: api_key_secret is ONLY returned at creation time
 */
export interface CreateAPIKeyResponse {
  key: APIKeyListItem;
  api_key_secret: string; // Full key - SHOWN ONLY ONCE
  message: string;
}

/**
 * Response when updating an API Key
 */
export interface UpdateAPIKeyResponse {
  key: APIKey;
}

/**
 * Response when revoking an API Key
 */
export interface RevokeAPIKeyResponse {
  success: boolean;
  message: string;
}

// ======================
// VALIDATION RESULT
// ======================

/**
 * Result of API Key validation (for middleware use)
 */
export interface APIKeyValidationResult {
  valid: boolean;
  key_id?: string;
  tenant_id?: string;
  scopes?: string[];
  environment?: APIKeyEnvironment;
  rate_limit?: {
    rpm: number;
    daily: number;
    remaining_minute: number;
    remaining_daily: number;
  };
  error?: string;
  error_code?:
    | 'INVALID_FORMAT'
    | 'KEY_NOT_FOUND'
    | 'KEY_REVOKED'
    | 'KEY_EXPIRED'
    | 'IP_NOT_ALLOWED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'INSUFFICIENT_SCOPE';
}

// ======================
// RATE LIMIT TYPES
// ======================

/**
 * Rate limit check result from database function
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: 'key_not_found' | 'rate_limit_minute' | 'rate_limit_daily';
  limit?: number;
  current?: number;
  retry_after_seconds?: number;
  remaining_minute?: number;
  remaining_daily?: number;
}

/**
 * Rate limit configuration by plan
 */
export interface PlanRateLimits {
  plan: string;
  default_rpm: number;
  default_daily: number;
  max_rpm: number;
  max_daily: number;
  max_keys: number;
}

// ======================
// GENERATED KEY TYPE
// ======================

/**
 * Result of API Key generation (internal use only)
 */
export interface GeneratedAPIKey {
  key: string; // Full key
  hash: string; // SHA-256 hash for storage
  hint: string; // "...xxxx" for display
  prefix: APIKeyPrefix;
}
