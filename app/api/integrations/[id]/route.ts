// =====================================================
// TIS TIS PLATFORM - Integration Detail API Route
// GET, PATCH, DELETE operations for specific integration
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { SAFE_INTEGRATION_FIELDS } from '@/src/features/integrations/constants/api-fields';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ======================
// GET - Get single integration
// ======================
export async function GET(request: NextRequest, { params }: RouteParams) {
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
        { error: 'Only administrators can access integrations' },
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

    const { data, error } = await supabase
      .from('integration_connections')
      .select(SAFE_INTEGRATION_FIELDS)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ connection: data });
  } catch (error) {
    console.error('[Integration API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update integration
// ======================
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
        { error: 'Only administrators can update integrations' },
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

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('integration_connections')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Allowlist of updatable fields
    // SECURITY: Credentials (api_key, access_token, etc.) should ONLY be set
    // through dedicated OAuth/auth endpoints, never through generic PATCH
    const allowedFields = [
      'connection_name',
      'status',
      'sync_enabled',
      'sync_direction',
      'sync_frequency_minutes',
      'sync_contacts',
      'sync_appointments',
      'sync_products',
      'sync_inventory',
      'sync_orders',
      'field_mapping',
      // 'api_key', - REMOVED: Security risk - use dedicated auth endpoints
      'external_account_id',
      'external_account_name',
      'external_api_base_url',
      'metadata',
    ];

    // Validate specific fields if provided
    if (body.sync_direction !== undefined) {
      const VALID_DIRECTIONS = ['inbound', 'outbound', 'bidirectional'];
      if (!VALID_DIRECTIONS.includes(body.sync_direction)) {
        return NextResponse.json(
          { error: 'Invalid sync_direction' },
          { status: 400 }
        );
      }
    }

    if (body.sync_frequency_minutes !== undefined) {
      const freq = Number(body.sync_frequency_minutes);
      if (isNaN(freq) || freq < 5 || freq > 1440) {
        return NextResponse.json(
          { error: 'sync_frequency_minutes must be between 5 and 1440' },
          { status: 400 }
        );
      }
    }

    if (body.status !== undefined) {
      const VALID_STATUSES = ['pending', 'configuring', 'connected', 'paused', 'disconnected'];
      // Note: 'syncing' and 'error' are set by the system, not by user
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
    }

    // Validate boolean fields
    const booleanFields = ['sync_enabled', 'sync_contacts', 'sync_appointments', 'sync_products', 'sync_inventory', 'sync_orders'];
    for (const field of booleanFields) {
      if (body[field] !== undefined && typeof body[field] !== 'boolean') {
        return NextResponse.json(
          { error: `${field} must be a boolean` },
          { status: 400 }
        );
      }
    }

    // Validate field_mapping is an object
    if (body.field_mapping !== undefined) {
      if (typeof body.field_mapping !== 'object' || body.field_mapping === null || Array.isArray(body.field_mapping)) {
        return NextResponse.json(
          { error: 'field_mapping must be an object' },
          { status: 400 }
        );
      }
    }

    // Validate metadata is an object
    if (body.metadata !== undefined) {
      if (typeof body.metadata !== 'object' || body.metadata === null || Array.isArray(body.metadata)) {
        return NextResponse.json(
          { error: 'metadata must be an object' },
          { status: 400 }
        );
      }
    }

    // Build update object with only allowed fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // If status is being set to 'connected', set connected_at
    if (body.status === 'connected') {
      updateData.connected_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(SAFE_INTEGRATION_FIELDS)
      .single();

    if (error) {
      console.error('[Integration API] Error updating integration:', error);
      return NextResponse.json(
        { error: 'Failed to update integration' },
        { status: 500 }
      );
    }

    console.log('[Integration API] Integration updated:', id);

    return NextResponse.json({ connection: data });
  } catch (error) {
    console.error('[Integration API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Delete integration
// ======================
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions - only owner can delete
    if (role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the owner can delete integrations' },
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

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('integration_connections')
      .select('id, integration_type')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Delete the integration (cascades to related records via FK)
    const { error: deleteError } = await supabase
      .from('integration_connections')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      console.error('[Integration API] Error deleting integration:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete integration' },
        { status: 500 }
      );
    }

    console.log('[Integration API] Integration deleted:', id, existing.integration_type);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Integration API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
