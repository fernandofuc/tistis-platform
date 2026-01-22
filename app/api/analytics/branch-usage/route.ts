// =====================================================
// TIS TIS PLATFORM - FASE 3: Branch Usage Analytics API
// Provides detailed usage statistics per branch
// For admin dashboard and monitoring
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ======================
// TYPES
// ======================

interface BranchUsageStats {
  branch_id: string;
  branch_name: string;
  is_headquarters: boolean;

  // API Request metrics (last 30 days)
  api_requests_30d: number;
  api_requests_7d: number;
  api_requests_today: number;

  // Most used endpoints
  most_used_endpoints: Array<{
    endpoint: string;
    requests: number;
    avg_response_time_ms: number;
  }>;

  // Lead metrics
  leads: {
    total: number;
    new_30d: number;
    converted_30d: number;
    conversion_rate: number;
  };

  // Appointment metrics
  appointments: {
    total: number;
    upcoming: number;
    completed_30d: number;
    completion_rate: number;
  };

  // Performance metrics
  performance: {
    avg_response_time_ms: number;
    p95_response_time_ms: number;
    error_rate: number;
    cache_hit_rate: number;
  };

  // Usage trends (last 7 days)
  daily_trends: Array<{
    date: string;
    requests: number;
    errors: number;
  }>;
}

interface BranchUsageResponse {
  tenant_id: string;
  generated_at: string;
  branches: BranchUsageStats[];
  summary: {
    total_branches: number;
    total_requests_30d: number;
    avg_response_time_ms: number;
    overall_error_rate: number;
  };
}

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];

// ======================
// GET - Branch Usage Analytics
// ======================
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // 2. Check permissions (only owners and admins)
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver analytics' },
        { status: 403 }
      );
    }

    // 3. Parse query parameters
    const url = new URL(request.url);
    const branchId = url.searchParams.get('branch_id'); // Optional: filter by specific branch
    const days = parseInt(url.searchParams.get('days') || '30', 10); // Default: 30 days

    // Validate days parameter
    const validDays = Math.min(Math.max(days, 1), 90); // Between 1 and 90 days

    // 4. Fetch branches
    let branchQuery = supabase
      .from('branches')
      .select('id, name, is_headquarters, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_headquarters', { ascending: false })
      .order('name', { ascending: true });

    if (branchId) {
      branchQuery = branchQuery.eq('id', branchId);
    }

    const { data: branches, error: branchError } = await branchQuery;

    if (branchError) {
      console.error('[Analytics API] Error fetching branches:', branchError);
      return NextResponse.json(
        { error: 'Error al obtener sucursales' },
        { status: 500 }
      );
    }

    if (!branches || branches.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron sucursales' },
        { status: 404 }
      );
    }

    // 5. Fetch analytics for each branch (in parallel for performance)
    const branchStats: BranchUsageStats[] = [];
    let totalRequests30d = 0;
    let totalResponseTime = 0;
    let totalErrors = 0;
    let totalApiLogs = 0;

    // ✅ CRITICAL FIX: Use Promise.all to fetch all branch data in parallel
    const branchStatsPromises = branches.map(async (branch) => {
      // 5.1 API Request metrics (from api_key_usage_logs)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - validDays);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // ✅ CRITICAL FIX: Get API keys for this branch first
      const { data: branchKeys } = await supabase
        .from('api_keys')
        .select('id, usage_count, last_used_at')
        .eq('tenant_id', tenantId)
        .eq('branch_id', branch.id)
        .eq('is_active', true);

      const branchKeyIds = branchKeys?.map((k) => k.id) || [];

      // ✅ CRITICAL FIX: Query correct table (api_key_usage_logs) with branch filter
      // Filter at database level for performance (not in memory)
      const { data: branchApiLogs } = await supabase
        .from('api_key_usage_logs')
        .select('endpoint, status_code, response_time_ms, created_at, api_key_id')
        .eq('tenant_id', tenantId)
        .in('api_key_id', branchKeyIds.length > 0 ? branchKeyIds : ['00000000-0000-0000-0000-000000000000']) // Dummy UUID if no keys
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Handle null/empty logs array
      const logs = branchApiLogs || [];

      const requests30d = logs.length;
      const requests7d = logs.filter(
        (log: any) => new Date(log.created_at) >= sevenDaysAgo
      ).length;
      const requestsToday = logs.filter(
        (log: any) => new Date(log.created_at) >= today
      ).length;

      // Calculate most used endpoints
      const endpointCounts: Record<string, { count: number; totalTime: number }> = {};
      logs.forEach((log: any) => {
        if (!endpointCounts[log.endpoint]) {
          endpointCounts[log.endpoint] = { count: 0, totalTime: 0 };
        }
        endpointCounts[log.endpoint].count++;
        endpointCounts[log.endpoint].totalTime += log.response_time_ms || 0;
      });

      const mostUsedEndpoints = Object.entries(endpointCounts)
        .map(([endpoint, stats]) => ({
          endpoint,
          requests: stats.count,
          avg_response_time_ms: Math.round(stats.totalTime / stats.count),
        }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 5);

      // 5.2 Lead metrics
      const { count: totalLeads } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('branch_id', branch.id);

      const { count: newLeads30d } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('branch_id', branch.id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { count: convertedLeads30d } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('branch_id', branch.id)
        .eq('status', 'converted')
        .gte('updated_at', thirtyDaysAgo.toISOString());

      const conversionRate =
        newLeads30d && newLeads30d > 0
          ? Math.round((convertedLeads30d || 0) / newLeads30d * 100)
          : 0;

      // 5.3 Appointment metrics
      const { count: totalAppointments } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('branch_id', branch.id);

      const { count: upcomingAppointments } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('branch_id', branch.id)
        .eq('status', 'confirmed')
        .gte('scheduled_at', new Date().toISOString());

      const { count: completedAppointments30d } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('branch_id', branch.id)
        .eq('status', 'completed')
        .gte('updated_at', thirtyDaysAgo.toISOString());

      const { count: totalAppointments30d } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('branch_id', branch.id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const completionRate =
        totalAppointments30d && totalAppointments30d > 0
          ? Math.round((completedAppointments30d || 0) / totalAppointments30d * 100)
          : 0;

      // 5.4 Performance metrics
      const responseTimes = logs.map((log: any) => log.response_time_ms || 0);
      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      // Calculate P95 (95th percentile)
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95ResponseTime = sortedTimes[p95Index] || 0;

      const errorCount = logs.filter(
        (log: any) => log.status_code >= 400
      ).length;
      const errorRate = requests30d > 0
        ? Math.round((errorCount / requests30d) * 100 * 10) / 10
        : 0;

      // 5.5 Daily trends (last 7 days)
      const dailyTrends = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayLogs = logs.filter((log: any) => {
          const logDate = new Date(log.created_at);
          return logDate >= date && logDate < nextDate;
        });

        dailyTrends.push({
          date: date.toISOString().split('T')[0],
          requests: dayLogs.length,
          errors: dayLogs.filter((log: any) => log.status_code >= 400).length,
        });
      }

      // Build and return branch stats object
      return {
        stats: {
          branch_id: branch.id,
          branch_name: branch.name,
          is_headquarters: branch.is_headquarters || false,
          api_requests_30d: requests30d,
          api_requests_7d: requests7d,
          api_requests_today: requestsToday,
          most_used_endpoints: mostUsedEndpoints,
          leads: {
            total: totalLeads || 0,
            new_30d: newLeads30d || 0,
            converted_30d: convertedLeads30d || 0,
            conversion_rate: conversionRate,
          },
          appointments: {
            total: totalAppointments || 0,
            upcoming: upcomingAppointments || 0,
            completed_30d: completedAppointments30d || 0,
            completion_rate: completionRate,
          },
          performance: {
            avg_response_time_ms: avgResponseTime,
            p95_response_time_ms: p95ResponseTime,
            error_rate: errorRate,
            cache_hit_rate: 0, // TODO: Implement cache hit tracking
          },
          daily_trends: dailyTrends,
        },
        // Return totals for summary aggregation
        totals: {
          requests: requests30d,
          responseTime: avgResponseTime * requests30d,
          errors: errorCount,
          apiLogs: requests30d,
        },
      };
    });

    // ✅ Await all branch analytics in parallel (massive performance improvement)
    const branchResults = await Promise.all(branchStatsPromises);

    // Aggregate totals from all branches
    branchResults.forEach((result) => {
      branchStats.push(result.stats);
      totalRequests30d += result.totals.requests;
      totalResponseTime += result.totals.responseTime;
      totalErrors += result.totals.errors;
      totalApiLogs += result.totals.apiLogs;
    });

    // 6. Build response
    const response: BranchUsageResponse = {
      tenant_id: tenantId,
      generated_at: new Date().toISOString(),
      branches: branchStats,
      summary: {
        total_branches: branchStats.length,
        total_requests_30d: totalRequests30d,
        avg_response_time_ms: totalApiLogs > 0
          ? Math.round(totalResponseTime / totalApiLogs)
          : 0,
        overall_error_rate: totalRequests30d > 0
          ? Math.round((totalErrors / totalRequests30d) * 100 * 10) / 10
          : 0,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Analytics API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error al generar analytics' },
      { status: 500 }
    );
  }
}
