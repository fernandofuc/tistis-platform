// =====================================================
// TIS TIS PLATFORM - API Keys Audit Statistics API
// GET: Get audit statistics for a period
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import type {
  AuditStatistics,
  AuditAction,
  AuditSeverity,
} from '@/src/features/api-settings/types';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];

const VALID_PERIODS = ['last_7_days', 'last_30_days', 'last_90_days'] as const;
type Period = typeof VALID_PERIODS[number];

const PERIOD_DAYS: Record<Period, number> = {
  last_7_days: 7,
  last_30_days: 30,
  last_90_days: 90,
};

const ALL_ACTIONS: AuditAction[] = [
  'api_key.created',
  'api_key.updated',
  'api_key.revoked',
  'api_key.rotated',
  'api_key.viewed',
  'api_key.used',
  'api_key.rate_limited',
  'api_key.auth_failed',
  'api_key.ip_blocked',
  'api_key.scope_denied',
  'api_key.expired',
];

const ALL_SEVERITIES: AuditSeverity[] = ['info', 'warning', 'error', 'critical'];

// ======================
// HELPER FUNCTIONS
// ======================

function getStartDate(period: Period): string {
  const now = new Date();
  const days = PERIOD_DAYS[period];
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

// ======================
// GET - Get audit statistics
// ======================
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver las estadísticas de auditoría' },
        { status: 403 }
      );
    }

    // Parse period parameter
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period') || 'last_30_days';
    const period: Period = VALID_PERIODS.includes(periodParam as Period)
      ? (periodParam as Period)
      : 'last_30_days';

    const startDate = getStartDate(period);
    const days = PERIOD_DAYS[period];

    // Get total events count
    const { count: totalEvents } = await supabase
      .from('api_key_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate);

    // Get events grouped by action
    const { data: actionCounts } = await supabase
      .from('api_key_audit_logs')
      .select('action')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate);

    const eventsByAction: Record<AuditAction, number> = {} as Record<AuditAction, number>;
    for (const action of ALL_ACTIONS) {
      eventsByAction[action] = 0;
    }
    for (const row of actionCounts || []) {
      if (row.action && eventsByAction[row.action as AuditAction] !== undefined) {
        eventsByAction[row.action as AuditAction]++;
      }
    }

    // Get events grouped by severity
    const { data: severityCounts } = await supabase
      .from('api_key_audit_logs')
      .select('severity')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate);

    const eventsBySeverity: Record<AuditSeverity, number> = {} as Record<AuditSeverity, number>;
    for (const severity of ALL_SEVERITIES) {
      eventsBySeverity[severity] = 0;
    }
    for (const row of severityCounts || []) {
      if (row.severity && eventsBySeverity[row.severity as AuditSeverity] !== undefined) {
        eventsBySeverity[row.severity as AuditSeverity]++;
      }
    }

    // Get security metrics
    const { count: failedAuthAttempts } = await supabase
      .from('api_key_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('action', 'api_key.auth_failed')
      .gte('created_at', startDate);

    const { count: rateLimitHits } = await supabase
      .from('api_key_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('action', 'api_key.rate_limited')
      .gte('created_at', startDate);

    const { count: ipBlocks } = await supabase
      .from('api_key_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('action', 'api_key.ip_blocked')
      .gte('created_at', startDate);

    // Get most active keys
    const { data: keyUsage } = await supabase
      .from('api_key_audit_logs')
      .select('resource_id, metadata')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .not('resource_id', 'is', null);

    // Count by key
    const keyCountMap = new Map<string, { count: number; name: string }>();
    for (const row of keyUsage || []) {
      if (row.resource_id) {
        const existing = keyCountMap.get(row.resource_id);
        if (existing) {
          existing.count++;
        } else {
          keyCountMap.set(row.resource_id, {
            count: 1,
            name: row.metadata?.key_name || 'Unknown',
          });
        }
      }
    }

    const mostActiveKeys = Array.from(keyCountMap.entries())
      .map(([keyId, data]) => ({
        key_id: keyId,
        key_name: data.name,
        request_count: data.count,
      }))
      .sort((a, b) => b.request_count - a.request_count)
      .slice(0, 5);

    // Get events by day
    const eventsByDay: { date: string; count: number; failures: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { count: dayCount } = await supabase
        .from('api_key_audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      const { count: dayFailures } = await supabase
        .from('api_key_audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'failure')
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      eventsByDay.push({
        date: dateStr,
        count: dayCount || 0,
        failures: dayFailures || 0,
      });
    }

    // Build response
    const statistics: AuditStatistics = {
      period,
      total_events: totalEvents || 0,
      events_by_action: eventsByAction,
      events_by_severity: eventsBySeverity,
      failed_auth_attempts: failedAuthAttempts || 0,
      rate_limit_hits: rateLimitHits || 0,
      ip_blocks: ipBlocks || 0,
      most_active_keys: mostActiveKeys,
      events_by_day: eventsByDay,
    };

    return NextResponse.json(statistics);
  } catch (error) {
    console.error('[Audit Stats API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener las estadísticas de auditoría' },
      { status: 500 }
    );
  }
}
