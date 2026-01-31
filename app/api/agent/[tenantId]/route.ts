// =====================================================
// TIS TIS PLATFORM - List Agents Endpoint
// GET /api/agent/[tenantId]
// Lists all agents for a tenant
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';
import { getAgentManagerService } from '@/src/features/integrations';
import type { AgentStatus } from '@/src/features/integrations';

export const dynamic = 'force-dynamic';

// ======================
// UUID VALIDATION
// ======================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

// ======================
// TYPES
// ======================

interface RouteParams {
  params: Promise<{
    tenantId: string;
  }>;
}

// ======================
// GET - List Agents
// ======================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { tenantId: routeTenantId } = await params;

    // Validate tenant ID format
    if (!isValidUUID(routeTenantId)) {
      return NextResponse.json(
        { error: 'Invalid tenant ID format', errorCode: 'INVALID_TENANT_ID' },
        { status: 400 }
      );
    }

    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { tenantId, role } = authResult;

    // Verify user belongs to the requested tenant
    if (tenantId !== routeTenantId) {
      return NextResponse.json(
        { error: 'Access denied', errorCode: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Only owners and admins can list agents
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse query params
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as AgentStatus | null;
    const branchId = url.searchParams.get('branch_id');
    const integrationId = url.searchParams.get('integration_id');

    // Validate optional UUIDs
    if (branchId && !isValidUUID(branchId)) {
      return NextResponse.json(
        { error: 'Invalid branch_id format', errorCode: 'INVALID_BRANCH_ID' },
        { status: 400 }
      );
    }

    if (integrationId && !isValidUUID(integrationId)) {
      return NextResponse.json(
        { error: 'Invalid integration_id format', errorCode: 'INVALID_INTEGRATION_ID' },
        { status: 400 }
      );
    }

    // Valid statuses
    const validStatuses: AgentStatus[] = ['pending', 'registered', 'connected', 'syncing', 'error', 'offline'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, errorCode: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // Get agents
    const agentService = getAgentManagerService();
    const agents = await agentService.listAgents(tenantId, {
      status: status || undefined,
      branchId: branchId || undefined,
      integrationId: integrationId || undefined,
    });

    // Get stats
    const stats = await agentService.getAgentStats(tenantId);

    // Transform agents for response
    const agentList = agents.map(agent => ({
      id: agent.id,
      agent_id: agent.agent_id,
      integration_id: agent.integration_id,
      branch_id: agent.branch_id,
      status: agent.status,
      agent_version: agent.agent_version,
      machine_name: agent.machine_name,
      sr_version: agent.sr_version,
      sr_database_name: agent.sr_database_name,
      sync_config: {
        sync_interval_seconds: agent.sync_interval_seconds,
        sync_menu: agent.sync_menu,
        sync_inventory: agent.sync_inventory,
        sync_sales: agent.sync_sales,
        sync_tables: agent.sync_tables,
      },
      statistics: {
        last_heartbeat_at: agent.last_heartbeat_at,
        last_sync_at: agent.last_sync_at,
        last_sync_records: agent.last_sync_records,
        total_records_synced: agent.total_records_synced,
        consecutive_errors: agent.consecutive_errors,
      },
      created_at: agent.created_at,
      updated_at: agent.updated_at,
    }));

    return NextResponse.json({
      success: true,
      agents: agentList,
      total: agentList.length,
      stats: stats ? {
        total_agents: stats.totalAgents,
        connected_agents: stats.connectedAgents,
        syncing_agents: stats.syncingAgents,
        error_agents: stats.errorAgents,
        offline_agents: stats.offlineAgents,
        total_records_synced: stats.totalRecordsSynced,
        syncs_today: stats.syncsToday,
        syncs_failed_today: stats.syncsFailedToday,
        last_sync_at: stats.lastSyncAt,
        avg_sync_duration_ms: stats.avgSyncDurationMs,
      } : null,
    });

  } catch (error) {
    console.error('[List Agents] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
