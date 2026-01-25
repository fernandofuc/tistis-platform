// =====================================================
// TIS TIS PLATFORM - Setup Assistant Conversation Detail
// GET: Get conversation with recent messages
// PATCH: Update conversation status/metadata
// DELETE: Archive conversation
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import {
  rowToConversation,
  rowToMessage,
  type ConversationStatus,
  type SetupModule,
} from '@/src/features/setup-assistant';

// Route params type for Next.js 15
interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ======================
// GET - Get conversation with messages
// ======================
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID format' },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId } = authResult;

    // Get conversation (RLS ensures tenant isolation)
    const { data: conversationData, error: convError } = await supabase
      .from('setup_assistant_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversationData) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Get recent messages (last 50)
    const { data: messagesData, error: msgError } = await supabase
      .from('setup_assistant_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (msgError) {
      console.error('[SetupAssistant] Error fetching messages:', msgError);
    }

    // Transform to camelCase
    const conversation = rowToConversation(conversationData);
    const messages = (messagesData || []).map(rowToMessage);

    return NextResponse.json({
      conversation,
      messages,
    });
  } catch (error) {
    console.error('[SetupAssistant] Get conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update conversation
// ======================
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID format' },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId } = authResult;

    // Parse body
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Build update object with allowed fields only
    const updateData: Record<string, unknown> = {};

    // status
    if (body.status !== undefined) {
      const validStatuses: ConversationStatus[] = ['active', 'completed', 'archived'];
      if (validStatuses.includes(body.status as ConversationStatus)) {
        updateData.status = body.status;
        // Set completed_at timestamp if completing
        if (body.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }
      }
    }

    // title
    if (body.title !== undefined) {
      updateData.title = typeof body.title === 'string' ? body.title.slice(0, 255) : null;
    }

    // summary
    if (body.summary !== undefined) {
      updateData.summary = typeof body.summary === 'string' ? body.summary.slice(0, 2000) : null;
    }

    // current_module
    if (body.currentModule !== undefined) {
      const validModules: (SetupModule | null)[] = [
        'general', 'loyalty', 'agents', 'knowledge_base',
        'services', 'promotions', 'staff', 'branches', null
      ];
      if (validModules.includes(body.currentModule as SetupModule | null)) {
        updateData.current_module = body.currentModule;
      }
    }

    // setup_progress (JSON)
    if (body.setupProgress !== undefined && typeof body.setupProgress === 'object') {
      updateData.setup_progress = body.setupProgress;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Perform update
    const { data, error } = await supabase
      .from('setup_assistant_conversations')
      .update(updateData)
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('[SetupAssistant] Error updating conversation:', error);
      return NextResponse.json(
        { error: 'Failed to update conversation' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conversation: rowToConversation(data),
    });
  } catch (error) {
    console.error('[SetupAssistant] Update conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Archive conversation
// ======================
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID format' },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId } = authResult;

    // Archive instead of hard delete
    const { error } = await supabase
      .from('setup_assistant_conversations')
      .update({ status: 'archived' })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[SetupAssistant] Error archiving conversation:', error);
      return NextResponse.json(
        { error: 'Failed to archive conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SetupAssistant] Archive conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
