// =====================================================
// TIS TIS PLATFORM - Auth Utils Barrel Export
// =====================================================

// ======================
// VALIDATION
// ======================
export {
  // Schemas
  loginSchema,
  signUpSchema,
  resetPasswordSchema,
  updatePasswordSchema,

  // Types
  type LoginFormData,
  type SignUpFormData,
  type ResetPasswordFormData,
  type UpdatePasswordFormData,

  // Helpers
  sanitizeEmail,
  checkPasswordStrength,
  isValidPhone,
  isDisposableEmail,
} from './validation';

// ======================
// RATE LIMITING
// ======================
export {
  // Singleton instance
  rateLimiter,

  // Configurations
  LOGIN_RATE_LIMIT,
  OAUTH_RATE_LIMIT,
  RESET_PASSWORD_RATE_LIMIT,
  SIGNUP_RATE_LIMIT,

  // Helpers
  formatRetryTime,
  getUserIdentifier,
} from './rateLimiter';

// ======================
// RE-EXPORT TYPES
// ======================
export type { RateLimitConfig } from './rateLimiter';
