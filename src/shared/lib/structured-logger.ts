// =====================================================
// TIS TIS PLATFORM - Structured JSON Logger
// Production-ready logging with context, correlation IDs, and levels
// =====================================================

// ============================================
// TYPES
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  /** Correlation ID for tracing requests across services */
  correlationId?: string;
  /** Tenant ID for multi-tenant context */
  tenantId?: string;
  /** User ID (never log PII like email directly) */
  userId?: string;
  /** Request path */
  path?: string;
  /** HTTP method */
  method?: string;
  /** Response status code */
  statusCode?: number;
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Component/service name */
  component?: string;
  /** Action being performed */
  action?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  environment: string;
  service: string;
  version: string;
}

export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Service name for all logs */
  serviceName: string;
  /** Service version */
  version: string;
  /** Pretty print in development */
  prettyPrint: boolean;
  /** Redact sensitive fields */
  redactFields: string[];
  /** Include stack traces */
  includeStackTraces: boolean;
}

// ============================================
// LOG LEVEL HIERARCHY
// ============================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// ============================================
// SENSITIVE FIELD PATTERNS
// ============================================

const DEFAULT_REDACT_PATTERNS = [
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'creditCard',
  'credit_card',
  'ssn',
  'privateKey',
  'private_key',
  'sessionId',
  'session_id',
];

// ============================================
// MAIN LOGGER CLASS
// ============================================

export class StructuredLogger {
  private config: LoggerConfig;
  private defaultContext: LogContext;

  constructor(config?: Partial<LoggerConfig>, defaultContext?: LogContext) {
    const isProduction = process.env.NODE_ENV === 'production';

    this.config = {
      minLevel: isProduction ? 'info' : 'debug',
      serviceName: 'tistis-platform',
      version: process.env.npm_package_version || '0.1.0',
      prettyPrint: !isProduction,
      redactFields: DEFAULT_REDACT_PATTERNS,
      includeStackTraces: !isProduction,
      ...config,
    };

    this.defaultContext = defaultContext || {};
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  /**
   * Redact sensitive fields from an object (including arrays)
   */
  private redactSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const isRedacted = this.config.redactFields.some(pattern =>
        key.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isRedacted) {
        result[key] = '[REDACTED]';
      } else if (Array.isArray(value)) {
        // Recursively redact arrays
        result[key] = value.map(item =>
          typeof item === 'object' && item !== null
            ? this.redactSensitiveFields(item as Record<string, unknown>)
            : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.redactSensitiveFields(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Format error for logging
   */
  private formatError(error: unknown): LogEntry['error'] | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: this.config.includeStackTraces ? error.stack : undefined,
      };
    }

    return {
      name: 'UnknownError',
      message: String(error),
    };
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown
  ): LogEntry {
    const mergedContext = this.redactSensitiveFields({
      ...this.defaultContext,
      ...context,
    }) as LogContext;

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: mergedContext,
      error: this.formatError(error),
      environment: process.env.NODE_ENV || 'development',
      service: this.config.serviceName,
      version: this.config.version,
    };
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    const output = this.config.prettyPrint
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error);
    this.output(entry);
  }

  // ============================================
  // PUBLIC LOGGING METHODS
  // ============================================

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext, error?: unknown): void {
    this.log('warn', message, context, error);
  }

  error(message: string, context?: LogContext, error?: unknown): void {
    this.log('error', message, context, error);
  }

  fatal(message: string, context?: LogContext, error?: unknown): void {
    this.log('fatal', message, context, error);
  }

  // ============================================
  // SPECIALIZED LOGGING METHODS
  // ============================================

  /**
   * Log API request
   */
  request(
    method: string,
    path: string,
    context?: Omit<LogContext, 'method' | 'path'>
  ): void {
    this.info('API Request', {
      ...context,
      method,
      path,
      action: 'request',
    });
  }

  /**
   * Log API response
   */
  response(
    method: string,
    path: string,
    statusCode: number,
    responseTimeMs: number,
    context?: Omit<LogContext, 'method' | 'path' | 'statusCode' | 'responseTimeMs'>
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this.log(level, 'API Response', {
      ...context,
      method,
      path,
      statusCode,
      responseTimeMs,
      action: 'response',
    });
  }

  /**
   * Log database operation
   */
  database(
    operation: 'query' | 'insert' | 'update' | 'delete',
    table: string,
    durationMs: number,
    context?: LogContext,
    error?: unknown
  ): void {
    const level: LogLevel = error ? 'error' : 'debug';
    this.log(level, `Database ${operation}`, {
      ...context,
      component: 'database',
      action: operation,
      table,
      durationMs,
    }, error);
  }

  /**
   * Log external API call
   */
  externalApi(
    service: string,
    endpoint: string,
    statusCode: number,
    durationMs: number,
    context?: LogContext,
    error?: unknown
  ): void {
    const level: LogLevel = error ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `External API: ${service}`, {
      ...context,
      component: 'external-api',
      action: 'call',
      service,
      endpoint,
      statusCode,
      durationMs,
    }, error);
  }

  /**
   * Log AI/LLM operation
   */
  ai(
    model: string,
    operation: string,
    tokens?: { input?: number; output?: number },
    durationMs?: number,
    context?: LogContext,
    error?: unknown
  ): void {
    const level: LogLevel = error ? 'error' : 'info';
    this.log(level, `AI ${operation}`, {
      ...context,
      component: 'ai',
      action: operation,
      model,
      inputTokens: tokens?.input,
      outputTokens: tokens?.output,
      durationMs,
    }, error);
  }

  /**
   * Log security event
   */
  security(
    event: 'login' | 'logout' | 'failed_login' | 'rate_limit' | 'unauthorized' | 'suspicious',
    context?: LogContext,
    error?: unknown
  ): void {
    const level: LogLevel = event === 'suspicious' ? 'warn' : 'info';
    this.log(level, `Security: ${event}`, {
      ...context,
      component: 'security',
      action: event,
    }, error);
  }

  /**
   * Log business event
   */
  business(
    event: string,
    context?: LogContext
  ): void {
    this.info(`Business: ${event}`, {
      ...context,
      component: 'business',
      action: event,
    });
  }

  // ============================================
  // CHILD LOGGER
  // ============================================

  /**
   * Create child logger with additional default context
   */
  child(additionalContext: LogContext): StructuredLogger {
    return new StructuredLogger(this.config, {
      ...this.defaultContext,
      ...additionalContext,
    });
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let loggerInstance: StructuredLogger | null = null;

/**
 * Get the singleton logger instance
 */
export function getLogger(config?: Partial<LoggerConfig>): StructuredLogger {
  if (!loggerInstance) {
    loggerInstance = new StructuredLogger(config);
  }
  return loggerInstance;
}

/**
 * Create a new logger instance (not singleton)
 */
export function createLogger(
  config?: Partial<LoggerConfig>,
  defaultContext?: LogContext
): StructuredLogger {
  return new StructuredLogger(config, defaultContext);
}

// ============================================
// CORRELATION ID UTILITIES
// ============================================

/**
 * Generate a correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract correlation ID from request headers
 */
export function getCorrelationId(request: Request): string {
  return (
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-request-id') ||
    generateCorrelationId()
  );
}

// ============================================
// REQUEST LOGGING MIDDLEWARE HELPER
// ============================================

/**
 * Create request logger context from NextRequest
 */
export function createRequestContext(
  request: Request,
  additionalContext?: Partial<LogContext>
): LogContext {
  const url = new URL(request.url);

  return {
    correlationId: getCorrelationId(request),
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        undefined,
    ...additionalContext,
  };
}

// ============================================
// EXPORTS
// ============================================

export default getLogger;
