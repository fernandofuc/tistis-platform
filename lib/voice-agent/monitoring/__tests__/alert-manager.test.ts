/**
 * TIS TIS Platform - Voice Agent v2.0
 * Alert Manager Tests
 *
 * Tests for the alerting system:
 * - Alert rule management
 * - Alert lifecycle (firing, acknowledgement, resolution)
 * - Condition evaluation
 * - Deduplication
 * - Manual alerts
 */

import {
  AlertManager,
  getAlertManager,
  startAlertManager,
  stopAlertManager,
  getActiveAlerts,
  getAlertSummary,
  acknowledgeAlert,
  resolveAlert,
  createManualAlert,
  addAlertRule,
  getAlertRules,
} from '../alert-manager';
import {
  MetricsRegistry,
  recordVoiceCall,
  recordVoiceError,
  recordLatency,
  setCircuitBreakerState,
  resetMetrics,
} from '../voice-metrics';
import type { AlertRule, AlertSeverity, Alert } from '../types';
import { DEFAULT_ALERT_RULES, VOICE_METRIC_NAMES } from '../types';

// =====================================================
// TEST SETUP
// =====================================================

describe('Alert Manager System', () => {
  let alertManager: AlertManager;

  beforeEach(() => {
    // Reset singletons
    AlertManager.resetInstance();
    MetricsRegistry.resetInstance();
    resetMetrics();

    // Create new alert manager with short intervals for testing
    alertManager = new AlertManager({
      enabled: true,
      evaluationIntervalMs: 100,
      repeatIntervalMs: 1000,
      deduplicationWindowMs: 500,
      maxActiveAlerts: 10,
    });
  });

  afterEach(() => {
    alertManager.stop();
  });

  // =====================================================
  // RULE MANAGEMENT TESTS
  // =====================================================

  describe('Rule Management', () => {
    it('should initialize with default rules', () => {
      const rules = alertManager.getRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some((r) => r.name === 'High Error Rate')).toBe(true);
      expect(rules.some((r) => r.name === 'High Latency')).toBe(true);
      expect(rules.some((r) => r.name === 'Circuit Breaker Open')).toBe(true);
    });

    it('should add custom rules', () => {
      const customRule = alertManager.addRule({
        name: 'Custom Alert',
        description: 'Test alert',
        severity: 'warning',
        condition: {
          metric: VOICE_METRIC_NAMES.CALLS_TOTAL,
          operator: 'gt',
          threshold: 100,
        },
        enabled: true,
        notificationChannels: ['slack'],
      });

      expect(customRule.id).toBeDefined();
      expect(customRule.name).toBe('Custom Alert');

      const rules = alertManager.getRules();
      expect(rules.some((r) => r.id === customRule.id)).toBe(true);
    });

    it('should update existing rules', () => {
      const rules = alertManager.getRules();
      const firstRule = rules[0];

      const updated = alertManager.updateRule(firstRule.id, {
        description: 'Updated description',
        enabled: false,
      });

      expect(updated).not.toBeNull();
      expect(updated?.description).toBe('Updated description');
      expect(updated?.enabled).toBe(false);
    });

    it('should remove rules', () => {
      const initialCount = alertManager.getRules().length;

      const rules = alertManager.getRules();
      const ruleToRemove = rules[0];

      const removed = alertManager.removeRule(ruleToRemove.id);

      expect(removed).toBe(true);
      expect(alertManager.getRules().length).toBe(initialCount - 1);
    });

    it('should enable/disable rules', () => {
      const rules = alertManager.getRules();
      const rule = rules[0];

      alertManager.setRuleEnabled(rule.id, false);
      const disabledRule = alertManager.getRule(rule.id);
      expect(disabledRule?.enabled).toBe(false);

      alertManager.setRuleEnabled(rule.id, true);
      const enabledRule = alertManager.getRule(rule.id);
      expect(enabledRule?.enabled).toBe(true);
    });

    it('should get rule by ID', () => {
      const rules = alertManager.getRules();
      const rule = alertManager.getRule(rules[0].id);

      expect(rule).toBeDefined();
      expect(rule?.id).toBe(rules[0].id);
    });

    it('should return undefined for non-existent rule', () => {
      const rule = alertManager.getRule('non-existent-id');

      expect(rule).toBeUndefined();
    });
  });

  // =====================================================
  // ALERT LIFECYCLE TESTS
  // =====================================================

  describe('Alert Lifecycle', () => {
    it('should fire alerts when conditions are met', async () => {
      // Add a rule that will fire immediately
      alertManager.addRule({
        name: 'Test Alert',
        description: 'Fires when calls > 0',
        severity: 'warning',
        condition: {
          metric: VOICE_METRIC_NAMES.CALLS_TOTAL,
          operator: 'gt',
          threshold: 0,
        },
        enabled: true,
        notificationChannels: [],
      });

      // Record a call to trigger the alert
      recordVoiceCall();

      // Evaluate rules
      alertManager.evaluateAllRules();

      const activeAlerts = alertManager.getActiveAlerts();

      expect(activeAlerts.length).toBeGreaterThan(0);
      expect(activeAlerts[0].name).toBe('Test Alert');
      expect(activeAlerts[0].status).toBe('firing');
    });

    it('should resolve alerts when conditions are no longer met', () => {
      // Add and fire an alert
      alertManager.addRule({
        name: 'Calls Alert',
        description: 'Fires when calls > 5',
        severity: 'warning',
        condition: {
          metric: VOICE_METRIC_NAMES.CALLS_TOTAL,
          operator: 'gt',
          threshold: 5,
        },
        enabled: true,
        notificationChannels: [],
      });

      // Record enough calls to trigger
      for (let i = 0; i < 10; i++) {
        recordVoiceCall();
      }

      alertManager.evaluateAllRules();
      expect(alertManager.getActiveAlerts().length).toBeGreaterThan(0);

      // Reset metrics (condition no longer met)
      resetMetrics();

      alertManager.evaluateAllRules();

      // Alert should be resolved
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts.length).toBe(0);
    });

    it('should acknowledge alerts', () => {
      // Create a manual alert
      const alert = alertManager.createManualAlert({
        name: 'Manual Alert',
        description: 'For testing',
        severity: 'warning',
      });

      const acknowledged = alertManager.acknowledgeAlert(alert.id, 'admin@test.com');

      expect(acknowledged).toBe(true);

      const updatedAlert = alertManager.getAlert(alert.id);
      expect(updatedAlert?.status).toBe('acknowledged');
      expect(updatedAlert?.acknowledgedBy).toBe('admin@test.com');
    });

    it('should resolve alerts manually', () => {
      const alert = alertManager.createManualAlert({
        name: 'Manual Alert',
        description: 'For testing',
        severity: 'warning',
      });

      const resolved = alertManager.resolveAlert(alert.id, 'Issue fixed');

      expect(resolved).toBe(true);

      // Alert should no longer be active
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts.find((a) => a.id === alert.id)).toBeUndefined();
    });

    it('should track alert history', () => {
      const alert = alertManager.createManualAlert({
        name: 'History Alert',
        description: 'For history testing',
        severity: 'info',
      });

      alertManager.resolveAlert(alert.id, 'Done');

      const history = alertManager.getAlertHistory();

      expect(history.some((a) => a.id === alert.id)).toBe(true);
      expect(history.find((a) => a.id === alert.id)?.status).toBe('resolved');
    });
  });

  // =====================================================
  // CONDITION EVALUATION TESTS
  // =====================================================

  describe('Condition Evaluation', () => {
    it('should evaluate greater than condition', () => {
      alertManager.addRule({
        name: 'GT Test',
        description: 'Test greater than',
        severity: 'warning',
        condition: {
          metric: VOICE_METRIC_NAMES.CALLS_TOTAL,
          operator: 'gt',
          threshold: 5,
        },
        enabled: true,
        notificationChannels: [],
      });

      // Below threshold - should not fire
      for (let i = 0; i < 3; i++) recordVoiceCall();
      alertManager.evaluateAllRules();
      expect(alertManager.getActiveAlerts().filter((a) => a.name === 'GT Test').length).toBe(0);

      // Above threshold - should fire
      for (let i = 0; i < 5; i++) recordVoiceCall();
      alertManager.evaluateAllRules();
      expect(alertManager.getActiveAlerts().filter((a) => a.name === 'GT Test').length).toBe(1);
    });

    it('should evaluate equals condition', () => {
      alertManager.addRule({
        name: 'EQ Test',
        description: 'Test equals',
        severity: 'warning',
        condition: {
          metric: VOICE_METRIC_NAMES.CIRCUIT_BREAKER_STATE,
          operator: 'eq',
          threshold: 2, // OPEN state
        },
        enabled: true,
        notificationChannels: [],
      });

      setCircuitBreakerState('CLOSED'); // value = 0
      alertManager.evaluateAllRules();
      expect(alertManager.getActiveAlerts().filter((a) => a.name === 'EQ Test').length).toBe(0);

      setCircuitBreakerState('OPEN'); // value = 2
      alertManager.evaluateAllRules();
      expect(alertManager.getActiveAlerts().filter((a) => a.name === 'EQ Test').length).toBe(1);
    });

    it('should evaluate less than condition', () => {
      alertManager.addRule({
        name: 'LT Test',
        description: 'Test less than',
        severity: 'info',
        condition: {
          metric: VOICE_METRIC_NAMES.ACTIVE_CALLS,
          operator: 'lt',
          threshold: 5,
        },
        enabled: true,
        notificationChannels: [],
      });

      // Gauge starts at 0, which is < 5
      alertManager.evaluateAllRules();
      expect(alertManager.getActiveAlerts().filter((a) => a.name === 'LT Test').length).toBe(1);
    });

    it('should handle missing metrics gracefully', () => {
      alertManager.addRule({
        name: 'Missing Metric Test',
        description: 'Test with non-existent metric',
        severity: 'warning',
        condition: {
          metric: 'non_existent_metric',
          operator: 'gt',
          threshold: 0,
        },
        enabled: true,
        notificationChannels: [],
      });

      // Should not throw
      expect(() => alertManager.evaluateAllRules()).not.toThrow();
      expect(alertManager.getActiveAlerts().filter((a) => a.name === 'Missing Metric Test').length).toBe(0);
    });
  });

  // =====================================================
  // DEDUPLICATION TESTS
  // =====================================================

  describe('Deduplication', () => {
    it('should not fire duplicate alerts within deduplication window', () => {
      alertManager.addRule({
        name: 'Dedup Test',
        description: 'Test deduplication',
        severity: 'warning',
        condition: {
          metric: VOICE_METRIC_NAMES.CALLS_TOTAL,
          operator: 'gt',
          threshold: 0,
        },
        enabled: true,
        notificationChannels: [],
      });

      recordVoiceCall();

      // First evaluation - should fire
      alertManager.evaluateAllRules();
      const firstCount = alertManager.getActiveAlerts().filter((a) => a.name === 'Dedup Test').length;

      // Second evaluation within dedup window - should not create new alert
      alertManager.evaluateAllRules();
      const secondCount = alertManager.getActiveAlerts().filter((a) => a.name === 'Dedup Test').length;

      expect(firstCount).toBe(1);
      expect(secondCount).toBe(1); // Same alert, not a new one
    });
  });

  // =====================================================
  // MANUAL ALERT TESTS
  // =====================================================

  describe('Manual Alerts', () => {
    it('should create manual alerts', () => {
      const alert = alertManager.createManualAlert({
        name: 'Manual Test Alert',
        description: 'Created manually for testing',
        severity: 'critical',
        labels: { source: 'test' },
        annotations: { runbook: 'https://example.com/runbook' },
      });

      expect(alert.id).toBeDefined();
      expect(alert.name).toBe('Manual Test Alert');
      expect(alert.severity).toBe('critical');
      expect(alert.ruleId).toBe('manual');
      expect(alert.labels.manual).toBe('true');
      expect(alert.status).toBe('firing');
    });

    it('should include manual alerts in active alerts', () => {
      alertManager.createManualAlert({
        name: 'Included Alert',
        description: 'Test',
        severity: 'warning',
      });

      const activeAlerts = alertManager.getActiveAlerts();

      expect(activeAlerts.some((a) => a.name === 'Included Alert')).toBe(true);
    });
  });

  // =====================================================
  // QUERY TESTS
  // =====================================================

  describe('Query Methods', () => {
    beforeEach(() => {
      alertManager.createManualAlert({
        name: 'Critical Alert',
        description: 'Critical severity',
        severity: 'critical',
      });
      alertManager.createManualAlert({
        name: 'Warning Alert',
        description: 'Warning severity',
        severity: 'warning',
      });
      alertManager.createManualAlert({
        name: 'Info Alert',
        description: 'Info severity',
        severity: 'info',
      });
    });

    it('should get alerts by severity', () => {
      const criticalAlerts = alertManager.getAlertsBySeverity('critical');
      const warningAlerts = alertManager.getAlertsBySeverity('warning');
      const infoAlerts = alertManager.getAlertsBySeverity('info');

      expect(criticalAlerts.length).toBe(1);
      expect(warningAlerts.length).toBe(1);
      expect(infoAlerts.length).toBe(1);
    });

    it('should get alerts by status', () => {
      const alert = alertManager.getActiveAlerts()[0];
      alertManager.acknowledgeAlert(alert.id, 'test');

      const firingAlerts = alertManager.getAlertsByStatus('firing');
      const acknowledgedAlerts = alertManager.getAlertsByStatus('acknowledged');

      expect(firingAlerts.length).toBe(2);
      expect(acknowledgedAlerts.length).toBe(1);
    });

    it('should get alert count by severity', () => {
      const counts = alertManager.getAlertCountBySeverity();

      expect(counts.critical).toBe(1);
      expect(counts.warning).toBe(1);
      expect(counts.info).toBe(1);
    });

    it('should get alert summary', () => {
      const summary = alertManager.getAlertSummary();

      expect(summary.total).toBe(3);
      expect(summary.firing).toBe(3);
      expect(summary.acknowledged).toBe(0);
      expect(summary.bySeverity.critical).toBe(1);
    });
  });

  // =====================================================
  // START/STOP TESTS
  // =====================================================

  describe('Start/Stop', () => {
    it('should start evaluation', () => {
      alertManager.start();

      // Should not throw
      expect(() => alertManager.start()).not.toThrow();
    });

    it('should stop evaluation', () => {
      alertManager.start();
      alertManager.stop();

      // Should not throw
      expect(() => alertManager.stop()).not.toThrow();
    });

    it('should not start when disabled', () => {
      const disabledManager = new AlertManager({ enabled: false });

      // Should not throw or start evaluation
      expect(() => disabledManager.start()).not.toThrow();
    });
  });

  // =====================================================
  // CONVENIENCE FUNCTION TESTS
  // =====================================================

  describe('Convenience Functions', () => {
    beforeEach(() => {
      AlertManager.resetInstance();
    });

    it('should work with getAlertManager', () => {
      const manager1 = getAlertManager();
      const manager2 = getAlertManager();

      expect(manager1).toBe(manager2);
    });

    it('should work with convenience functions', () => {
      const alert = createManualAlert({
        name: 'Convenience Test',
        description: 'Test',
        severity: 'info',
      });

      expect(alert.id).toBeDefined();

      const active = getActiveAlerts();
      expect(active.some((a) => a.id === alert.id)).toBe(true);

      const summary = getAlertSummary();
      expect(summary.total).toBeGreaterThan(0);

      acknowledgeAlert(alert.id, 'test');
      const ackAlert = getAlertManager().getAlert(alert.id);
      expect(ackAlert?.status).toBe('acknowledged');

      resolveAlert(alert.id, 'Done');
      expect(getActiveAlerts().find((a) => a.id === alert.id)).toBeUndefined();
    });

    it('should work with rule convenience functions', () => {
      const rule = addAlertRule({
        name: 'Added Rule',
        description: 'Test',
        severity: 'warning',
        condition: {
          metric: VOICE_METRIC_NAMES.CALLS_TOTAL,
          operator: 'gt',
          threshold: 10,
        },
        enabled: true,
        notificationChannels: [],
      });

      expect(rule.id).toBeDefined();

      const rules = getAlertRules();
      expect(rules.some((r) => r.id === rule.id)).toBe(true);
    });
  });
});
