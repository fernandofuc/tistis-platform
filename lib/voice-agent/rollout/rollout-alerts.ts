/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Alerts Integration
 *
 * Connects rollout monitoring with the alert system:
 * - Automatic health-based alerting
 * - Rollback trigger alerts
 * - Stage progression notifications
 * - SLA violation detection
 *
 * @module lib/voice-agent/rollout/rollout-alerts
 */

import {
  getAlertManager,
  createManualAlert,
  addAlertRule,
  type AlertManager,
} from '../monitoring/alert-manager';
import type { Alert, AlertRule, AlertSeverity, NotificationChannel } from '../monitoring/types';
import { getVoiceLogger } from '../monitoring/voice-logger';
import { getRolloutService, type RolloutService } from './rollout-service';
import type {
  RolloutStage,
  RolloutStatus,
  HealthCheckResult,
  RolloutIssue,
  RolloutHistoryEntry,
} from './types';
import { DEFAULT_STAGE_CONFIGS } from './types';

// =====================================================
// TYPES
// =====================================================

/**
 * Rollout alert configuration
 */
export interface RolloutAlertConfig {
  /** Enable rollout alerts */
  enabled: boolean;

  /** Monitoring interval in milliseconds */
  monitoringIntervalMs: number;

  /** Default notification channels */
  defaultChannels: NotificationChannel[];

  /** Auto-rollback on critical alerts */
  autoRollbackOnCritical: boolean;

  /** Minimum calls before alerting */
  minCallsForAlerts: number;

  /** Alert suppression window after rollback (ms) */
  suppressionWindowAfterRollbackMs: number;

  /** Escalation config */
  escalation: {
    /** Time before escalating warning to critical (ms) */
    warningEscalationMs: number;
    /** Max consecutive warnings before escalation */
    maxConsecutiveWarnings: number;
  };
}

/**
 * Rollout alert event
 */
export interface RolloutAlertEvent {
  type: RolloutAlertType;
  severity: AlertSeverity;
  stage: RolloutStage;
  percentage: number;
  message: string;
  details: Record<string, unknown>;
  timestamp: string;
}

/**
 * Types of rollout alerts
 */
export type RolloutAlertType =
  | 'health_degradation'
  | 'rollback_triggered'
  | 'rollback_recommended'
  | 'stage_advanced'
  | 'stage_blocked'
  | 'sla_violation'
  | 'auto_advance_ready'
  | 'circuit_breaker_triggered'
  | 'error_rate_spike'
  | 'latency_spike';

/**
 * Alert handler callback
 */
export type RolloutAlertHandler = (event: RolloutAlertEvent) => void | Promise<void>;

// =====================================================
// DEFAULT CONFIGURATION
// =====================================================

const DEFAULT_ALERT_CONFIG: RolloutAlertConfig = {
  enabled: process.env.ENABLE_ROLLOUT_ALERTS !== 'false',
  monitoringIntervalMs: 60_000, // 1 minute
  defaultChannels: ['slack'],
  autoRollbackOnCritical: false, // Requires explicit enable
  minCallsForAlerts: 10,
  suppressionWindowAfterRollbackMs: 300_000, // 5 minutes
  escalation: {
    warningEscalationMs: 900_000, // 15 minutes
    maxConsecutiveWarnings: 3,
  },
};

// =====================================================
// ROLLOUT ALERT SERVICE
// =====================================================

/**
 * Service for managing rollout-specific alerts
 */
export class RolloutAlertService {
  private readonly config: RolloutAlertConfig;
  private readonly logger = getVoiceLogger();
  private readonly rolloutService: RolloutService;
  private readonly alertManager: AlertManager;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private readonly alertHandlers: Set<RolloutAlertHandler> = new Set();
  private lastRollbackTime: number = 0;
  private consecutiveWarnings: Map<string, number> = new Map();
  private warningStartTimes: Map<string, number> = new Map();
  private static instance: RolloutAlertService | null = null;
  /** Flag to prevent concurrent monitoring cycles */
  private isMonitoringCycleRunning = false;

  constructor(config?: Partial<RolloutAlertConfig>) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config };
    this.rolloutService = getRolloutService();
    this.alertManager = getAlertManager();

    // Initialize rollout-specific alert rules
    this.initializeAlertRules();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<RolloutAlertConfig>): RolloutAlertService {
    if (!RolloutAlertService.instance) {
      RolloutAlertService.instance = new RolloutAlertService(config);
    }
    return RolloutAlertService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    if (RolloutAlertService.instance) {
      RolloutAlertService.instance.stop();
    }
    RolloutAlertService.instance = null;
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  /**
   * Initialize rollout-specific alert rules
   */
  private initializeAlertRules(): void {
    // Error rate threshold rule
    addAlertRule({
      name: 'Rollout Error Rate Critical',
      description: 'V2 error rate exceeds no-go threshold during rollout',
      severity: 'critical',
      enabled: true,
      condition: {
        metric: 'voice_agent.v2.error_rate',
        operator: 'gt',
        threshold: 0.05, // 5%
        window: 300_000, // 5 minutes
        aggregation: 'avg',
      },
      labels: {
        component: 'rollout',
        version: 'v2',
      },
      annotations: {
        runbook: 'Check V2 error logs, consider rollback if persistent',
        dashboard: '/admin/rollout',
      },
      notificationChannels: this.config.defaultChannels,
    });

    // Latency threshold rule
    addAlertRule({
      name: 'Rollout Latency Critical',
      description: 'V2 p95 latency exceeds no-go threshold during rollout',
      severity: 'critical',
      enabled: true,
      condition: {
        metric: 'voice_agent.v2.latency_p95',
        operator: 'gt',
        threshold: 1200, // 1200ms
        window: 300_000,
        aggregation: 'max',
      },
      labels: {
        component: 'rollout',
        version: 'v2',
      },
      annotations: {
        runbook: 'Check V2 performance, investigate latency sources',
        dashboard: '/admin/rollout',
      },
      notificationChannels: this.config.defaultChannels,
    });

    // Warning level error rate
    addAlertRule({
      name: 'Rollout Error Rate Warning',
      description: 'V2 error rate approaching no-go threshold',
      severity: 'warning',
      enabled: true,
      condition: {
        metric: 'voice_agent.v2.error_rate',
        operator: 'gt',
        threshold: 0.02, // 2%
        window: 300_000,
        aggregation: 'avg',
      },
      labels: {
        component: 'rollout',
        version: 'v2',
      },
      annotations: {
        runbook: 'Monitor closely, may need intervention soon',
        dashboard: '/admin/rollout',
      },
      notificationChannels: ['slack'],
    });

    this.logger.info('Rollout alert rules initialized');
  }

  // =====================================================
  // LIFECYCLE
  // =====================================================

  /**
   * Start rollout monitoring
   */
  start(): void {
    if (!this.config.enabled) {
      this.logger.info('Rollout alerts disabled');
      return;
    }

    if (this.monitoringInterval) {
      return; // Already running
    }

    this.logger.info('Starting rollout alert monitoring', {
      data: {
        intervalMs: this.config.monitoringIntervalMs,
        autoRollback: this.config.autoRollbackOnCritical,
      },
    });

    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.runMonitoringCycle();
    }, this.config.monitoringIntervalMs);

    // Run initial check
    this.runMonitoringCycle();
  }

  /**
   * Stop rollout monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Rollout alert monitoring stopped');
    }
    // Clear warning maps to free memory
    this.consecutiveWarnings.clear();
    this.warningStartTimes.clear();
  }

  /**
   * Register an alert handler
   */
  onAlert(handler: RolloutAlertHandler): () => void {
    this.alertHandlers.add(handler);
    return () => {
      this.alertHandlers.delete(handler);
    };
  }

  // =====================================================
  // MONITORING
  // =====================================================

  /**
   * Run a monitoring cycle
   * Prevents concurrent execution to avoid resource contention
   */
  private async runMonitoringCycle(): Promise<void> {
    // Prevent concurrent monitoring cycles
    if (this.isMonitoringCycleRunning) {
      this.logger.debug('Monitoring cycle already running, skipping');
      return;
    }

    this.isMonitoringCycleRunning = true;
    try {
      // Check if in suppression window after rollback
      if (this.isInSuppressionWindow()) {
        return;
      }

      // Get current status and perform health check
      const status = await this.rolloutService.getStatus();

      // Skip if rollout is disabled
      if (!status.enabled || status.percentage === 0) {
        return;
      }

      // Perform health check
      const healthCheck = await this.rolloutService.performHealthCheck();

      // Process health check results
      await this.processHealthCheck(status, healthCheck);
    } catch (error) {
      this.logger.error('Error in rollout monitoring cycle', error as Error);
    } finally {
      this.isMonitoringCycleRunning = false;
    }
  }

  /**
   * Check if in suppression window after rollback
   */
  private isInSuppressionWindow(): boolean {
    const timeSinceRollback = Date.now() - this.lastRollbackTime;
    return timeSinceRollback < this.config.suppressionWindowAfterRollbackMs;
  }

  /**
   * Process health check results
   */
  private async processHealthCheck(
    status: RolloutStatus,
    healthCheck: HealthCheckResult
  ): Promise<void> {
    // Check for critical issues
    const criticalIssues = healthCheck.issues.filter((i) => i.severity === 'critical');
    const warningIssues = healthCheck.issues.filter((i) => i.severity === 'warning');

    // Handle critical issues
    if (criticalIssues.length > 0) {
      await this.handleCriticalIssues(status, criticalIssues, healthCheck);
    }

    // Handle warnings with escalation logic
    if (warningIssues.length > 0) {
      await this.handleWarningIssues(status, warningIssues);
    } else {
      // Clear warning counters if no warnings
      this.consecutiveWarnings.clear();
      this.warningStartTimes.clear();
    }

    // Check if rollback is recommended
    if (healthCheck.shouldRollback) {
      await this.handleRollbackRecommendation(status, healthCheck);
    }

    // Check if can advance
    if (healthCheck.canAdvance && status.autoAdvanceEnabled) {
      await this.handleAutoAdvanceReady(status, healthCheck);
    }
  }

  /**
   * Handle critical issues
   */
  private async handleCriticalIssues(
    status: RolloutStatus,
    issues: RolloutIssue[],
    healthCheck: HealthCheckResult
  ): Promise<void> {
    for (const issue of issues) {
      const alertType = this.issueTypeToAlertType(issue.type);

      await this.emitAlert({
        type: alertType,
        severity: 'critical',
        stage: status.currentStage,
        percentage: status.percentage,
        message: issue.message,
        details: {
          currentValue: issue.currentValue,
          thresholdValue: issue.thresholdValue,
          recommendedAction: issue.recommendedAction,
          v2Metrics: healthCheck.v2Metrics,
          v1Metrics: healthCheck.v1Metrics,
        },
        timestamp: new Date().toISOString(),
      });

      // Create alert in alert manager
      createManualAlert({
        name: `Rollout ${alertType}: ${issue.type}`,
        description: issue.message,
        severity: 'critical',
        labels: {
          stage: status.currentStage,
          percentage: String(status.percentage),
          issueType: issue.type,
        },
        annotations: {
          recommendedAction: issue.recommendedAction,
        },
        notificationChannels: this.config.defaultChannels,
      });
    }

    // Auto-rollback if enabled
    if (this.config.autoRollbackOnCritical && healthCheck.shouldRollback) {
      await this.triggerAutoRollback(status, issues);
    }
  }

  /**
   * Handle warning issues with escalation
   */
  private async handleWarningIssues(
    status: RolloutStatus,
    issues: RolloutIssue[]
  ): Promise<void> {
    for (const issue of issues) {
      const key = `${issue.type}:${status.currentStage}`;
      const now = Date.now();

      // Track consecutive warnings
      const currentCount = (this.consecutiveWarnings.get(key) ?? 0) + 1;
      this.consecutiveWarnings.set(key, currentCount);

      // Track warning start time
      if (!this.warningStartTimes.has(key)) {
        this.warningStartTimes.set(key, now);
      }

      const warningStartTime = this.warningStartTimes.get(key)!;
      const warningDuration = now - warningStartTime;

      // Check if should escalate to critical
      const shouldEscalate =
        currentCount >= this.config.escalation.maxConsecutiveWarnings ||
        warningDuration >= this.config.escalation.warningEscalationMs;

      const severity: AlertSeverity = shouldEscalate ? 'critical' : 'warning';
      const alertType = this.issueTypeToAlertType(issue.type);

      await this.emitAlert({
        type: alertType,
        severity,
        stage: status.currentStage,
        percentage: status.percentage,
        message: shouldEscalate
          ? `ESCALATED: ${issue.message} (${currentCount} consecutive warnings)`
          : issue.message,
        details: {
          currentValue: issue.currentValue,
          thresholdValue: issue.thresholdValue,
          recommendedAction: issue.recommendedAction,
          consecutiveWarnings: currentCount,
          warningDurationMs: warningDuration,
          escalated: shouldEscalate,
        },
        timestamp: new Date().toISOString(),
      });

      // Create alert if escalated
      if (shouldEscalate) {
        createManualAlert({
          name: `Rollout Warning Escalated: ${issue.type}`,
          description: `${issue.message} - Persisted for ${Math.round(warningDuration / 60000)} minutes`,
          severity: 'critical',
          labels: {
            stage: status.currentStage,
            escalated: 'true',
          },
          notificationChannels: this.config.defaultChannels,
        });
      }
    }
  }

  /**
   * Handle rollback recommendation
   */
  private async handleRollbackRecommendation(
    status: RolloutStatus,
    healthCheck: HealthCheckResult
  ): Promise<void> {
    await this.emitAlert({
      type: 'rollback_recommended',
      severity: 'critical',
      stage: status.currentStage,
      percentage: status.percentage,
      message: `Rollback recommended: ${healthCheck.issues.length} critical issues detected`,
      details: {
        issues: healthCheck.issues,
        v2Metrics: healthCheck.v2Metrics,
        v1Metrics: healthCheck.v1Metrics,
      },
      timestamp: new Date().toISOString(),
    });

    createManualAlert({
      name: 'Rollout Rollback Recommended',
      description: `V2 rollout at ${status.percentage}% is experiencing critical issues. Rollback is recommended.`,
      severity: 'critical',
      labels: {
        stage: status.currentStage,
        percentage: String(status.percentage),
        issueCount: String(healthCheck.issues.length),
      },
      annotations: {
        action: 'Review dashboard and consider rollback',
        dashboard: '/admin/rollout',
      },
      notificationChannels: [...this.config.defaultChannels, 'pagerduty'],
    });
  }

  /**
   * Handle auto-advance ready
   */
  private async handleAutoAdvanceReady(
    status: RolloutStatus,
    healthCheck: HealthCheckResult
  ): Promise<void> {
    const nextStage = this.rolloutService.getNextStage(status.currentStage);
    if (!nextStage) return;

    await this.emitAlert({
      type: 'auto_advance_ready',
      severity: 'info',
      stage: status.currentStage,
      percentage: status.percentage,
      message: `Rollout ready to advance from ${status.currentStage} to ${nextStage}`,
      details: {
        nextStage,
        metrics: healthCheck.v2Metrics,
        goConditionsMet: true,
      },
      timestamp: new Date().toISOString(),
    });

    createManualAlert({
      name: 'Rollout Auto-Advance Ready',
      description: `V2 rollout at ${status.currentStage} meets all go conditions for advancement to ${nextStage}`,
      severity: 'info',
      labels: {
        currentStage: status.currentStage,
        nextStage,
      },
      notificationChannels: ['slack'],
    });
  }

  /**
   * Trigger auto-rollback
   */
  private async triggerAutoRollback(
    status: RolloutStatus,
    issues: RolloutIssue[]
  ): Promise<void> {
    const reason = `Auto-rollback triggered: ${issues.map((i) => i.type).join(', ')}`;

    this.logger.error('Triggering auto-rollback', null, {
      data: {
        stage: status.currentStage,
        percentage: status.percentage,
        issues: issues.length,
        reason,
      },
    });

    // Execute rollback
    const result = await this.rolloutService.executeRollback({
      level: 'partial',
      initiatedBy: 'system:auto-rollback',
      reason,
    });

    if (result.success) {
      this.lastRollbackTime = Date.now();

      await this.emitAlert({
        type: 'rollback_triggered',
        severity: 'critical',
        stage: status.currentStage,
        percentage: status.percentage,
        message: `Auto-rollback executed: ${status.currentStage} (${status.percentage}%) → ${result.newStatus.currentStage} (${result.newStatus.percentage}%)`,
        details: {
          fromStage: status.currentStage,
          toStage: result.newStatus.currentStage,
          fromPercentage: status.percentage,
          toPercentage: result.newStatus.percentage,
          issues,
          automatic: true,
        },
        timestamp: new Date().toISOString(),
      });

      createManualAlert({
        name: 'Rollout Auto-Rollback Executed',
        description: `V2 rollout automatically rolled back from ${status.percentage}% to ${result.newStatus.percentage}% due to critical issues`,
        severity: 'critical',
        labels: {
          automatic: 'true',
          fromPercentage: String(status.percentage),
          toPercentage: String(result.newStatus.percentage),
        },
        notificationChannels: [...this.config.defaultChannels, 'pagerduty'],
      });
    } else {
      this.logger.error('Auto-rollback failed', null, {
        data: { error: result.error },
      });
    }
  }

  /**
   * Convert issue type to alert type
   */
  private issueTypeToAlertType(issueType: string): RolloutAlertType {
    switch (issueType) {
      case 'error_rate':
        return 'error_rate_spike';
      case 'latency':
        return 'latency_spike';
      case 'circuit_breaker':
        return 'circuit_breaker_triggered';
      default:
        return 'health_degradation';
    }
  }

  /**
   * Emit alert to all handlers
   */
  private async emitAlert(event: RolloutAlertEvent): Promise<void> {
    this.logger.info('Rollout alert emitted', {
      data: {
        type: event.type,
        severity: event.severity,
        stage: event.stage,
        message: event.message,
      },
    });

    for (const handler of this.alertHandlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Alert handler error', error as Error);
      }
    }
  }

  // =====================================================
  // MANUAL ALERTS
  // =====================================================

  /**
   * Create a stage advancement alert
   */
  async createStageAdvancementAlert(
    fromStage: RolloutStage,
    toStage: RolloutStage,
    fromPercentage: number,
    toPercentage: number,
    initiatedBy: string
  ): Promise<void> {
    await this.emitAlert({
      type: 'stage_advanced',
      severity: 'info',
      stage: toStage,
      percentage: toPercentage,
      message: `Rollout advanced: ${fromStage} (${fromPercentage}%) → ${toStage} (${toPercentage}%)`,
      details: {
        fromStage,
        toStage,
        fromPercentage,
        toPercentage,
        initiatedBy,
      },
      timestamp: new Date().toISOString(),
    });

    createManualAlert({
      name: 'Rollout Stage Advanced',
      description: `V2 rollout advanced from ${fromStage} to ${toStage} (${toPercentage}%)`,
      severity: 'info',
      labels: {
        fromStage,
        toStage,
        initiatedBy,
      },
      notificationChannels: ['slack'],
    });
  }

  /**
   * Create a manual rollback alert
   */
  async createRollbackAlert(
    fromStage: RolloutStage,
    toStage: RolloutStage,
    fromPercentage: number,
    toPercentage: number,
    initiatedBy: string,
    reason: string
  ): Promise<void> {
    this.lastRollbackTime = Date.now();

    await this.emitAlert({
      type: 'rollback_triggered',
      severity: 'warning',
      stage: toStage,
      percentage: toPercentage,
      message: `Manual rollback executed: ${fromStage} (${fromPercentage}%) → ${toStage} (${toPercentage}%)`,
      details: {
        fromStage,
        toStage,
        fromPercentage,
        toPercentage,
        initiatedBy,
        reason,
        automatic: false,
      },
      timestamp: new Date().toISOString(),
    });

    createManualAlert({
      name: 'Rollout Manual Rollback',
      description: `V2 rollout manually rolled back from ${fromPercentage}% to ${toPercentage}%: ${reason}`,
      severity: 'warning',
      labels: {
        automatic: 'false',
        fromPercentage: String(fromPercentage),
        toPercentage: String(toPercentage),
        initiatedBy,
      },
      notificationChannels: this.config.defaultChannels,
    });
  }

  /**
   * Create stage blocked alert
   */
  async createStageBlockedAlert(
    currentStage: RolloutStage,
    targetStage: RolloutStage,
    reason: string
  ): Promise<void> {
    await this.emitAlert({
      type: 'stage_blocked',
      severity: 'warning',
      stage: currentStage,
      percentage: DEFAULT_STAGE_CONFIGS[currentStage].percentage,
      message: `Cannot advance from ${currentStage} to ${targetStage}: ${reason}`,
      details: {
        currentStage,
        targetStage,
        reason,
      },
      timestamp: new Date().toISOString(),
    });

    createManualAlert({
      name: 'Rollout Advancement Blocked',
      description: `Attempt to advance V2 rollout from ${currentStage} to ${targetStage} was blocked: ${reason}`,
      severity: 'warning',
      labels: {
        currentStage,
        targetStage,
      },
      notificationChannels: ['slack'],
    });
  }

  // =====================================================
  // QUERY METHODS
  // =====================================================

  /**
   * Get rollout-related alerts
   */
  getRolloutAlerts(): Alert[] {
    return this.alertManager.getActiveAlerts().filter((alert) =>
      alert.labels.component === 'rollout' || alert.name.includes('Rollout')
    );
  }

  /**
   * Get alert summary for rollout
   */
  getRolloutAlertSummary(): {
    total: number;
    critical: number;
    warning: number;
    info: number;
  } {
    const alerts = this.getRolloutAlerts();
    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
    };
  }
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Get rollout alert service instance
 */
export function getRolloutAlertService(): RolloutAlertService {
  return RolloutAlertService.getInstance();
}

/**
 * Start rollout alert monitoring
 */
export function startRolloutAlertMonitoring(): void {
  RolloutAlertService.getInstance().start();
}

/**
 * Stop rollout alert monitoring
 */
export function stopRolloutAlertMonitoring(): void {
  RolloutAlertService.getInstance().stop();
}

/**
 * Get rollout alerts
 */
export function getRolloutAlerts(): Alert[] {
  return RolloutAlertService.getInstance().getRolloutAlerts();
}

/**
 * Get rollout alert summary
 */
export function getRolloutAlertSummary(): {
  total: number;
  critical: number;
  warning: number;
  info: number;
} {
  return RolloutAlertService.getInstance().getRolloutAlertSummary();
}

/**
 * Register rollout alert handler
 */
export function onRolloutAlert(handler: RolloutAlertHandler): () => void {
  return RolloutAlertService.getInstance().onAlert(handler);
}

/**
 * Create stage advancement alert
 */
export async function notifyStageAdvancement(
  fromStage: RolloutStage,
  toStage: RolloutStage,
  fromPercentage: number,
  toPercentage: number,
  initiatedBy: string
): Promise<void> {
  return RolloutAlertService.getInstance().createStageAdvancementAlert(
    fromStage,
    toStage,
    fromPercentage,
    toPercentage,
    initiatedBy
  );
}

/**
 * Create rollback alert
 */
export async function notifyRollback(
  fromStage: RolloutStage,
  toStage: RolloutStage,
  fromPercentage: number,
  toPercentage: number,
  initiatedBy: string,
  reason: string
): Promise<void> {
  return RolloutAlertService.getInstance().createRollbackAlert(
    fromStage,
    toStage,
    fromPercentage,
    toPercentage,
    initiatedBy,
    reason
  );
}

/**
 * Create stage blocked alert
 */
export async function notifyStageBlocked(
  currentStage: RolloutStage,
  targetStage: RolloutStage,
  reason: string
): Promise<void> {
  return RolloutAlertService.getInstance().createStageBlockedAlert(
    currentStage,
    targetStage,
    reason
  );
}
