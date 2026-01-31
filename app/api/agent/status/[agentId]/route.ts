// =====================================================
// TIS TIS PLATFORM - Agent Status Endpoint
// GET /api/agent/status/[agentId]
// Returns status and details of a specific agent
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';
import { getAgentManagerService } from '@/src/features/integrations';

export const dynamic = 'force-dynamic';

// ======================
// TYPES
// ======================

interface RouteParams {
  params: Promise<{
    agentId: string;
  }>;
}

// ======================
// GET - Get Agent Status
// ======================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { agentId } = await params;

    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { tenantId, role } = authResult;

    // Only owners and admins can view agent status
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get agent
    const agentService = getAgentManagerService();
    const agent = await agentService.getAgent(agentId);

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found', errorCode: 'AGENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify agent belongs to tenant
    if (agent.tenant_id !== tenantId) {
      return NextResponse.json(
        { error: 'Agent not found', errorCode: 'AGENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get recent sync logs
    const syncLogs = await agentService.getSyncLogs(agentId, 10);

    // Return agent status
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        agent_id: agent.agent_id,
        status: agent.status,
        agent_version: agent.agent_version,
        machine_name: agent.machine_name,
        sr_version: agent.sr_version,
        sr_database_name: agent.sr_database_name,
        sr_sql_instance: agent.sr_sql_instance,
        sr_empresa_id: agent.sr_empresa_id,
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
          last_error_message: agent.last_error_message,
          last_error_at: agent.last_error_at,
        },
        token_expires_at: agent.token_expires_at,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      },
      recent_syncs: syncLogs.map(log => ({
        id: log.id,
        sync_type: log.syncType,
        status: log.status,
        records_processed: log.recordsProcessed,
        records_created: log.recordsCreated,
        records_updated: log.recordsUpdated,
        records_failed: log.recordsFailed,
        duration_ms: log.durationMs,
        error_message: log.errorMessage,
        created_at: log.createdAt,
      })),
    });

  } catch (error) {
    console.error('[Agent Status] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Delete Agent
// ======================

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { agentId } = await params;

    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { tenantId, role } = authResult;

    // Only owners can delete agents
    if (role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can delete agents' },
        { status: 403 }
      );
    }

    // Get agent
    const agentService = getAgentManagerService();
    const agent = await agentService.getAgent(agentId);

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found', errorCode: 'AGENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify agent belongs to tenant
    if (agent.tenant_id !== tenantId) {
      return NextResponse.json(
        { error: 'Agent not found', errorCode: 'AGENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Delete agent
    const deleted = await agentService.deleteAgent(agentId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete agent', errorCode: 'DELETE_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully',
    });

  } catch (error) {
    console.error('[Agent Delete] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update Agent Config
// ======================

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { agentId } = await params;

    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { tenantId, role } = authResult;

    // Only owners and admins can update agents
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', errorCode: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // Get agent
    const agentService = getAgentManagerService();
    const agent = await agentService.getAgent(agentId);

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found', errorCode: 'AGENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify agent belongs to tenant
    if (agent.tenant_id !== tenantId) {
      return NextResponse.json(
        { error: 'Agent not found', errorCode: 'AGENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Build config update
    const configUpdate: {
      syncIntervalSeconds?: number;
      syncMenu?: boolean;
      syncInventory?: boolean;
      syncSales?: boolean;
      syncTables?: boolean;
    } = {};

    if (typeof body.sync_interval_seconds === 'number') {
      if (body.sync_interval_seconds < 60 || body.sync_interval_seconds > 86400) {
        return NextResponse.json(
          { error: 'sync_interval_seconds must be between 60 and 86400', errorCode: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }
      configUpdate.syncIntervalSeconds = body.sync_interval_seconds;
    }

    if (typeof body.sync_menu === 'boolean') {
      configUpdate.syncMenu = body.sync_menu;
    }

    if (typeof body.sync_inventory === 'boolean') {
      configUpdate.syncInventory = body.sync_inventory;
    }

    if (typeof body.sync_sales === 'boolean') {
      configUpdate.syncSales = body.sync_sales;
    }

    if (typeof body.sync_tables === 'boolean') {
      configUpdate.syncTables = body.sync_tables;
    }

    // Ensure at least one sync option remains enabled
    const finalSyncMenu = configUpdate.syncMenu ?? agent.sync_menu;
    const finalSyncInventory = configUpdate.syncInventory ?? agent.sync_inventory;
    const finalSyncSales = configUpdate.syncSales ?? agent.sync_sales;
    const finalSyncTables = configUpdate.syncTables ?? agent.sync_tables;

    if (!finalSyncMenu && !finalSyncInventory && !finalSyncSales && !finalSyncTables) {
      return NextResponse.json(
        { error: 'At least one sync option must be enabled', errorCode: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Update agent
    const updated = await agentService.updateAgentConfig(agentId, configUpdate);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update agent', errorCode: 'UPDATE_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent configuration updated',
    });

  } catch (error) {
    console.error('[Agent Update] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
