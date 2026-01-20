/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Service (Simplified for v2-only)
 *
 * Service for managing Voice Agent deployment:
 * - Health monitoring
 * - Tenant-level controls (enable/disable)
 * - Emergency disable procedures
 * - History and audit logging
 *
 * NOTE: This is a v2-only architecture. The percentage-based rollout
 * has been simplified to a simple enable/disable toggle.
 *
 * @module lib/voice-agent/rollout/rollout-service
 * @version 2.0.0
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  RolloutStage,
  RolloutStatus,
  RolloutMetrics,
  RolloutHistoryEntry,
  RolloutAction,
  HealthCheckResult,
  RolloutIssue,
  AdvanceRolloutCommand,
  RollbackCommand,
  TenantRolloutCommand,
  RolloutStageConfig,
} from './types';
import { DEFAULT_STAGE_CONFIGS, STAGE_PROGRESSION } from './types';
import { getVoiceLogger } from '../monitoring/voice-logger';
import { getMetricsSummary } from '../monitoring/voice-metrics';
import { getAlertManager } from '../monitoring/alert-manager';

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Rollout service configuration
 */
export interface RolloutServiceConfig {
  /** Supabase URL */
  supabaseUrl: string;

  /** Supabase service role key */
  supabaseServiceKey: string;

  /** Feature flag name */
  featureFlagName: string;

  /** Metrics window for health checks (ms) */
  metricsWindowMs: number;

  /** Stage configurations override */
  stageConfigs?: Partial<Record<RolloutStage, Partial<RolloutStageConfig>>>;
}

const DEFAULT_CONFIG: RolloutServiceConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  featureFlagName: 'voice_agent',
  metricsWindowMs: 3600_000, // 1 hour
};

// =====================================================
// ROLLOUT SERVICE
// =====================================================

/**
 * Untyped Supabase client for tables without generated types
 */
type UntypedSupabaseClient = SupabaseClient<any, any, any>;

/**
 * Service for managing Voice Agent deployment and health
 */
export class RolloutService {
  private readonly config: RolloutServiceConfig;
  private readonly supabase: UntypedSupabaseClient;
  private readonly logger = getVoiceLogger();
  private readonly stageConfigs: Record<RolloutStage, RolloutStageConfig>;
  private static instance: RolloutService | null = null;

  constructor(config?: Partial<RolloutServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseServiceKey
    ) as UntypedSupabaseClient;

    // Merge custom stage configs with defaults
    this.stageConfigs = { ...DEFAULT_STAGE_CONFIGS };
    if (config?.stageConfigs) {
      for (const [stage, overrides] of Object.entries(config.stageConfigs)) {
        const stageKey = stage as RolloutStage;
        this.stageConfigs[stageKey] = {
          ...this.stageConfigs[stageKey],
          ...overrides,
        };
      }
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<RolloutServiceConfig>): RolloutService {
    if (!RolloutService.instance) {
      RolloutService.instance = new RolloutService(config);
    }
    return RolloutService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    RolloutService.instance = null;
  }

  // =====================================================
  // STATUS METHODS
  // =====================================================

  /**
   * Get current deployment status
   */
  async getStatus(): Promise<RolloutStatus> {
    const { data, error } = await this.supabase
      .from('platform_feature_flags')
      .select('*')
      .eq('name', this.config.featureFlagName)
      .single();

    if (error || !data) {
      this.logger.warn('Feature flag not found, returning defaults', {
        data: { flagName: this.config.featureFlagName, error: error?.message },
      });
      return this.getDefaultStatus();
    }

    // Type assertion for Supabase data
    const flagData = data as {
      enabled: boolean;
      percentage: number;
      enabled_tenants: string[] | null;
      disabled_tenants: string[] | null;
      stage_started_at: string | null;
      stage_initiated_by: string | null;
      auto_advance_enabled: boolean | null;
      metadata: Record<string, unknown> | null;
    };

    // In v2-only mode: enabled = complete (100%), disabled = disabled (0%)
    const currentStage = flagData.enabled ? 'complete' : 'disabled';
    const percentage = flagData.enabled ? 100 : 0;

    // Get history
    const history = await this.getHistory(10);

    // Get last health check from metadata
    const lastHealthCheck = flagData.metadata?.lastHealthCheck as HealthCheckResult | null;

    return {
      currentStage,
      percentage,
      enabled: flagData.enabled,
      enabledTenants: flagData.enabled_tenants ?? [],
      disabledTenants: flagData.disabled_tenants ?? [],
      stageStartedAt: flagData.stage_started_at ?? new Date().toISOString(),
      stageInitiatedBy: flagData.stage_initiated_by,
      autoAdvanceEnabled: false, // Not used in v2-only mode
      lastHealthCheck,
      history,
    };
  }

  /**
   * Get default status when flag doesn't exist
   */
  private getDefaultStatus(): RolloutStatus {
    return {
      currentStage: 'complete', // v2 is enabled by default
      percentage: 100,
      enabled: true,
      enabledTenants: [],
      disabledTenants: [],
      stageStartedAt: new Date().toISOString(),
      stageInitiatedBy: null,
      autoAdvanceEnabled: false,
      lastHealthCheck: null,
      history: [],
    };
  }

  /**
   * Convert percentage to stage (maintained for compatibility)
   */
  private percentageToStage(percentage: number): RolloutStage {
    if (percentage >= 100) return 'complete';
    if (percentage >= 50) return 'majority';
    if (percentage >= 25) return 'expansion';
    if (percentage >= 10) return 'early_adopters';
    if (percentage > 0) return 'canary';
    return 'disabled';
  }

  /**
   * Get next stage in progression
   */
  getNextStage(currentStage: RolloutStage): RolloutStage | null {
    const currentIndex = STAGE_PROGRESSION.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex >= STAGE_PROGRESSION.length - 1) {
      return null;
    }
    return STAGE_PROGRESSION[currentIndex + 1];
  }

  /**
   * Get previous stage in progression
   */
  getPreviousStage(currentStage: RolloutStage): RolloutStage | null {
    const currentIndex = STAGE_PROGRESSION.indexOf(currentStage);
    if (currentIndex <= 0) {
      return null;
    }
    return STAGE_PROGRESSION[currentIndex - 1];
  }

  // =====================================================
  // TENANT CHECK
  // =====================================================

  /**
   * Check if voice agent is enabled for a tenant
   */
  async shouldUseV2(tenantId: string): Promise<boolean> {
    const status = await this.getStatus();

    // If globally disabled
    if (!status.enabled) {
      return false;
    }

    // If tenant is explicitly disabled
    if (status.disabledTenants.includes(tenantId)) {
      return false;
    }

    // If tenant is explicitly enabled (or global is enabled)
    return true;
  }

  // =====================================================
  // HEALTH CHECK
  // =====================================================

  /**
   * Perform health check for voice agent
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const status = await this.getStatus();
    const stageConfig = this.stageConfigs[status.currentStage];

    // Get metrics (v2-only, no comparison needed)
    const v2Metrics = await this.getVoiceMetrics();

    // Check for issues
    const issues = this.checkForIssues(v2Metrics, stageConfig);

    // Determine health status
    const healthy = issues.filter((i) => i.severity === 'critical').length === 0;

    // Check if should disable (emergency)
    const shouldRollback = this.shouldTriggerEmergencyDisable(v2Metrics, stageConfig);

    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      healthy,
      canAdvance: true, // Always true in v2-only mode (no stages to advance)
      shouldRollback,
      v2Metrics,
      v1Metrics: this.getEmptyMetrics(), // No v1 metrics in v2-only mode
      issues,
    };

    // Store health check result
    await this.storeHealthCheckResult(result);

    // Log the check
    this.logger.info('Voice agent health check completed', {
      data: {
        healthy,
        shouldRollback,
        issueCount: issues.length,
        errorRate: v2Metrics.errorRate,
        p95Latency: v2Metrics.p95LatencyMs,
      },
    });

    return result;
  }

  /**
   * Get voice agent metrics
   */
  private async getVoiceMetrics(): Promise<RolloutMetrics> {
    const since = new Date(Date.now() - this.config.metricsWindowMs).toISOString();

    try {
      const { data, error } = await this.supabase
        .from('voice_calls')
        .select('id, status, latency_avg_ms, ended_reason')
        .gte('created_at', since);

      if (error) {
        this.logger.error('Failed to fetch voice metrics', error);
        return this.getEmptyMetrics();
      }

      type CallRecord = {
        id: string;
        status: string;
        latency_avg_ms: number | null;
        ended_reason: string | null;
      };

      const calls = (data ?? []) as CallRecord[];
      const totalCalls = calls.length;

      if (totalCalls === 0) {
        return this.getEmptyMetrics();
      }

      const successfulCalls = calls.filter(
        (c) => c.status === 'completed' || c.ended_reason === 'assistant-forwarded-call'
      ).length;
      const failedCalls = calls.filter((c) => c.status === 'failed').length;
      const errorRate = failedCalls / totalCalls;

      // Calculate latency percentiles
      const latencies = calls
        .filter((c) => c.latency_avg_ms != null)
        .map((c) => c.latency_avg_ms as number)
        .sort((a, b) => a - b);

      const avgLatencyMs = latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;

      // Get circuit breaker opens from alerts
      const alertManager = getAlertManager();
      const circuitBreakerOpens = alertManager.getAlertHistory()
        .filter((a) =>
          a.name.includes('Circuit Breaker') &&
          new Date(a.firedAt) > new Date(since)
        ).length;

      // Get active calls from metrics
      const metricsSummary = getMetricsSummary();

      return {
        totalCalls,
        successfulCalls,
        failedCalls,
        errorRate,
        avgLatencyMs,
        p50LatencyMs: this.percentile(latencies, 50),
        p95LatencyMs: this.percentile(latencies, 95),
        p99LatencyMs: this.percentile(latencies, 99),
        circuitBreakerOpens,
        activeCalls: metricsSummary.activeCalls,
      };
    } catch (error) {
      this.logger.error('Error calculating voice metrics', error as Error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Get empty metrics object
   */
  private getEmptyMetrics(): RolloutMetrics {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      circuitBreakerOpens: 0,
      activeCalls: 0,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] ?? 0;
  }

  /**
   * Check for issues in metrics
   */
  private checkForIssues(metrics: RolloutMetrics, stageConfig: RolloutStageConfig): RolloutIssue[] {
    const issues: RolloutIssue[] = [];
    const { noGoCriteria, goCriteria } = stageConfig;

    // Check error rate
    if (metrics.errorRate > noGoCriteria.maxErrorRate) {
      issues.push({
        severity: 'critical',
        type: 'error_rate',
        message: `Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds critical threshold ${(noGoCriteria.maxErrorRate * 100).toFixed(2)}%`,
        currentValue: metrics.errorRate,
        thresholdValue: noGoCriteria.maxErrorRate,
        recommendedAction: 'Consider disabling voice agent or investigation',
      });
    } else if (metrics.errorRate > goCriteria.maxErrorRate) {
      issues.push({
        severity: 'warning',
        type: 'error_rate',
        message: `Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds warning threshold ${(goCriteria.maxErrorRate * 100).toFixed(2)}%`,
        currentValue: metrics.errorRate,
        thresholdValue: goCriteria.maxErrorRate,
        recommendedAction: 'Monitor closely',
      });
    }

    // Check latency
    if (metrics.p95LatencyMs > noGoCriteria.maxP95LatencyMs) {
      issues.push({
        severity: 'critical',
        type: 'latency',
        message: `p95 latency ${metrics.p95LatencyMs}ms exceeds critical threshold ${noGoCriteria.maxP95LatencyMs}ms`,
        currentValue: metrics.p95LatencyMs,
        thresholdValue: noGoCriteria.maxP95LatencyMs,
        recommendedAction: 'Investigate latency issues immediately',
      });
    } else if (metrics.p95LatencyMs > goCriteria.maxP95LatencyMs) {
      issues.push({
        severity: 'warning',
        type: 'latency',
        message: `p95 latency ${metrics.p95LatencyMs}ms exceeds warning threshold ${goCriteria.maxP95LatencyMs}ms`,
        currentValue: metrics.p95LatencyMs,
        thresholdValue: goCriteria.maxP95LatencyMs,
        recommendedAction: 'Monitor latency',
      });
    }

    // Check circuit breakers
    if (metrics.circuitBreakerOpens > noGoCriteria.maxCircuitBreakerOpens) {
      issues.push({
        severity: 'critical',
        type: 'circuit_breaker',
        message: `${metrics.circuitBreakerOpens} circuit breaker opens exceed threshold ${noGoCriteria.maxCircuitBreakerOpens}`,
        currentValue: metrics.circuitBreakerOpens,
        thresholdValue: noGoCriteria.maxCircuitBreakerOpens,
        recommendedAction: 'Immediate investigation required',
      });
    }

    // Check failed calls rate
    const failedCallsRate = metrics.totalCalls > 0
      ? metrics.failedCalls / metrics.totalCalls
      : 0;

    if (failedCallsRate > noGoCriteria.maxFailedCallsRate) {
      issues.push({
        severity: 'critical',
        type: 'failed_calls',
        message: `Failed calls rate ${(failedCallsRate * 100).toFixed(2)}% exceeds threshold ${(noGoCriteria.maxFailedCallsRate * 100).toFixed(2)}%`,
        currentValue: failedCallsRate,
        thresholdValue: noGoCriteria.maxFailedCallsRate,
        recommendedAction: 'Investigate call failures',
      });
    }

    return issues;
  }

  /**
   * Check if should trigger emergency disable
   */
  private shouldTriggerEmergencyDisable(
    metrics: RolloutMetrics,
    stageConfig: RolloutStageConfig
  ): boolean {
    const { noGoCriteria } = stageConfig;

    if (metrics.errorRate > noGoCriteria.maxErrorRate) return true;
    if (metrics.p95LatencyMs > noGoCriteria.maxP95LatencyMs) return true;
    if (metrics.circuitBreakerOpens > noGoCriteria.maxCircuitBreakerOpens) return true;

    const failedCallsRate = metrics.totalCalls > 0
      ? metrics.failedCalls / metrics.totalCalls
      : 0;
    if (failedCallsRate > noGoCriteria.maxFailedCallsRate) return true;

    return false;
  }

  /**
   * Store health check result in metadata
   */
  private async storeHealthCheckResult(result: HealthCheckResult): Promise<void> {
    try {
      const { data: current } = await this.supabase
        .from('platform_feature_flags')
        .select('metadata')
        .eq('name', this.config.featureFlagName)
        .single();

      const currentData = current as { metadata?: Record<string, unknown> } | null;
      const currentMetadata = currentData?.metadata ?? {};

      await this.supabase
        .from('platform_feature_flags')
        .update({
          metadata: {
            ...currentMetadata,
            lastHealthCheck: result,
          },
        } as any)
        .eq('name', this.config.featureFlagName);
    } catch (error) {
      this.logger.error('Failed to store health check result', error as Error);
    }
  }

  // =====================================================
  // CONTROL METHODS
  // =====================================================

  /**
   * Enable/advance voice agent
   */
  async advanceRollout(command: AdvanceRolloutCommand): Promise<{
    success: boolean;
    newStatus: RolloutStatus;
    error?: string;
  }> {
    const status = await this.getStatus();

    // In v2-only mode, advance means enable
    const targetPercentage = 100;
    const targetStage: RolloutStage = 'complete';

    // Validate if not skipping health check
    if (!command.skipHealthCheck) {
      const healthCheck = await this.performHealthCheck();

      if (healthCheck.shouldRollback) {
        return {
          success: false,
          newStatus: status,
          error: 'Health check failed - cannot enable',
        };
      }
    }

    // Update the flag
    const { error } = await this.supabase
      .from('platform_feature_flags')
      .upsert({
        name: this.config.featureFlagName,
        percentage: targetPercentage,
        enabled: true,
        stage_started_at: new Date().toISOString(),
        stage_initiated_by: command.initiatedBy,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'name',
      });

    if (error) {
      return {
        success: false,
        newStatus: status,
        error: `Database error: ${error.message}`,
      };
    }

    // Log history
    await this.logHistoryEntry({
      action: 'advance',
      fromStage: status.currentStage,
      toStage: targetStage,
      fromPercentage: status.percentage,
      toPercentage: targetPercentage,
      initiatedBy: command.initiatedBy,
      reason: command.reason,
    });

    this.logger.info('Voice agent enabled', {
      data: {
        fromStage: status.currentStage,
        toStage: targetStage,
        initiatedBy: command.initiatedBy,
      },
    });

    const newStatus = await this.getStatus();
    return { success: true, newStatus };
  }

  /**
   * Execute emergency disable or tenant disable
   */
  async executeRollback(command: RollbackCommand): Promise<{
    success: boolean;
    newStatus: RolloutStatus;
    error?: string;
  }> {
    const status = await this.getStatus();

    switch (command.level) {
      case 'tenant':
        return this.disableTenant(command, status);
      case 'partial':
      case 'total':
        return this.disableGlobally(command, status);
      default:
        return {
          success: false,
          newStatus: status,
          error: `Unknown rollback level: ${command.level}`,
        };
    }
  }

  /**
   * Disable voice agent for a specific tenant
   */
  private async disableTenant(
    command: RollbackCommand,
    status: RolloutStatus
  ): Promise<{ success: boolean; newStatus: RolloutStatus; error?: string }> {
    if (!command.tenantId) {
      return {
        success: false,
        newStatus: status,
        error: 'Tenant ID required for tenant-level disable',
      };
    }

    const disabledTenants = [...status.disabledTenants];
    if (!disabledTenants.includes(command.tenantId)) {
      disabledTenants.push(command.tenantId);
    }

    const { error } = await this.supabase
      .from('platform_feature_flags')
      .update({
        disabled_tenants: disabledTenants,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('name', this.config.featureFlagName);

    if (error) {
      return { success: false, newStatus: status, error: error.message };
    }

    await this.logHistoryEntry({
      action: 'rollback_tenant',
      fromStage: status.currentStage,
      toStage: status.currentStage,
      fromPercentage: status.percentage,
      toPercentage: status.percentage,
      initiatedBy: command.initiatedBy,
      reason: `Tenant ${command.tenantId} disabled: ${command.reason}`,
    });

    this.logger.warn('Tenant disabled for voice agent', {
      data: {
        tenantId: command.tenantId,
        reason: command.reason,
        initiatedBy: command.initiatedBy,
      },
    });

    const newStatus = await this.getStatus();
    return { success: true, newStatus };
  }

  /**
   * Disable voice agent globally (emergency)
   */
  private async disableGlobally(
    command: RollbackCommand,
    status: RolloutStatus
  ): Promise<{ success: boolean; newStatus: RolloutStatus; error?: string }> {
    const { error } = await this.supabase
      .from('platform_feature_flags')
      .update({
        percentage: 0,
        enabled: false,
        stage_started_at: new Date().toISOString(),
        stage_initiated_by: command.initiatedBy,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('name', this.config.featureFlagName);

    if (error) {
      return { success: false, newStatus: status, error: error.message };
    }

    await this.logHistoryEntry({
      action: 'rollback_total',
      fromStage: status.currentStage,
      toStage: 'disabled',
      fromPercentage: status.percentage,
      toPercentage: 0,
      initiatedBy: command.initiatedBy,
      reason: command.reason,
    });

    this.logger.error('VOICE AGENT EMERGENCY DISABLED', null, {
      data: {
        fromPercentage: status.percentage,
        reason: command.reason,
        initiatedBy: command.initiatedBy,
      },
    });

    // Create critical alert
    try {
      const alertManager = getAlertManager();
      alertManager.createManualAlert({
        name: 'Voice Agent Emergency Disabled',
        description: `Voice agent disabled: ${command.reason}`,
        severity: 'critical',
        labels: { initiatedBy: command.initiatedBy },
        notificationChannels: ['slack', 'pagerduty'],
      });
    } catch {
      // Alert manager may not be available
    }

    const newStatus = await this.getStatus();
    return { success: true, newStatus };
  }

  /**
   * Update tenant status (enable/disable)
   */
  async updateTenantStatus(command: TenantRolloutCommand): Promise<{
    success: boolean;
    newStatus: RolloutStatus;
    error?: string;
  }> {
    const status = await this.getStatus();

    let enabledTenants = [...status.enabledTenants];
    let disabledTenants = [...status.disabledTenants];

    if (command.action === 'enable') {
      // Remove from disabled, add to enabled
      disabledTenants = disabledTenants.filter((t) => t !== command.tenantId);
      if (!enabledTenants.includes(command.tenantId)) {
        enabledTenants.push(command.tenantId);
      }
    } else {
      // Remove from enabled, add to disabled
      enabledTenants = enabledTenants.filter((t) => t !== command.tenantId);
      if (!disabledTenants.includes(command.tenantId)) {
        disabledTenants.push(command.tenantId);
      }
    }

    const { error } = await this.supabase
      .from('platform_feature_flags')
      .update({
        enabled_tenants: enabledTenants,
        disabled_tenants: disabledTenants,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('name', this.config.featureFlagName);

    if (error) {
      return { success: false, newStatus: status, error: error.message };
    }

    await this.logHistoryEntry({
      action: command.action === 'enable' ? 'enable_tenant' : 'rollback_tenant',
      fromStage: status.currentStage,
      toStage: status.currentStage,
      fromPercentage: status.percentage,
      toPercentage: status.percentage,
      initiatedBy: command.initiatedBy,
      reason: `Tenant ${command.tenantId} ${command.action}d: ${command.reason}`,
    });

    this.logger.info(`Tenant ${command.action}d for voice agent`, {
      data: {
        tenantId: command.tenantId,
        action: command.action,
        reason: command.reason,
        initiatedBy: command.initiatedBy,
      },
    });

    const newStatus = await this.getStatus();
    return { success: true, newStatus };
  }

  // =====================================================
  // HISTORY METHODS
  // =====================================================

  /**
   * Get deployment history
   */
  async getHistory(limit: number = 50): Promise<RolloutHistoryEntry[]> {
    const { data, error } = await this.supabase
      .from('rollout_history')
      .select('*')
      .eq('feature_flag', this.config.featureFlagName)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    type HistoryRecord = {
      id: string;
      created_at: string;
      action: RolloutAction;
      from_stage: RolloutStage;
      to_stage: RolloutStage;
      from_percentage: number;
      to_percentage: number;
      initiated_by: string | null;
      reason: string;
      health_metrics: RolloutMetrics | null;
    };

    return (data as HistoryRecord[]).map((row) => ({
      id: row.id,
      timestamp: row.created_at,
      action: row.action,
      fromStage: row.from_stage,
      toStage: row.to_stage,
      fromPercentage: row.from_percentage,
      toPercentage: row.to_percentage,
      initiatedBy: row.initiated_by,
      reason: row.reason,
      healthMetrics: row.health_metrics ?? undefined,
    }));
  }

  /**
   * Log a history entry
   */
  private async logHistoryEntry(
    entry: Omit<RolloutHistoryEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    let healthMetrics: RolloutMetrics | undefined;
    try {
      healthMetrics = await this.getVoiceMetrics();
    } catch {
      // Metrics may not be available
    }

    const { error } = await this.supabase
      .from('rollout_history')
      .insert({
        feature_flag: this.config.featureFlagName,
        action: entry.action,
        from_stage: entry.fromStage,
        to_stage: entry.toStage,
        from_percentage: entry.fromPercentage,
        to_percentage: entry.toPercentage,
        initiated_by: entry.initiatedBy,
        reason: entry.reason,
        health_metrics: healthMetrics,
      } as any);

    if (error) {
      this.logger.error('Failed to log history', error);
    }
  }

  // =====================================================
  // TENANT STATS
  // =====================================================

  /**
   * Get tenant statistics
   */
  async getTenantStats(): Promise<{
    total: number;
    onV2: number;
    onV1: number;
    explicitlyEnabled: number;
    explicitlyDisabled: number;
  }> {
    const status = await this.getStatus();

    // Get total tenant count (TIS TIS uses tenants table, not businesses)
    const { count: totalCount } = await this.supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true });

    const total = totalCount ?? 0;

    // In v2-only mode: all tenants are on v2 except explicitly disabled
    const onV2 = status.enabled
      ? total - status.disabledTenants.length
      : status.enabledTenants.length;

    return {
      total,
      onV2: Math.max(0, onV2),
      onV1: Math.max(0, total - onV2), // "v1" = disabled
      explicitlyEnabled: status.enabledTenants.length,
      explicitlyDisabled: status.disabledTenants.length,
    };
  }
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Get rollout service instance
 */
export function getRolloutService(): RolloutService {
  return RolloutService.getInstance();
}

/**
 * Check if voice agent is enabled for tenant
 */
export async function shouldUseVoiceAgentV2(tenantId: string): Promise<boolean> {
  return RolloutService.getInstance().shouldUseV2(tenantId);
}

/**
 * Get current deployment status
 */
export async function getRolloutStatus(): Promise<RolloutStatus> {
  return RolloutService.getInstance().getStatus();
}

/**
 * Perform health check
 */
export async function performRolloutHealthCheck(): Promise<HealthCheckResult> {
  return RolloutService.getInstance().performHealthCheck();
}

/**
 * Enable voice agent
 */
export async function advanceRollout(command: AdvanceRolloutCommand): Promise<{
  success: boolean;
  newStatus: RolloutStatus;
  error?: string;
}> {
  return RolloutService.getInstance().advanceRollout(command);
}

/**
 * Disable voice agent
 */
export async function executeRollback(command: RollbackCommand): Promise<{
  success: boolean;
  newStatus: RolloutStatus;
  error?: string;
}> {
  return RolloutService.getInstance().executeRollback(command);
}

/**
 * Update tenant status
 */
export async function updateTenantRolloutStatus(command: TenantRolloutCommand): Promise<{
  success: boolean;
  newStatus: RolloutStatus;
  error?: string;
}> {
  return RolloutService.getInstance().updateTenantStatus(command);
}

/**
 * Get deployment history
 */
export async function getRolloutHistory(limit?: number): Promise<RolloutHistoryEntry[]> {
  return RolloutService.getInstance().getHistory(limit);
}

/**
 * Get tenant stats
 */
export async function getTenantRolloutStats(): Promise<{
  total: number;
  onV2: number;
  onV1: number;
  explicitlyEnabled: number;
  explicitlyDisabled: number;
}> {
  return RolloutService.getInstance().getTenantStats();
}
