/**
 * TIS TIS Platform - Voice Agent v2.0
 * Health Check API Endpoint
 *
 * Provides health status for the Voice Agent v2 system.
 * Used by:
 * - Load balancers for routing decisions
 * - Monitoring systems for uptime tracking
 * - Admin dashboards for status display
 * - Kubernetes for liveness/readiness probes
 *
 * @module app/api/voice/health
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { HealthCheckResponse, HealthStatus, ServiceHealth } from '@/lib/voice-agent/monitoring/types';
import { getMetricsSummary, getMetricsRegistry } from '@/lib/voice-agent/monitoring/voice-metrics';
import { getAlertManager } from '@/lib/voice-agent/monitoring/alert-manager';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Track service start time for uptime calculation
const SERVICE_START_TIME = Date.now();

// Service version from env or default
const SERVICE_VERSION = process.env.APP_VERSION ?? '2.0.0';

/**
 * Create Supabase client with service role for health checks
 */
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =====================================================
// GET - Health Check
// =====================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';
    const checkType = url.searchParams.get('type') ?? 'full'; // 'liveness', 'readiness', 'full'

    // For Kubernetes liveness probe - just check if service is alive
    if (checkType === 'liveness') {
      return NextResponse.json(
        { status: 'healthy', timestamp: new Date().toISOString() },
        { status: 200 }
      );
    }

    // For readiness probe or full check - check all services
    const healthCheck = await performHealthCheck(detailed);

    // Determine HTTP status code
    const httpStatus = healthCheck.status === 'unhealthy' ? 503 : 200;

    // Add response headers for caching and monitoring
    const headers = new Headers();
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('X-Health-Status', healthCheck.status);
    headers.set('X-Response-Time', `${Date.now() - startTime}ms`);

    return NextResponse.json(healthCheck, { status: httpStatus, headers });
  } catch (error) {
    console.error('[Voice Health] Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: SERVICE_VERSION,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 503 }
    );
  }
}

// =====================================================
// HEALTH CHECK IMPLEMENTATION
// =====================================================

/**
 * Perform comprehensive health check
 */
async function performHealthCheck(detailed: boolean): Promise<HealthCheckResponse> {
  // Run all health checks in parallel
  const [database, vapi, langgraph, circuitBreaker] = await Promise.all([
    checkDatabaseHealth(),
    checkVapiHealth(),
    checkLangGraphHealth(),
    checkCircuitBreakerHealth(),
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

  // Any unhealthy service makes the whole system unhealthy
  if (statuses.some((s) => s.status === 'unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (statuses.some((s) => s.status === 'degraded')) {
    overallStatus = 'degraded';
  }

  // Get metrics summary
  const metricsSummary = getMetricsSummary();

  // Get alert count
  let activeAlertsCount = 0;
  try {
    const alertManager = getAlertManager();
    activeAlertsCount = alertManager.getAlertSummary().total;
  } catch {
    // Alert manager may not be initialized
  }

  // Build response
  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: SERVICE_VERSION,
    apiVersion: 'v2',
    uptimeSeconds: Math.floor((Date.now() - SERVICE_START_TIME) / 1000),
    services,
    metrics: {
      activeCalls: metricsSummary.activeCalls,
      callsLastHour: metricsSummary.totalCalls,
      errorRatePercent: Number((metricsSummary.errorRate * 100).toFixed(2)),
      avgLatencyMs: metricsSummary.avgLatencyMs,
      p95LatencyMs: metricsSummary.p95LatencyMs,
    },
    activeAlerts: activeAlertsCount,
  };

  // Add detailed service info if requested
  if (detailed) {
    // Add more detailed information for each service
    for (const service of Object.values(services)) {
      if (service.details) {
        // Already has details
      }
    }
  }

  return response;
}

// =====================================================
// SERVICE HEALTH CHECKS
// =====================================================

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  const name = 'database';

  try {
    const supabase = createServiceClient();

    // Simple query to test database connection
    const { error } = await supabase
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

    // Consider degraded if response is slow
    const status: HealthStatus = latencyMs > 500 ? 'degraded' : 'healthy';

    return {
      name,
      status,
      latencyMs,
      lastCheck: new Date().toISOString(),
      details: latencyMs > 500 ? { warning: 'High latency' } : undefined,
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
 * Check VAPI health
 */
async function checkVapiHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  const name = 'vapi';

  try {
    // Check if VAPI API key is configured
    const hasApiKey = Boolean(process.env.VAPI_API_KEY);

    if (!hasApiKey) {
      return {
        name,
        status: 'degraded',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error: 'VAPI API key not configured',
        details: { configured: false },
      };
    }

    // Optionally ping VAPI's health endpoint
    // For now, just check configuration
    // In production, you might want to actually ping VAPI
    const latencyMs = Date.now() - start;

    return {
      name,
      status: 'healthy',
      latencyMs,
      lastCheck: new Date().toISOString(),
      details: { configured: true },
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
 * Check LangGraph health
 */
async function checkLangGraphHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  const name = 'langgraph';

  try {
    // Check if LLM API keys are configured
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
    const hasLLM = hasOpenAI || hasAnthropic;

    if (!hasLLM) {
      return {
        name,
        status: 'degraded',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error: 'No LLM API key configured',
        details: { openai: hasOpenAI, anthropic: hasAnthropic },
      };
    }

    const latencyMs = Date.now() - start;

    return {
      name,
      status: 'healthy',
      latencyMs,
      lastCheck: new Date().toISOString(),
      details: { openai: hasOpenAI, anthropic: hasAnthropic },
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
 * Check circuit breaker health
 */
function checkCircuitBreakerHealth(): ServiceHealth {
  const start = Date.now();
  const name = 'circuitBreaker';

  try {
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
      details: { state },
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

// =====================================================
// HEAD - Quick health check for load balancers
// =====================================================

export async function HEAD() {
  try {
    // Quick check - just verify service is running
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Health-Status': 'healthy',
        'X-Uptime-Seconds': String(Math.floor((Date.now() - SERVICE_START_TIME) / 1000)),
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
