// =====================================================
// TIS TIS PLATFORM - Shared Lib Index
// =====================================================

export { supabase, DEFAULT_TENANT_ID, ESVA_TENANT_ID, createServerClient, isSupabaseConfigured, getSupabaseUrl } from './supabase';
export {
  rateLimit,
  rateLimitHeaders,
  createRateLimitResponse,
  getClientIdentifier,
  withRateLimit,
  RATE_LIMIT_PRESETS,
} from './rate-limiter';
export {
  applyApiSecurity,
  sanitizeString,
  sanitizeObject,
  isValidUUID,
  isValidEmail,
  isValidPhone,
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
  createValidationErrorResponse,
  SECURITY_HEADERS,
  type SecurityConfig,
  type SecurityContext,
} from './api-security';
