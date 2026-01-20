/**
 * TIS TIS Platform - Voice Agent v2.0
 * Security Module Exports
 *
 * This module provides 5-layer security validation for VAPI webhooks:
 * 1. IP Whitelist - Only allow VAPI's known IPs
 * 2. Rate Limiting - Prevent abuse and DoS
 * 3. Timestamp Validation - Prevent replay attacks
 * 4. HMAC Signature - Verify request authenticity
 * 5. Content Validation - Ensure valid JSON structure
 *
 * @example
 * ```typescript
 * import { createSecurityGate, logValidationResult } from '@/lib/voice-agent/security';
 *
 * const securityGate = createSecurityGate();
 *
 * export async function POST(request: Request) {
 *   const result = await securityGate.validate(request);
 *
 *   logValidationResult(result);
 *
 *   if (!result.valid) {
 *     return new Response(JSON.stringify({ error: result.reason }), {
 *       status: 403,
 *       headers: { 'Content-Type': 'application/json' }
 *     });
 *   }
 *
 *   // Process the webhook...
 * }
 * ```
 */

// =====================================================
// MAIN EXPORTS
// =====================================================

// Security Gate (main entry point)
export {
  WebhookSecurityGate,
  createSecurityGate,
  createDevSecurityGate,
} from './webhook-security-gate';

// IP Whitelist
export {
  IPWhitelist,
  parseCIDR,
  isIPInRange,
  isValidIPv4,
  isValidIPv6,
} from './ip-whitelist';

// Rate Limiter
export {
  RateLimiter,
  MultiTierRateLimiter,
} from './rate-limiter';

// Security Logger
export {
  SecurityLogger,
  createSecurityLogger,
  logSecurityEvent,
  logValidationResult,
} from './security-logger';

// =====================================================
// TYPE EXPORTS
// =====================================================

export type {
  // Core types
  SecurityValidationResult,
  ValidationLayer,
  ValidationCheckResult,
  SecurityEvent,
  SecurityEventType,

  // Configuration types
  SecurityGateConfig,
  IPWhitelistConfig,
  RateLimiterConfig,
  TimestampConfig,
  HmacConfig,
  ContentValidationConfig,

  // Rate limit types
  RateLimitEntry,
  RateLimitResult,

  // VAPI types
  VapiWebhookPayload,
  VapiMessageType,
} from './types';

// Logger types
export type {
  SecurityLoggerConfig,
  SecurityLogEntry,
  LogLevel,
} from './security-logger';

// =====================================================
// CONSTANTS
// =====================================================

export {
  DEFAULT_VAPI_IP_RANGES,
  DEFAULT_SECURITY_CONFIG,
  isVapiWebhookPayload,
  isValidVapiMessageType,
} from './types';

// =====================================================
// RE-EXPORTS FOR CONVENIENCE
// =====================================================

/**
 * Quick validation function for simple use cases
 */
export async function validateVapiWebhook(
  request: Request,
  body?: string
): Promise<{
  valid: boolean;
  reason?: string;
  requestId?: string;
}> {
  const { createSecurityGate } = await import('./webhook-security-gate');
  const gate = createSecurityGate();

  const result = await gate.validate(request, body);

  return {
    valid: result.valid,
    reason: result.reason,
    requestId: result.metadata?.requestId,
  };
}
