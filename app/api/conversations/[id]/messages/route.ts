// =====================================================
// TIS TIS PLATFORM - Conversation Messages API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';

const ESVA_TENANT_ID = process.env.NEXT_PUBLIC_ESVA_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';

// ======================
// GET - Fetch messages for a conversation
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // For pagination

    // Verify conversation exists and belongs to tenant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', ESVA_TENANT_ID)
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
    const { id } = await params;
    const supabase = createServerClient();
    const body = await request.json();

    // Validate required fields
    if (!body.content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Verify conversation exists and get details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, lead_id, status')
      .eq('tenant_id', ESVA_TENANT_ID)
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Create message
    const messageData = {
      conversation_id: id,
      sender_type: body.sender_type || 'staff', // 'lead', 'staff', 'ai'
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
