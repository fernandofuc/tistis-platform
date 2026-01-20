/**
 * TIS TIS Platform - Voice Agent v2.0
 * Error Handler Tests
 */

import {
  handleWebhookError,
  toWebhookError,
  invalidPayloadError,
  unknownEventTypeError,
  handlerNotFoundError,
  tenantNotFoundError,
  callNotFoundError,
  configNotFoundError,
  functionNotFoundError,
  functionExecutionError,
  databaseError,
  handlerError,
  createErrorResponse,
  createFallbackAssistantResponse,
  isRetryableError,
  getStatusText,
} from '@/lib/voice-agent/webhooks/error-handler';
import { WebhookError } from '@/lib/voice-agent/webhooks/types';
import type { WebhookHandlerContext } from '@/lib/voice-agent/webhooks/types';

describe('handleWebhookError', () => {
  const createContext = (): WebhookHandlerContext => ({
    requestId: 'test-req-123',
    clientIp: '127.0.0.1',
    startTime: Date.now(),
  });

  it('should handle WebhookError correctly', () => {
    const error = new WebhookError('INVALID_PAYLOAD', 'Invalid payload', 400);
    const context = createContext();

    const result = handleWebhookError(error, context);

    expect(result.response.error).toBe('Invalid payload');
    expect(result.response.code).toBe('INVALID_PAYLOAD');
    expect(result.statusCode).toBe(400);
  });

  it('should convert standard Error to WebhookError', () => {
    const error = new Error('Something went wrong');
    const context = createContext();

    const result = handleWebhookError(error, context);

    expect(result.response.error).toBe('Something went wrong');
    expect(result.response.code).toBe('INTERNAL_ERROR');
    expect(result.statusCode).toBe(500);
  });

  it('should handle timeout errors', () => {
    const error = new Error('Request timeout ETIMEDOUT');
    const context = createContext();

    const result = handleWebhookError(error, context);

    expect(result.response.code).toBe('TIMEOUT_ERROR');
    expect(result.statusCode).toBe(504);
  });

  it('should handle database errors', () => {
    const error = new Error('ECONNREFUSED database connection failed');
    const context = createContext();

    const result = handleWebhookError(error, context);

    expect(result.response.code).toBe('DATABASE_ERROR');
    expect(result.statusCode).toBe(503);
  });

  it('should handle unknown error types', () => {
    const context = createContext();

    const result = handleWebhookError('string error', context);

    expect(result.response.error).toBe('An unexpected error occurred');
    expect(result.statusCode).toBe(500);
  });

  it('should include processing time in metadata', () => {
    const error = new Error('Test error');
    const context = createContext();

    const result = handleWebhookError(error, context);

    expect(result.metadata?.processingTimeMs).toBeDefined();
    expect(typeof result.metadata?.processingTimeMs).toBe('number');
  });

  it('should sanitize error messages', () => {
    const error = new Error('Error at /Users/test/app.ts:123');
    const context = createContext();

    const result = handleWebhookError(error, context);

    expect(result.response.error).not.toContain('/Users/test');
  });
});

describe('toWebhookError', () => {
  it('should return same error if already WebhookError', () => {
    const error = new WebhookError('INVALID_PAYLOAD', 'Invalid', 400);
    const result = toWebhookError(error);

    expect(result).toBe(error);
  });

  it('should convert standard Error', () => {
    const error = new Error('Test error');
    const result = toWebhookError(error);

    expect(result).toBeInstanceOf(WebhookError);
    expect(result.code).toBe('INTERNAL_ERROR');
  });

  it('should detect timeout in error message', () => {
    const error = new Error('Connection timeout');
    const result = toWebhookError(error);

    expect(result.code).toBe('TIMEOUT_ERROR');
  });

  it('should detect database error in message', () => {
    const error = new Error('database query failed');
    const result = toWebhookError(error);

    expect(result.code).toBe('DATABASE_ERROR');
  });
});

describe('Error Factory Functions', () => {
  describe('invalidPayloadError', () => {
    it('should create invalid payload error', () => {
      const error = invalidPayloadError('Missing field');

      expect(error.code).toBe('INVALID_PAYLOAD');
      expect(error.message).toBe('Missing field');
      expect(error.statusCode).toBe(400);
    });

    it('should use default message if not provided', () => {
      const error = invalidPayloadError();

      expect(error.message).toBe('Invalid webhook payload');
    });
  });

  describe('unknownEventTypeError', () => {
    it('should create unknown event error', () => {
      const error = unknownEventTypeError('weird-event');

      expect(error.code).toBe('UNKNOWN_EVENT_TYPE');
      expect(error.message).toContain('weird-event');
      expect(error.statusCode).toBe(400);
      expect(error.details?.eventType).toBe('weird-event');
    });
  });

  describe('handlerNotFoundError', () => {
    it('should create handler not found error', () => {
      const error = handlerNotFoundError('custom-event');

      expect(error.code).toBe('HANDLER_NOT_FOUND');
      expect(error.message).toContain('custom-event');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('tenantNotFoundError', () => {
    it('should create tenant not found error', () => {
      const error = tenantNotFoundError('+1234567890');

      expect(error.code).toBe('TENANT_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      // Phone number should be masked
      expect(error.details?.phoneNumber).not.toBe('+1234567890');
    });

    it('should work without phone number', () => {
      const error = tenantNotFoundError();

      expect(error.code).toBe('TENANT_NOT_FOUND');
      expect(error.details).toBeUndefined();
    });
  });

  describe('callNotFoundError', () => {
    it('should create call not found error', () => {
      const error = callNotFoundError('call-123');

      expect(error.code).toBe('CALL_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.details?.callId).toBe('call-123');
    });
  });

  describe('configNotFoundError', () => {
    it('should create config not found error', () => {
      const error = configNotFoundError('tenant-123');

      expect(error.code).toBe('CONFIG_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.details?.tenantId).toBe('tenant-123');
    });
  });

  describe('functionNotFoundError', () => {
    it('should create function not found error', () => {
      const error = functionNotFoundError('unknown_function');

      expect(error.code).toBe('FUNCTION_NOT_FOUND');
      expect(error.message).toContain('unknown_function');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('functionExecutionError', () => {
    it('should create function execution error', () => {
      const originalError = new Error('Original error');
      const error = functionExecutionError('my_function', originalError);

      expect(error.code).toBe('FUNCTION_EXECUTION_ERROR');
      expect(error.message).toContain('my_function');
      expect(error.statusCode).toBe(500);
      expect(error.details?.originalMessage).toBe('Original error');
    });

    it('should work without original error', () => {
      const error = functionExecutionError('my_function');

      expect(error.code).toBe('FUNCTION_EXECUTION_ERROR');
      expect(error.details?.originalMessage).toBeUndefined();
    });
  });

  describe('databaseError', () => {
    it('should create database error', () => {
      const originalError = new Error('Connection failed');
      const error = databaseError('insert', originalError);

      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.message).toContain('insert');
      expect(error.statusCode).toBe(503);
    });
  });

  describe('handlerError', () => {
    it('should create handler error', () => {
      const originalError = new Error('Handler crashed');
      const error = handlerError('transcript', originalError);

      expect(error.code).toBe('HANDLER_ERROR');
      expect(error.message).toContain('transcript');
      expect(error.statusCode).toBe(500);
    });
  });
});

describe('Helper Functions', () => {
  describe('createErrorResponse', () => {
    it('should create basic error response', () => {
      const response = createErrorResponse('INVALID_PAYLOAD', 'Invalid data');

      expect(response.error).toBe('Invalid data');
      expect(response.code).toBe('INVALID_PAYLOAD');
    });
  });

  describe('createFallbackAssistantResponse', () => {
    it('should return Spanish message by default', () => {
      const message = createFallbackAssistantResponse();

      expect(message).toContain('Disculpa');
      expect(message).toContain('problema técnico');
    });

    it('should return Spanish message for es locale', () => {
      const message = createFallbackAssistantResponse('es');

      expect(message).toContain('Disculpa');
    });

    it('should return English message for en locale', () => {
      const message = createFallbackAssistantResponse('en');

      expect(message).toContain('Sorry');
      expect(message).toContain('technical issue');
    });

    it('should fall back to Spanish for unknown locale', () => {
      const message = createFallbackAssistantResponse('fr');

      expect(message).toContain('Disculpa');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for database errors', () => {
      const error = new WebhookError('DATABASE_ERROR', 'DB error', 503);

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const error = new WebhookError('TIMEOUT_ERROR', 'Timeout', 504);

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for validation errors', () => {
      const error = new WebhookError('INVALID_PAYLOAD', 'Invalid', 400);

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for not found errors', () => {
      const error = new WebhookError('TENANT_NOT_FOUND', 'Not found', 404);

      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('getStatusText', () => {
    it('should return correct text for common status codes', () => {
      expect(getStatusText(400)).toBe('Bad Request');
      expect(getStatusText(401)).toBe('Unauthorized');
      expect(getStatusText(403)).toBe('Forbidden');
      expect(getStatusText(404)).toBe('Not Found');
      expect(getStatusText(500)).toBe('Internal Server Error');
      expect(getStatusText(503)).toBe('Service Unavailable');
      expect(getStatusText(504)).toBe('Gateway Timeout');
    });

    it('should return Unknown Error for unrecognized codes', () => {
      expect(getStatusText(418)).toBe('Unknown Error');
    });
  });
});

describe('WebhookError class', () => {
  it('should create error with all properties', () => {
    const error = new WebhookError(
      'INVALID_PAYLOAD',
      'Test message',
      400,
      { field: 'name' }
    );

    expect(error.code).toBe('INVALID_PAYLOAD');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ field: 'name' });
    expect(error.name).toBe('WebhookError');
  });

  it('should use default status code', () => {
    const error = new WebhookError('INTERNAL_ERROR', 'Error');

    expect(error.statusCode).toBe(500);
  });

  it('should convert to response', () => {
    const error = new WebhookError('INVALID_PAYLOAD', 'Invalid data', 400, {
      field: 'name',
    });

    const response = error.toResponse();

    expect(response.error).toBe('Invalid data');
    expect(response.code).toBe('INVALID_PAYLOAD');
  });
});
