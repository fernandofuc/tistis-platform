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
