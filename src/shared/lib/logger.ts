// =====================================================
// TIS TIS PLATFORM - Structured Logger Service
// Sprint 4: Logger estructurado para reemplazar console.*
// =====================================================

// ======================
// TYPES
// ======================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** User ID for user tracking */
  userId?: string;
  /** Request ID for request correlation */
  requestId?: string;
  /** Service/module name */
  service?: string;
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
}

export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include timestamps */
  includeTimestamp: boolean;
  /** Whether to output as JSON */
  jsonOutput: boolean;
  /** Whether logging is enabled */
  enabled: boolean;
  /** Default service name */
  defaultService?: string;
}

// ======================
// LOG LEVEL PRIORITIES
// ======================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ======================
// DEFAULT CONFIG
// ======================

const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  includeTimestamp: true,
  jsonOutput: process.env.NODE_ENV === 'production',
  enabled: true,
  defaultService: 'tistis',
};

// ======================
// LOGGER CLASS
// ======================

class Logger {
  private config: LoggerConfig;
  private context: LogContext;

  constructor(config: Partial<LoggerConfig> = {}, context: LogContext = {}) {
    this.config = { ...defaultConfig, ...config };
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger(this.config, { ...this.context, ...context });
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  /**
   * Format and output a log entry
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        service: this.config.defaultService,
        ...this.context,
        ...context,
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.output(entry);
  }

  /**
   * Output the log entry
   */
  private output(entry: LogEntry): void {
    if (this.config.jsonOutput) {
      // JSON format for production/log aggregators
      const output = JSON.stringify(entry);
      switch (entry.level) {
        case 'error':
          console.error(output);
          break;
        case 'warn':
          console.warn(output);
          break;
        default:
          console.log(output);
      }
    } else {
      // Human-readable format for development
      const timestamp = this.config.includeTimestamp
        ? `[${entry.timestamp}] `
        : '';
      const contextStr = this.formatContext(entry.context);
      const prefix = `${timestamp}[${entry.level.toUpperCase()}]${contextStr}`;

      switch (entry.level) {
        case 'error':
          console.error(`${prefix} ${entry.message}`);
          if (entry.error?.stack) {
            console.error(entry.error.stack);
          }
          break;
        case 'warn':
          console.warn(`${prefix} ${entry.message}`);
          break;
        case 'debug':
          console.debug(`${prefix} ${entry.message}`);
          break;
        default:
          console.log(`${prefix} ${entry.message}`);
      }
    }
  }

  /**
   * Format context for human-readable output
   */
  private formatContext(context: LogContext): string {
    const parts: string[] = [];

    if (context.service) parts.push(context.service);
    if (context.tenantId) parts.push(`tenant:${context.tenantId.slice(0, 8)}`);
    if (context.requestId) parts.push(`req:${context.requestId.slice(0, 8)}`);

    return parts.length > 0 ? ` [${parts.join('|')}]` : '';
  }

  // ======================
  // PUBLIC LOGGING METHODS
  // ======================

  /**
   * Debug level - detailed information for debugging
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info level - general operational information
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warn level - potentially harmful situations
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error level - error events that might still allow the app to continue
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorObj = error instanceof Error ? error : undefined;
    const errorContext = error && !(error instanceof Error)
      ? { ...context, errorData: error }
      : context;
    this.log('error', message, errorContext, errorObj);
  }

  // ======================
  // CONVENIENCE METHODS
  // ======================

  /**
   * Log with tenant context
   */
  forTenant(tenantId: string): Logger {
    return this.child({ tenantId });
  }

  /**
   * Log with user context
   */
  forUser(userId: string): Logger {
    return this.child({ userId });
  }

  /**
   * Log with request context
   */
  forRequest(requestId: string): Logger {
    return this.child({ requestId });
  }

  /**
   * Log with service context
   */
  forService(service: string): Logger {
    return this.child({ service });
  }

  /**
   * Create a logger with full context from a request
   */
  fromRequest(request: Request, tenantId?: string, userId?: string): Logger {
    const headers = request.headers;
    const requestId = headers.get('x-request-id') || crypto.randomUUID();

    return this.child({
      requestId,
      tenantId,
      userId,
    });
  }

  // ======================
  // TIMING/PERFORMANCE
  // ======================

  /**
   * Start a timer and return a function to log the duration
   */
  startTimer(operation: string, context?: LogContext): () => void {
    const startTime = Date.now();

    return () => {
      const durationMs = Date.now() - startTime;
      this.info(`${operation} completed in ${durationMs}ms`, {
        ...context,
        durationMs,
        operation,
      });
    };
  }

  /**
   * Log operation with timing
   */
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;
      this.info(`${operation} completed in ${durationMs}ms`, {
        ...context,
        durationMs,
        operation,
        success: true,
      });
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.error(`${operation} failed after ${durationMs}ms`, error, {
        ...context,
        durationMs,
        operation,
        success: false,
      });
      throw error;
    }
  }
}

// ======================
// SINGLETON INSTANCES
// ======================

/** Global logger instance */
export const logger = new Logger();

/** Create service-specific loggers */
export const createLogger = (service: string, context?: LogContext): Logger => {
  return logger.child({ service, ...context });
};

// ======================
// PRE-CONFIGURED SERVICE LOGGERS
// ======================

export const aiLogger = createLogger('ai');
export const apiLogger = createLogger('api');
export const authLogger = createLogger('auth');
export const dbLogger = createLogger('db');
export const webhookLogger = createLogger('webhook');
export const integrationLogger = createLogger('integration');
export const voiceLogger = createLogger('voice');

// ======================
// BACKWARDS COMPATIBILITY
// ======================

/**
 * Drop-in replacement for console.log that adds structure
 * Use this during migration from console.* to logger.*
 */
export const log = {
  debug: (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      logger.debug(message, { args });
    } else {
      logger.debug(message);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      logger.info(message, { args });
    } else {
      logger.info(message);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      logger.warn(message, { args });
    } else {
      logger.warn(message);
    }
  },
  error: (message: string, error?: unknown, ...args: unknown[]) => {
    logger.error(message, error, args.length > 0 ? { args } : undefined);
  },
};

// ======================
// EXPORTS
// ======================

export { Logger };
// Note: LogEntry, LoggerConfig already exported as interfaces above
