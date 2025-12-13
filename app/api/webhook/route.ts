// =====================================================
// TIS TIS PLATFORM - Webhook API Route (Multi-Tenant)
// Prepared for WhatsApp Business API & n8n Integration
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'tistis_verify_token';

// ======================
// TYPES
// ======================
interface TenantContext {
  tenant_id: string;
  branch_id: string | null;
  ai_enabled: boolean;
}

// ======================
// GET - WhatsApp Webhook Verification
// ======================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // WhatsApp webhook verification
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('[Webhook] WhatsApp verification successful');
      return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 403 }
    );
  } catch (error) {
    console.error('[Webhook] Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Handle incoming webhooks
// ======================
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    // Identify webhook source
    const source = identifyWebhookSource(body, request.headers);

    console.log(`[Webhook] Received from: ${source}`, JSON.stringify(body, null, 2));

    switch (source) {
      case 'whatsapp':
        return await handleWhatsAppWebhook(supabase, body);
      case 'n8n':
        return await handleN8nWebhook(supabase, body);
      default:
        return await handleGenericWebhook(supabase, body);
    }
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ======================
// HELPER: Identify Webhook Source
// ======================
function identifyWebhookSource(body: Record<string, unknown>, headers: Headers): string {
  // WhatsApp webhook structure
  if (body.object === 'whatsapp_business_account' || body.entry) {
    return 'whatsapp';
  }

  // n8n webhook header
  if (headers.get('x-n8n-signature') || body.n8n_source) {
    return 'n8n';
  }

  return 'unknown';
}

// ======================
// HELPER: Get Tenant Context from phone_number_id (Multi-tenant)
// ======================
async function getTenantContext(
  supabase: ReturnType<typeof createServerClient>,
  phoneNumberId: string
): Promise<TenantContext | null> {
  // Find channel_connection by phone_number_id
  const { data: connection } = await supabase
    .from('channel_connections')
    .select('tenant_id, branch_id, ai_enabled')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .eq('channel', 'whatsapp')
    .eq('status', 'connected')
    .single();

  if (!connection) {
    console.error(`[WhatsApp] No connection found for phone_number_id: ${phoneNumberId}`);
    return null;
  }

  return {
    tenant_id: connection.tenant_id,
    branch_id: connection.branch_id,
    ai_enabled: connection.ai_enabled ?? true,
  };
}

// ======================
// HANDLER: WhatsApp Webhook (Multi-tenant)
// Ready for WhatsApp Business API integration
// ======================
async function handleWhatsAppWebhook(
  supabase: ReturnType<typeof createServerClient>,
  body: Record<string, unknown>
): Promise<NextResponse> {
  try {
    // Parse WhatsApp webhook structure
    const entries = (body.entry as Record<string, unknown>[]) || [];

    for (const entry of entries) {
      const changes = (entry.changes as Record<string, unknown>[]) || [];

      for (const change of changes) {
        if (change.field === 'messages') {
          const value = change.value as Record<string, unknown>;
          const metadata = value.metadata as Record<string, unknown>;
          const phoneNumberId = metadata?.phone_number_id as string;
          const messages = (value.messages as Record<string, unknown>[]) || [];
          const contacts = (value.contacts as Record<string, unknown>[]) || [];

          // Get tenant context from phone_number_id
          const context = phoneNumberId
            ? await getTenantContext(supabase, phoneNumberId)
            : null;

          if (!context) {
            console.error('[WhatsApp Webhook] Could not determine tenant context');
            continue;
          }

          for (const message of messages) {
            await processIncomingWhatsAppMessage(supabase, context, message, contacts);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);
    return NextResponse.json(
      { error: 'WhatsApp webhook processing failed' },
      { status: 500 }
    );
  }
}

// ======================
// PROCESS: Incoming WhatsApp Message (Multi-tenant)
// ======================
async function processIncomingWhatsAppMessage(
  supabase: ReturnType<typeof createServerClient>,
  context: TenantContext,
  message: Record<string, unknown>,
  contacts: Record<string, unknown>[]
): Promise<void> {
  const phone = message.from as string;
  const messageType = message.type as string;
  const timestamp = message.timestamp as string;

  // Normalize phone number
  let normalizedPhone = phone.replace(/[^\d+]/g, '');
  if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = `+${normalizedPhone}`;
  }

  // Find or create lead with tenant and branch context
  const lead = await findOrCreateLead(supabase, context.tenant_id, context.branch_id, normalizedPhone, contacts);

  // Find or create conversation with tenant and branch context
  const conversation = await findOrCreateConversation(supabase, context.tenant_id, context.branch_id, lead.id);

  // Extract message content
  let content = '';
  let mediaUrl = null;

  switch (messageType) {
    case 'text':
      content = (message.text as Record<string, unknown>)?.body as string || '';
      break;
    case 'image':
      content = (message.image as Record<string, unknown>)?.caption as string || '[Imagen]';
      mediaUrl = (message.image as Record<string, unknown>)?.id as string;
      break;
    case 'document':
      content = (message.document as Record<string, unknown>)?.filename as string || '[Documento]';
      mediaUrl = (message.document as Record<string, unknown>)?.id as string;
      break;
    case 'audio':
      content = '[Audio]';
      mediaUrl = (message.audio as Record<string, unknown>)?.id as string;
      break;
    case 'location': {
      const location = message.location as Record<string, unknown>;
      content = `[Ubicación: ${location?.latitude}, ${location?.longitude}]`;
      break;
    }
    default:
      content = `[${messageType}]`;
  }

  // Save message
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'lead',
    sender_id: lead.id,
    content,
    message_type: messageType,
    media_url: mediaUrl,
    metadata: {
      whatsapp_message_id: message.id as string,
      timestamp,
    },
    status: 'received',
  });

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id);

  // TODO: Trigger AI response if ai_handling is true
  // This will be connected to n8n workflow
  console.log(`[WhatsApp] Message saved for lead ${lead.id}, conversation ${conversation.id}`);
}

// ======================
// HELPER: Find or Create Lead (Multi-tenant)
// ======================
async function findOrCreateLead(
  supabase: ReturnType<typeof createServerClient>,
  tenantId: string,
  branchId: string | null,
  phone: string,
  contacts: Record<string, unknown>[]
): Promise<{ id: string; name: string }> {
  // Check existing lead
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('phone_normalized', phone)
    .single();

  if (existingLead) {
    return existingLead;
  }

  // Get name from contacts if available
  const contact = contacts.find((c) => c.wa_id === phone.replace('+', ''));
  const profile = contact?.profile as Record<string, unknown> | undefined;
  const name = (profile?.name as string) || 'Unknown';

  // Create new lead with branch_id
  const { data: newLead, error } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      phone,
      phone_normalized: phone,
      name,
      source: 'whatsapp',
      status: 'new',
      classification: 'warm',
      score: 50,
    })
    .select('id, name')
    .single();

  if (error) {
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  return newLead;
}

// ======================
// HELPER: Find or Create Conversation (Multi-tenant)
// ======================
async function findOrCreateConversation(
  supabase: ReturnType<typeof createServerClient>,
  tenantId: string,
  branchId: string | null,
  leadId: string
): Promise<{ id: string }> {
  // Check existing active conversation
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('lead_id', leadId)
    .in('status', ['active', 'pending'])
    .single();

  if (existingConv) {
    return existingConv;
  }

  // Create new conversation with branch_id
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      lead_id: leadId,
      channel: 'whatsapp',
      status: 'active',
      ai_handling: true,
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return newConv;
}

// ======================
// HANDLER: n8n Webhook
// Ready for n8n workflow integration
// ======================
async function handleN8nWebhook(
  supabase: ReturnType<typeof createServerClient>,
  body: Record<string, unknown>
): Promise<NextResponse> {
  try {
    const action = body.action as string;

    switch (action) {
      case 'ai_response':
        // Handle AI-generated response from n8n
        return await handleAIResponse(supabase, body);

      case 'update_lead_score':
        // Handle lead scoring updates
        return await handleLeadScoreUpdate(supabase, body);

      case 'schedule_appointment':
        // Handle appointment scheduling
        return await handleAppointmentScheduling(supabase, body);

      case 'escalate_conversation':
        // Handle conversation escalation
        return await handleEscalation(supabase, body);

      default:
        console.log(`[n8n Webhook] Unknown action: ${action}`);
        return NextResponse.json({ success: true, action: 'logged' });
    }
  } catch (error) {
    console.error('[n8n Webhook] Error:', error);
    return NextResponse.json(
      { error: 'n8n webhook processing failed' },
      { status: 500 }
    );
  }
}

// ======================
// n8n ACTION: AI Response
// ======================
async function handleAIResponse(
  supabase: ReturnType<typeof createServerClient>,
  body: Record<string, unknown>
): Promise<NextResponse> {
  const conversationId = body.conversation_id as string;
  const content = body.content as string;

  if (!conversationId || !content) {
    return NextResponse.json(
      { error: 'conversation_id and content required' },
      { status: 400 }
    );
  }

  // Save AI message
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'ai',
    content,
    message_type: 'text',
    status: 'sent',
    metadata: {
      model: body.model || 'claude-3-opus',
      tokens: body.tokens || 0,
    },
  });

  // Update conversation
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  // TODO: Send message via WhatsApp API
  console.log(`[n8n] AI response saved for conversation ${conversationId}`);

  return NextResponse.json({ success: true, action: 'ai_response_saved' });
}

// ======================
// n8n ACTION: Lead Score Update (Multi-tenant)
// ======================
async function handleLeadScoreUpdate(
  supabase: ReturnType<typeof createServerClient>,
  body: Record<string, unknown>
): Promise<NextResponse> {
  const tenantId = body.tenant_id as string;
  const leadId = body.lead_id as string;
  const score = body.score as number;
  const reason = body.reason as string;

  if (!tenantId || !leadId || score === undefined) {
    return NextResponse.json(
      { error: 'tenant_id, lead_id and score required' },
      { status: 400 }
    );
  }

  // Determine classification
  let classification = 'cold';
  if (score >= 80) classification = 'hot';
  else if (score >= 40) classification = 'warm';

  await supabase
    .from('leads')
    .update({
      score,
      classification,
      notes: reason ? `Score updated: ${reason}` : undefined,
    })
    .eq('id', leadId)
    .eq('tenant_id', tenantId);

  console.log(`[n8n] Lead ${leadId} score updated to ${score}`);

  return NextResponse.json({ success: true, action: 'score_updated' });
}

// ======================
// n8n ACTION: Appointment Scheduling (Multi-tenant)
// ======================
async function handleAppointmentScheduling(
  supabase: ReturnType<typeof createServerClient>,
  body: Record<string, unknown>
): Promise<NextResponse> {
  const tenantId = body.tenant_id as string;
  const leadId = body.lead_id as string;
  const branchId = body.branch_id as string;
  const scheduledAt = body.scheduled_at as string;
  const serviceId = body.service_id as string;

  if (!tenantId || !leadId || !branchId || !scheduledAt) {
    return NextResponse.json(
      { error: 'tenant_id, lead_id, branch_id, and scheduled_at required' },
      { status: 400 }
    );
  }

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      branch_id: branchId,
      service_id: serviceId || null,
      scheduled_at: scheduledAt,
      status: 'scheduled',
      source: 'ai',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  console.log(`[n8n] Appointment ${appointment.id} scheduled`);

  return NextResponse.json({
    success: true,
    action: 'appointment_scheduled',
    appointment_id: appointment.id,
  });
}

// ======================
// n8n ACTION: Escalation (Multi-tenant)
// ======================
async function handleEscalation(
  supabase: ReturnType<typeof createServerClient>,
  body: Record<string, unknown>
): Promise<NextResponse> {
  const tenantId = body.tenant_id as string;
  const conversationId = body.conversation_id as string;
  const reason = body.reason as string;
  const staffId = body.staff_id as string;

  if (!tenantId || !conversationId) {
    return NextResponse.json(
      { error: 'tenant_id and conversation_id required' },
      { status: 400 }
    );
  }

  await supabase
    .from('conversations')
    .update({
      status: 'escalated',
      ai_handling: false,
      escalation_reason: reason || 'AI escalation',
      escalated_at: new Date().toISOString(),
      assigned_staff_id: staffId || null,
    })
    .eq('id', conversationId)
    .eq('tenant_id', tenantId);

  console.log(`[n8n] Conversation ${conversationId} escalated`);

  return NextResponse.json({ success: true, action: 'escalated' });
}

// ======================
// HANDLER: Generic Webhook
// ======================
async function handleGenericWebhook(
  _supabase: ReturnType<typeof createServerClient>,
  _body: Record<string, unknown>
): Promise<NextResponse> {
  // Log unknown webhooks for debugging
  console.log('[Webhook] Unknown source, logging payload');

  // Could save to a webhooks_log table for debugging
  // await _supabase.from('webhook_logs').insert({ payload: _body });

  return NextResponse.json({
    success: true,
    message: 'Webhook received and logged',
  });
}
