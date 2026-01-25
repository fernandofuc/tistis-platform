// =====================================================
// TIS TIS PLATFORM - Single Lead API Route
// With Zod Validation (Sprint 3)
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';
import {
  validateRequest,
  validatePathParams,
  checkValidation,
  validationErrorResponse,
} from '@/src/lib/api/zod-validation';
import { leadUpdateSchema, leadIdParamSchema } from '@/src/shared/schemas';

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
    const resolvedParams = await params;

    // Validate path params with Zod
    const paramValidation = validatePathParams(resolvedParams, leadIdParamSchema);
    const paramResult = checkValidation(paramValidation);
    if (paramResult instanceof NextResponse) return paramResult;

    const { id } = paramResult;

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
    const resolvedParams = await params;

    // Validate path params with Zod
    const paramValidation = validatePathParams(resolvedParams, leadIdParamSchema);
    const paramResult = checkValidation(paramValidation);
    if (paramResult instanceof NextResponse) return paramResult;

    const { id } = paramResult;

    // Validate request body with Zod
    const bodyValidation = await validateRequest(request, leadUpdateSchema);
    const body = checkValidation(bodyValidation);
    if (body instanceof NextResponse) return body;

    // Build update data from validated body (Zod already filters and validates fields)
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'phone', 'email', 'status', 'classification',
      'source', 'branch_id', 'assigned_staff_id', 'interested_services',
      'notes', 'custom_fields', 'last_contact_at', 'next_followup_at'
    ];

    for (const field of allowedFields) {
      const value = body[field as keyof typeof body];
      if (value !== undefined) {
        updateData[field] = value;
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
    const resolvedParams = await params;

    // Validate path params with Zod
    const paramValidation = validatePathParams(resolvedParams, leadIdParamSchema);
    const paramResult = checkValidation(paramValidation);
    if (paramResult instanceof NextResponse) return paramResult;

    const { id } = paramResult;

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

    const { client: supabase, tenantId, user } = authContext;
    const resolvedParams = await params;

    // Validate path params with Zod
    const paramValidation = validatePathParams(resolvedParams, leadIdParamSchema);
    const paramResult = checkValidation(paramValidation);
    if (paramResult instanceof NextResponse) return paramResult;

    const { id } = paramResult;

    // Parse body for action
    let body: { action?: string };
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse([{
        field: 'body',
        message: 'JSON invalido en el cuerpo de la peticion',
        code: 'INVALID_JSON'
      }]);
    }

    // Check if this is a restore action
    if (body.action !== 'restore') {
      return validationErrorResponse([{
        field: 'action',
        message: 'Accion invalida. Use action: "restore"',
        code: 'invalid_literal'
      }]);
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
