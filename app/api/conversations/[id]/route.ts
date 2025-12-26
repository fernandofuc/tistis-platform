// =====================================================
// TIS TIS PLATFORM - Single Conversation API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, DEFAULT_TENANT_ID } from '@/src/shared/lib/supabase';

// ======================
// GET - Fetch single conversation with messages
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
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
      .eq('tenant_id', DEFAULT_TENANT_ID)
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
// PATCH - Update conversation
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const body = await request.json();

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
      .eq('tenant_id', DEFAULT_TENANT_ID)
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
