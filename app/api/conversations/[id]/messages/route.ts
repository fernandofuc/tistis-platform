// =====================================================
// TIS TIS PLATFORM - Conversation Messages API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';

// ======================
// GET - Fetch messages for a conversation
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

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const before = searchParams.get('before'); // For pagination

    // Verify conversation exists and belongs to authenticated user's tenant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Build messages query
    let query = supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Reverse to show oldest first in UI
    const messages = data?.reverse() || [];

    return NextResponse.json({
      data: messages,
      pagination: {
        total: count || 0,
        hasMore: (count || 0) > messages.length,
      },
    });
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Send a message
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

    const { client: supabase, tenantId } = authContext;
    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Verify conversation exists and belongs to authenticated user's tenant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, lead_id, status')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Create message
    // CRITICAL FIX: Include BOTH role and sender_type for compatibility
    // - 'role' is required by migration 012 (NOT NULL constraint)
    // - 'sender_type' is used by save_incoming_message RPC (migration 110)
    // - Inbox page.tsx reads 'role' to determine message sender
    // Mapping: user↔lead, assistant↔ai, staff↔staff, system↔system
    const senderType = body.sender_type || 'staff';
    const roleMap: Record<string, string> = {
      lead: 'user',
      ai: 'assistant',
      staff: 'staff',
      system: 'system',
    };
    const messageData = {
      conversation_id: id,
      role: roleMap[senderType] || 'staff',
      sender_type: senderType,
      sender_id: body.sender_id || null,
      content: body.content,
      message_type: body.message_type || 'text', // 'text', 'image', 'document', 'audio'
      media_url: body.media_url || null,
      metadata: body.metadata || {},
      status: 'sent',
    };

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (msgError) {
      console.error('Error creating message:', msgError);
      return NextResponse.json(
        { error: msgError.message },
        { status: 500 }
      );
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        status: conversation.status === 'resolved' ? 'active' : conversation.status,
      })
      .eq('id', id);

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
