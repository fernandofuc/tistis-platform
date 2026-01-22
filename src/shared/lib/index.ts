// =====================================================
// TIS TIS PLATFORM - Shared Lib Index
// =====================================================

export {
  supabase,
  DEFAULT_TENANT_ID,
  ESVA_TENANT_ID,
  createServerClient,
  isSupabaseConfigured,
  getSupabaseUrl,
  getUserTenantId,
  validateUserTenantAccess,
} from './supabase';
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

// API Client (for client-side authenticated requests)
export {
  fetchWithAuth,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  buildUrl,
  hasActiveSession,
  getAccessToken,
  type APIResponse,
  type FetchWithAuthOptions,
} from './api-client';

// WhatsApp Client
export {
  whatsappClient,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendServicesMenu,
  ESVA_TEMPLATES,
  type WhatsAppMessage,
  type WhatsAppResponse,
  type WhatsAppTemplateComponent,
  type WhatsAppInteractiveAction,
} from './whatsapp';

// Admin Authentication
export {
  verifyAdminAuth,
  isValidAdminKey,
  type AdminAuthResult,
  type AdminAuthConfig,
} from './admin-auth';

// Environment Validation
export {
  validateEnvironment,
  getEnvSummary,
  assertValidEnvironment,
  type EnvValidationResult,
  type EnvVarConfig,
} from './env-validator';

// Unified Rate Limiting (Redis + Memory fallback)
export {
  checkUnifiedRateLimit,
  applyRateLimit,
  applyRateLimitByUser,
  applyRateLimitByTenant,
  createRateLimitResponse as createUnifiedRateLimitResponse,
  addRateLimitHeaders,
  getClientIP,
  UNIFIED_RATE_LIMITS,
  type UnifiedRateLimitConfig,
  type UnifiedRateLimitResult,
} from './rate-limit-unified';

// Structured Logging
export {
  StructuredLogger,
  getLogger,
  createLogger,
  generateCorrelationId,
  getCorrelationId,
  createRequestContext,
  type LogLevel,
  type LogContext,
  type LogEntry,
  type LoggerConfig,
} from './structured-logger';
