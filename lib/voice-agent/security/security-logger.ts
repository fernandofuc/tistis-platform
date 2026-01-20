/**
 * TIS TIS Platform - Voice Agent v2.0
 * Security Event Logger
 *
 * Provides structured logging for security events.
 * Ensures sensitive data is never logged while maintaining
 * useful debugging information.
 */

import type {
  SecurityEvent,
  SecurityEventType,
  SecurityValidationResult,
  ValidationLayer,
} from './types';

// =====================================================
// TYPES
// =====================================================

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger configuration
 */
export interface SecurityLoggerConfig {
  /** Enable logging */
  enabled: boolean;

  /** Minimum log level */
  minLevel: LogLevel;

  /** Include stack traces for errors */
  includeStackTrace: boolean;

  /** Custom log handler (optional) */
  handler?: (event: SecurityLogEntry) => void;

  /** Environment name */
  environment: string;

  /** Service name for identification */
  serviceName: string;
}

/**
 * Complete log entry
 */
export interface SecurityLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  requestId: string;
  event: SecurityEventType;
  message: string;
  clientIp?: string;
  userAgent?: string;
  validationLayer?: ValidationLayer;
  details?: Record<string, unknown>;
}

// =====================================================
// SENSITIVE DATA PATTERNS
// =====================================================

/**
 * Patterns to redact from logs
 */
const SENSITIVE_PATTERNS = [
  // API keys and secrets
  /(?:api[_-]?key|secret|token|password|auth|bearer)[\s:=]+["']?[a-zA-Z0-9-_.]+["']?/gi,
  // Credit card numbers (basic pattern)
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  // SSN
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // Email addresses (partial redaction)
  /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  // Phone numbers
  /\+?\d{10,14}/g,
  // Signatures (hex strings > 32 chars)
  /\b[a-fA-F0-9]{32,}\b/g,
];

/**
 * Keys that should always be redacted
 */
const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'secretKey',
  'secret_key',
  'signature',
  'authorization',
  'x-vapi-signature',
  'creditCard',
  'ssn',
  'privateKey',
  'private_key',
];

// =====================================================
// SECURITY LOGGER CLASS
// =====================================================

export class SecurityLogger {
  private readonly config: SecurityLoggerConfig;
  private static instance: SecurityLogger | null = null;

  constructor(config?: Partial<SecurityLoggerConfig>) {
    this.config = {
      enabled: true,
      minLevel: 'info',
      includeStackTrace: process.env.NODE_ENV === 'development',
      environment: process.env.NODE_ENV ?? 'development',
      serviceName: 'voice-agent-security',
      ...config,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<SecurityLoggerConfig>): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger(config);
    }
    return SecurityLogger.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    SecurityLogger.instance = null;
  }

  // =====================================================
  // LOGGING METHODS
  // =====================================================

  /**
   * Log a security event from validation result
   */
  logValidationResult(
    result: SecurityValidationResult,
    additionalContext?: Record<string, unknown>
  ): void {
    const eventType: SecurityEventType = result.valid
      ? 'allowed'
      : this.mapFailureToEventType(result.failedAt);

    const level = result.valid ? 'info' : 'warn';

    this.log(level, eventType, {
      requestId: result.metadata?.requestId ?? 'unknown',
      message: result.valid
        ? 'Request passed security validation'
        : `Security validation failed: ${result.reason}`,
      clientIp: result.metadata?.clientIp,
      validationLayer: result.failedAt,
      details: {
        validations: result.validations,
        processingTimeMs: result.metadata?.processingTimeMs,
        ...additionalContext,
      },
    });
  }

  /**
   * Log a security event
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const level = this.eventTypeToLogLevel(event.type);

    this.log(level, event.type, {
      requestId: event.requestId,
      message: event.reason ?? `Security event: ${event.type}`,
      clientIp: event.clientIp,
      userAgent: event.userAgent,
      validationLayer: event.failedValidation,
      details: event.metadata,
    });
  }

  /**
   * Log allowed request
   */
  logAllowed(requestId: string, clientIp: string, metadata?: Record<string, unknown>): void {
    this.log('info', 'allowed', {
      requestId,
      message: 'Request allowed',
      clientIp,
      details: metadata,
    });
  }

  /**
   * Log blocked request
   */
  logBlocked(
    requestId: string,
    clientIp: string,
    layer: ValidationLayer,
    reason: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log('warn', 'blocked', {
      requestId,
      message: `Request blocked at ${layer}: ${reason}`,
      clientIp,
      validationLayer: layer,
      details: metadata,
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspicious(
    requestId: string,
    clientIp: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log('warn', 'suspicious', {
      requestId,
      message: `Suspicious activity detected: ${reason}`,
      clientIp,
      details: metadata,
    });
  }

  /**
   * Log rate limit hit
   */
  logRateLimited(
    requestId: string,
    clientIp: string,
    remaining: number,
    resetInMs: number
  ): void {
    this.log('warn', 'rate_limited', {
      requestId,
      message: `Rate limit exceeded for IP ${this.maskIP(clientIp)}`,
      clientIp: this.maskIP(clientIp),
      details: {
        remaining,
        resetInSeconds: Math.ceil(resetInMs / 1000),
      },
    });
  }

  // =====================================================
  // CORE LOGGING
  // =====================================================

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    event: SecurityEventType,
    data: {
      requestId: string;
      message: string;
      clientIp?: string;
      userAgent?: string;
      validationLayer?: ValidationLayer;
      details?: Record<string, unknown>;
    }
  ): void {
    if (!this.config.enabled) {
      return;
    }

    if (!this.shouldLog(level)) {
      return;
    }

    // Build log entry
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.serviceName,
      environment: this.config.environment,
      requestId: data.requestId,
      event,
      message: data.message,
      clientIp: data.clientIp ? this.maskIP(data.clientIp) : undefined,
      userAgent: data.userAgent,
      validationLayer: data.validationLayer,
      details: data.details ? this.sanitizeObject(data.details) : undefined,
    };

    // Use custom handler if provided
    if (this.config.handler) {
      this.config.handler(entry);
      return;
    }

    // Default: console output
    this.outputToConsole(entry);
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: SecurityLogEntry): void {
    const logFn = this.getConsoleMethod(entry.level);
    const formattedEntry = JSON.stringify(entry, null, 2);

    logFn(`[${entry.service}] ${entry.message}`, formattedEntry);
  }

  /**
   * Get appropriate console method for log level
   */
  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case 'debug':
        return console.debug.bind(console);
      case 'info':
        return console.info.bind(console);
      case 'warn':
        return console.warn.bind(console);
      case 'error':
        return console.error.bind(console);
      default:
        return console.log.bind(console);
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Check if we should log at this level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.config.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  /**
   * Map failure type to security event type
   */
  private mapFailureToEventType(
    failedAt?: ValidationLayer
  ): SecurityEventType {
    switch (failedAt) {
      case 'ip':
        return 'ip_blocked';
      case 'rateLimit':
        return 'rate_limited';
      case 'timestamp':
        return 'expired_timestamp';
      case 'signature':
        return 'invalid_signature';
      case 'content':
        return 'invalid_content';
      default:
        return 'blocked';
    }
  }

  /**
   * Map event type to log level
   */
  private eventTypeToLogLevel(eventType: SecurityEventType): LogLevel {
    switch (eventType) {
      case 'allowed':
        return 'info';
      case 'blocked':
      case 'rate_limited':
      case 'ip_blocked':
        return 'warn';
      case 'suspicious':
      case 'invalid_signature':
      case 'expired_timestamp':
      case 'invalid_content':
        return 'warn';
      default:
        return 'info';
    }
  }

  /**
   * Mask IP address for privacy
   */
  private maskIP(ip: string): string {
    // For IPv4: show first two octets, mask last two
    // For IPv6: show first group, mask rest
    if (ip.includes(':')) {
      // IPv6
      const parts = ip.split(':');
      return `${parts[0]}:****:****:****`;
    } else {
      // IPv4
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.***.***`;
      }
    }
    return '***masked***';
  }

  /**
   * Sanitize object by removing/masking sensitive data
   */
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if key is sensitive
      if (SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
        continue;
      }

      // Sanitize string values
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
        continue;
      }

      // Keep other values as-is
      sanitized[key] = value;
    }

    return sanitized;
  }

  /**
   * Sanitize string by redacting sensitive patterns
   */
  private sanitizeString(str: string): string {
    let sanitized = str;

    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Log a security event (convenience function)
 */
export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  SecurityLogger.getInstance().logSecurityEvent(event);
}

/**
 * Log validation result (convenience function)
 */
export function logValidationResult(
  result: SecurityValidationResult,
  context?: Record<string, unknown>
): void {
  SecurityLogger.getInstance().logValidationResult(result, context);
}

/**
 * Create a configured security logger
 */
export function createSecurityLogger(
  config?: Partial<SecurityLoggerConfig>
): SecurityLogger {
  return new SecurityLogger(config);
}

// Note: Types SecurityLoggerConfig, SecurityLogEntry, and LogLevel are
// already exported from their definitions above
