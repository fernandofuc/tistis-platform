// =====================================================
// TIS TIS PLATFORM - Agent Status API
// GET: Returns the status of a specific agent instance
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';

// ======================
// GET - Get agent status
// ======================

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId } = authResult;

    // Get agent_id from query params
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    if (!agentId) {
      return NextResponse.json(
        { error: 'MISSING_AGENT_ID', message: 'agent_id query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch agent instance with schema validation metadata
    const { data: agent, error: agentError } = await supabase
      .from('agent_instances')
      .select(`
        id,
        agent_id,
        status,
        machine_name,
        agent_version,
        last_heartbeat_at,
        last_sync_at,
        total_records_synced,
        consecutive_errors,
        sync_menu,
        sync_inventory,
        sync_sales,
        sync_tables,
        metadata,
        branch_id,
        store_code
      `)
      .eq('agent_id', agentId)
      .eq('tenant_id', tenantId)
      .single();

    if (agentError) {
      if (agentError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'AGENT_NOT_FOUND', message: 'Agent not found' },
          { status: 404 }
        );
      }
      console.error('[agent/status] Error fetching agent:', agentError);
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Error fetching agent status' },
        { status: 500 }
      );
    }

    // Parse schema validation from metadata if present
    let schemaValidation = null;
    if (agent.metadata && typeof agent.metadata === 'object') {
      const metadata = agent.metadata as Record<string, unknown>;
      if (metadata.schema_validation) {
        const sv = metadata.schema_validation as Record<string, unknown>;
        schemaValidation = {
          success: sv.success ?? false,
          validated_at: sv.validated_at,
          database_name: sv.database_name,
          sr_version: sv.sr_version_detected,
          tables_found: sv.tables_found,
          tables_missing: sv.tables_missing,
          total_tables_expected: sv.total_tables_expected,
          can_sync_sales: sv.can_sync_sales,
          can_sync_menu: sv.can_sync_menu,
          can_sync_inventory: sv.can_sync_inventory,
          can_sync_tables: sv.can_sync_tables,
          errors: sv.errors || [],
          warnings: sv.warnings || [],
          missing_required_tables: sv.missing_required_tables || [],
        };
      }
    }

    return NextResponse.json({
      success: true,
      agent_id: agent.agent_id,
      status: agent.status,
      machine_name: agent.machine_name,
      agent_version: agent.agent_version,
      last_heartbeat_at: agent.last_heartbeat_at,
      last_sync_at: agent.last_sync_at,
      total_records_synced: agent.total_records_synced,
      consecutive_errors: agent.consecutive_errors,
      sync_config: {
        sync_menu: agent.sync_menu,
        sync_inventory: agent.sync_inventory,
        sync_sales: agent.sync_sales,
        sync_tables: agent.sync_tables,
      },
      branch_id: agent.branch_id,
      store_code: agent.store_code,
      schema_validation: schemaValidation,
    });
  } catch (error) {
    console.error('[agent/status] Unexpected error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
