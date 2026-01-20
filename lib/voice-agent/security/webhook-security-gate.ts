/**
 * TIS TIS Platform - Voice Agent v2.0
 * Webhook Security Gate
 *
 * Implements 5-layer security validation for VAPI webhooks:
 * 1. IP Whitelist - Only allow VAPI's known IPs
 * 2. Rate Limiting - Prevent abuse and DoS
 * 3. Timestamp Validation - Prevent replay attacks
 * 4. HMAC Signature - Verify request authenticity
 * 5. Content Validation - Ensure valid JSON structure
 *
 * All validations use fail-fast approach for efficiency.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { IPWhitelist } from './ip-whitelist';
import { MultiTierRateLimiter } from './rate-limiter';
import type {
  SecurityGateConfig,
  SecurityValidationResult,
  ValidationLayer,
  ValidationCheckResult,
  VapiWebhookPayload,
} from './types';
import {
  isVapiWebhookPayload,
  isValidVapiMessageType,
  DEFAULT_VAPI_IP_RANGES,
} from './types';

// =====================================================
// WEBHOOK SECURITY GATE
// =====================================================

export class WebhookSecurityGate {
  private readonly config: SecurityGateConfig;
  private readonly ipWhitelist: IPWhitelist;
  private readonly rateLimiter: MultiTierRateLimiter;

  constructor(config?: Partial<SecurityGateConfig>) {
    // Merge with defaults
    this.config = {
      enabled: true,
      failFast: true,
      enableLogging: true,

      ipWhitelist: {
        allowedIPs: [...DEFAULT_VAPI_IP_RANGES],
        allowAllInDevelopment: process.env.NODE_ENV === 'development',
        trustProxy: true,
        maxProxyHops: 2,
      },

      rateLimiter: {
        maxRequests: parseInt(
          process.env.SECURITY_RATE_LIMIT_REQUESTS ?? '100',
          10
        ),
        windowMs: parseInt(
          process.env.SECURITY_RATE_LIMIT_WINDOW_MS ?? '60000',
          10
        ),
        cleanupIntervalMs: 300_000,
      },

      timestamp: {
        maxAgeMs: parseInt(
          process.env.SECURITY_TIMESTAMP_TOLERANCE_MS ?? '300000',
          10
        ),
        clockSkewToleranceMs: 30_000,
        headerName: 'x-vapi-timestamp',
      },

      hmac: {
        secretKey: process.env.VAPI_SECRET_KEY ?? '',
        signatureHeader: 'x-vapi-signature',
        timestampHeader: 'x-vapi-timestamp',
        algorithm: 'sha256',
      },

      content: {
        maxPayloadSize: 1_048_576, // 1MB
        requiredContentType: 'application/json',
        validateVapiStructure: true,
      },

      ...config,
    };

    // Initialize components
    this.ipWhitelist = new IPWhitelist(this.config.ipWhitelist);

    this.rateLimiter = new MultiTierRateLimiter({
      perIp: this.config.rateLimiter,
      perTenant: {
        ...this.config.rateLimiter,
        maxRequests: this.config.rateLimiter.maxRequests * 10, // 10x for tenants
      },
    });
  }

  // =====================================================
  // MAIN VALIDATION METHOD
  // =====================================================

  /**
   * Validate incoming webhook request through all security layers
   */
  async validate(
    request: Request,
    body?: string
  ): Promise<SecurityValidationResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // Initialize result
    const result: SecurityValidationResult = {
      valid: true,
      validations: {
        ip: false,
        rateLimit: false,
        timestamp: false,
        signature: false,
        content: false,
      },
      metadata: {
        requestId,
      },
    };

    // If security gate is disabled, skip all validations
    if (!this.config.enabled) {
      result.validations = {
        ip: true,
        rateLimit: true,
        timestamp: true,
        signature: true,
        content: true,
      };
      return result;
    }

    // Get headers
    const headers = request.headers;

    // Extract client IP
    const clientIp = this.extractClientIP(request);
    result.metadata!.clientIp = clientIp;

    // =====================================================
    // LAYER 1: IP WHITELIST
    // =====================================================

    const ipResult = this.validateIP(clientIp, headers.get('x-forwarded-for'));

    result.validations.ip = ipResult.passed;

    if (!ipResult.passed) {
      result.valid = false;
      result.failedAt = 'ip';
      result.reason = ipResult.reason;

      if (this.config.failFast) {
        result.metadata!.processingTimeMs = Date.now() - startTime;
        return result;
      }
    }

    // =====================================================
    // LAYER 2: RATE LIMITING
    // =====================================================

    const rateLimitResult = this.validateRateLimit(clientIp);

    result.validations.rateLimit = rateLimitResult.passed;
    result.metadata!.rateLimitRemaining =
      rateLimitResult.metadata?.remaining as number;

    if (!rateLimitResult.passed) {
      result.valid = false;
      result.failedAt = result.failedAt ?? 'rateLimit';
      result.reason = result.reason ?? rateLimitResult.reason;

      if (this.config.failFast) {
        result.metadata!.processingTimeMs = Date.now() - startTime;
        return result;
      }
    }

    // =====================================================
    // LAYER 3: TIMESTAMP VALIDATION
    // =====================================================

    const timestampHeader = headers.get(this.config.timestamp.headerName);
    const timestampResult = this.validateTimestamp(timestampHeader);

    result.validations.timestamp = timestampResult.passed;
    result.metadata!.timestampAgeMs =
      timestampResult.metadata?.ageMs as number;

    if (!timestampResult.passed) {
      result.valid = false;
      result.failedAt = result.failedAt ?? 'timestamp';
      result.reason = result.reason ?? timestampResult.reason;

      if (this.config.failFast) {
        result.metadata!.processingTimeMs = Date.now() - startTime;
        return result;
      }
    }

    // =====================================================
    // LAYER 4: HMAC SIGNATURE
    // =====================================================

    // Get request body if not provided
    let requestBody = body;
    if (!requestBody) {
      try {
        requestBody = await request.text();
      } catch {
        requestBody = '';
      }
    }

    const signatureHeader = headers.get(this.config.hmac.signatureHeader);
    const signatureResult = this.validateSignature(
      signatureHeader,
      timestampHeader,
      requestBody
    );

    result.validations.signature = signatureResult.passed;

    if (!signatureResult.passed) {
      result.valid = false;
      result.failedAt = result.failedAt ?? 'signature';
      result.reason = result.reason ?? signatureResult.reason;

      if (this.config.failFast) {
        result.metadata!.processingTimeMs = Date.now() - startTime;
        return result;
      }
    }

    // =====================================================
    // LAYER 5: CONTENT VALIDATION
    // =====================================================

    const contentResult = this.validateContent(
      headers.get('content-type'),
      requestBody
    );

    result.validations.content = contentResult.passed;

    if (!contentResult.passed) {
      result.valid = false;
      result.failedAt = result.failedAt ?? 'content';
      result.reason = result.reason ?? contentResult.reason;
    }

    // Calculate processing time
    result.metadata!.processingTimeMs = Date.now() - startTime;

    // Determine final validity
    result.valid = Object.values(result.validations).every(Boolean);

    return result;
  }

  // =====================================================
  // LAYER 1: IP VALIDATION
  // =====================================================

  /**
   * Validate client IP against whitelist
   */
  validateIP(
    clientIp: string,
    forwardedFor?: string | null
  ): ValidationCheckResult {
    return this.ipWhitelist.validate(clientIp, forwardedFor);
  }

  // =====================================================
  // LAYER 2: RATE LIMIT VALIDATION
  // =====================================================

  /**
   * Validate request against rate limits
   */
  validateRateLimit(
    clientIp: string,
    tenantId?: string
  ): ValidationCheckResult {
    return this.rateLimiter.validate(clientIp, tenantId);
  }

  // =====================================================
  // LAYER 3: TIMESTAMP VALIDATION
  // =====================================================

  /**
   * Validate request timestamp to prevent replay attacks
   */
  validateTimestamp(timestamp: string | null): ValidationCheckResult {
    if (!timestamp) {
      return {
        passed: false,
        reason: 'Missing timestamp header',
        metadata: { headerName: this.config.timestamp.headerName },
      };
    }

    // Parse timestamp (VAPI uses Unix timestamp in seconds or ISO string)
    let requestTime: number;

    // Check if it's a pure numeric string (Unix timestamp)
    if (/^\d+$/.test(timestamp)) {
      const unixTimestamp = parseInt(timestamp, 10);
      // Convert seconds to milliseconds if needed
      requestTime =
        unixTimestamp > 1e12 ? unixTimestamp : unixTimestamp * 1000;
    } else {
      // Try parsing as ISO string
      requestTime = new Date(timestamp).getTime();
    }

    if (isNaN(requestTime)) {
      return {
        passed: false,
        reason: 'Invalid timestamp format',
        metadata: { timestamp },
      };
    }

    const now = Date.now();
    const age = Math.abs(now - requestTime);

    // Check if timestamp is too old
    if (age > this.config.timestamp.maxAgeMs) {
      return {
        passed: false,
        reason: `Timestamp too old: ${Math.floor(age / 1000)}s (max: ${Math.floor(this.config.timestamp.maxAgeMs / 1000)}s)`,
        metadata: {
          timestamp,
          ageMs: age,
          maxAgeMs: this.config.timestamp.maxAgeMs,
        },
      };
    }

    // Check for future timestamps (with clock skew tolerance)
    if (requestTime > now + this.config.timestamp.clockSkewToleranceMs) {
      return {
        passed: false,
        reason: `Timestamp is in the future (clock skew > ${this.config.timestamp.clockSkewToleranceMs}ms)`,
        metadata: {
          timestamp,
          requestTime,
          serverTime: now,
          skewMs: requestTime - now,
        },
      };
    }

    return {
      passed: true,
      metadata: {
        timestamp,
        ageMs: age,
      },
    };
  }

  // =====================================================
  // LAYER 4: HMAC SIGNATURE VALIDATION
  // =====================================================

  /**
   * Validate HMAC signature of the request
   * VAPI signs: timestamp.payload
   */
  validateSignature(
    signature: string | null,
    timestamp: string | null,
    payload: string
  ): ValidationCheckResult {
    // Check if secret key is configured
    if (!this.config.hmac.secretKey) {
      // In development, we might skip signature validation
      if (process.env.NODE_ENV === 'development') {
        return {
          passed: true,
          reason: 'Signature validation skipped in development (no secret key)',
          metadata: { skipped: true },
        };
      }

      return {
        passed: false,
        reason: 'HMAC secret key not configured',
        metadata: { error: 'VAPI_SECRET_KEY not set' },
      };
    }

    if (!signature) {
      return {
        passed: false,
        reason: 'Missing signature header',
        metadata: { headerName: this.config.hmac.signatureHeader },
      };
    }

    if (!timestamp) {
      return {
        passed: false,
        reason: 'Missing timestamp for signature validation',
        metadata: { headerName: this.config.hmac.timestampHeader },
      };
    }

    // Validate signature format (must be valid hex)
    if (!/^[a-fA-F0-9]+$/.test(signature)) {
      return {
        passed: false,
        reason: 'Invalid signature format (not valid hex)',
        metadata: { signaturePrefix: signature.substring(0, 8) + '...' },
      };
    }

    // VAPI signature format: timestamp.payload
    const signedPayload = `${timestamp}.${payload}`;

    // Calculate expected signature
    const expectedSignature = createHmac(
      this.config.hmac.algorithm,
      this.config.hmac.secretKey
    )
      .update(signedPayload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    try {
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      // Ensure buffers are same length before comparison
      if (signatureBuffer.length !== expectedBuffer.length) {
        return {
          passed: false,
          reason: 'Invalid signature length',
          metadata: {
            receivedLength: signatureBuffer.length,
            expectedLength: expectedBuffer.length,
          },
        };
      }

      const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        return {
          passed: false,
          reason: 'Signature mismatch',
          metadata: {
            // Never log actual signatures
            signaturePrefix: signature.substring(0, 8) + '...',
          },
        };
      }

      return {
        passed: true,
        metadata: {
          algorithm: this.config.hmac.algorithm,
        },
      };
    } catch (error) {
      return {
        passed: false,
        reason: 'Signature validation error',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // =====================================================
  // LAYER 5: CONTENT VALIDATION
  // =====================================================

  /**
   * Validate request content (type, size, structure)
   */
  validateContent(
    contentType: string | null,
    body: string
  ): ValidationCheckResult {
    // Check content type
    if (
      !contentType ||
      !contentType.includes(this.config.content.requiredContentType)
    ) {
      return {
        passed: false,
        reason: `Invalid content type: expected ${this.config.content.requiredContentType}`,
        metadata: { contentType },
      };
    }

    // Check payload size
    const payloadSize = Buffer.byteLength(body, 'utf8');
    if (payloadSize > this.config.content.maxPayloadSize) {
      return {
        passed: false,
        reason: `Payload too large: ${payloadSize} bytes (max: ${this.config.content.maxPayloadSize})`,
        metadata: {
          payloadSize,
          maxSize: this.config.content.maxPayloadSize,
        },
      };
    }

    // Check if body is empty
    if (!body || body.trim().length === 0) {
      return {
        passed: false,
        reason: 'Empty request body',
        metadata: {},
      };
    }

    // Validate JSON structure
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(body);
    } catch (error) {
      return {
        passed: false,
        reason: 'Invalid JSON in request body',
        metadata: {
          error: error instanceof Error ? error.message : 'Parse error',
        },
      };
    }

    // Validate VAPI webhook structure if enabled
    if (this.config.content.validateVapiStructure) {
      if (!isVapiWebhookPayload(parsedBody)) {
        return {
          passed: false,
          reason:
            'Invalid VAPI webhook structure: missing or invalid message object',
          metadata: {
            hasMessage: typeof (parsedBody as Record<string, unknown>)
              ?.message === 'object',
          },
        };
      }

      // Validate message type
      const messageType = (parsedBody as VapiWebhookPayload).message.type;
      if (!isValidVapiMessageType(messageType)) {
        return {
          passed: false,
          reason: `Unknown VAPI message type: ${messageType}`,
          metadata: { messageType },
        };
      }
    }

    return {
      passed: true,
      metadata: {
        payloadSize,
        messageType: (parsedBody as VapiWebhookPayload)?.message?.type,
      },
    };
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Extract client IP from request
   */
  private extractClientIP(request: Request): string {
    const headers = request.headers;

    // Try various headers used by proxies/load balancers
    const forwardedFor = headers.get('x-forwarded-for');
    if (forwardedFor) {
      // Take the first IP (original client)
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = headers.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }

    const cfConnectingIp = headers.get('cf-connecting-ip');
    if (cfConnectingIp) {
      return cfConnectingIp.trim();
    }

    // Fallback: try to get from request URL (for some environments)
    // This is typically set by the server
    return '0.0.0.0';
  }

  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `vapi-${timestamp}-${random}`;
  }

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): Omit<SecurityGateConfig, 'hmac'> & { hmac: { secretKey: string } } {
    return {
      ...this.config,
      hmac: {
        ...this.config.hmac,
        secretKey: this.config.hmac.secretKey ? '[REDACTED]' : '[NOT SET]',
      },
    };
  }

  /**
   * Stop the security gate (cleanup timers)
   */
  stop(): void {
    this.rateLimiter.stop();
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create a pre-configured security gate instance
 */
export function createSecurityGate(
  options?: Partial<SecurityGateConfig>
): WebhookSecurityGate {
  return new WebhookSecurityGate(options);
}

/**
 * Create a development-mode security gate (relaxed settings)
 */
export function createDevSecurityGate(): WebhookSecurityGate {
  return new WebhookSecurityGate({
    enabled: true,
    failFast: false,
    enableLogging: true,
    ipWhitelist: {
      allowedIPs: [...DEFAULT_VAPI_IP_RANGES],
      allowAllInDevelopment: true,
      trustProxy: true,
      maxProxyHops: 5,
    },
  });
}

// Note: Types are exported from ./types.ts and re-exported via ./index.ts
// This file only exports the class and factory functions
