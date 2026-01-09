// =====================================================
// TIS TIS PLATFORM - Send Message API
// POST /api/messages/send
// =====================================================
// REVISIÓN 5.4 G-I5: Cancela jobs AI pendientes cuando staff responde

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';
import { sendWhatsAppMessage } from '@/src/features/messaging/services/whatsapp.service';
import type { ChannelConnection } from '@/src/shared/types/whatsapp';
import { createServerClient } from '@/src/shared/lib/supabase';

// ======================
// TYPES
// ======================
interface SendMessageRequest {
  conversation_id: string;
  content: string;
  message_type?: 'text' | 'image' | 'document';
}

// ======================
// REVISIÓN 5.4 G-I5: CANCEL AI JOBS ON STAFF REPLY
// ======================

/**
 * Cancela jobs de AI pendientes cuando el staff responde manualmente
 * Evita respuestas duplicadas (staff + AI) al mismo mensaje
 *
 * REVISIÓN 5.4 G-I5
 */
async function cancelPendingAIJobs(conversationId: string): Promise<number> {
  const supabase = createServerClient();

  try {
    // Cancelar jobs de AI pendientes para esta conversación
    const { data, error } = await supabase
      .from('job_queue')
      .update({
        status: 'cancelled',
        error_message: 'Cancelled: Staff responded manually (G-I5)',
        completed_at: new Date().toISOString(),
      })
      .eq('job_type', 'ai_response')
      .eq('status', 'pending')
      .select('id, payload');

    if (error) {
      console.warn('[Send Message] G-I5: Failed to query AI jobs:', error);
      return 0;
    }

    // Filtrar por conversation_id (payload es JSONB)
    const jobsForConversation = data?.filter(
      job => (job.payload as { conversation_id?: string })?.conversation_id === conversationId
    );

    // Si encontramos jobs para esta conversación, hacer update específico
    if (jobsForConversation && jobsForConversation.length > 0) {
      const jobIds = jobsForConversation.map(j => j.id);

      await supabase
        .from('job_queue')
        .update({
          status: 'cancelled',
          error_message: 'Cancelled: Staff responded manually (G-I5)',
          completed_at: new Date().toISOString(),
        })
        .in('id', jobIds);

      console.log(
        `[Send Message] G-I5: Cancelled ${jobsForConversation.length} pending AI job(s) for conversation ${conversationId}`
      );

      return jobsForConversation.length;
    }

    return 0;
  } catch (err) {
    console.error('[Send Message] G-I5: Error cancelling AI jobs:', err);
    return 0;
  }
}

// ======================
// POST - Send Message
// ======================
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if (isAuthError(authContext)) {
      return createAuthErrorResponse(authContext);
    }

    const { client: supabase, tenantId } = authContext;

    // 1. Parse request body
    const body: SendMessageRequest = await request.json();

    if (!body.conversation_id || !body.content) {
      return NextResponse.json(
        { error: 'conversation_id and content are required' },
        { status: 400 }
      );
    }

    // 2. Get conversation with lead and channel info - verify it belongs to user's tenant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        tenant_id,
        lead_id,
        channel,
        channel_connection_id,
        leads:lead_id (
          id,
          phone,
          phone_normalized,
          name
        )
      `)
      .eq('id', body.conversation_id)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      console.error('[Send Message] Conversation not found:', convError);
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const lead = conversation.leads as unknown as { id: string; phone: string; phone_normalized: string; name: string };

    // 3. Get channel connection for sending
    const { data: connection, error: connError } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('id', conversation.channel_connection_id)
      .single();

    if (connError || !connection) {
      console.error('[Send Message] Channel connection not found:', connError);
      return NextResponse.json(
        { error: 'Channel connection not configured' },
        { status: 400 }
      );
    }

    // 4. Save message to database first
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: body.conversation_id,
        sender_type: 'staff',
        content: body.content,
        message_type: body.message_type || 'text',
        channel: conversation.channel,
        status: 'pending',
      })
      .select('id')
      .single();

    if (msgError || !message) {
      console.error('[Send Message] Failed to save message:', msgError);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    // REVISIÓN 5.4 G-I5: Cancelar jobs AI pendientes cuando staff responde
    // Esto evita respuestas duplicadas (staff responde + AI también responde)
    const cancelledJobs = await cancelPendingAIJobs(body.conversation_id);
    if (cancelledJobs > 0) {
      console.log(`[Send Message] G-I5: Staff reply cancelled ${cancelledJobs} pending AI jobs`);
    }

    // 5. Send via appropriate channel
    let sendResult: { success: boolean; messageId?: string; error?: string } = { success: false };

    if (conversation.channel === 'whatsapp') {
      try {
        const result = await sendWhatsAppMessage(
          connection as ChannelConnection,
          lead.phone_normalized || lead.phone,
          body.content
        );
        sendResult = { success: true, messageId: result.messageId };
      } catch (error) {
        sendResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send'
        };
      }
    } else {
      // For other channels (instagram, facebook), queue for later implementation
      sendResult = { success: true, messageId: 'queued' };
      console.log(`[Send Message] Channel ${conversation.channel} message queued`);
    }

    // 6. Update message status
    await supabase
      .from('messages')
      .update({
        status: sendResult.success ? 'sent' : 'failed',
        external_id: sendResult.messageId,
        error_message: sendResult.error,
      })
      .eq('id', message.id);

    // 7. Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', body.conversation_id);

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || 'Failed to send message' },
        { status: 500 }
      );
    }

    // Log without exposing phone number
    console.log(`[Send Message] Sent to lead ${lead.id}, message ${message.id}`);

    return NextResponse.json({
      success: true,
      message_id: message.id,
      external_id: sendResult.messageId,
    });

  } catch (error) {
    console.error('[Send Message] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
