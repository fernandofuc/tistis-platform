/**
 * Tests for Structured Logger
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import {
  StructuredLogger,
  createLogger,
  getLogger,
  generateCorrelationId,
  getCorrelationId,
  createRequestContext,
  type LogLevel,
} from '../../../src/shared/lib/structured-logger';

describe('StructuredLogger', () => {
  let consoleSpy: {
    debug: MockInstance;
    info: MockInstance;
    warn: MockInstance;
    error: MockInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should output debug logs when minLevel is debug', () => {
      const logger = createLogger({ minLevel: 'debug', prettyPrint: false });
      logger.debug('test message');

      expect(consoleSpy.debug).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.debug.mock.calls[0][0]);
      expect(logOutput.level).toBe('debug');
      expect(logOutput.message).toBe('test message');
    });

    it('should not output debug logs when minLevel is info', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.debug('test message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it('should output info logs', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.info('info message');

      expect(consoleSpy.info).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.level).toBe('info');
    });

    it('should output warn logs', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.warn('warning message');

      expect(consoleSpy.warn).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.warn.mock.calls[0][0]);
      expect(logOutput.level).toBe('warn');
    });

    it('should output error logs', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.error('error message');

      expect(consoleSpy.error).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logOutput.level).toBe('error');
    });
  });

  describe('context handling', () => {
    it('should include context in log output', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.info('test', { userId: 'user123', tenantId: 'tenant456' });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.context.userId).toBe('user123');
      expect(logOutput.context.tenantId).toBe('tenant456');
    });

    it('should include default context in all logs', () => {
      const logger = createLogger(
        { minLevel: 'info', prettyPrint: false },
        { component: 'test-component' }
      );
      logger.info('test message');

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.context.component).toBe('test-component');
    });

    it('should merge default context with log context', () => {
      const logger = createLogger(
        { minLevel: 'info', prettyPrint: false },
        { component: 'test-component' }
      );
      logger.info('test', { action: 'test-action' });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.context.component).toBe('test-component');
      expect(logOutput.context.action).toBe('test-action');
    });
  });

  describe('sensitive field redaction', () => {
    it('should redact password fields', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.info('test', { password: 'secret123' });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.context.password).toBe('[REDACTED]');
    });

    it('should redact token fields', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.info('test', { accessToken: 'abc123', apiKey: 'key456' });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.context.accessToken).toBe('[REDACTED]');
      expect(logOutput.context.apiKey).toBe('[REDACTED]');
    });

    it('should redact nested sensitive fields', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.info('test', {
        user: {
          name: 'John',
          password: 'secret',
        },
      });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.context.user.name).toBe('John');
      expect(logOutput.context.user.password).toBe('[REDACTED]');
    });
  });

  describe('error handling', () => {
    it('should format Error objects correctly', () => {
      const logger = createLogger({
        minLevel: 'info',
        prettyPrint: false,
        includeStackTraces: true,
      });
      const testError = new Error('test error');
      logger.error('error occurred', {}, testError);

      const logOutput = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logOutput.error.name).toBe('Error');
      expect(logOutput.error.message).toBe('test error');
      expect(logOutput.error.stack).toBeDefined();
    });

    it('should handle non-Error objects', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.error('error occurred', {}, 'string error');

      const logOutput = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logOutput.error.name).toBe('UnknownError');
      expect(logOutput.error.message).toBe('string error');
    });
  });

  describe('specialized logging methods', () => {
    it('should log requests correctly', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.request('GET', '/api/test', { userId: 'user123' });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.message).toBe('API Request');
      expect(logOutput.context.method).toBe('GET');
      expect(logOutput.context.path).toBe('/api/test');
      expect(logOutput.context.action).toBe('request');
    });

    it('should log responses with correct level based on status', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });

      // Success
      logger.response('GET', '/api/test', 200, 50);
      expect(consoleSpy.info).toHaveBeenCalled();

      // Client error
      logger.response('GET', '/api/test', 400, 50);
      expect(consoleSpy.warn).toHaveBeenCalled();

      // Server error
      logger.response('GET', '/api/test', 500, 50);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should log security events', () => {
      const logger = createLogger({ minLevel: 'info', prettyPrint: false });
      logger.security('failed_login', { userId: 'user123' });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.message).toBe('Security: failed_login');
      expect(logOutput.context.component).toBe('security');
    });
  });

  describe('child logger', () => {
    it('should create child logger with merged context', () => {
      const parentLogger = createLogger(
        { minLevel: 'info', prettyPrint: false },
        { component: 'parent' }
      );
      const childLogger = parentLogger.child({ requestId: 'req123' });

      childLogger.info('child log');

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.context.component).toBe('parent');
      expect(logOutput.context.requestId).toBe('req123');
    });
  });
});

describe('Correlation ID utilities', () => {
  describe('generateCorrelationId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).not.toBe(id2);
    });

    it('should generate IDs in expected format', () => {
      const id = generateCorrelationId();

      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('getCorrelationId', () => {
    it('should extract x-correlation-id header', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'x-correlation-id') return 'test-correlation-id';
            return null;
          },
        },
      } as unknown as Request;

      expect(getCorrelationId(mockRequest)).toBe('test-correlation-id');
    });

    it('should extract x-request-id header as fallback', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'x-request-id') return 'test-request-id';
            return null;
          },
        },
      } as unknown as Request;

      expect(getCorrelationId(mockRequest)).toBe('test-request-id');
    });

    it('should generate new ID if no header present', () => {
      const mockRequest = {
        headers: {
          get: () => null,
        },
      } as unknown as Request;

      const id = getCorrelationId(mockRequest);
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('createRequestContext', () => {
    it('should create context from request', () => {
      const mockRequest = {
        url: 'https://example.com/api/test?foo=bar',
        method: 'POST',
        headers: {
          get: (name: string) => {
            if (name === 'x-correlation-id') return 'corr-123';
            if (name === 'user-agent') return 'test-agent';
            if (name === 'x-forwarded-for') return '192.168.1.1';
            return null;
          },
        },
      } as unknown as Request;

      const context = createRequestContext(mockRequest);

      expect(context.correlationId).toBe('corr-123');
      expect(context.method).toBe('POST');
      expect(context.path).toBe('/api/test');
      expect(context.userAgent).toBe('test-agent');
      expect(context.ip).toBe('192.168.1.1');
    });
  });
});

describe('getLogger (singleton)', () => {
  it('should return same instance on multiple calls', () => {
    const logger1 = getLogger();
    const logger2 = getLogger();

    expect(logger1).toBe(logger2);
  });
});
