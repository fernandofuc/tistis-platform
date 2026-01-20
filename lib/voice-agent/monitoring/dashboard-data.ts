/**
 * TIS TIS Platform - Voice Agent v2.0
 * Dashboard Data Service
 *
 * Provides aggregated data for the rollout dashboard:
 * - Feature flags status
 * - V1 vs V2 comparison metrics
 * - Active alerts
 * - Health check results
 * - Real-time metrics summary
 *
 * @module lib/voice-agent/monitoring/dashboard-data
 */

import type {
  RolloutDashboardData,
  VersionStats,
  HealthCheckResponse,
  HealthStatus,
  ServiceHealth,
  Alert,
} from './types';
import { getMetricsSummary, getMetricsRegistry } from './voice-metrics';
import { getAlertManager } from './alert-manager';
import { getVoiceLogger } from './voice-logger';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /** Supabase URL */
  supabaseUrl: string;

  /** Supabase service role key */
  supabaseServiceKey: string;

  /** API version being monitored */
  apiVersion: 'v1' | 'v2' | 'both';

  /** Time window for metrics in ms */
  metricsWindowMs: number;

  /** Service version string */
  serviceVersion: string;

  /** Start time for uptime calculation */
  startTime: number;
}

/**
 * Feature flags status from database
 */
interface FeatureFlagsStatus {
  enabled: boolean;
  percentage: number;
  enabledTenants: string[];
  disabledTenants: string[];
  updatedAt: string;
  updatedBy: string | null;
}

// =====================================================
// DEFAULT CONFIGURATION
// =====================================================

const DEFAULT_CONFIG: DashboardConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  apiVersion: 'both',
  metricsWindowMs: 3600_000, // 1 hour
  serviceVersion: process.env.APP_VERSION ?? '2.0.0',
  startTime: Date.now(),
};

// =====================================================
// DASHBOARD DATA SERVICE
// =====================================================

/**
 * Service for fetching and aggregating dashboard data
 */
export class DashboardDataService {
  private readonly config: DashboardConfig;
  private readonly supabase: ReturnType<typeof createClient>;
  private static instance: DashboardDataService | null = null;
  private readonly logger = getVoiceLogger();

  constructor(config?: Partial<DashboardConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseServiceKey
    );
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<DashboardConfig>): DashboardDataService {
    if (!DashboardDataService.instance) {
      DashboardDataService.instance = new DashboardDataService(config);
    }
    return DashboardDataService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    DashboardDataService.instance = null;
  }

  // =====================================================
  // MAIN DATA METHODS
  // =====================================================

  /**
   * Get complete rollout dashboard data
   */
  async getRolloutDashboardData(): Promise<RolloutDashboardData> {
    const startTime = Date.now();

    try {
      const [featureFlags, versionComparison, alerts, health] = await Promise.all([
        this.getFeatureFlagsStatus(),
        this.getVersionComparison(),
        this.getActiveAlerts(),
        this.getHealthCheck(),
      ]);

      const dashboardData: RolloutDashboardData = {
        featureFlags: {
          enabled: featureFlags.enabled,
          percentage: featureFlags.percentage,
          enabledTenants: featureFlags.enabledTenants.length,
          disabledTenants: featureFlags.disabledTenants.length,
        },
        versionComparison,
        alerts,
        health,
        lastUpdated: new Date().toISOString(),
      };

      this.logger.debug('Dashboard data fetched', {
        durationMs: Date.now() - startTime,
        data: {
          alertsCount: alerts.length,
          healthStatus: health.status,
        },
      });

      return dashboardData;
    } catch (error) {
      this.logger.error('Failed to fetch dashboard data', error as Error);
      throw error;
    }
  }

  // =====================================================
  // FEATURE FLAGS
  // =====================================================

  /**
   * Get feature flags status from database
   */
  async getFeatureFlagsStatus(): Promise<FeatureFlagsStatus> {
    try {
      const { data, error } = await this.supabase
        .from('platform_feature_flags')
        .select('*')
        .eq('name', 'voice_agent_v2')
        .single();

      if (error) {
        this.logger.warn('Failed to fetch feature flags from database', {
          data: { error: error.message },
        });
        // Return defaults if not found
        return {
          enabled: false,
          percentage: 0,
          enabledTenants: [],
          disabledTenants: [],
          updatedAt: new Date().toISOString(),
          updatedBy: null,
        };
      }

      // Type assertion for Supabase data
      const typedData = data as {
        enabled?: boolean;
        percentage?: number;
        enabled_tenants?: string[];
        disabled_tenants?: string[];
        updated_at: string;
        updated_by: string | null;
      };

      return {
        enabled: typedData.enabled ?? false,
        percentage: typedData.percentage ?? 0,
        enabledTenants: typedData.enabled_tenants ?? [],
        disabledTenants: typedData.disabled_tenants ?? [],
        updatedAt: typedData.updated_at,
        updatedBy: typedData.updated_by,
      };
    } catch (error) {
      this.logger.error('Error fetching feature flags', error as Error);
      throw error;
    }
  }

  /**
   * Get tenant count using V2
   */
  async getTenantsOnV2Count(): Promise<{ onV2: number; total: number }> {
    try {
      // Get total tenants (TIS TIS uses tenants table, not businesses)
      const { count: totalCount, error: totalError } = await this.supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        throw totalError;
      }

      // Get tenants with v2 calls in last hour
      const oneHourAgo = new Date(Date.now() - this.config.metricsWindowMs).toISOString();
      const { data: v2Calls, error: v2Error } = await this.supabase
        .from('voice_calls')
        .select('tenant_id')
        .eq('api_version', 'v2')
        .gte('created_at', oneHourAgo);

      if (v2Error) {
        throw v2Error;
      }

      const typedV2Calls = v2Calls as Array<{ tenant_id: string }> | null;
      const uniqueV2Tenants = new Set(typedV2Calls?.map((c) => c.tenant_id) ?? []);

      return {
        onV2: uniqueV2Tenants.size,
        total: totalCount ?? 0,
      };
    } catch (error) {
      this.logger.error('Error fetching tenant counts', error as Error);
      return { onV2: 0, total: 0 };
    }
  }

  // =====================================================
  // VERSION COMPARISON
  // =====================================================

  /**
   * Get V1 vs V2 comparison stats
   */
  async getVersionComparison(): Promise<{ v1: VersionStats; v2: VersionStats }> {
    const oneHourAgo = new Date(Date.now() - this.config.metricsWindowMs).toISOString();

    const [v1Stats, v2Stats] = await Promise.all([
      this.getVersionStats('v1', oneHourAgo),
      this.getVersionStats('v2', oneHourAgo),
    ]);

    return { v1: v1Stats, v2: v2Stats };
  }

  /**
   * Get stats for a specific API version
   */
  private async getVersionStats(version: 'v1' | 'v2', since: string): Promise<VersionStats> {
    try {
      const { data, error } = await this.supabase
        .from('voice_calls')
        .select('id, status, duration_seconds, latency_ms, ended_reason, created_at')
        .eq('api_version', version)
        .gte('created_at', since);

      if (error) {
        throw error;
      }

      // Type assertion for Supabase data
      type VoiceCallRecord = {
        id: string;
        status: string;
        duration_seconds: number | null;
        latency_ms: number | null;
        ended_reason: string | null;
        created_at: string;
      };

      const calls = (data ?? []) as VoiceCallRecord[];
      const totalCalls = calls.length;

      if (totalCalls === 0) {
        return this.getEmptyVersionStats();
      }

      // Calculate stats
      const successfulCalls = calls.filter((c) =>
        c.status === 'completed' || c.ended_reason === 'assistant-forwarded-call'
      ).length;
      const failedCalls = totalCalls - successfulCalls;
      const errorRate = totalCalls > 0 ? failedCalls / totalCalls : 0;

      // Latency stats
      const latencies = calls
        .filter((c) => c.latency_ms != null)
        .map((c) => c.latency_ms as number)
        .sort((a, b) => a - b);

      const avgLatencyMs = latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;

      const p50LatencyMs = this.percentile(latencies, 50);
      const p95LatencyMs = this.percentile(latencies, 95);
      const p99LatencyMs = this.percentile(latencies, 99);

      // Duration stats
      const durations = calls
        .filter((c) => c.duration_seconds != null)
        .map((c) => c.duration_seconds as number);

      const avgDurationSeconds = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

      // Transfer rate
      const transfers = calls.filter((c) => c.ended_reason === 'assistant-forwarded-call').length;
      const transferRate = totalCalls > 0 ? transfers / totalCalls : 0;

      return {
        totalCalls,
        successfulCalls,
        failedCalls,
        errorRate,
        avgLatencyMs,
        p50LatencyMs,
        p95LatencyMs,
        p99LatencyMs,
        avgDurationSeconds,
        transferRate,
      };
    } catch (error) {
      this.logger.error(`Error fetching ${version} stats`, error as Error);
      return this.getEmptyVersionStats();
    }
  }

  /**
   * Get empty version stats
   */
  private getEmptyVersionStats(): VersionStats {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      avgDurationSeconds: 0,
      transferRate: 0,
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

  // =====================================================
  // ALERTS
  // =====================================================

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return getAlertManager().getActiveAlerts();
  }

  // =====================================================
  // HEALTH CHECK
  // =====================================================

  /**
   * Perform health check
   */
  async getHealthCheck(): Promise<HealthCheckResponse> {
    const startTime = Date.now();

    const [database, vapi, langgraph, circuitBreaker] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkVapiHealth(),
      this.checkLangGraphHealth(),
      this.checkCircuitBreakerHealth(),
    ]);

    const services = {
      database,
      vapi,
      langgraph,
      circuitBreaker,
    };

    // Determine overall status
    const statuses = Object.values(services);
    let overallStatus: HealthStatus = 'healthy';

    if (statuses.some((s) => s.status === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.some((s) => s.status === 'degraded')) {
      overallStatus = 'degraded';
    }

    // Get metrics summary
    const metricsSummary = getMetricsSummary();

    // Get alert count
    const alertSummary = getAlertManager().getAlertSummary();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: this.config.serviceVersion,
      apiVersion: 'v2',
      uptimeSeconds: Math.floor((Date.now() - this.config.startTime) / 1000),
      services,
      metrics: {
        activeCalls: metricsSummary.activeCalls,
        callsLastHour: metricsSummary.totalCalls,
        errorRatePercent: metricsSummary.errorRate * 100,
        avgLatencyMs: metricsSummary.avgLatencyMs,
        p95LatencyMs: metricsSummary.p95LatencyMs,
      },
      activeAlerts: alertSummary.total,
    };
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    const name = 'database';

    try {
      const { error } = await this.supabase
        .from('platform_feature_flags')
        .select('id')
        .limit(1);

      const latencyMs = Date.now() - start;

      if (error) {
        return {
          name,
          status: 'unhealthy',
          latencyMs,
          lastCheck: new Date().toISOString(),
          error: error.message,
        };
      }

      return {
        name,
        status: latencyMs > 500 ? 'degraded' : 'healthy',
        latencyMs,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check VAPI health (simplified check)
   */
  private async checkVapiHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    const name = 'vapi';

    // In a real implementation, this would ping VAPI's health endpoint
    // For now, we check if the API key is configured
    const hasApiKey = Boolean(process.env.VAPI_API_KEY);

    return {
      name,
      status: hasApiKey ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
      lastCheck: new Date().toISOString(),
      details: {
        configured: hasApiKey,
      },
    };
  }

  /**
   * Check LangGraph health (simplified check)
   */
  private async checkLangGraphHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    const name = 'langgraph';

    // In a real implementation, this would check LangGraph service
    // For now, we check if the required env vars are configured
    const hasConfig = Boolean(
      process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    );

    return {
      name,
      status: hasConfig ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
      lastCheck: new Date().toISOString(),
      details: {
        configured: hasConfig,
      },
    };
  }

  /**
   * Check circuit breaker health
   */
  private checkCircuitBreakerHealth(): ServiceHealth {
    const start = Date.now();
    const name = 'circuitBreaker';

    // Check circuit breaker state from metrics
    const registry = getMetricsRegistry();
    const cbMetric = registry.getMetric('voice_circuit_breaker_state');

    let status: HealthStatus = 'healthy';
    let state = 'CLOSED';

    if (cbMetric && cbMetric.type === 'gauge') {
      const value = cbMetric.value;
      if (value === 2) {
        status = 'unhealthy';
        state = 'OPEN';
      } else if (value === 1) {
        status = 'degraded';
        state = 'HALF_OPEN';
      }
    }

    return {
      name,
      status,
      latencyMs: Date.now() - start,
      lastCheck: new Date().toISOString(),
      details: {
        state,
      },
    };
  }

  // =====================================================
  // REAL-TIME METRICS
  // =====================================================

  /**
   * Get real-time metrics from in-memory registry
   */
  getRealTimeMetrics(): ReturnType<typeof getMetricsSummary> {
    return getMetricsSummary();
  }

  /**
   * Get metrics for a specific time window
   */
  async getMetricsForWindow(windowMs: number): Promise<{
    calls: number;
    errors: number;
    avgLatency: number;
    p95Latency: number;
  }> {
    const since = new Date(Date.now() - windowMs).toISOString();

    try {
      const { data, error } = await this.supabase
        .from('voice_calls')
        .select('status, latency_ms')
        .eq('api_version', 'v2')
        .gte('created_at', since);

      if (error) {
        throw error;
      }

      // Type assertion for Supabase data
      type WindowedCallRecord = {
        status: string;
        latency_ms: number | null;
      };

      const calls = (data ?? []) as WindowedCallRecord[];
      const errors = calls.filter((c) => c.status === 'failed').length;
      const latencies = calls
        .filter((c) => c.latency_ms != null)
        .map((c) => c.latency_ms as number)
        .sort((a, b) => a - b);

      return {
        calls: calls.length,
        errors,
        avgLatency: latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0,
        p95Latency: this.percentile(latencies, 95),
      };
    } catch (error) {
      this.logger.error('Error fetching windowed metrics', error as Error);
      return { calls: 0, errors: 0, avgLatency: 0, p95Latency: 0 };
    }
  }
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Get dashboard data service instance
 */
export function getDashboardDataService(): DashboardDataService {
  return DashboardDataService.getInstance();
}

/**
 * Get complete rollout dashboard data
 */
export async function getRolloutDashboardData(): Promise<RolloutDashboardData> {
  return DashboardDataService.getInstance().getRolloutDashboardData();
}

/**
 * Get version comparison stats
 */
export async function getVersionComparison(): Promise<{ v1: VersionStats; v2: VersionStats }> {
  return DashboardDataService.getInstance().getVersionComparison();
}

/**
 * Get health check response
 */
export async function getHealthCheck(): Promise<HealthCheckResponse> {
  return DashboardDataService.getInstance().getHealthCheck();
}

/**
 * Get real-time metrics summary
 */
export function getRealTimeMetrics(): ReturnType<typeof getMetricsSummary> {
  return DashboardDataService.getInstance().getRealTimeMetrics();
}
