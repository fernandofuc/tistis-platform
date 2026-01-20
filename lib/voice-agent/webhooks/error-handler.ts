/**
 * TIS TIS Platform - Voice Agent v2.0
 * Webhook Error Handler
 *
 * Centralized error handling for webhook processing.
 * Ensures consistent error responses and proper logging.
 */

import type {
  WebhookHandlerContext,
  ErrorResponse,
  WebhookErrorCode,
  HandlerResult,
} from './types';
import { WebhookError } from './types';

// =====================================================
// ERROR HANDLER
// =====================================================

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Include error details in response (only for development) */
  includeDetails?: boolean;

  /** Log errors to console */
  logErrors?: boolean;

  /** Custom error logger */
  logger?: (error: Error, context: WebhookHandlerContext) => void;
}

/**
 * Default error handler options
 */
export const DEFAULT_ERROR_HANDLER_OPTIONS: ErrorHandlerOptions = {
  includeDetails: process.env.NODE_ENV === 'development',
  logErrors: true,
};

/**
 * Handle webhook errors and convert to appropriate responses
 */
export function handleWebhookError(
  error: unknown,
  context: WebhookHandlerContext,
  options: ErrorHandlerOptions = DEFAULT_ERROR_HANDLER_OPTIONS
): HandlerResult<ErrorResponse> {
  const processingTime = Date.now() - context.startTime;

  // Log error if enabled
  if (options.logErrors) {
    logError(error, context, processingTime);
  }

  // Custom logger if provided
  if (options.logger && error instanceof Error) {
    options.logger(error, context);
  }

  // Convert to WebhookError if not already
  const webhookError = toWebhookError(error);

  // Build response
  const response: ErrorResponse = {
    error: sanitizeErrorMessage(webhookError.message),
    code: webhookError.code,
  };

  // Include details only in development
  if (options.includeDetails && webhookError.details) {
    response.details = webhookError.details;
  }

  return {
    response,
    statusCode: webhookError.statusCode,
    shouldLog: true,
    metadata: {
      errorCode: webhookError.code,
      processingTimeMs: processingTime,
      requestId: context.requestId,
    },
  };
}

// =====================================================
// ERROR CONVERSION
// =====================================================

/**
 * Convert any error to a WebhookError
 */
export function toWebhookError(error: unknown): WebhookError {
  // Already a WebhookError
  if (error instanceof WebhookError) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for known error patterns
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return new WebhookError(
        'TIMEOUT_ERROR',
        'Request timed out',
        504,
        { originalMessage: error.message }
      );
    }

    if (error.message.includes('database') || error.message.includes('ECONNREFUSED')) {
      return new WebhookError(
        'DATABASE_ERROR',
        'Database connection error',
        503,
        { originalMessage: error.message }
      );
    }

    // Generic internal error
    return new WebhookError(
      'INTERNAL_ERROR',
      error.message || 'An unexpected error occurred',
      500,
      { stack: process.env.NODE_ENV === 'development' ? error.stack : undefined }
    );
  }

  // Unknown error type
  return new WebhookError(
    'INTERNAL_ERROR',
    'An unexpected error occurred',
    500,
    { originalError: String(error) }
  );
}

// =====================================================
// ERROR FACTORY FUNCTIONS
// =====================================================

/**
 * Create an invalid payload error
 */
export function invalidPayloadError(details?: string): WebhookError {
  return new WebhookError(
    'INVALID_PAYLOAD',
    details || 'Invalid webhook payload',
    400
  );
}

/**
 * Create an unknown event type error
 */
export function unknownEventTypeError(eventType: string): WebhookError {
  return new WebhookError(
    'UNKNOWN_EVENT_TYPE',
    `Unknown event type: ${eventType}`,
    400,
    { eventType }
  );
}

/**
 * Create a handler not found error
 */
export function handlerNotFoundError(eventType: string): WebhookError {
  return new WebhookError(
    'HANDLER_NOT_FOUND',
    `No handler registered for event type: ${eventType}`,
    500,
    { eventType }
  );
}

/**
 * Create a tenant not found error
 */
export function tenantNotFoundError(phoneNumber?: string): WebhookError {
  return new WebhookError(
    'TENANT_NOT_FOUND',
    'No tenant found for the given phone number',
    404,
    phoneNumber ? { phoneNumber: maskPhoneNumber(phoneNumber) } : undefined
  );
}

/**
 * Create a call not found error
 */
export function callNotFoundError(callId: string): WebhookError {
  return new WebhookError(
    'CALL_NOT_FOUND',
    'Call not found',
    404,
    { callId }
  );
}

/**
 * Create a config not found error
 */
export function configNotFoundError(tenantId: string): WebhookError {
  return new WebhookError(
    'CONFIG_NOT_FOUND',
    'Voice agent configuration not found for tenant',
    404,
    { tenantId }
  );
}

/**
 * Create a function not found error
 */
export function functionNotFoundError(functionName: string): WebhookError {
  return new WebhookError(
    'FUNCTION_NOT_FOUND',
    `Function not found: ${functionName}`,
    404,
    { functionName }
  );
}

/**
 * Create a function execution error
 */
export function functionExecutionError(
  functionName: string,
  originalError?: Error
): WebhookError {
  return new WebhookError(
    'FUNCTION_EXECUTION_ERROR',
    `Error executing function: ${functionName}`,
    500,
    {
      functionName,
      originalMessage: originalError?.message,
    }
  );
}

/**
 * Create a database error
 */
export function databaseError(operation: string, originalError?: Error): WebhookError {
  return new WebhookError(
    'DATABASE_ERROR',
    `Database error during ${operation}`,
    503,
    {
      operation,
      originalMessage: originalError?.message,
    }
  );
}

/**
 * Create a handler error
 */
export function handlerError(
  handlerName: string,
  originalError?: Error
): WebhookError {
  return new WebhookError(
    'HANDLER_ERROR',
    `Error in handler: ${handlerName}`,
    500,
    {
      handlerName,
      originalMessage: originalError?.message,
    }
  );
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Sanitize error message to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  // Remove file paths
  let sanitized = message.replace(/\/[^\s]+\.(ts|js)/g, '[path]');

  // Remove potential secrets or tokens
  sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, '[redacted]');

  // Remove IP addresses
  sanitized = sanitized.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '[ip]');

  return sanitized;
}

/**
 * Mask phone number for logging
 */
function maskPhoneNumber(phone: string): string {
  if (phone.length <= 4) {
    return '****';
  }
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}

/**
 * Log error with context
 */
function logError(
  error: unknown,
  context: WebhookHandlerContext,
  processingTime: number
): void {
  const webhookError = error instanceof WebhookError ? error : toWebhookError(error);

  const logData = {
    level: 'error',
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
    clientIp: context.clientIp,
    tenantId: context.tenantId,
    callId: context.callId,
    errorCode: webhookError.code,
    errorMessage: webhookError.message,
    statusCode: webhookError.statusCode,
    processingTimeMs: processingTime,
    details: process.env.NODE_ENV === 'development' ? webhookError.details : undefined,
  };

  console.error('[Voice Webhook Error]', JSON.stringify(logData));

  // Log stack trace in development
  if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
    console.error('[Voice Webhook Error Stack]', error.stack);
  }
}

// =====================================================
// ERROR RESPONSE HELPERS
// =====================================================

/**
 * Create a generic error response for VAPI
 */
export function createErrorResponse(
  code: WebhookErrorCode,
  message: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    error: message,
    code,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
  };
}

/**
 * Create a fallback assistant response for error cases
 */
export function createFallbackAssistantResponse(locale: string = 'es'): string {
  const messages: Record<string, string> = {
    es: 'Disculpa, tuve un problema técnico. ¿Podrías repetir lo que dijiste?',
    en: 'Sorry, I had a technical issue. Could you repeat what you said?',
  };

  return messages[locale] || messages['es'];
}

/**
 * Determine if error should trigger a retry
 */
export function isRetryableError(error: WebhookError): boolean {
  const retryableCodes: WebhookErrorCode[] = [
    'DATABASE_ERROR',
    'TIMEOUT_ERROR',
  ];

  return retryableCodes.includes(error.code);
}

/**
 * Get HTTP status text for status code
 */
export function getStatusText(statusCode: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return statusTexts[statusCode] || 'Unknown Error';
}
