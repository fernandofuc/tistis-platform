// =====================================================
// TIS TIS PLATFORM - Integration Sync API Route
// Trigger manual sync for an integration
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { createServerClient } from '@/src/shared/lib/supabase';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ======================
// POST - Trigger sync
// ======================
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can trigger sync' },
        { status: 403 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid integration ID format' },
        { status: 400 }
      );
    }

    // Get the integration - only select fields needed for sync validation
    // SECURITY: Never select credentials even for internal use
    const { data: integration, error: fetchError } = await supabase
      .from('integration_connections')
      .select('id, status, integration_type, sync_direction, sync_frequency_minutes, error_count, consecutive_errors')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Check if integration is connected
    if (integration.status !== 'connected' && integration.status !== 'syncing') {
      return NextResponse.json(
        { error: 'Integration must be connected before syncing' },
        { status: 400 }
      );
    }

    // Check if already syncing
    if (integration.status === 'syncing') {
      return NextResponse.json(
        { error: 'Sync already in progress' },
        { status: 409 }
      );
    }

    // ATOMIC UPDATE: Only update if status is still 'connected'
    // This prevents race conditions where two requests try to start sync simultaneously
    const { data: updatedRows, error: updateError } = await supabase
      .from('integration_connections')
      .update({ status: 'syncing' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('status', 'connected') // Only update if still connected (atomic check)
      .select('id');

    if (updateError) {
      console.error('[Integration Sync] Error updating status:', updateError);
      return NextResponse.json(
        { error: 'Failed to start sync' },
        { status: 500 }
      );
    }

    // If no rows were updated, another request already started the sync
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { error: 'Sync already in progress or integration status changed' },
        { status: 409 }
      );
    }

    // Create sync log entry
    const syncLogId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    await supabase
      .from('integration_sync_logs')
      .insert({
        id: syncLogId,
        tenant_id: tenantId,
        integration_id: id,
        sync_type: 'full',
        sync_direction: integration.sync_direction,
        sync_trigger: 'manual',
        status: 'started',
        started_at: startedAt,
        records_processed: 0,
        records_created: 0,
        records_updated: 0,
        records_skipped: 0,
        records_failed: 0,
        metadata: {},
      });

    console.log('[Integration Sync] Sync started:', id, integration.integration_type);

    // TODO: In production, this would trigger an async job via job queue
    // (Trigger.dev, Inngest, BullMQ, etc.)
    // For now, simulate sync completion after a delay

    // IMPORTANT: Use service_role client for background operations
    // The user's auth token may expire during the setTimeout
    const syncFrequencyMinutes = integration.sync_frequency_minutes;
    const errorCount = integration.error_count;
    const consecutiveErrors = integration.consecutive_errors;

    // Simulate async sync (in production, use job queue)
    setTimeout(async () => {
      // Create fresh service_role client for background operation
      const serviceClient = createServerClient();

      try {
        const completedAt = new Date().toISOString();
        const durationMs = Date.now() - new Date(startedAt).getTime();

        // Update integration status back to connected
        const { error: connUpdateErr } = await serviceClient
          .from('integration_connections')
          .update({
            status: 'connected',
            last_sync_at: completedAt,
            next_sync_at: new Date(
              Date.now() + syncFrequencyMinutes * 60000
            ).toISOString(),
            consecutive_errors: 0, // Reset on success
          })
          .eq('id', id)
          .eq('tenant_id', tenantId);

        if (connUpdateErr) {
          console.error('[Integration Sync] Failed to update connection status:', connUpdateErr);
          // Continue to update sync_log anyway for audit trail
        }

        // Update sync log
        const { error: logUpdateErr } = await serviceClient
          .from('integration_sync_logs')
          .update({
            status: 'completed',
            completed_at: completedAt,
            duration_ms: durationMs,
            records_processed: 0, // Would be actual count
            records_created: 0,
            records_updated: 0,
          })
          .eq('id', syncLogId)
          .eq('tenant_id', tenantId);

        if (logUpdateErr) {
          console.error('[Integration Sync] Failed to update sync log:', logUpdateErr);
        }

        console.log('[Integration Sync] Sync completed:', id);
      } catch (err) {
        console.error('[Integration Sync] Error completing sync:', err);
        const errorAt = new Date().toISOString();
        const errorMessage = err instanceof Error ? err.message : 'Sync failed unexpectedly';

        // CRITICAL: Wrap error handling in try-catch to prevent silent failures
        // If this fails (e.g., Supabase down), at least log it
        try {
          // Update integration to error state
          await serviceClient
            .from('integration_connections')
            .update({
              status: 'error',
              last_error_at: errorAt,
              last_error_message: errorMessage,
              error_count: errorCount + 1,
              consecutive_errors: consecutiveErrors + 1,
            })
            .eq('id', id)
            .eq('tenant_id', tenantId);

          // CRITICAL: Also update the sync_log to 'failed' state
          // Without this, sync_logs stay in 'started' state forever
          await serviceClient
            .from('integration_sync_logs')
            .update({
              status: 'failed',
              completed_at: errorAt,
              duration_ms: Date.now() - new Date(startedAt).getTime(),
              error_message: errorMessage,
            })
            .eq('id', syncLogId)
            .eq('tenant_id', tenantId);
        } catch (dbErr) {
          // If we can't even update the error state, log it critically
          // This indicates a serious infrastructure issue
          console.error('[Integration Sync] CRITICAL: Failed to update error state:', dbErr);
          console.error('[Integration Sync] Original error was:', errorMessage);
          console.error('[Integration Sync] Affected integration:', id, 'sync_log:', syncLogId);
        }
      }
    }, 3000);

    return NextResponse.json({
      success: true,
      message: 'Sync started',
      sync_log_id: syncLogId,
    });
  } catch (error) {
    console.error('[Integration Sync] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
