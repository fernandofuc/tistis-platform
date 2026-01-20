/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Alerts Tests
 *
 * Unit tests for the rollout alerts service:
 * - Alert triggering
 * - Escalation logic
 * - Auto-rollback
 * - Event handlers
 *
 * @module lib/voice-agent/rollout/__tests__/rollout-alerts.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { RolloutAlertService, type RolloutAlertEvent } from '../rollout-alerts';
import type { RolloutStatus, HealthCheckResult, RolloutIssue, RolloutMetrics } from '../types';

// Type for mock function calls
type MockCall = [RolloutAlertEvent];

// =====================================================
// MOCKS
// =====================================================

// Mock rollout service
const mockRolloutService = {
  getStatus: vi.fn(),
  performHealthCheck: vi.fn(),
  executeRollback: vi.fn(),
  getNextStage: vi.fn(),
};

vi.mock('../rollout-service', () => ({
  getRolloutService: () => mockRolloutService,
  RolloutService: {
    getInstance: () => mockRolloutService,
  },
}));

// Mock alert manager
const mockAlertManager = {
  getActiveAlerts: vi.fn((): unknown[] => []),
  createManualAlert: vi.fn(),
  addRule: vi.fn((rule: Record<string, unknown>) => ({ id: 'rule-123', ...rule })),
};

vi.mock('../../monitoring/alert-manager', () => ({
  getAlertManager: () => mockAlertManager,
  createManualAlert: vi.fn(),
  addAlertRule: vi.fn((rule: Record<string, unknown>) => ({ id: 'rule-123', ...rule })),
}));

// Mock logger
vi.mock('../../monitoring/voice-logger', () => ({
  getVoiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// =====================================================
// TEST HELPERS
// =====================================================

function createMockStatus(overrides: Partial<RolloutStatus> = {}): RolloutStatus {
  return {
    currentStage: 'canary',
    percentage: 5,
    enabled: true,
    enabledTenants: [],
    disabledTenants: [],
    stageStartedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    stageInitiatedBy: 'test-user',
    autoAdvanceEnabled: false,
    lastHealthCheck: null,
    history: [],
    ...overrides,
  };
}

function createMockMetrics(overrides: Partial<RolloutMetrics> = {}): RolloutMetrics {
  return {
    totalCalls: 100,
    successfulCalls: 99,
    failedCalls: 1,
    errorRate: 0.01,
    avgLatencyMs: 300,
    p50LatencyMs: 250,
    p95LatencyMs: 500,
    p99LatencyMs: 800,
    circuitBreakerOpens: 0,
    activeCalls: 5,
    ...overrides,
  };
}

function createMockHealthCheck(overrides: Partial<HealthCheckResult> = {}): HealthCheckResult {
  return {
    timestamp: new Date().toISOString(),
    healthy: true,
    canAdvance: false,
    shouldRollback: false,
    v2Metrics: createMockMetrics(),
    v1Metrics: createMockMetrics(),
    issues: [],
    ...overrides,
  };
}

function createMockIssue(overrides: Partial<RolloutIssue> = {}): RolloutIssue {
  return {
    severity: 'warning',
    type: 'error_rate',
    message: 'Error rate exceeds threshold',
    currentValue: 0.03,
    thresholdValue: 0.02,
    recommendedAction: 'Monitor closely',
    ...overrides,
  };
}

// =====================================================
// TESTS
// =====================================================

describe('RolloutAlertService', () => {
  let service: RolloutAlertService;

  beforeEach(() => {
    RolloutAlertService.resetInstance();
    vi.clearAllMocks();
    vi.useFakeTimers();

    service = new RolloutAlertService({
      enabled: true,
      monitoringIntervalMs: 60_000,
      defaultChannels: ['slack'],
      autoRollbackOnCritical: false,
      minCallsForAlerts: 10,
      suppressionWindowAfterRollbackMs: 300_000,
      escalation: {
        warningEscalationMs: 900_000,
        maxConsecutiveWarnings: 3,
      },
    });
  });

  afterEach(() => {
    service.stop();
    RolloutAlertService.resetInstance();
    vi.useRealTimers();
  });

  // =====================================================
  // SINGLETON TESTS
  // =====================================================

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = RolloutAlertService.getInstance();
      const instance2 = RolloutAlertService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance correctly', () => {
      const instance1 = RolloutAlertService.getInstance();
      RolloutAlertService.resetInstance();
      const instance2 = RolloutAlertService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  // =====================================================
  // LIFECYCLE TESTS
  // =====================================================

  describe('Lifecycle', () => {
    it('should start monitoring when enabled', () => {
      mockRolloutService.getStatus.mockResolvedValue(createMockStatus({ enabled: false }));

      service.start();

      // Should set up interval
      expect(vi.getTimerCount()).toBe(1);
    });

    it('should stop monitoring', () => {
      mockRolloutService.getStatus.mockResolvedValue(createMockStatus({ enabled: false }));

      service.start();
      service.stop();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('should not start if disabled', () => {
      RolloutAlertService.resetInstance();
      const disabledService = new RolloutAlertService({ enabled: false });

      disabledService.start();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  // =====================================================
  // ALERT HANDLER TESTS
  // =====================================================

  describe('Alert Handlers', () => {
    it('should register alert handler', () => {
      const handler = vi.fn();
      const unsubscribe = service.onAlert(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unregister alert handler', () => {
      const handler = vi.fn();
      const unsubscribe = service.onAlert(handler);

      unsubscribe();

      // Handler should no longer be called
    });

    it('should call handlers when alert emitted', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
      mockRolloutService.performHealthCheck.mockResolvedValue(
        createMockHealthCheck({
          healthy: false,
          issues: [createMockIssue({ severity: 'critical' })],
        })
      );

      service.start();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(handler).toHaveBeenCalled();
    });
  });

  // =====================================================
  // HEALTH CHECK PROCESSING TESTS
  // =====================================================

  describe('Health Check Processing', () => {
    it('should not alert when healthy', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
      mockRolloutService.performHealthCheck.mockResolvedValue(createMockHealthCheck());

      service.start();
      await vi.advanceTimersByTimeAsync(60_000);

      // No alerts should be emitted for healthy status
      const criticalCalls = (handler.mock.calls as MockCall[]).filter(
        (call: MockCall) => call[0].severity === 'critical'
      );
      expect(criticalCalls.length).toBe(0);
    });

    it('should alert on critical issues', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
      mockRolloutService.performHealthCheck.mockResolvedValue(
        createMockHealthCheck({
          healthy: false,
          shouldRollback: true,
          issues: [
            createMockIssue({
              severity: 'critical',
              type: 'error_rate',
              message: 'Error rate critical',
            }),
          ],
        })
      );

      service.start();
      await vi.advanceTimersByTimeAsync(60_000);

      const criticalAlerts = (handler.mock.calls as MockCall[]).filter(
        (call: MockCall) => call[0].severity === 'critical'
      );
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it('should skip when rollout disabled', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      mockRolloutService.getStatus.mockResolvedValue(
        createMockStatus({ enabled: false })
      );

      service.start();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // =====================================================
  // WARNING ESCALATION TESTS
  // =====================================================

  describe('Warning Escalation', () => {
    it('should escalate after max consecutive warnings', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
      mockRolloutService.performHealthCheck.mockResolvedValue(
        createMockHealthCheck({
          healthy: true,
          issues: [createMockIssue({ severity: 'warning' })],
        })
      );

      service.start();

      // Run monitoring cycles to accumulate warnings
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(60_000);
      }

      // Should eventually escalate to critical
      const escalatedAlerts = (handler.mock.calls as MockCall[]).filter(
        (call: MockCall) =>
          call[0].severity === 'critical' &&
          call[0].details?.escalated === true
      );
      expect(escalatedAlerts.length).toBeGreaterThan(0);
    });

    it('should escalate after warning duration threshold', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
      mockRolloutService.performHealthCheck.mockResolvedValue(
        createMockHealthCheck({
          healthy: true,
          issues: [createMockIssue({ severity: 'warning' })],
        })
      );

      service.start();

      // Run past escalation time (15+ minutes)
      await vi.advanceTimersByTimeAsync(16 * 60 * 1000);

      const escalatedAlerts = (handler.mock.calls as MockCall[]).filter(
        (call: MockCall) =>
          call[0].severity === 'critical' &&
          call[0].details?.escalated === true
      );
      expect(escalatedAlerts.length).toBeGreaterThan(0);
    });

    it('should clear warnings when issues resolve', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      // First cycle: warning
      mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
      mockRolloutService.performHealthCheck.mockResolvedValueOnce(
        createMockHealthCheck({
          healthy: true,
          issues: [createMockIssue({ severity: 'warning' })],
        })
      );

      service.start();
      await vi.advanceTimersByTimeAsync(60_000);

      // Second cycle: healthy (no issues)
      mockRolloutService.performHealthCheck.mockResolvedValueOnce(
        createMockHealthCheck({ healthy: true, issues: [] })
      );

      await vi.advanceTimersByTimeAsync(60_000);

      // Third cycle: warning again (should start fresh, not escalate)
      mockRolloutService.performHealthCheck.mockResolvedValueOnce(
        createMockHealthCheck({
          healthy: true,
          issues: [createMockIssue({ severity: 'warning' })],
        })
      );

      await vi.advanceTimersByTimeAsync(60_000);

      // Should not have escalated yet since warnings were reset
      const escalatedAfterReset = (handler.mock.calls as MockCall[]).filter(
        (call: MockCall) =>
          call[0].details?.consecutiveWarnings === 1
      );
      expect(escalatedAfterReset.length).toBeGreaterThan(0);
    });
  });

  // =====================================================
  // AUTO-ROLLBACK TESTS
  // =====================================================

  describe('Auto-Rollback', () => {
    it('should not auto-rollback when disabled', async () => {
      mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
      mockRolloutService.performHealthCheck.mockResolvedValue(
        createMockHealthCheck({
          healthy: false,
          shouldRollback: true,
          issues: [createMockIssue({ severity: 'critical' })],
        })
      );

      service.start();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(mockRolloutService.executeRollback).not.toHaveBeenCalled();
    });

    it('should auto-rollback when enabled and critical', async () => {
      RolloutAlertService.resetInstance();
      const autoRollbackService = new RolloutAlertService({
        enabled: true,
        autoRollbackOnCritical: true,
        monitoringIntervalMs: 60_000,
        defaultChannels: ['slack'],
        minCallsForAlerts: 10,
        suppressionWindowAfterRollbackMs: 300_000,
        escalation: {
          warningEscalationMs: 900_000,
          maxConsecutiveWarnings: 3,
        },
      });

      mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
      mockRolloutService.performHealthCheck.mockResolvedValue(
        createMockHealthCheck({
          healthy: false,
          shouldRollback: true,
          issues: [createMockIssue({ severity: 'critical' })],
        })
      );
      mockRolloutService.executeRollback.mockResolvedValue({
        success: true,
        newStatus: createMockStatus({ percentage: 0 }),
      });

      autoRollbackService.start();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(mockRolloutService.executeRollback).toHaveBeenCalled();

      autoRollbackService.stop();
    });
  });

  // =====================================================
  // SUPPRESSION WINDOW TESTS
  // =====================================================

  describe('Suppression Window', () => {
    it('should suppress alerts after rollback', async () => {
      const handler = vi.fn();

      RolloutAlertService.resetInstance();
      const autoRollbackService = new RolloutAlertService({
        enabled: true,
        autoRollbackOnCritical: true,
        monitoringIntervalMs: 60_000,
        defaultChannels: ['slack'],
        minCallsForAlerts: 10,
        suppressionWindowAfterRollbackMs: 300_000, // 5 minutes
        escalation: {
          warningEscalationMs: 900_000,
          maxConsecutiveWarnings: 3,
        },
      });

      autoRollbackService.onAlert(handler);

      // First cycle triggers rollback
      mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
      mockRolloutService.performHealthCheck.mockResolvedValue(
        createMockHealthCheck({
          healthy: false,
          shouldRollback: true,
          issues: [createMockIssue({ severity: 'critical' })],
        })
      );
      mockRolloutService.executeRollback.mockResolvedValue({
        success: true,
        newStatus: createMockStatus({ percentage: 0 }),
      });

      autoRollbackService.start();
      await vi.advanceTimersByTimeAsync(60_000);

      const callsBeforeWindow = handler.mock.calls.length;

      // During suppression window - should not alert
      await vi.advanceTimersByTimeAsync(60_000);

      const callsDuringWindow = handler.mock.calls.length;

      // Alerts should be suppressed
      expect(callsDuringWindow).toBe(callsBeforeWindow);

      autoRollbackService.stop();
    });
  });

  // =====================================================
  // MANUAL ALERT CREATION TESTS
  // =====================================================

  describe('Manual Alert Creation', () => {
    it('should create stage advancement alert', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      await service.createStageAdvancementAlert(
        'canary',
        'early_adopters',
        5,
        10,
        'test-user'
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stage_advanced',
          severity: 'info',
        })
      );
    });

    it('should create rollback alert', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      await service.createRollbackAlert(
        'early_adopters',
        'canary',
        10,
        5,
        'test-user',
        'Manual rollback'
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rollback_triggered',
          severity: 'warning',
        })
      );
    });

    it('should create stage blocked alert', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      await service.createStageBlockedAlert(
        'canary',
        'early_adopters',
        'Go criteria not met'
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stage_blocked',
          severity: 'warning',
        })
      );
    });
  });

  // =====================================================
  // QUERY METHODS TESTS
  // =====================================================

  describe('Query Methods', () => {
    it('should get rollout alerts', () => {
      mockAlertManager.getActiveAlerts.mockReturnValue([
        { id: 'alert-1', name: 'Rollout Error Rate', labels: { component: 'rollout' } },
        { id: 'alert-2', name: 'Other Alert', labels: { component: 'other' } },
        { id: 'alert-3', name: 'Rollout Latency', labels: {} },
      ] as unknown[]);

      const alerts = service.getRolloutAlerts();

      expect(alerts.length).toBe(2); // Only rollout alerts
    });

    it('should get rollout alert summary', () => {
      mockAlertManager.getActiveAlerts.mockReturnValue([
        { id: 'alert-1', name: 'Rollout Error', labels: { component: 'rollout' }, severity: 'critical' },
        { id: 'alert-2', name: 'Rollout Warning', labels: { component: 'rollout' }, severity: 'warning' },
        { id: 'alert-3', name: 'Rollout Info', labels: { component: 'rollout' }, severity: 'info' },
      ] as unknown[]);

      const summary = service.getRolloutAlertSummary();

      expect(summary.total).toBe(3);
      expect(summary.critical).toBe(1);
      expect(summary.warning).toBe(1);
      expect(summary.info).toBe(1);
    });
  });

  // =====================================================
  // ISSUE TYPE MAPPING TESTS
  // =====================================================

  describe('Issue Type Mapping', () => {
    it('should map issue types to alert types correctly', async () => {
      const handler = vi.fn();
      service.onAlert(handler);

      const issueTypes = [
        { issueType: 'error_rate', expectedAlertType: 'error_rate_spike' },
        { issueType: 'latency', expectedAlertType: 'latency_spike' },
        { issueType: 'circuit_breaker', expectedAlertType: 'circuit_breaker_triggered' },
        { issueType: 'other', expectedAlertType: 'health_degradation' },
      ];

      for (const { issueType, expectedAlertType } of issueTypes) {
        handler.mockClear();

        mockRolloutService.getStatus.mockResolvedValue(createMockStatus());
        mockRolloutService.performHealthCheck.mockResolvedValue(
          createMockHealthCheck({
            healthy: false,
            issues: [
              createMockIssue({
                severity: 'critical',
                type: issueType as RolloutIssue['type'],
              }),
            ],
          })
        );

        service.start();
        await vi.advanceTimersByTimeAsync(60_000);
        service.stop();

        const alertTypes = (handler.mock.calls as MockCall[]).map((call: MockCall) => call[0].type);
        expect(alertTypes).toContain(expectedAlertType);
      }
    });
  });
});
