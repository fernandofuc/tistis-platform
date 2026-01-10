// =====================================================
// TIS TIS PLATFORM - Single Lead API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';

// ======================
// GET - Fetch single lead
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if (isAuthError(authContext)) {
      return createAuthErrorResponse(authContext);
    }

    const { client: supabase, tenantId } = authContext;
    const { id } = await params;

    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        branches(id, name, city),
        assigned_staff:staff(id, first_name, last_name, role),
        appointments(id, scheduled_at, status, service:services(name)),
        conversations(id, status, channel, last_message_at)
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching lead:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Lead API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update lead
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if (isAuthError(authContext)) {
      return createAuthErrorResponse(authContext);
    }

    const { client: supabase, tenantId } = authContext;
    const { id } = await params;
    const body = await request.json();

    // Fields allowed for update
    const allowedFields = [
      'first_name', 'last_name', 'full_name', 'email', 'status', 'classification', 'score',
      'source', 'interested_services', 'branch_id', 'assigned_staff_id',
      'notes', 'tags', 'custom_fields'
    ];

    // Filter only allowed fields
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Auto-update classification based on score
    if (updateData.score !== undefined) {
      const score = updateData.score as number;
      if (score >= 80) {
        updateData.classification = 'hot';
      } else if (score >= 40) {
        updateData.classification = 'warm';
      } else {
        updateData.classification = 'cold';
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }
      console.error('Error updating lead:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Lead API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Soft delete lead (preserves data for recovery)
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if (isAuthError(authContext)) {
      return createAuthErrorResponse(authContext);
    }

    const { client: supabase, tenantId, user } = authContext;
    const { id } = await params;

    // First verify the lead belongs to this tenant
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, tenant_id, deleted_at')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (checkError || !existingLead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    if (existingLead.deleted_at) {
      return NextResponse.json(
        { error: 'Lead already deleted' },
        { status: 400 }
      );
    }

    // Use soft delete function
    // FIX: Updated to match migration 122 signature (UUID, UUID, TEXT)
    // and new return type (success, appointments_cancelled, conversations_closed, message)
    const { data, error } = await supabase.rpc('soft_delete_lead', {
      p_lead_id: id,
      p_deleted_by: user.id,
      p_cancel_reason: 'Lead soft-deleted by user'
    });

    if (error) {
      console.error('Error soft deleting lead:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Check RPC result - new return type from migration 122
    const result = data?.[0];
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.message || 'Failed to delete lead' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Lead moved to trash. Can be restored within 30 days.',
      lead_id: id,
      appointments_cancelled: result.appointments_cancelled || 0,
      conversations_closed: result.conversations_closed || 0
    }, { status: 200 });
  } catch (error) {
    console.error('Lead API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Restore deleted lead
// ======================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if (isAuthError(authContext)) {
      return createAuthErrorResponse(authContext);
    }

    // FIX: Added user to destructuring for p_restored_by parameter
    const { client: supabase, tenantId, user } = authContext;
    const { id } = await params;
    const body = await request.json();

    // Check if this is a restore action
    if (body.action !== 'restore') {
      return NextResponse.json(
        { error: 'Invalid action. Use action: "restore"' },
        { status: 400 }
      );
    }

    // First verify the lead belongs to this tenant
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, tenant_id, deleted_at')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (checkError || !existingLead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    if (!existingLead.deleted_at) {
      return NextResponse.json(
        { error: 'Lead is not deleted' },
        { status: 400 }
      );
    }

    // Use restore function
    // FIX: Updated to match migration 122 signature (UUID, UUID)
    // and new return type (success, restored_status, message)
    const { data, error } = await supabase.rpc('restore_lead', {
      p_lead_id: id,
      p_restored_by: user.id
    });

    if (error) {
      console.error('Error restoring lead:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Check RPC result - new return type from migration 122
    const result = data?.[0];
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.message || 'Failed to restore lead' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Lead restored successfully',
      lead_id: id,
      restored_status: result.restored_status
    }, { status: 200 });
  } catch (error) {
    console.error('Lead API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
