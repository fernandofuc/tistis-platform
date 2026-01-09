// =====================================================
// TIS TIS PLATFORM - Webhook API Route (Multi-Tenant)
// WhatsApp Business API Integration
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';
import { timingSafeEqual } from 'crypto';
import {
  checkRateLimit,
  getClientIP,
  publicAPILimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';

// SECURITY: No fallback token - require proper configuration
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// SECURITY: Timing-safe token verification to prevent timing attacks
function verifyTokenTimingSafe(providedToken: string | null, expectedToken: string | undefined): boolean {
  if (!expectedToken || !providedToken) {
    return false;
  }
  try {
    const providedBuffer = Buffer.from(providedToken);
    const expectedBuffer = Buffer.from(expectedToken);
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// ======================
// TYPES
// ======================
interface TenantContext {
  tenant_id: string;
  branch_id: string | null;
  channel_connection_id: string;
  ai_enabled: boolean;
}

// ======================
// GET - WhatsApp Webhook Verification
// ======================
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify token is configured
    if (!WHATSAPP_VERIFY_TOKEN) {
      console.error('[Webhook] WHATSAPP_VERIFY_TOKEN not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);

    // WhatsApp webhook verification
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Use timing-safe comparison to prevent timing attacks
    if (mode === 'subscribe' && verifyTokenTimingSafe(token, WHATSAPP_VERIFY_TOKEN)) {
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
  // Rate limiting: 100 requests per minute per IP
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(clientIP, publicAPILimiter);

  if (!rateLimitResult.success) {
    console.warn(`[Webhook] Rate limit exceeded for IP: ${clientIP}`);
    return rateLimitExceeded(rateLimitResult);
  }

  try {
    const supabase = createServerClient();
    const body = await request.json();

    // Only process WhatsApp webhooks
    if (body.object === 'whatsapp_business_account' || body.entry) {
      console.log('[Webhook] Received WhatsApp webhook');
      return await handleWhatsAppWebhook(supabase, body);
    }

    // Unknown webhook source - log and ignore
    console.log('[Webhook] Unknown source, ignoring');
    return NextResponse.json({
      success: true,
      message: 'Webhook received but not processed',
    });
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
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
    .select('id, tenant_id, branch_id, ai_enabled')
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
    channel_connection_id: connection.id,
    ai_enabled: connection.ai_enabled ?? true,
  };
}

// ======================
// HANDLER: WhatsApp Webhook (Multi-tenant)
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
// Uses atomic RPCs to prevent race conditions
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
  const whatsappMessageId = message.id as string;

  // Normalize phone number
  let normalizedPhone = phone.replace(/[^\d+]/g, '');
  if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = `+${normalizedPhone}`;
  }

  // Get contact name from WhatsApp payload
  const contact = contacts.find((c) => c.wa_id === phone.replace('+', ''));
  const profile = contact?.profile as Record<string, unknown> | undefined;
  const contactName = (profile?.name as string) || null;

  // Use atomic RPC to find or create lead (prevents race conditions)
  const { data: leadResult, error: leadError } = await supabase.rpc('find_or_create_channel_lead', {
    p_tenant_id: context.tenant_id,
    p_branch_id: context.branch_id,
    p_channel: 'whatsapp',
    p_identifier: normalizedPhone,
    p_contact_name: contactName,
    p_profile_image_url: null,
  });

  if (leadError || !leadResult || leadResult.length === 0) {
    console.error('[WhatsApp] Error finding/creating lead:', leadError?.message);
    throw new Error(`Failed to find/create lead: ${leadError?.message}`);
  }

  const lead = leadResult[0];

  // Use atomic RPC to find or create conversation (prevents race conditions)
  const { data: convResult, error: convError } = await supabase.rpc('find_or_create_channel_conversation', {
    p_tenant_id: context.tenant_id,
    p_branch_id: context.branch_id,
    p_lead_id: lead.lead_id,
    p_channel: 'whatsapp',
    p_channel_connection_id: context.channel_connection_id,
    p_ai_enabled: context.ai_enabled,
  });

  if (convError || !convResult || convResult.length === 0) {
    console.error('[WhatsApp] Error finding/creating conversation:', convError?.message);
    throw new Error(`Failed to find/create conversation: ${convError?.message}`);
  }

  const conversation = convResult[0];

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

  // Use atomic RPC to save message (handles duplicates)
  const { data: msgResult, error: msgError } = await supabase.rpc('save_incoming_message', {
    p_conversation_id: conversation.conversation_id,
    p_lead_id: lead.lead_id,
    p_content: content,
    p_message_type: messageType,
    p_channel: 'whatsapp',
    p_media_url: mediaUrl,
    p_whatsapp_message_id: whatsappMessageId,
    p_metadata: { timestamp },
  });

  if (msgError) {
    console.error('[WhatsApp] Error saving message:', msgError.message);
    throw new Error(`Failed to save message: ${msgError.message}`);
  }

  // Check if duplicate
  if (msgResult && msgResult.length > 0 && msgResult[0].is_duplicate) {
    console.log(`[WhatsApp] Skipping duplicate message: ${whatsappMessageId}`);
    return;
  }

  // Log success
  const wasReopened = conversation.was_reopened ? ' (reopened)' : '';
  const isNewConv = conversation.is_new ? ' (new conversation)' : '';
  console.log(
    `[WhatsApp] Message saved for lead ${lead.lead_id}, conversation ${conversation.conversation_id}${wasReopened}${isNewConv}`
  );

  // Note: AI response is handled by the tenant-specific webhook at /api/webhook/whatsapp/[tenantSlug]
  // This legacy endpoint is for backwards compatibility
}
