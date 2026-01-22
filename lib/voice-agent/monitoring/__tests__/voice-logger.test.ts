/**
 * TIS TIS Platform - Voice Agent v2.0
 * Voice Logger Tests
 *
 * Tests for the structured logging system:
 * - Log level filtering
 * - Call lifecycle logging
 * - Error logging
 * - Circuit breaker logging
 * - Sensitive data redaction
 * - Child logger context
 */

import {
  VoiceLogger,
  ChildLogger,
  getVoiceLogger,
  logDebug,
  logInfo,
  logWarn,
  logError,
  logCallStart,
  logCallEnd,
  logVoiceError,
  logCircuitBreakerChange,
  logRAGOperation,
  logToolExecution,
  logLatency,
  createCallLogger,
  startTimer,
} from '../voice-logger';
import type { LogEntry, LogLevel } from '../types';

// =====================================================
// TEST SETUP
// =====================================================

describe('Voice Logger System', () => {
  let capturedLogs: LogEntry[] = [];
  let logger: VoiceLogger;

  beforeEach(() => {
    capturedLogs = [];
    VoiceLogger.resetInstance();

    // Create logger with custom handler to capture logs
    logger = new VoiceLogger({
      enabled: true,
      minLevel: 'debug',
      includeStackTrace: true,
      consoleOutput: false, // Disable console for tests
      customHandler: (entry) => {
        capturedLogs.push(entry);
      },
    });
  });

  // =====================================================
  // BASIC LOGGING TESTS
  // =====================================================

  describe('Basic Logging', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('debug');
      expect(capturedLogs[0].message).toBe('Debug message');
    });

    it('should log info messages', () => {
      logger.info('Info message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('info');
      expect(capturedLogs[0].message).toBe('Info message');
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('warn');
      expect(capturedLogs[0].message).toBe('Warning message');
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error message', error);

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('error');
      expect(capturedLogs[0].message).toBe('Error message');
      expect(capturedLogs[0].error).toBeDefined();
      expect(capturedLogs[0].error?.message).toBe('Test error');
    });

    it('should include timestamp in all logs', () => {
      logger.info('Test message');

      expect(capturedLogs[0].timestamp).toBeDefined();
      expect(new Date(capturedLogs[0].timestamp).getTime()).not.toBeNaN();
    });

    it('should include service name in all logs', () => {
      logger.info('Test message');

      expect(capturedLogs[0].service).toBe('voice-agent-v2');
    });
  });

  // =====================================================
  // LOG LEVEL FILTERING TESTS
  // =====================================================

  describe('Log Level Filtering', () => {
    it('should filter logs below minimum level', () => {
      const filteredLogger = new VoiceLogger({
        enabled: true,
        minLevel: 'warn',
        consoleOutput: false,
        customHandler: (entry) => capturedLogs.push(entry),
      });

      filteredLogger.debug('Debug - should not appear');
      filteredLogger.info('Info - should not appear');
      filteredLogger.warn('Warning - should appear');
      filteredLogger.error('Error - should appear', null);

      expect(capturedLogs).toHaveLength(2);
      expect(capturedLogs[0].level).toBe('warn');
      expect(capturedLogs[1].level).toBe('error');
    });

    it('should not log when disabled', () => {
      const disabledLogger = new VoiceLogger({
        enabled: false,
        consoleOutput: false,
        customHandler: (entry) => capturedLogs.push(entry),
      });

      disabledLogger.info('Should not appear');

      expect(capturedLogs).toHaveLength(0);
    });
  });

  // =====================================================
  // CALL LIFECYCLE TESTS
  // =====================================================

  describe('Call Lifecycle Logging', () => {
    it('should log call start', () => {
      logger.logCallStart({
        callId: 'call-123',
        tenantId: 'tenant-456',
        assistantType: 'restaurant',
        apiVersion: 'v2',
        callerNumber: '+1234567890',
        direction: 'inbound',
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toBe('Voice call started');
      expect(capturedLogs[0].callId).toBe('call-123');
      expect(capturedLogs[0].tenantId).toBe('tenant-456');
      expect(capturedLogs[0].data?.direction).toBe('inbound');
    });

    it('should log call end with outcome', () => {
      logger.logCallEnd({
        callId: 'call-123',
        tenantId: 'tenant-456',
        durationSeconds: 120,
        outcome: 'completed',
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toContain('Voice call ended');
      expect(capturedLogs[0].message).toContain('completed');
      expect(capturedLogs[0].durationMs).toBe(120000);
    });

    it('should log failed calls as warnings', () => {
      logger.logCallEnd({
        callId: 'call-123',
        tenantId: 'tenant-456',
        durationSeconds: 30,
        outcome: 'failed',
        failureReason: 'Network timeout',
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('warn');
      expect(capturedLogs[0].data?.failureReason).toBe('Network timeout');
    });

    it('should log transferred calls', () => {
      logger.logCallEnd({
        callId: 'call-123',
        tenantId: 'tenant-456',
        durationSeconds: 60,
        outcome: 'transferred',
        transferReason: 'Customer requested human agent',
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].data?.transferReason).toBe('Customer requested human agent');
    });
  });

  // =====================================================
  // ERROR LOGGING TESTS
  // =====================================================

  describe('Error Logging', () => {
    it('should log voice errors with context', () => {
      const error = new Error('Connection failed');

      logger.logVoiceError({
        callId: 'call-123',
        tenantId: 'tenant-456',
        errorType: 'network',
        errorCode: 'ERR_CONN',
        operation: 'webhook_call',
        retryCount: 2,
        error,
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('error');
      expect(capturedLogs[0].error?.message).toBe('Connection failed');
      expect(capturedLogs[0].data?.errorType).toBe('network');
      expect(capturedLogs[0].data?.retryCount).toBe(2);
    });

    it('should log webhook errors', () => {
      const error = new Error('HTTP 500');

      logger.logWebhookError({
        callId: 'call-123',
        tenantId: 'tenant-456',
        webhookType: 'vapi_callback',
        httpStatus: 500,
        responseBody: 'Internal Server Error',
        error,
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('error');
      expect(capturedLogs[0].data?.webhookType).toBe('vapi_callback');
      expect(capturedLogs[0].data?.httpStatus).toBe(500);
    });

    it('should include stack traces when configured', () => {
      const error = new Error('Test error');
      logger.error('Error with stack', error);

      expect(capturedLogs[0].error?.stack).toBeDefined();
    });
  });

  // =====================================================
  // CIRCUIT BREAKER TESTS
  // =====================================================

  describe('Circuit Breaker Logging', () => {
    it('should log circuit breaker state changes', () => {
      logger.logCircuitBreakerChange({
        tenantId: 'business-123',
        previousState: 'CLOSED',
        newState: 'OPEN',
        failureCount: 5,
        reason: 'Consecutive failures',
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('warn');
      expect(capturedLogs[0].message).toContain('CLOSED');
      expect(capturedLogs[0].message).toContain('OPEN');
    });

    it('should log circuit breaker trip', () => {
      logger.logCircuitBreakerTrip('business-123', 'High error rate', 10);

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('warn');
      expect(capturedLogs[0].data?.state).toBe('OPEN');
    });

    it('should log circuit breaker recovery', () => {
      logger.logCircuitBreakerRecovery('business-123', 5);

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('info');
      expect(capturedLogs[0].data?.state).toBe('CLOSED');
    });
  });

  // =====================================================
  // RAG AND TOOL TESTS
  // =====================================================

  describe('RAG and Tool Logging', () => {
    it('should log RAG operations', () => {
      logger.logRAGOperation({
        callId: 'call-123',
        tenantId: 'tenant-456',
        operation: 'query',
        collection: 'menu_items',
        documentCount: 5,
        durationMs: 150,
        relevanceScore: 0.85,
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].data?.operation).toBe('query');
      expect(capturedLogs[0].data?.relevanceScore).toBe(0.85);
    });

    it('should warn on slow RAG operations', () => {
      logger.logRAGOperation({
        callId: 'call-123',
        operation: 'query',
        durationMs: 1500, // > 1000ms threshold
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('warn');
    });

    it('should log tool execution', () => {
      logger.logToolExecution({
        callId: 'call-123',
        tenantId: 'tenant-456',
        toolName: 'create_reservation',
        toolType: 'action',
        result: 'success',
        durationMs: 200,
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toContain('create_reservation');
      expect(capturedLogs[0].data?.result).toBe('success');
    });

    it('should warn on failed tool execution', () => {
      logger.logToolExecution({
        callId: 'call-123',
        toolName: 'create_reservation',
        result: 'failure',
      });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('warn');
    });
  });

  // =====================================================
  // LATENCY TESTS
  // =====================================================

  describe('Latency Logging', () => {
    it('should log latency measurements', () => {
      logger.logLatency('database_query', 50, { callId: 'call-123' });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].durationMs).toBe(50);
      expect(capturedLogs[0].message).toContain('database_query');
    });

    it('should warn on high latency', () => {
      logger.logLatency('api_call', 1500, { threshold: 1000 });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('warn');
      expect(capturedLogs[0].data?.exceededThreshold).toBe(true);
    });

    it('should use timer for duration measurement', async () => {
      const stopTimer = logger.startTimer('test_operation');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = stopTimer();

      expect(duration).toBeGreaterThanOrEqual(10);
    });
  });

  // =====================================================
  // SENSITIVE DATA TESTS
  // =====================================================

  describe('Sensitive Data Redaction', () => {
    it('should redact API keys', () => {
      logger.info('Config loaded', {
        data: {
          apiKey: 'sk-secret-key-12345',
          setting: 'value',
        },
      });

      expect(capturedLogs[0].data?.apiKey).toBe('[REDACTED]');
      expect(capturedLogs[0].data?.setting).toBe('value');
    });

    it('should redact passwords', () => {
      logger.info('User config', {
        data: {
          password: 'super-secret-password',
          username: 'testuser',
        },
      });

      expect(capturedLogs[0].data?.password).toBe('[REDACTED]');
      expect(capturedLogs[0].data?.username).toBe('testuser');
    });

    it('should redact tokens', () => {
      logger.info('Auth info', {
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          userId: 'user-123',
        },
      });

      expect(capturedLogs[0].data?.token).toBe('[REDACTED]');
    });

    it('should mask phone numbers in data', () => {
      // Phone masking happens via maskPhoneNumber for callerNumber
      logger.logCallStart({
        callId: 'call-123',
        callerNumber: '+15551234567',
      });

      expect(capturedLogs[0].data?.callerNumber).toContain('***');
    });

    it('should not redact non-sensitive data', () => {
      logger.info('Regular data', {
        data: {
          businessName: 'Test Restaurant',
          location: 'Mexico City',
          openTime: '09:00',
        },
      });

      expect(capturedLogs[0].data?.businessName).toBe('Test Restaurant');
      expect(capturedLogs[0].data?.location).toBe('Mexico City');
      expect(capturedLogs[0].data?.openTime).toBe('09:00');
    });
  });

  // =====================================================
  // CHILD LOGGER TESTS
  // =====================================================

  describe('Child Logger', () => {
    it('should create child logger with default context', () => {
      const childLogger = logger.child({
        callId: 'call-123',
        tenantId: 'tenant-456',
        apiVersion: 'v2',
      });

      childLogger.info('Child log message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].callId).toBe('call-123');
      expect(capturedLogs[0].tenantId).toBe('tenant-456');
    });

    it('should allow overriding default context', () => {
      const childLogger = logger.child({
        callId: 'call-123',
      });

      childLogger.info('Message with override', {
        callId: 'call-different',
        data: { extra: 'data' },
      });

      // Override should take precedence
      expect(capturedLogs[0].callId).toBe('call-different');
      expect(capturedLogs[0].data?.extra).toBe('data');
    });

    it('should support all log levels', () => {
      const childLogger = logger.child({ callId: 'call-123' });

      childLogger.debug('Debug');
      childLogger.info('Info');
      childLogger.warn('Warn');
      childLogger.error('Error', new Error('Test'));

      expect(capturedLogs).toHaveLength(4);
      expect(capturedLogs.map((l) => l.level)).toEqual(['debug', 'info', 'warn', 'error']);
    });
  });

  // =====================================================
  // SINGLETON TESTS
  // =====================================================

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getVoiceLogger();
      const instance2 = getVoiceLogger();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance correctly', () => {
      const instance1 = VoiceLogger.getInstance();
      VoiceLogger.resetInstance();
      const instance2 = VoiceLogger.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  // =====================================================
  // CONVENIENCE FUNCTION TESTS
  // =====================================================

  describe('Convenience Functions', () => {
    beforeEach(() => {
      // Configure singleton for convenience function tests
      VoiceLogger.resetInstance();
      VoiceLogger.getInstance({
        enabled: true,
        minLevel: 'debug',
        consoleOutput: false,
        customHandler: (entry) => capturedLogs.push(entry),
      });
    });

    it('should work with logInfo convenience function', () => {
      logInfo('Convenience info');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('info');
    });

    it('should work with logCallStart convenience function', () => {
      logCallStart({ callId: 'call-123' });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toBe('Voice call started');
    });

    it('should work with createCallLogger convenience function', () => {
      const callLogger = createCallLogger({
        callId: 'call-123',
        tenantId: 'tenant-456',
      });

      callLogger.info('Test message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].callId).toBe('call-123');
    });
  });
});
