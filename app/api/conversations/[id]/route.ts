// =====================================================
// TIS TIS PLATFORM - Single Conversation API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';

// ======================
// GET - Fetch single conversation with messages
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
    const { searchParams } = new URL(request.url);
    const includeMessages = searchParams.get('include_messages') !== 'false';

    // Fetch conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        lead:leads(id, first_name, last_name, full_name, phone, email, classification, score, interested_services),
        branch:branches(id, name, city),
        assigned_staff:staff(id, first_name, last_name, role, email)
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (convError) {
      if (convError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching conversation:', convError);
      return NextResponse.json(
        { error: convError.message },
        { status: 500 }
      );
    }

    // Fetch messages if requested
    let messages = [];
    if (includeMessages) {
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (!msgError && msgData) {
        messages = msgData;
      }
    }

    return NextResponse.json({
      data: {
        ...conversation,
        messages,
      },
    });
  } catch (error) {
    console.error('Conversation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// REVISIÓN 5.4.1: ROLE-BASED PERMISSIONS
// ======================

// Define which roles can perform which actions
const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Roles that can escalate conversations
  escalate: ['admin', 'manager', 'dentist', 'doctor', 'supervisor', 'staff'],
  // Roles that can resolve/close conversations
  resolve: ['admin', 'manager', 'dentist', 'doctor', 'supervisor', 'staff'],
  // Roles that can toggle AI handling
  toggle_ai: ['admin', 'manager', 'supervisor'],
  // Roles that can reassign staff
  reassign: ['admin', 'manager', 'supervisor'],
  // Roles that can change branch assignment
  change_branch: ['admin', 'manager'],
};

/**
 * REVISIÓN 5.4.1: Check if user role has permission for an action
 */
function hasPermission(userRole: string, action: keyof typeof ROLE_PERMISSIONS): boolean {
  const allowedRoles = ROLE_PERMISSIONS[action];
  return allowedRoles?.includes(userRole.toLowerCase()) ?? false;
}

// ======================
// PATCH - Update conversation
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

    const { client: supabase, tenantId, role: userRole } = authContext;
    const { id } = await params;
    const body = await request.json();

    // REVISIÓN 5.4.1: Validate role-based permissions before processing
    // Check specific permission requirements
    if (body.status === 'escalated' && !hasPermission(userRole, 'escalate')) {
      console.warn(`[Conversation PATCH] User with role '${userRole}' attempted to escalate without permission`);
      return NextResponse.json(
        { error: 'You do not have permission to escalate conversations' },
        { status: 403 }
      );
    }
    if (body.status === 'resolved' && !hasPermission(userRole, 'resolve')) {
      console.warn(`[Conversation PATCH] User with role '${userRole}' attempted to resolve without permission`);
      return NextResponse.json(
        { error: 'You do not have permission to resolve conversations' },
        { status: 403 }
      );
    }
    if (body.ai_handling !== undefined && !hasPermission(userRole, 'toggle_ai')) {
      console.warn(`[Conversation PATCH] User with role '${userRole}' attempted to toggle AI without permission`);
      return NextResponse.json(
        { error: 'You do not have permission to toggle AI handling' },
        { status: 403 }
      );
    }
    if (body.assigned_staff_id !== undefined && !hasPermission(userRole, 'reassign')) {
      console.warn(`[Conversation PATCH] User with role '${userRole}' attempted to reassign without permission`);
      return NextResponse.json(
        { error: 'You do not have permission to reassign conversations' },
        { status: 403 }
      );
    }
    if (body.branch_id !== undefined && !hasPermission(userRole, 'change_branch')) {
      console.warn(`[Conversation PATCH] User with role '${userRole}' attempted to change branch without permission`);
      return NextResponse.json(
        { error: 'You do not have permission to change branch assignment' },
        { status: 403 }
      );
    }

    // Fields allowed for update
    const allowedFields = [
      'status', 'ai_handling', 'assigned_staff_id', 'branch_id',
      'escalation_reason', 'resolution_notes', 'satisfaction_score'
    ];

    // Filter only allowed fields
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Handle status transitions
    if (updateData.status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }
    if (updateData.status === 'escalated' && body.escalation_reason) {
      updateData.escalated_at = new Date().toISOString();
      updateData.ai_handling = false;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select(`
        *,
        lead:leads(id, first_name, last_name, full_name, phone),
        assigned_staff:staff(id, first_name, last_name)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      console.error('Error updating conversation:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Conversation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
