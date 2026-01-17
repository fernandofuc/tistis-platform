// =====================================================
// TIS TIS PLATFORM - API Key Usage Statistics API
// GET: Get usage statistics for an API key
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import type {
  APIKeyUsageResponse,
  APIKeyUsageStats,
  APIKeyUsageLog,
} from '@/src/features/api-settings/types';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];
const MAX_DAYS = 90;
const DEFAULT_DAYS = 30;
const MAX_LOGS_LIMIT = 100;

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// ======================
// GET - Get usage statistics
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format
    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: 'ID de API Key inválido' },
        { status: 400 }
      );
    }

    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver las estadísticas de uso' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const includeLogs = searchParams.get('include_logs') === 'true';
    const logsLimitParam = searchParams.get('logs_limit');
    const endpointPrefix = searchParams.get('endpoint_prefix');
    const method = searchParams.get('method');

    // Validate days parameter
    let days = DEFAULT_DAYS;
    if (daysParam) {
      const parsedDays = parseInt(daysParam, 10);
      if (!isNaN(parsedDays) && parsedDays > 0) {
        days = Math.min(parsedDays, MAX_DAYS);
      }
    }

    // Validate logs limit
    let logsLimit = 50;
    if (logsLimitParam) {
      const parsedLimit = parseInt(logsLimitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        logsLimit = Math.min(parsedLimit, MAX_LOGS_LIMIT);
      }
    }

    // Verify the API key exists and belongs to this tenant
    const { data: keyExists, error: keyError } = await supabase
      .from('api_keys')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (keyError || !keyExists) {
      return NextResponse.json(
        { error: 'API Key no encontrada' },
        { status: 404 }
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Try to get stats from RPC function first
    const { data: rpcStats, error: rpcError } = await supabase.rpc(
      'get_api_key_usage_stats',
      {
        p_api_key_id: id,
        p_days: days,
      }
    );

    let stats: APIKeyUsageStats;

    if (rpcError || !rpcStats) {
      // Fallback: Calculate stats manually from usage logs
      console.warn(
        '[API Key Usage API] RPC failed, falling back to manual calculation:',
        rpcError
      );

      // Build the base query for usage logs
      let logsQuery = supabase
        .from('api_key_usage_logs')
        .select('*')
        .eq('api_key_id', id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Apply filters if provided
      if (endpointPrefix) {
        logsQuery = logsQuery.ilike('endpoint', `${endpointPrefix}%`);
      }
      if (method) {
        logsQuery = logsQuery.eq('method', method.toUpperCase());
      }

      const { data: allLogs, error: logsError } = await logsQuery.order(
        'created_at',
        { ascending: false }
      );

      if (logsError) {
        console.error('[API Key Usage API] Logs query error:', logsError);
        // Return empty stats if logs table doesn't exist or query fails
        stats = {
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          avg_response_time_ms: 0,
          requests_by_endpoint: [],
          requests_by_day: [],
        };
      } else {
        const logs = allLogs || [];

        // Calculate aggregate stats
        const totalRequests = logs.length;
        const successfulRequests = logs.filter(
          (log) => log.status_code < 400
        ).length;
        const failedRequests = totalRequests - successfulRequests;

        const avgResponseTime =
          totalRequests > 0
            ? Math.round(
                logs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) /
                  totalRequests
              )
            : 0;

        // Group by endpoint
        const endpointCounts: Record<string, number> = {};
        for (const log of logs) {
          const endpoint = log.endpoint || 'unknown';
          endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
        }
        const requestsByEndpoint = Object.entries(endpointCounts)
          .map(([endpoint, count]) => ({ endpoint, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Group by day
        const dayCounts: Record<string, number> = {};
        for (const log of logs) {
          const date = new Date(log.created_at).toISOString().split('T')[0];
          dayCounts[date] = (dayCounts[date] || 0) + 1;
        }
        const requestsByDay = Object.entries(dayCounts)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        stats = {
          total_requests: totalRequests,
          successful_requests: successfulRequests,
          failed_requests: failedRequests,
          avg_response_time_ms: avgResponseTime,
          requests_by_endpoint: requestsByEndpoint,
          requests_by_day: requestsByDay,
          error_rate:
            totalRequests > 0
              ? Math.round((failedRequests / totalRequests) * 100 * 100) / 100
              : 0,
        };
      }
    } else {
      // Use RPC stats
      stats = {
        total_requests: rpcStats.total_requests || 0,
        successful_requests: rpcStats.successful_requests || 0,
        failed_requests: rpcStats.failed_requests || 0,
        avg_response_time_ms: rpcStats.avg_response_time_ms || 0,
        requests_by_endpoint: rpcStats.requests_by_endpoint || [],
        requests_by_day: rpcStats.requests_by_day || [],
        error_rate:
          rpcStats.total_requests > 0
            ? Math.round(
                (rpcStats.failed_requests / rpcStats.total_requests) * 100 * 100
              ) / 100
            : 0,
      };
    }

    // Fetch detailed logs if requested
    let logs: APIKeyUsageLog[] | undefined;
    if (includeLogs) {
      let detailedLogsQuery = supabase
        .from('api_key_usage_logs')
        .select(
          `
          id,
          api_key_id,
          tenant_id,
          endpoint,
          method,
          status_code,
          response_time_ms,
          ip_address,
          user_agent,
          request_size_bytes,
          response_size_bytes,
          error_message,
          error_code,
          created_at
        `
        )
        .eq('api_key_id', id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(logsLimit);

      // Apply filters if provided
      if (endpointPrefix) {
        detailedLogsQuery = detailedLogsQuery.ilike(
          'endpoint',
          `${endpointPrefix}%`
        );
      }
      if (method) {
        detailedLogsQuery = detailedLogsQuery.eq('method', method.toUpperCase());
      }

      const { data: logsData, error: detailedLogsError } =
        await detailedLogsQuery;

      if (!detailedLogsError && logsData) {
        logs = logsData.map((log) => ({
          id: log.id,
          api_key_id: log.api_key_id,
          tenant_id: log.tenant_id,
          endpoint: log.endpoint,
          method: log.method,
          status_code: log.status_code,
          response_time_ms: log.response_time_ms,
          ip_address: log.ip_address,
          user_agent: log.user_agent,
          request_size_bytes: log.request_size_bytes,
          response_size_bytes: log.response_size_bytes,
          error_message: log.error_message,
          error_code: log.error_code,
          created_at: log.created_at,
        }));
      }
    }

    // Build response
    const response: APIKeyUsageResponse = {
      stats,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days,
      },
      ...(logs && { logs }),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Key Usage API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener las estadísticas de uso' },
      { status: 500 }
    );
  }
}
