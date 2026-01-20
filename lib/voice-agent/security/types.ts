/**
 * TIS TIS Platform - Voice Agent v2.0
 * Security Types and Interfaces
 *
 * Defines all types for the 5-layer security gate:
 * 1. IP Whitelist
 * 2. Rate Limiting
 * 3. Timestamp Validation
 * 4. HMAC Signature
 * 5. Content Validation
 */

// =====================================================
// VALIDATION LAYERS
// =====================================================

/**
 * Security validation layers in order of execution
 */
export type ValidationLayer =
  | 'ip'
  | 'rateLimit'
  | 'timestamp'
  | 'signature'
  | 'content';

/**
 * Result of a single validation check
 */
export interface ValidationCheckResult {
  passed: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Complete result of security gate validation
 */
export interface SecurityValidationResult {
  /** Whether all validations passed */
  valid: boolean;

  /** Which layer failed (if any) */
  failedAt?: ValidationLayer;

  /** Human-readable reason for failure */
  reason?: string;

  /** Individual validation results */
  validations: {
    ip: boolean;
    rateLimit: boolean;
    timestamp: boolean;
    signature: boolean;
    content: boolean;
  };

  /** Additional metadata for logging/debugging */
  metadata?: {
    clientIp?: string;
    requestId?: string;
    processingTimeMs?: number;
    rateLimitRemaining?: number;
    timestampAgeMs?: number;
  };
}

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * IP Whitelist configuration
 */
export interface IPWhitelistConfig {
  /** List of allowed IP addresses or CIDR ranges */
  allowedIPs: string[];

  /** Allow all IPs in development mode */
  allowAllInDevelopment?: boolean;

  /** Trust proxy headers (x-forwarded-for) */
  trustProxy?: boolean;

  /** Maximum hops to check in x-forwarded-for */
  maxProxyHops?: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;

  /** Window size in milliseconds */
  windowMs: number;

  /** Key generator function */
  keyGenerator?: (request: Request, headers: Headers) => string;

  /** Skip rate limiting for certain conditions */
  skip?: (request: Request) => boolean;

  /** Cleanup interval for expired entries (ms) */
  cleanupIntervalMs?: number;

  /**
   * Maximum number of unique keys to track
   * Prevents memory exhaustion from IP spoofing attacks
   * @default 100000
   */
  maxEntries?: number;
}

/**
 * Timestamp validation configuration
 */
export interface TimestampConfig {
  /** Maximum age of timestamp in milliseconds (default: 5 minutes) */
  maxAgeMs: number;

  /** Tolerance for clock skew in milliseconds (default: 30 seconds) */
  clockSkewToleranceMs: number;

  /** Header name containing timestamp */
  headerName: string;
}

/**
 * HMAC signature configuration
 */
export interface HmacConfig {
  /** Secret key for HMAC validation */
  secretKey: string;

  /** Header name containing signature */
  signatureHeader: string;

  /** Header name containing timestamp */
  timestampHeader: string;

  /** Hash algorithm (default: sha256) */
  algorithm: 'sha256' | 'sha384' | 'sha512';
}

/**
 * Content validation configuration
 */
export interface ContentValidationConfig {
  /** Maximum payload size in bytes (default: 1MB) */
  maxPayloadSize: number;

  /** Required content type */
  requiredContentType: string;

  /** Validate VAPI webhook structure */
  validateVapiStructure: boolean;
}

/**
 * Complete security gate configuration
 */
export interface SecurityGateConfig {
  /** Enable/disable security gate */
  enabled: boolean;

  /** IP whitelist configuration */
  ipWhitelist: IPWhitelistConfig;

  /** Rate limiter configuration */
  rateLimiter: RateLimiterConfig;

  /** Timestamp validation configuration */
  timestamp: TimestampConfig;

  /** HMAC signature configuration */
  hmac: HmacConfig;

  /** Content validation configuration */
  content: ContentValidationConfig;

  /** Enable detailed logging */
  enableLogging: boolean;

  /** Fail-fast: stop on first validation failure */
  failFast: boolean;
}

// =====================================================
// VAPI WEBHOOK TYPES
// =====================================================

/**
 * VAPI webhook message types
 */
export type VapiMessageType =
  | 'assistant-request'
  | 'function-call'
  | 'function-call-result'
  | 'conversation-update'
  | 'end-of-call-report'
  | 'hang'
  | 'speech-update'
  | 'status-update'
  | 'transcript'
  | 'tool-calls'
  | 'tool-call-result'
  | 'transfer-destination-request'
  | 'voice-input';

/**
 * Basic VAPI webhook payload structure
 */
export interface VapiWebhookPayload {
  message: {
    type: VapiMessageType;
    call?: {
      id: string;
      orgId: string;
      createdAt: string;
      startedAt?: string;
      endedAt?: string;
      status?: string;
      phoneNumberId?: string;
      customer?: {
        number?: string;
        name?: string;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

// =====================================================
// SECURITY EVENT TYPES
// =====================================================

/**
 * Security event types for logging
 */
export type SecurityEventType =
  | 'allowed'
  | 'blocked'
  | 'suspicious'
  | 'rate_limited'
  | 'invalid_signature'
  | 'expired_timestamp'
  | 'invalid_content'
  | 'ip_blocked';

/**
 * Security event for logging
 */
export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  requestId: string;
  clientIp: string;
  userAgent?: string;
  failedValidation?: ValidationLayer;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// =====================================================
// RATE LIMIT TYPES
// =====================================================

/**
 * Rate limit entry stored in memory
 */
export interface RateLimitEntry {
  /** Request timestamps within the window */
  timestamps: number[];

  /** First request timestamp */
  firstRequest: number;

  /** Total requests in current window */
  count: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Remaining requests in window */
  remaining: number;

  /** Time until rate limit resets (ms) */
  resetInMs: number;

  /** Total limit */
  limit: number;
}

// =====================================================
// DEFAULT CONFIGURATION
// =====================================================

/**
 * Default VAPI IP addresses (CIDR ranges)
 * Source: VAPI documentation
 */
export const DEFAULT_VAPI_IP_RANGES = [
  '54.172.60.0/24',
  '54.244.51.0/24',
  '52.2.4.0/24',
  '3.129.67.0/24',
] as const;

/**
 * Default security gate configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityGateConfig = {
  enabled: true,
  failFast: true,
  enableLogging: true,

  ipWhitelist: {
    allowedIPs: [...DEFAULT_VAPI_IP_RANGES],
    allowAllInDevelopment: false,
    trustProxy: true,
    maxProxyHops: 2,
  },

  rateLimiter: {
    maxRequests: 100,
    windowMs: 60_000, // 1 minute
    cleanupIntervalMs: 300_000, // 5 minutes
  },

  timestamp: {
    maxAgeMs: 300_000, // 5 minutes
    clockSkewToleranceMs: 30_000, // 30 seconds
    headerName: 'x-vapi-timestamp',
  },

  hmac: {
    secretKey: '', // Must be set via env
    signatureHeader: 'x-vapi-signature',
    timestampHeader: 'x-vapi-timestamp',
    algorithm: 'sha256',
  },

  content: {
    maxPayloadSize: 1_048_576, // 1MB
    requiredContentType: 'application/json',
    validateVapiStructure: true,
  },
};

// =====================================================
// TYPE GUARDS
// =====================================================

/**
 * Type guard to check if payload is a valid VAPI webhook
 */
export function isVapiWebhookPayload(
  payload: unknown
): payload is VapiWebhookPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.message !== 'object' || p.message === null) {
    return false;
  }

  const message = p.message as Record<string, unknown>;

  if (typeof message.type !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validate VAPI message type
 */
export function isValidVapiMessageType(type: string): type is VapiMessageType {
  const validTypes: VapiMessageType[] = [
    'assistant-request',
    'function-call',
    'function-call-result',
    'conversation-update',
    'end-of-call-report',
    'hang',
    'speech-update',
    'status-update',
    'transcript',
    'tool-calls',
    'tool-call-result',
    'transfer-destination-request',
    'voice-input',
  ];

  return validTypes.includes(type as VapiMessageType);
}
