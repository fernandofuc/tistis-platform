/**
 * TIS TIS Platform - Voice Agent v2.0
 * Structured Voice Logger
 *
 * Provides structured JSON logging for all voice agent operations:
 * - Call lifecycle events
 * - Error tracking with context
 * - Circuit breaker state changes
 * - Performance measurements
 * - RAG operations
 * - Tool executions
 *
 * All logs follow a consistent JSON format for easy parsing
 * and integration with log aggregation systems.
 *
 * @module lib/voice-agent/monitoring/voice-logger
 */

import type { LogEntry, LogLevel } from './types';
import { recordVoiceError } from './voice-metrics';

// =====================================================
// TYPES
// =====================================================

/**
 * Logger configuration
 */
export interface VoiceLoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;

  /** Enable logging */
  enabled: boolean;

  /** Include stack traces for errors */
  includeStackTrace: boolean;

  /** Environment name */
  environment: string;

  /** Service name for identification */
  serviceName: string;

  /** Custom log handler (for testing or custom outputs) */
  customHandler?: (entry: LogEntry) => void;

  /** Whether to also log to console */
  consoleOutput: boolean;

  /** Pretty print JSON in development */
  prettyPrint: boolean;

  /** Redact sensitive data */
  redactSensitive: boolean;
}

/**
 * Call context for logging
 */
export interface CallContext {
  callId?: string;
  tenantId?: string;
  assistantType?: string;
  phoneNumber?: string;
  apiVersion?: 'v1' | 'v2';
}

/**
 * Error context for logging
 */
export interface ErrorContext extends CallContext {
  errorType?: string;
  errorCode?: string;
  operation?: string;
  retryCount?: number;
}

/**
 * Circuit breaker log context
 */
export interface CircuitBreakerContext {
  tenantId: string;
  previousState: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
  newState: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
  failureCount?: number;
  successCount?: number;
  reason?: string;
}

/**
 * RAG operation log context
 */
export interface RAGContext extends CallContext {
  operation: 'query' | 'index' | 'update' | 'delete';
  collection?: string;
  documentCount?: number;
  vectorCount?: number;
  durationMs?: number;
  relevanceScore?: number;
}

/**
 * Tool execution log context
 */
export interface ToolContext extends CallContext {
  toolName: string;
  toolType?: string;
  parameters?: Record<string, unknown>;
  result?: 'success' | 'failure' | 'timeout';
  durationMs?: number;
}

// =====================================================
// SENSITIVE DATA PATTERNS
// =====================================================

/**
 * Patterns to redact from logs
 */
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API keys and secrets
  { pattern: /(?:api[_-]?key|secret|token|password|auth|bearer)[\s:=]+["']?[a-zA-Z0-9-_.]+["']?/gi, replacement: '[REDACTED_KEY]' },
  // Credit card numbers
  { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[REDACTED_CC]' },
  // SSN
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
  // Phone numbers (keep last 4)
  { pattern: /\+?(\d{1,3})?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?(\d{4})/g, replacement: '***-***-$2' },
  // Signatures (hex strings > 32 chars)
  { pattern: /\b[a-fA-F0-9]{32,}\b/g, replacement: '[REDACTED_SIGNATURE]' },
];

/**
 * Keys that should always be redacted
 */
const SENSITIVE_KEYS = new Set([
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
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
]);

// =====================================================
// VOICE LOGGER CLASS
// =====================================================

/**
 * Structured voice logger with JSON output
 */
export class VoiceLogger {
  private readonly config: VoiceLoggerConfig;
  private static instance: VoiceLogger | null = null;
  private readonly startTime: number;

  constructor(config?: Partial<VoiceLoggerConfig>) {
    this.config = {
      minLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
      enabled: process.env.DISABLE_VOICE_LOGGING !== 'true',
      includeStackTrace: process.env.NODE_ENV === 'development',
      environment: process.env.NODE_ENV ?? 'development',
      serviceName: 'voice-agent-v2',
      consoleOutput: true,
      prettyPrint: process.env.NODE_ENV === 'development',
      redactSensitive: true,
      ...config,
    };
    this.startTime = Date.now();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<VoiceLoggerConfig>): VoiceLogger {
    if (!VoiceLogger.instance) {
      VoiceLogger.instance = new VoiceLogger(config);
    }
    return VoiceLogger.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    VoiceLogger.instance = null;
  }

  /**
   * Reconfigure the logger
   */
  configure(config: Partial<VoiceLoggerConfig>): void {
    Object.assign(this.config, config);
  }

  // =====================================================
  // LEVEL-SPECIFIC METHODS
  // =====================================================

  /**
   * Debug level log
   */
  debug(message: string, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
    this.log('debug', message, context);
  }

  /**
   * Info level log
   */
  info(message: string, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
    this.log('info', message, context);
  }

  /**
   * Warning level log
   */
  warn(message: string, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
    this.log('warn', message, context);
  }

  /**
   * Error level log
   */
  error(message: string, error?: Error | null, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
    const errorDetails = error ? {
      name: error.name,
      message: error.message,
      stack: this.config.includeStackTrace ? error.stack : undefined,
    } : undefined;

    this.log('error', message, {
      ...context,
      error: errorDetails,
    });
  }

  // =====================================================
  // CALL LIFECYCLE LOGGING
  // =====================================================

  /**
   * Log call start
   */
  logCallStart(context: CallContext & { callerNumber?: string; direction?: 'inbound' | 'outbound' }): void {
    this.info('Voice call started', {
      correlationId: context.callId,
      tenantId: context.tenantId,
      callId: context.callId,
      data: {
        tenantId: context.tenantId,
        assistantType: context.assistantType,
        apiVersion: context.apiVersion,
        direction: context.direction,
        callerNumber: context.callerNumber ? this.maskPhoneNumber(context.callerNumber) : undefined,
      },
    });
  }

  /**
   * Log call end
   */
  logCallEnd(context: CallContext & {
    durationSeconds: number;
    outcome: 'completed' | 'transferred' | 'failed' | 'abandoned';
    transferReason?: string;
    failureReason?: string;
  }): void {
    const level = context.outcome === 'failed' ? 'warn' : 'info';

    this.log(level, `Voice call ended: ${context.outcome}`, {
      correlationId: context.callId,
      tenantId: context.tenantId,
      callId: context.callId,
      durationMs: context.durationSeconds * 1000,
      data: {
        tenantId: context.tenantId,
        assistantType: context.assistantType,
        apiVersion: context.apiVersion,
        outcome: context.outcome,
        transferReason: context.transferReason,
        failureReason: context.failureReason,
      },
    });
  }

  /**
   * Log message in call
   */
  logCallMessage(context: CallContext & {
    role: 'user' | 'assistant' | 'system';
    messageType: 'speech' | 'tool_call' | 'function_call';
    durationMs?: number;
  }): void {
    this.debug('Call message processed', {
      correlationId: context.callId,
      tenantId: context.tenantId,
      callId: context.callId,
      durationMs: context.durationMs,
      data: {
        role: context.role,
        messageType: context.messageType,
        apiVersion: context.apiVersion,
      },
    });
  }

  // =====================================================
  // ERROR LOGGING
  // =====================================================

  /**
   * Log voice error with full context
   */
  logVoiceError(context: ErrorContext & { error: Error }): void {
    // Record in metrics
    recordVoiceError(context.errorType, { tenantId: context.tenantId ?? 'unknown' });

    this.error(`Voice error: ${context.operation ?? 'unknown'} - ${context.error.message}`, context.error, {
      correlationId: context.callId,
      tenantId: context.tenantId,
      callId: context.callId,
      data: {
        errorType: context.errorType,
        errorCode: context.errorCode,
        operation: context.operation,
        retryCount: context.retryCount,
        tenantId: context.tenantId,
        assistantType: context.assistantType,
        apiVersion: context.apiVersion,
      },
    });
  }

  /**
   * Log webhook error
   */
  logWebhookError(context: ErrorContext & {
    webhookType: string;
    httpStatus?: number;
    responseBody?: string;
    error: Error;
  }): void {
    this.error(`Webhook error: ${context.webhookType}`, context.error, {
      correlationId: context.callId,
      tenantId: context.tenantId,
      callId: context.callId,
      data: {
        webhookType: context.webhookType,
        httpStatus: context.httpStatus,
        responseBody: context.responseBody ? context.responseBody.slice(0, 500) : undefined,
        errorType: context.errorType,
        errorCode: context.errorCode,
        operation: context.operation,
        retryCount: context.retryCount,
      },
    });
  }

  // =====================================================
  // CIRCUIT BREAKER LOGGING
  // =====================================================

  /**
   * Log circuit breaker state change
   */
  logCircuitBreakerChange(context: CircuitBreakerContext): void {
    const level: LogLevel = context.newState === 'OPEN' ? 'warn' : 'info';

    this.log(level, `Circuit breaker state change: ${context.previousState} -> ${context.newState}`, {
      tenantId: context.tenantId,
      data: {
        tenantId: context.tenantId,
        previousState: context.previousState,
        newState: context.newState,
        failureCount: context.failureCount,
        successCount: context.successCount,
        reason: context.reason,
      },
    });
  }

  /**
   * Log circuit breaker trip
   */
  logCircuitBreakerTrip(tenantId: string, reason: string, failureCount: number): void {
    this.warn('Circuit breaker tripped to OPEN', {
      tenantId: tenantId,
      data: {
        tenantId,
        reason,
        failureCount,
        state: 'OPEN',
      },
    });
  }

  /**
   * Log circuit breaker recovery
   */
  logCircuitBreakerRecovery(tenantId: string, successCount: number): void {
    this.info('Circuit breaker recovered to CLOSED', {
      tenantId: tenantId,
      data: {
        tenantId,
        successCount,
        state: 'CLOSED',
      },
    });
  }

  // =====================================================
  // RAG OPERATIONS LOGGING
  // =====================================================

  /**
   * Log RAG operation
   */
  logRAGOperation(context: RAGContext): void {
    const level = context.durationMs && context.durationMs > 1000 ? 'warn' : 'debug';

    this.log(level, `RAG operation: ${context.operation}`, {
      correlationId: context.callId,
      tenantId: context.tenantId,
      callId: context.callId,
      durationMs: context.durationMs,
      data: {
        operation: context.operation,
        collection: context.collection,
        documentCount: context.documentCount,
        vectorCount: context.vectorCount,
        relevanceScore: context.relevanceScore,
        tenantId: context.tenantId,
        apiVersion: context.apiVersion,
      },
    });
  }

  /**
   * Log RAG query with results
   */
  logRAGQuery(context: RAGContext & {
    query?: string;
    resultsCount: number;
    topScore?: number;
  }): void {
    this.debug('RAG query executed', {
      correlationId: context.callId,
      tenantId: context.tenantId,
      callId: context.callId,
      durationMs: context.durationMs,
      data: {
        collection: context.collection,
        resultsCount: context.resultsCount,
        topScore: context.topScore,
        relevanceScore: context.relevanceScore,
        tenantId: context.tenantId,
      },
    });
  }

  // =====================================================
  // TOOL EXECUTION LOGGING
  // =====================================================

  /**
   * Log tool execution
   */
  logToolExecution(context: ToolContext): void {
    const level = context.result === 'failure' ? 'warn' : 'debug';

    this.log(level, `Tool execution: ${context.toolName} - ${context.result ?? 'completed'}`, {
      correlationId: context.callId,
      tenantId: context.tenantId,
      callId: context.callId,
      durationMs: context.durationMs,
      data: {
        toolName: context.toolName,
        toolType: context.toolType,
        result: context.result,
        tenantId: context.tenantId,
        apiVersion: context.apiVersion,
        // Only log non-sensitive parameters
        parameters: context.parameters ? this.sanitizeObject(context.parameters) : undefined,
      },
    });
  }

  // =====================================================
  // LATENCY LOGGING
  // =====================================================

  /**
   * Log latency measurement
   */
  logLatency(operation: string, durationMs: number, context?: CallContext & { threshold?: number }): void {
    const threshold = context?.threshold ?? 1000;
    const level = durationMs > threshold ? 'warn' : 'debug';

    this.log(level, `Latency: ${operation} took ${durationMs}ms`, {
      correlationId: context?.callId,
      tenantId: context?.tenantId,
      callId: context?.callId,
      durationMs,
      data: {
        operation,
        threshold,
        exceededThreshold: durationMs > threshold,
        tenantId: context?.tenantId,
        apiVersion: context?.apiVersion,
      },
    });
  }

  /**
   * Create a timer for measuring duration
   * @param _operation - Operation name (for future use in logging)
   */
  startTimer(_operation: string): () => number {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      return duration;
    };
  }

  // =====================================================
  // CORE LOGGING METHOD
  // =====================================================

  /**
   * Core log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>
  ): void {
    // Check if logging is enabled
    if (!this.config.enabled) {
      return;
    }

    // Check minimum level
    if (!this.shouldLog(level)) {
      return;
    }

    // Build log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.serviceName,
      correlationId: context?.correlationId,
      tenantId: context?.tenantId,
      callId: context?.callId,
      data: context?.data ? (this.config.redactSensitive ? this.sanitizeObject(context.data) : context.data) : undefined,
      error: context?.error,
      durationMs: context?.durationMs,
    };

    // Remove undefined values for cleaner output
    const cleanEntry = this.removeUndefined(entry);

    // Custom handler if provided
    if (this.config.customHandler) {
      this.config.customHandler(cleanEntry);
    }

    // Console output
    if (this.config.consoleOutput) {
      this.outputToConsole(cleanEntry);
    }
  }

  /**
   * Output to console
   */
  private outputToConsole(entry: LogEntry): void {
    const output = this.config.prettyPrint
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    const consoleMethod = this.getConsoleMethod(entry.level);
    consoleMethod(output);
  }

  /**
   * Get console method for level
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

  /**
   * Check if should log at level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.config.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  // =====================================================
  // SANITIZATION METHODS
  // =====================================================

  /**
   * Sanitize object by redacting sensitive data
   */
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if key is sensitive
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
        continue;
      }

      // Handle arrays
      if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? this.sanitizeObject(item as Record<string, unknown>)
            : typeof item === 'string'
            ? this.sanitizeString(item)
            : item
        );
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

    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  /**
   * Mask phone number for privacy
   */
  private maskPhoneNumber(phone: string): string {
    // Keep country code and last 4 digits
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return `+***-***-${cleaned.slice(-4)}`;
    }
    return '***-***-****';
  }

  /**
   * Remove undefined values from object
   */
  private removeUndefined(obj: LogEntry): LogEntry {
    const cleaned: Partial<LogEntry> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        (cleaned as Record<string, unknown>)[key] = value;
      }
    }
    return cleaned as LogEntry;
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Get uptime in seconds
   */
  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Create a child logger with default context
   */
  child(defaultContext: Partial<CallContext>): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

// =====================================================
// CHILD LOGGER CLASS
// =====================================================

/**
 * Child logger with pre-set context
 */
export class ChildLogger {
  constructor(
    private readonly parent: VoiceLogger,
    private readonly defaultContext: Partial<CallContext>
  ) {}

  debug(message: string, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error | null, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
    this.parent.error(message, error, this.mergeContext(context));
  }

  private mergeContext(context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>> {
    return {
      correlationId: this.defaultContext.callId,
      tenantId: this.defaultContext.tenantId,
      callId: this.defaultContext.callId,
      ...context,
      data: {
        tenantId: this.defaultContext.tenantId,
        assistantType: this.defaultContext.assistantType,
        apiVersion: this.defaultContext.apiVersion,
        ...context?.data,
      },
    };
  }
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Get the singleton logger instance
 */
export function getVoiceLogger(): VoiceLogger {
  return VoiceLogger.getInstance();
}

/**
 * Log at debug level
 */
export function logDebug(message: string, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
  VoiceLogger.getInstance().debug(message, context);
}

/**
 * Log at info level
 */
export function logInfo(message: string, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
  VoiceLogger.getInstance().info(message, context);
}

/**
 * Log at warn level
 */
export function logWarn(message: string, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
  VoiceLogger.getInstance().warn(message, context);
}

/**
 * Log at error level
 */
export function logError(message: string, error?: Error | null, context?: Partial<Omit<LogEntry, 'level' | 'timestamp' | 'message' | 'service'>>): void {
  VoiceLogger.getInstance().error(message, error, context);
}

/**
 * Log call start
 */
export function logCallStart(context: CallContext & { callerNumber?: string; direction?: 'inbound' | 'outbound' }): void {
  VoiceLogger.getInstance().logCallStart(context);
}

/**
 * Log call end
 */
export function logCallEnd(context: CallContext & {
  durationSeconds: number;
  outcome: 'completed' | 'transferred' | 'failed' | 'abandoned';
  transferReason?: string;
  failureReason?: string;
}): void {
  VoiceLogger.getInstance().logCallEnd(context);
}

/**
 * Log voice error
 */
export function logVoiceError(context: ErrorContext & { error: Error }): void {
  VoiceLogger.getInstance().logVoiceError(context);
}

/**
 * Log circuit breaker state change
 */
export function logCircuitBreakerChange(context: CircuitBreakerContext): void {
  VoiceLogger.getInstance().logCircuitBreakerChange(context);
}

/**
 * Log RAG operation
 */
export function logRAGOperation(context: RAGContext): void {
  VoiceLogger.getInstance().logRAGOperation(context);
}

/**
 * Log tool execution
 */
export function logToolExecution(context: ToolContext): void {
  VoiceLogger.getInstance().logToolExecution(context);
}

/**
 * Log latency measurement
 */
export function logLatency(operation: string, durationMs: number, context?: CallContext & { threshold?: number }): void {
  VoiceLogger.getInstance().logLatency(operation, durationMs, context);
}

/**
 * Create a child logger with default context
 */
export function createCallLogger(context: CallContext): ChildLogger {
  return VoiceLogger.getInstance().child(context);
}

/**
 * Start a timer for measuring duration
 */
export function startTimer(operation: string): () => number {
  return VoiceLogger.getInstance().startTimer(operation);
}
