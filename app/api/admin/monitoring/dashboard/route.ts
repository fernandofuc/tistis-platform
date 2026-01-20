/**
 * TIS TIS Platform - Voice Agent v2.0
 * Monitoring Dashboard API Endpoint
 *
 * Provides comprehensive monitoring data for the admin dashboard:
 * - Rollout status and feature flags
 * - V1 vs V2 comparison metrics
 * - Active alerts
 * - Health status
 * - Real-time metrics
 *
 * @module app/api/admin/monitoring/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRolloutDashboardData, getHealthCheck } from '@/lib/voice-agent/monitoring/dashboard-data';
import { getMetricsSummary, exportMetricsJSON, exportMetricsPrometheus } from '@/lib/voice-agent/monitoring/voice-metrics';
import { getAlertManager, getActiveAlerts, getAlertRules } from '@/lib/voice-agent/monitoring/alert-manager';
import { getNotificationDeliveryStats } from '@/lib/voice-agent/monitoring/notification-service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Create Supabase client with service role
 */
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Verify admin access from JWT
 */
async function verifyAdminAccess(request: NextRequest): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const token = authHeader.substring(7);
  const supabase = createServiceClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { valid: false, error: 'Invalid token' };
  }

  // Check if user is platform admin
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['platform_admin', 'super_admin', 'admin', 'owner'])
    .single();

  if (!role) {
    return { valid: false, error: 'Admin access required' };
  }

  return {
    valid: true,
    userId: user.id,
    email: user.email,
  };
}

// =====================================================
// GET - Get monitoring dashboard data
// =====================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const url = new URL(request.url);
    const section = url.searchParams.get('section'); // 'overview', 'metrics', 'alerts', 'health', 'all'
    const format = url.searchParams.get('format') ?? 'json'; // 'json', 'prometheus'

    // Handle Prometheus format for metrics scraping
    if (format === 'prometheus') {
      const prometheusMetrics = exportMetricsPrometheus();
      return new NextResponse(prometheusMetrics, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
        },
      });
    }

    // Build response based on section requested
    const response: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      responseTimeMs: 0,
    };

    switch (section) {
      case 'overview':
        response.overview = await getRolloutDashboardData();
        break;

      case 'metrics':
        response.metrics = {
          summary: getMetricsSummary(),
          detailed: exportMetricsJSON(),
        };
        break;

      case 'alerts':
        response.alerts = {
          active: getActiveAlerts(),
          rules: getAlertRules(),
          summary: getAlertManager().getAlertSummary(),
        };
        break;

      case 'health':
        response.health = await getHealthCheck();
        break;

      case 'notifications':
        response.notifications = {
          stats: getNotificationDeliveryStats(),
        };
        break;

      case 'all':
      default:
        // Return comprehensive dashboard data
        const [dashboardData, healthData] = await Promise.all([
          getRolloutDashboardData(),
          getHealthCheck(),
        ]);

        response.overview = dashboardData;
        response.metrics = {
          summary: getMetricsSummary(),
        };
        response.alerts = {
          active: getActiveAlerts(),
          summary: getAlertManager().getAlertSummary(),
        };
        response.health = healthData;
        response.notifications = {
          stats: getNotificationDeliveryStats(),
        };
        break;
    }

    response.responseTimeMs = Date.now() - startTime;

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${response.responseTimeMs}ms`,
      },
    });
  } catch (error) {
    console.error('[Admin Monitoring API] Failed to get dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to get dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - Alert management actions
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    const alertManager = getAlertManager();

    switch (action) {
      case 'acknowledgeAlert':
        if (!params.alertId) {
          return NextResponse.json(
            { error: 'Missing alertId parameter' },
            { status: 400 }
          );
        }
        const acknowledged = alertManager.acknowledgeAlert(params.alertId, auth.email ?? auth.userId ?? 'admin');
        if (!acknowledged) {
          return NextResponse.json(
            { error: 'Alert not found' },
            { status: 404 }
          );
        }
        break;

      case 'resolveAlert':
        if (!params.alertId) {
          return NextResponse.json(
            { error: 'Missing alertId parameter' },
            { status: 400 }
          );
        }
        const resolved = alertManager.resolveAlert(params.alertId, params.reason ?? 'Manually resolved');
        if (!resolved) {
          return NextResponse.json(
            { error: 'Alert not found' },
            { status: 404 }
          );
        }
        break;

      case 'enableRule':
        if (!params.ruleId) {
          return NextResponse.json(
            { error: 'Missing ruleId parameter' },
            { status: 400 }
          );
        }
        alertManager.setRuleEnabled(params.ruleId, true);
        break;

      case 'disableRule':
        if (!params.ruleId) {
          return NextResponse.json(
            { error: 'Missing ruleId parameter' },
            { status: 400 }
          );
        }
        alertManager.setRuleEnabled(params.ruleId, false);
        break;

      case 'startAlertManager':
        alertManager.start();
        break;

      case 'stopAlertManager':
        alertManager.stop();
        break;

      case 'createManualAlert':
        if (!params.name || !params.severity) {
          return NextResponse.json(
            { error: 'Missing name or severity parameter' },
            { status: 400 }
          );
        }
        const alert = alertManager.createManualAlert({
          name: params.name,
          description: params.description ?? '',
          severity: params.severity,
          labels: params.labels,
          annotations: params.annotations,
          notificationChannels: params.notificationChannels,
        });
        return NextResponse.json({ success: true, alert });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Return updated state
    return NextResponse.json({
      success: true,
      action,
      alerts: {
        active: getActiveAlerts(),
        summary: alertManager.getAlertSummary(),
      },
    });
  } catch (error) {
    console.error('[Admin Monitoring API] Failed to execute action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute action' },
      { status: 500 }
    );
  }
}
