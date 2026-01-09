// =====================================================
// TIS TIS PLATFORM - WhatsApp Service
// Multi-tenant WhatsApp Business API Service
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import type {
  WhatsAppWebhookPayload,
  WhatsAppMessage,
  WhatsAppContact,
  WhatsAppStatus,
  WhatsAppChangeValue,
  ParsedWhatsAppMessage,
  WhatsAppOutboundMessage,
  AIResponseJobPayload,
  SendMessageJobPayload,
  ChannelConnection,
} from '@/src/shared/types/whatsapp';
import crypto from 'crypto';
import {
  processHighPriorityPatterns,
  queueMessageForLearning,
} from '@/src/features/ai/services/message-learning.service';

// ======================
// TYPES
// ======================

interface TenantContext {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_vertical: string;
  branch_id: string | null;
  channel_connection: ChannelConnection;
  ai_enabled: boolean;
}

interface ProcessResult {
  success: boolean;
  messages_processed: number;
  statuses_processed: number;
  errors: string[];
}

// ======================
// SIGNATURE VERIFICATION
// ======================

/**
 * Verifica la firma X-Hub-Signature-256 de Meta
 * CRÍTICO para seguridad - rechaza payloads con firma inválida
 */
export function verifyWhatsAppSignature(
  payload: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) {
    console.error('[WhatsApp] Missing X-Hub-Signature-256 header');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  );

  if (!isValid) {
    console.error('[WhatsApp] Invalid signature - possible tampering');
  }

  return isValid;
}

// ======================
// PHONE NORMALIZATION
// ======================

/**
 * Normaliza número de teléfono a formato E.164
 * Ejemplos:
 * - "5491112345678" -> "+5491112345678"
 * - "+1 (555) 123-4567" -> "+15551234567"
 * - "521234567890" -> "+521234567890"
 */
export function normalizePhoneNumber(phone: string): string {
  // Remover todo excepto dígitos y +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Asegurar que empiece con +
  if (!normalized.startsWith('+')) {
    normalized = `+${normalized}`;
  }

  return normalized;
}

// ======================
// MESSAGE PARSER
// ======================

/**
 * Parsea un mensaje entrante de WhatsApp a formato interno
 */
export function parseWhatsAppMessage(
  message: WhatsAppMessage,
  contacts: WhatsAppContact[],
  metadata: WhatsAppChangeValue['metadata']
): ParsedWhatsAppMessage {
  const phone = message.from;
  const phoneNormalized = normalizePhoneNumber(phone);

  // Buscar nombre del contacto
  const contact = contacts.find(
    (c) => c.wa_id === phone || c.wa_id === phone.replace('+', '')
  );
  const contactName = contact?.profile?.name;

  // Extraer contenido según tipo de mensaje
  let content = '';
  let mediaId: string | undefined;
  let mediaType: string | undefined;

  switch (message.type) {
    case 'text':
      content = message.text?.body || '';
      break;

    case 'image':
      content = message.image?.caption || '[Imagen recibida]';
      mediaId = message.image?.id;
      mediaType = message.image?.mime_type || 'image/jpeg';
      break;

    case 'audio':
      content = '[Audio recibido]';
      mediaId = message.audio?.id;
      mediaType = message.audio?.mime_type || 'audio/ogg';
      break;

    case 'video':
      content = message.video?.caption || '[Video recibido]';
      mediaId = message.video?.id;
      mediaType = message.video?.mime_type || 'video/mp4';
      break;

    case 'document':
      content = message.document?.filename || '[Documento recibido]';
      mediaId = message.document?.id;
      mediaType = message.document?.mime_type || 'application/pdf';
      break;

    case 'location':
      if (message.location) {
        const { latitude, longitude, name, address } = message.location;
        content = name
          ? `[Ubicacion: ${name}${address ? ` - ${address}` : ''}]`
          : `[Ubicacion: ${latitude}, ${longitude}]`;
      }
      break;

    case 'contacts':
      if (message.contacts && message.contacts.length > 0) {
        const contactNames = message.contacts
          .map((c) => c.name.formatted_name)
          .join(', ');
        content = `[Contactos compartidos: ${contactNames}]`;
      }
      break;

    case 'interactive':
      if (message.interactive) {
        if (message.interactive.button_reply) {
          content = message.interactive.button_reply.title;
        } else if (message.interactive.list_reply) {
          content = message.interactive.list_reply.title;
        }
      }
      break;

    case 'button':
      content = message.button?.text || '[Boton presionado]';
      break;

    case 'sticker':
      content = '[Sticker recibido]';
      break;

    default:
      content = `[Mensaje tipo ${message.type}]`;
  }

  return {
    phone,
    phoneNormalized,
    messageId: message.id,
    timestamp: new Date(parseInt(message.timestamp) * 1000),
    type: message.type,
    content,
    mediaId,
    mediaType,
    contactName,
    metadata: {
      phoneNumberId: metadata.phone_number_id,
      displayPhoneNumber: metadata.display_phone_number,
      isReply: !!message.context,
      replyToMessageId: message.context?.id,
    },
  };
}

// ======================
// TENANT CONTEXT
// ======================

/**
 * Obtiene el contexto del tenant a partir del slug y phone_number_id
 */
export async function getTenantContext(
  tenantSlug: string,
  phoneNumberId: string
): Promise<TenantContext | null> {
  const supabase = createServerClient();

  // Buscar tenant por slug (incluyendo vertical para AI learning)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, slug, vertical')
    .eq('slug', tenantSlug)
    .eq('status', 'active')
    .single();

  if (tenantError || !tenant) {
    console.error(`[WhatsApp] Tenant not found: ${tenantSlug}`);
    return null;
  }

  // Buscar channel_connection por phone_number_id
  const { data: connection, error: connError } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('channel', 'whatsapp')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .eq('status', 'connected')
    .single();

  if (connError || !connection) {
    console.error(
      `[WhatsApp] Channel connection not found for tenant ${tenantSlug}, phone_number_id ${phoneNumberId}`
    );
    return null;
  }

  return {
    tenant_id: tenant.id,
    tenant_slug: tenant.slug,
    tenant_name: tenant.name,
    tenant_vertical: tenant.vertical || 'general',
    branch_id: connection.branch_id,
    channel_connection: connection as ChannelConnection,
    ai_enabled: connection.ai_enabled,
  };
}

// ======================
// LEAD MANAGEMENT
// ======================

/**
 * Busca o crea un lead basado en el número de teléfono
 * FIXED: Uses atomic RPC function with advisory lock to prevent race conditions
 * FIXED: Properly excludes soft-deleted leads
 */
export async function findOrCreateLead(
  tenantId: string,
  branchId: string | null,
  phoneNormalized: string,
  contactName?: string,
  source: string = 'whatsapp'
): Promise<{ id: string; name: string; isNew: boolean }> {
  const supabase = createServerClient();

  // Use atomic RPC function to prevent race conditions
  // This function uses advisory locks to ensure only one lead is created
  // even if multiple webhooks arrive simultaneously
  const { data: result, error } = await supabase.rpc('find_or_create_lead', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_phone_normalized: phoneNormalized,
    p_contact_name: contactName || null,
    p_source: source,
  });

  if (error) {
    console.error('[WhatsApp] Error in find_or_create_lead RPC:', error);
    throw new Error(`Failed to find/create lead: ${error.message}`);
  }

  // RPC returns array, get first row
  const leadResult = Array.isArray(result) ? result[0] : result;

  if (!leadResult?.lead_id) {
    throw new Error('find_or_create_lead returned no result');
  }

  if (leadResult.is_new) {
    console.log(`[WhatsApp] New lead created: ${leadResult.lead_id}`);
  }

  return {
    id: leadResult.lead_id,
    name: leadResult.lead_name,
    isNew: leadResult.is_new,
  };
}

// ======================
// CONVERSATION MANAGEMENT
// ======================

/**
 * Busca o crea una conversación activa para el lead
 * FIXED: Uses atomic RPC function with advisory lock to prevent race conditions
 */
export async function findOrCreateConversation(
  tenantId: string,
  branchId: string | null,
  leadId: string,
  channelConnectionId: string,
  aiEnabled: boolean,
  channel: string = 'whatsapp'
): Promise<{ id: string; isNew: boolean }> {
  const supabase = createServerClient();

  // Use atomic RPC function to prevent race conditions
  // This function uses advisory locks to ensure only one conversation is created
  // even if multiple webhooks arrive simultaneously
  const { data: result, error } = await supabase.rpc('find_or_create_conversation', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_lead_id: leadId,
    p_channel_connection_id: channelConnectionId,
    p_channel: channel,
    p_ai_enabled: aiEnabled,
  });

  if (error) {
    console.error('[WhatsApp] Error in find_or_create_conversation RPC:', error);
    throw new Error(`Failed to find/create conversation: ${error.message}`);
  }

  // RPC returns array, get first row
  const convResult = Array.isArray(result) ? result[0] : result;

  if (!convResult?.conversation_id) {
    throw new Error('find_or_create_conversation returned no result');
  }

  if (convResult.is_new) {
    console.log(`[WhatsApp] New conversation created: ${convResult.conversation_id}`);
  }

  return {
    id: convResult.conversation_id,
    isNew: convResult.is_new,
  };
}

// ======================
// MESSAGE STORAGE
// ======================

/**
 * Guarda un mensaje entrante en la base de datos
 * FIXED: Uses atomic RPC function with:
 * - Duplicate webhook detection (same whatsapp_message_id)
 * - Auto-reopening of resolved/closed conversations
 * - Atomic message count increment
 * - Lead engagement update trigger
 */
export async function saveIncomingMessage(
  conversationId: string,
  leadId: string,
  parsedMessage: ParsedWhatsAppMessage,
  channel: string = 'whatsapp'
): Promise<{ id: string; isDuplicate: boolean; conversationReopened: boolean }> {
  const supabase = createServerClient();

  // Build metadata object
  const metadata = {
    phone_number_id: parsedMessage.metadata.phoneNumberId,
    is_reply: parsedMessage.metadata.isReply,
    reply_to_message_id: parsedMessage.metadata.replyToMessageId,
    media_type: parsedMessage.mediaType,
  };

  // Use atomic RPC function for duplicate detection and auto-reopen
  const { data: result, error } = await supabase.rpc('save_incoming_message', {
    p_conversation_id: conversationId,
    p_lead_id: leadId,
    p_content: parsedMessage.content,
    p_message_type: parsedMessage.type,
    p_channel: channel,
    p_media_url: parsedMessage.mediaId || null,
    p_whatsapp_message_id: parsedMessage.messageId,
    p_metadata: metadata,
  });

  if (error) {
    // If RPC doesn't exist, fallback to direct insert
    if (error.code === 'PGRST202' || error.message.includes('function') || error.message.includes('does not exist')) {
      console.warn('[WhatsApp] save_incoming_message RPC not available, using fallback');
      return saveIncomingMessageFallback(conversationId, leadId, parsedMessage, channel);
    }

    console.error('[WhatsApp] Error saving message:', error);
    throw new Error(`Failed to save message: ${error.message}`);
  }

  // RPC returns array, get first row
  const saveResult = Array.isArray(result) ? result[0] : result;

  if (!saveResult?.message_id) {
    throw new Error('save_incoming_message returned no result');
  }

  if (saveResult.is_duplicate) {
    console.log(`[WhatsApp] Duplicate message detected: ${parsedMessage.messageId}`);
  }

  if (saveResult.conversation_reopened) {
    console.log(`[WhatsApp] Conversation ${conversationId} was auto-reopened`);
  }

  return {
    id: saveResult.message_id,
    isDuplicate: saveResult.is_duplicate || false,
    conversationReopened: saveResult.conversation_reopened || false,
  };
}

/**
 * Fallback function for saving messages when RPC is not available
 */
async function saveIncomingMessageFallback(
  conversationId: string,
  leadId: string,
  parsedMessage: ParsedWhatsAppMessage,
  channel: string
): Promise<{ id: string; isDuplicate: boolean; conversationReopened: boolean }> {
  const supabase = createServerClient();

  // Check for duplicate first
  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id')
    .eq('metadata->>whatsapp_message_id', parsedMessage.messageId)
    .single();

  if (existingMessage) {
    return { id: existingMessage.id, isDuplicate: true, conversationReopened: false };
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'lead',
      sender_id: leadId,
      content: parsedMessage.content,
      message_type: parsedMessage.type,
      channel: channel,
      media_url: parsedMessage.mediaId,
      status: 'received',
      metadata: {
        whatsapp_message_id: parsedMessage.messageId,
        phone_number_id: parsedMessage.metadata.phoneNumberId,
        is_reply: parsedMessage.metadata.isReply,
        reply_to_message_id: parsedMessage.metadata.replyToMessageId,
        media_type: parsedMessage.mediaType,
      },
    })
    .select('id')
    .single();

  if (error) {
    // Handle unique constraint violation (duplicate)
    if (error.code === '23505') {
      const { data: duplicateMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('metadata->>whatsapp_message_id', parsedMessage.messageId)
        .single();
      return { id: duplicateMsg?.id || '', isDuplicate: true, conversationReopened: false };
    }
    throw new Error(`Failed to save message: ${error.message}`);
  }

  // Update conversation
  try {
    await supabase.rpc('increment_conversation_message_count', {
      p_conversation_id: conversationId
    });
  } catch {
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  return { id: message.id, isDuplicate: false, conversationReopened: false };
}

// ======================
// STATUS UPDATES
// ======================

/**
 * Procesa actualizaciones de estado de mensajes (sent, delivered, read)
 * FIXED: Uses RPC function with proper tenant validation to prevent cross-tenant leakage
 */
export async function processStatusUpdate(
  tenantId: string,
  status: WhatsAppStatus
): Promise<void> {
  const supabase = createServerClient();

  // Mapear estado de WhatsApp a estado interno
  const statusMapping: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  };

  const internalStatus = statusMapping[status.status] || 'unknown';
  if (internalStatus === 'unknown') {
    console.log(`[WhatsApp] Unknown status type: ${status.status}`);
    return;
  }

  // Extract error message if present
  const errorMessage = status.errors?.[0]?.message || status.errors?.[0]?.title || null;

  // Use atomic RPC function with tenant validation
  // This prevents cross-tenant information leakage (M3 fix)
  const { data: result, error } = await supabase.rpc('update_message_status', {
    p_tenant_id: tenantId,
    p_whatsapp_message_id: status.id,
    p_new_status: internalStatus,
    p_error_message: errorMessage,
  });

  if (error) {
    console.error('[WhatsApp] Error updating message status:', error);
    return;
  }

  // RPC returns array, get first row
  const updateResult = Array.isArray(result) ? result[0] : result;

  if (!updateResult?.message_id) {
    // Message not found or doesn't belong to tenant - this is normal for
    // messages sent by other tenants or very old messages
    console.log(`[WhatsApp] Status update for unknown/unauthorized message: ${status.id}`);
    return;
  }

  if (updateResult.updated) {
    console.log(`[WhatsApp] Message ${updateResult.message_id} status: ${internalStatus}`);
  }

  // Log errors for debugging
  if (status.errors && status.errors.length > 0) {
    console.error('[WhatsApp] Message delivery error:', status.errors);
  }
}

// ======================
// JOB QUEUE
// ======================

/**
 * Encola un trabajo de respuesta AI con delay configurable por canal
 */
export async function enqueueAIResponseJob(
  payload: AIResponseJobPayload,
  delaySeconds: number = 0
): Promise<string> {
  const supabase = createServerClient();

  // Calculate scheduled time with delay
  const scheduledFor = new Date(Date.now() + delaySeconds * 1000);

  const { data: job, error } = await supabase
    .from('job_queue')
    .insert({
      tenant_id: payload.tenant_id,
      job_type: 'ai_response',
      payload,
      status: 'pending',
      priority: 1, // Alta prioridad para respuestas
      max_attempts: 3,
      scheduled_for: scheduledFor.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[WhatsApp] Error enqueueing AI job:', error);
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  const delayInfo = delaySeconds > 0 ? ` (delay: ${delaySeconds}s)` : '';
  console.log(`[WhatsApp] AI response job queued: ${job.id}${delayInfo}`);
  return job.id;
}

/**
 * Encola un trabajo de envío de mensaje
 */
export async function enqueueSendMessageJob(
  payload: SendMessageJobPayload
): Promise<string> {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from('job_queue')
    .insert({
      tenant_id: payload.tenant_id,
      job_type: 'send_whatsapp',
      payload,
      status: 'pending',
      priority: 1,
      max_attempts: 3,
      scheduled_for: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[WhatsApp] Error enqueueing send job:', error);
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  console.log(`[WhatsApp] Send message job queued: ${job.id}`);
  return job.id;
}

// ======================
// OUTBOUND MESSAGING
// ======================

// WhatsApp message limits
const WHATSAPP_MAX_MESSAGE_LENGTH = 4096;
const WHATSAPP_API_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Trunca un mensaje para que quepa en el límite de WhatsApp
 */
function truncateMessageForWhatsApp(message: string): string {
  if (message.length <= WHATSAPP_MAX_MESSAGE_LENGTH) {
    return message;
  }

  // Truncar dejando espacio para el aviso
  const truncateAt = WHATSAPP_MAX_MESSAGE_LENGTH - 50;
  let truncated = message.substring(0, truncateAt);

  // Intentar cortar en el último punto para mejor UX
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > truncateAt - 200) {
    truncated = truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '\n\n[Mensaje truncado por límite de caracteres]';
}

/**
 * Envía un mensaje de texto por WhatsApp
 * - Trunca mensajes que excedan 4096 caracteres
 * - Incluye timeout de 30 segundos para evitar requests colgados
 */
export async function sendWhatsAppMessage(
  connection: ChannelConnection,
  recipientPhone: string,
  message: string
): Promise<{ messageId: string; success: boolean }> {
  const accessToken = connection.whatsapp_access_token;
  const phoneNumberId = connection.whatsapp_phone_number_id;

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp connection not properly configured');
  }

  // Truncate message if too long (H5 fix)
  const truncatedMessage = truncateMessageForWhatsApp(message);
  if (truncatedMessage !== message) {
    console.warn(`[WhatsApp] Message truncated from ${message.length} to ${truncatedMessage.length} chars`);
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const payload: WhatsAppOutboundMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone.replace('+', ''),
    type: 'text',
    text: {
      preview_url: true,
      body: truncatedMessage,
    },
  };

  // Create AbortController for timeout (H8 fix)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WHATSAPP_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp] Send error:', data);
      throw new Error(data.error?.message || 'Failed to send message');
    }

    const messageId = data.messages?.[0]?.id;
    console.log(`[WhatsApp] Message sent: ${messageId}`);

    return {
      messageId,
      success: true,
    };
  } catch (error) {
    // Handle timeout specifically
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[WhatsApp] Send timed out after 30 seconds');
      throw new Error('WhatsApp API timeout - message may or may not have been sent');
    }
    console.error('[WhatsApp] Send failed:', error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ======================
// MAIN PROCESSOR
// ======================

/**
 * Procesa un webhook completo de WhatsApp
 */
export async function processWhatsAppWebhook(
  tenantSlug: string,
  payload: WhatsAppWebhookPayload
): Promise<ProcessResult> {
  const result: ProcessResult = {
    success: true,
    messages_processed: 0,
    statuses_processed: 0,
    errors: [],
  };

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const { metadata, messages, statuses, contacts } = value;

      // Obtener contexto del tenant
      const context = await getTenantContext(tenantSlug, metadata.phone_number_id);

      if (!context) {
        result.errors.push(
          `Tenant context not found for ${tenantSlug}/${metadata.phone_number_id}`
        );
        continue;
      }

      // Procesar mensajes entrantes
      if (messages && messages.length > 0) {
        for (const message of messages) {
          try {
            await processIncomingMessage(
              context,
              message,
              contacts || [],
              metadata
            );
            result.messages_processed++;
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Message ${message.id}: ${errorMsg}`);
          }
        }
      }

      // Procesar actualizaciones de estado
      if (statuses && statuses.length > 0) {
        for (const status of statuses) {
          try {
            await processStatusUpdate(context.tenant_id, status);
            result.statuses_processed++;
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Status ${status.id}: ${errorMsg}`);
          }
        }
      }
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Procesa un mensaje entrante individual
 * Aplica delay de respuesta y configuración de personalidad por canal
 */
async function processIncomingMessage(
  context: TenantContext,
  message: WhatsAppMessage,
  contacts: WhatsAppContact[],
  metadata: WhatsAppChangeValue['metadata']
): Promise<void> {
  // 1. Parsear mensaje
  const parsedMessage = parseWhatsAppMessage(message, contacts, metadata);

  console.log(
    `[WhatsApp] Processing message from ${parsedMessage.phoneNormalized}: "${parsedMessage.content.substring(0, 50)}..."`
  );

  // 2. Buscar o crear lead
  const lead = await findOrCreateLead(
    context.tenant_id,
    context.branch_id,
    parsedMessage.phoneNormalized,
    parsedMessage.contactName
  );

  // 3. Buscar o crear conversación
  const conversation = await findOrCreateConversation(
    context.tenant_id,
    context.branch_id,
    lead.id,
    context.channel_connection.id,
    context.ai_enabled
  );

  // 4. Guardar mensaje (with duplicate detection and auto-reopen)
  const messageResult = await saveIncomingMessage(
    conversation.id,
    lead.id,
    parsedMessage,
    'whatsapp'
  );

  // If duplicate message, skip further processing
  if (messageResult.isDuplicate) {
    console.log(`[WhatsApp] Skipping duplicate message: ${parsedMessage.messageId}`);
    return;
  }

  const messageId = messageResult.id;

  // Log if conversation was auto-reopened
  if (messageResult.conversationReopened) {
    console.log(`[WhatsApp] Conversation ${conversation.id} was auto-reopened by new message`);
  }

  // 5. AI Learning: Solo para verticales soportadas (dental y restaurant)
  // Variables para pasar contexto al AI job
  let detectedHighPriorityAction: string | null = null;

  if (context.tenant_vertical === 'dental' || context.tenant_vertical === 'restaurant') {
    // 5a. Procesar patrones de ALTA PRIORIDAD en tiempo real
    // Detecta urgencias, quejas, objeciones ANTES de que la IA responda
    // NO consume tokens de LLM - solo usa regex
    try {
      const highPriorityResult = await processHighPriorityPatterns(
        context.tenant_id,
        parsedMessage.content,
        context.tenant_vertical,
        {
          conversationId: conversation.id,
          leadId: lead.id,
          channel: 'whatsapp',
        }
      );

      if (highPriorityResult.requires_immediate_action) {
        detectedHighPriorityAction = highPriorityResult.action_type || null;
        console.log(
          `[WhatsApp] High priority patterns detected: ${highPriorityResult.action_type} ` +
          `(${highPriorityResult.high_priority_patterns.length} patterns, ${highPriorityResult.processing_time_ms}ms)`
        );
      }
    } catch (error) {
      // No bloquear el flujo si falla el procesamiento de patrones
      console.warn('[WhatsApp] High priority pattern processing failed:', error);
    }

    // 5b. Encolar mensaje para aprendizaje diferido (CRON)
    // Aprende vocabulario y patrones de manera asíncrona
    try {
      await queueMessageForLearning(
        context.tenant_id,
        conversation.id,
        messageId,
        parsedMessage.content,
        'lead',
        {
          channel: 'whatsapp',
          leadId: lead.id,
        }
      );
    } catch (error) {
      // No bloquear el flujo si falla el encolado
      console.warn('[WhatsApp] Failed to queue message for learning:', error);
    }
  }

  // 6. Encolar trabajo de AI si está habilitado
  if (context.ai_enabled) {
    const conn = context.channel_connection;

    // Determine if this is the first message in conversation
    const isFirstMessage = conversation.isNew;

    // Get appropriate delay based on message position
    const delaySeconds = isFirstMessage
      ? (conn.first_message_delay_seconds || 0)
      : (conn.subsequent_message_delay_seconds || 0);

    await enqueueAIResponseJob(
      {
        conversation_id: conversation.id,
        message_id: messageId,
        lead_id: lead.id,
        tenant_id: context.tenant_id,
        channel: 'whatsapp',
        channel_connection_id: conn.id,
        // Pass per-channel AI configuration
        ai_personality_override: conn.ai_personality_override || null,
        custom_instructions_override: conn.custom_instructions_override || null,
        is_first_message: isFirstMessage,
      },
      delaySeconds
    );
  }

  console.log(
    `[WhatsApp] Message processed: lead=${lead.id}, conv=${conversation.id}, msg=${messageId}, ` +
    `vertical=${context.tenant_vertical}, ai_queued=${context.ai_enabled}` +
    (detectedHighPriorityAction ? `, priority_action=${detectedHighPriorityAction}` : '')
  );
}

// ======================
// EXPORTS
// ======================
export const WhatsAppService = {
  verifySignature: verifyWhatsAppSignature,
  normalizePhone: normalizePhoneNumber,
  parseMessage: parseWhatsAppMessage,
  getTenantContext,
  findOrCreateLead,
  findOrCreateConversation,
  saveIncomingMessage,
  processStatusUpdate,
  enqueueAIResponseJob,
  enqueueSendMessageJob,
  sendMessage: sendWhatsAppMessage,
  processWebhook: processWhatsAppWebhook,
};
