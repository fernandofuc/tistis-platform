/**
 * TIS TIS Platform - Voice Agent v2.0
 * Alert Manager
 *
 * Manages alert rules, evaluates conditions against metrics,
 * fires and resolves alerts, and triggers notifications.
 *
 * Features:
 * - Rule-based alerting with configurable thresholds
 * - Deduplication to prevent alert storms
 * - Alert lifecycle management (firing -> acknowledged -> resolved)
 * - Integration with notification channels
 * - Alert history and audit logging
 *
 * @module lib/voice-agent/monitoring/alert-manager
 */

import type {
  Alert,
  AlertRule,
  AlertCondition,
  AlertSeverity,
  AlertStatus,
  ComparisonOperator,
  NotificationChannel,
  Metric,
} from './types';
import { DEFAULT_ALERT_RULES } from './types';
import { getMetricsRegistry } from './voice-metrics';
import { getVoiceLogger } from './voice-logger';

// =====================================================
// TYPES
// =====================================================

/**
 * Alert manager configuration
 */
export interface AlertManagerConfig {
  /** Enable alerting */
  enabled: boolean;

  /** Evaluation interval in milliseconds */
  evaluationIntervalMs: number;

  /** How long to wait before re-firing resolved alert */
  repeatIntervalMs: number;

  /** Maximum active alerts */
  maxActiveAlerts: number;

  /** Deduplication window in milliseconds */
  deduplicationWindowMs: number;

  /** Environment name */
  environment: string;

  /** Service name */
  serviceName: string;

  /** Notification handler */
  notificationHandler?: (alert: Alert, channels: NotificationChannel[]) => Promise<void>;
}

/**
 * Alert evaluation result
 */
interface AlertEvaluationResult {
  ruleId: string;
  shouldFire: boolean;
  currentValue: number;
  threshold: number;
  labels: Record<string, string>;
}

/**
 * Alert state for deduplication
 */
interface AlertState {
  lastFiredAt: number;
  lastResolvedAt?: number;
  consecutiveFirings: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

// =====================================================
// DEFAULT CONFIGURATION
// =====================================================

const DEFAULT_CONFIG: AlertManagerConfig = {
  enabled: process.env.ENABLE_VOICE_ALERTS !== 'false',
  evaluationIntervalMs: 30_000, // 30 seconds
  repeatIntervalMs: 300_000, // 5 minutes
  maxActiveAlerts: 100,
  deduplicationWindowMs: 60_000, // 1 minute
  environment: process.env.NODE_ENV ?? 'development',
  serviceName: 'voice-agent-v2',
};

// =====================================================
// ALERT MANAGER CLASS
// =====================================================

/**
 * Alert manager for voice agent monitoring
 */
export class AlertManager {
  private readonly config: AlertManagerConfig;
  private readonly rules: Map<string, AlertRule> = new Map();
  private readonly activeAlerts: Map<string, Alert> = new Map();
  private readonly alertStates: Map<string, AlertState> = new Map();
  private readonly alertHistory: Alert[] = [];
  private evaluationTimer: ReturnType<typeof setInterval> | null = null;
  private static instance: AlertManager | null = null;
  private readonly logger = getVoiceLogger();

  constructor(config?: Partial<AlertManagerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Initialize default rules
    this.initializeDefaultRules();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<AlertManagerConfig>): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager(config);
    }
    return AlertManager.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    if (AlertManager.instance) {
      AlertManager.instance.stop();
    }
    AlertManager.instance = null;
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    for (const ruleConfig of DEFAULT_ALERT_RULES) {
      const rule: AlertRule = {
        id: this.generateRuleId(ruleConfig.name),
        ...ruleConfig,
      };
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Generate a rule ID from name
   */
  private generateRuleId(name: string): string {
    return `rule_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString(36)}`;
  }

  /**
   * Generate an alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // =====================================================
  // RULE MANAGEMENT
  // =====================================================

  /**
   * Add a new alert rule
   */
  addRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const fullRule: AlertRule = {
      id: this.generateRuleId(rule.name),
      ...rule,
    };
    this.rules.set(fullRule.id, fullRule);

    this.logger.info('Alert rule added', {
      data: {
        ruleId: fullRule.id,
        name: fullRule.name,
        severity: fullRule.severity,
      },
    });

    return fullRule;
  }

  /**
   * Update an existing rule
   */
  updateRule(ruleId: string, updates: Partial<Omit<AlertRule, 'id'>>): AlertRule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return null;
    }

    const updatedRule: AlertRule = {
      ...rule,
      ...updates,
    };
    this.rules.set(ruleId, updatedRule);

    this.logger.info('Alert rule updated', {
      data: {
        ruleId,
        name: updatedRule.name,
      },
    });

    return updatedRule;
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): boolean {
    const existed = this.rules.delete(ruleId);
    if (existed) {
      // Also remove any active alerts from this rule
      for (const [alertId, alert] of this.activeAlerts) {
        if (alert.ruleId === ruleId) {
          this.resolveAlert(alertId, 'Rule deleted');
        }
      }
    }
    return existed;
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }
    rule.enabled = enabled;
    return true;
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a specific rule
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  // =====================================================
  // ALERT LIFECYCLE
  // =====================================================

  /**
   * Fire an alert
   */
  private fireAlert(rule: AlertRule, value: number, labels: Record<string, string>): Alert {
    const alertId = this.generateAlertId();
    const now = new Date().toISOString();

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      status: 'firing',
      firedAt: now,
      value,
      threshold: rule.condition.threshold,
      labels: {
        ...labels,
        ...rule.labels,
        environment: this.config.environment,
        service: this.config.serviceName,
      },
      annotations: rule.annotations ?? {},
    };

    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);

    // Update state for deduplication
    const stateKey = this.getStateKey(rule.id, labels);
    const currentState = this.alertStates.get(stateKey) ?? {
      lastFiredAt: 0,
      consecutiveFirings: 0,
    };
    this.alertStates.set(stateKey, {
      ...currentState,
      lastFiredAt: Date.now(),
      consecutiveFirings: currentState.consecutiveFirings + 1,
    });

    this.logger.warn(`Alert fired: ${rule.name}`, {
      data: {
        alertId,
        ruleId: rule.id,
        severity: rule.severity,
        value,
        threshold: rule.condition.threshold,
        labels,
      },
    });

    // Trigger notifications
    this.sendNotifications(alert, rule.notificationChannels);

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, reason?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();

    // Update in history
    const historyIndex = this.alertHistory.findIndex((a) => a.id === alertId);
    if (historyIndex !== -1) {
      this.alertHistory[historyIndex] = alert;
    }

    // Update state
    const stateKey = this.getStateKey(alert.ruleId, alert.labels);
    const currentState = this.alertStates.get(stateKey);
    if (currentState) {
      currentState.lastResolvedAt = Date.now();
      currentState.consecutiveFirings = 0;
    }

    this.activeAlerts.delete(alertId);

    this.logger.info(`Alert resolved: ${alert.name}`, {
      data: {
        alertId,
        ruleId: alert.ruleId,
        reason,
      },
    });

    // Send resolution notification
    this.sendNotifications(alert, this.rules.get(alert.ruleId)?.notificationChannels ?? []);

    return true;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = acknowledgedBy;

    // Update state
    const stateKey = this.getStateKey(alert.ruleId, alert.labels);
    const currentState = this.alertStates.get(stateKey);
    if (currentState) {
      currentState.acknowledgedAt = Date.now();
      currentState.acknowledgedBy = acknowledgedBy;
    }

    this.logger.info(`Alert acknowledged: ${alert.name}`, {
      data: {
        alertId,
        ruleId: alert.ruleId,
        acknowledgedBy,
      },
    });

    return true;
  }

  /**
   * Get state key for deduplication
   */
  private getStateKey(ruleId: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${ruleId}:${labelStr}`;
  }

  // =====================================================
  // ALERT EVALUATION
  // =====================================================

  /**
   * Start periodic evaluation
   */
  start(): void {
    if (!this.config.enabled) {
      this.logger.info('Alert manager disabled');
      return;
    }

    if (this.evaluationTimer) {
      return; // Already running
    }

    this.logger.info('Alert manager started', {
      data: {
        evaluationIntervalMs: this.config.evaluationIntervalMs,
        rulesCount: this.rules.size,
      },
    });

    this.evaluationTimer = setInterval(() => {
      this.evaluateAllRules();
    }, this.config.evaluationIntervalMs);

    // Run initial evaluation
    this.evaluateAllRules();
  }

  /**
   * Stop periodic evaluation
   */
  stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
      this.logger.info('Alert manager stopped');
    }
  }

  /**
   * Evaluate all rules
   */
  evaluateAllRules(): void {
    const metrics = getMetricsRegistry();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const result = this.evaluateRule(rule, metrics);
        this.processEvaluationResult(rule, result);
      } catch (error) {
        this.logger.error(`Failed to evaluate rule: ${rule.name}`, error as Error, {
          data: { ruleId: rule.id },
        });
      }
    }
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(rule: AlertRule, metrics: ReturnType<typeof getMetricsRegistry>): AlertEvaluationResult {
    const { condition } = rule;
    const metric = metrics.getMetric(condition.metric);

    if (!metric) {
      return {
        ruleId: rule.id,
        shouldFire: false,
        currentValue: 0,
        threshold: condition.threshold,
        labels: {},
      };
    }

    const value = this.getMetricValue(metric, condition);
    const shouldFire = this.evaluateCondition(value, condition);

    return {
      ruleId: rule.id,
      shouldFire,
      currentValue: value,
      threshold: condition.threshold,
      labels: metric.labels,
    };
  }

  /**
   * Get value from metric based on condition
   */
  private getMetricValue(metric: Metric, condition: AlertCondition): number {
    switch (metric.type) {
      case 'counter':
      case 'gauge':
        return metric.value;
      case 'histogram':
        // For histograms, use aggregation function
        switch (condition.aggregation) {
          case 'avg':
            return metric.count > 0 ? metric.sum / metric.count : 0;
          case 'max':
            return metric.percentiles.p99;
          case 'rate':
            // Calculate rate based on count over window
            return metric.count; // Simplified; real implementation would track over time
          default:
            return metric.percentiles.p95;
        }
      default:
        return 0;
    }
  }

  /**
   * Evaluate condition against value
   */
  private evaluateCondition(value: number, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case 'gt':
        return value > condition.threshold;
      case 'gte':
        return value >= condition.threshold;
      case 'lt':
        return value < condition.threshold;
      case 'lte':
        return value <= condition.threshold;
      case 'eq':
        return value === condition.threshold;
      case 'neq':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Process evaluation result
   */
  private processEvaluationResult(rule: AlertRule, result: AlertEvaluationResult): void {
    const stateKey = this.getStateKey(rule.id, result.labels);
    const state = this.alertStates.get(stateKey);

    // Check for existing active alert for this rule
    const existingAlert = Array.from(this.activeAlerts.values()).find(
      (a) => a.ruleId === rule.id && a.status === 'firing'
    );

    if (result.shouldFire) {
      // Should fire - check deduplication
      if (this.shouldDeduplicate(rule.id, result.labels)) {
        return;
      }

      if (!existingAlert) {
        // Check if we're within repeat interval
        if (state?.lastResolvedAt) {
          const timeSinceResolved = Date.now() - state.lastResolvedAt;
          if (timeSinceResolved < this.config.repeatIntervalMs) {
            return; // Don't re-fire too quickly
          }
        }

        // Fire new alert
        if (this.activeAlerts.size < this.config.maxActiveAlerts) {
          this.fireAlert(rule, result.currentValue, result.labels);
        } else {
          this.logger.warn('Maximum active alerts reached, not firing new alert', {
            data: {
              ruleId: rule.id,
              maxActiveAlerts: this.config.maxActiveAlerts,
            },
          });
        }
      }
    } else {
      // Condition no longer true - resolve alert if exists
      if (existingAlert && existingAlert.status === 'firing') {
        this.resolveAlert(existingAlert.id, 'Condition no longer met');
      }
    }
  }

  /**
   * Check if alert should be deduplicated
   */
  private shouldDeduplicate(ruleId: string, labels: Record<string, string>): boolean {
    const stateKey = this.getStateKey(ruleId, labels);
    const state = this.alertStates.get(stateKey);

    if (!state) {
      return false;
    }

    const timeSinceLastFire = Date.now() - state.lastFiredAt;
    return timeSinceLastFire < this.config.deduplicationWindowMs;
  }

  // =====================================================
  // NOTIFICATIONS
  // =====================================================

  /**
   * Send notifications for alert
   */
  private async sendNotifications(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    if (this.config.notificationHandler) {
      try {
        await this.config.notificationHandler(alert, channels);
      } catch (error) {
        this.logger.error('Failed to send notifications', error as Error, {
          data: {
            alertId: alert.id,
            channels,
          },
        });
      }
    }
  }

  // =====================================================
  // QUERY METHODS
  // =====================================================

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get active alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return Array.from(this.activeAlerts.values()).filter((a) => a.severity === severity);
  }

  /**
   * Get active alerts by status
   */
  getAlertsByStatus(status: AlertStatus): Alert[] {
    return Array.from(this.activeAlerts.values()).filter((a) => a.status === status);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.activeAlerts.get(alertId);
  }

  /**
   * Get alert count by severity
   */
  getAlertCountBySeverity(): Record<AlertSeverity, number> {
    const counts: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      critical: 0,
    };

    for (const alert of this.activeAlerts.values()) {
      counts[alert.severity]++;
    }

    return counts;
  }

  /**
   * Get alert summary
   */
  getAlertSummary(): {
    total: number;
    firing: number;
    acknowledged: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const alerts = Array.from(this.activeAlerts.values());

    return {
      total: alerts.length,
      firing: alerts.filter((a) => a.status === 'firing').length,
      acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
      bySeverity: this.getAlertCountBySeverity(),
    };
  }

  // =====================================================
  // MANUAL ALERT CREATION
  // =====================================================

  /**
   * Create a manual alert (not tied to a rule)
   */
  createManualAlert(params: {
    name: string;
    description: string;
    severity: AlertSeverity;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    notificationChannels?: NotificationChannel[];
  }): Alert {
    const alertId = this.generateAlertId();
    const now = new Date().toISOString();

    const alert: Alert = {
      id: alertId,
      ruleId: 'manual',
      name: params.name,
      description: params.description,
      severity: params.severity,
      status: 'firing',
      firedAt: now,
      value: 0,
      threshold: 0,
      labels: {
        ...params.labels,
        environment: this.config.environment,
        service: this.config.serviceName,
        manual: 'true',
      },
      annotations: params.annotations ?? {},
    };

    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);

    this.logger.warn(`Manual alert created: ${params.name}`, {
      data: {
        alertId,
        severity: params.severity,
      },
    });

    // Send notifications
    if (params.notificationChannels) {
      this.sendNotifications(alert, params.notificationChannels);
    }

    return alert;
  }
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Get the singleton alert manager instance
 */
export function getAlertManager(): AlertManager {
  return AlertManager.getInstance();
}

/**
 * Start the alert manager
 */
export function startAlertManager(): void {
  AlertManager.getInstance().start();
}

/**
 * Stop the alert manager
 */
export function stopAlertManager(): void {
  AlertManager.getInstance().stop();
}

/**
 * Get all active alerts
 */
export function getActiveAlerts(): Alert[] {
  return AlertManager.getInstance().getActiveAlerts();
}

/**
 * Get alert summary
 */
export function getAlertSummary(): {
  total: number;
  firing: number;
  acknowledged: number;
  bySeverity: Record<AlertSeverity, number>;
} {
  return AlertManager.getInstance().getAlertSummary();
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
  return AlertManager.getInstance().acknowledgeAlert(alertId, acknowledgedBy);
}

/**
 * Resolve an alert
 */
export function resolveAlert(alertId: string, reason?: string): boolean {
  return AlertManager.getInstance().resolveAlert(alertId, reason);
}

/**
 * Create a manual alert
 */
export function createManualAlert(params: {
  name: string;
  description: string;
  severity: AlertSeverity;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  notificationChannels?: NotificationChannel[];
}): Alert {
  return AlertManager.getInstance().createManualAlert(params);
}

/**
 * Add a custom alert rule
 */
export function addAlertRule(rule: Omit<AlertRule, 'id'>): AlertRule {
  return AlertManager.getInstance().addRule(rule);
}

/**
 * Get all alert rules
 */
export function getAlertRules(): AlertRule[] {
  return AlertManager.getInstance().getRules();
}
