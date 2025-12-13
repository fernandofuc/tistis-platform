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

// ======================
// TYPES
// ======================

interface TenantContext {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
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

  // Buscar tenant por slug
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, slug')
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
 */
export async function findOrCreateLead(
  tenantId: string,
  branchId: string | null,
  phoneNormalized: string,
  contactName?: string
): Promise<{ id: string; name: string; isNew: boolean }> {
  const supabase = createServerClient();

  // Buscar lead existente
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('phone_normalized', phoneNormalized)
    .single();

  if (existingLead) {
    // Actualizar nombre si tenemos uno nuevo y el actual es genérico
    if (contactName && existingLead.name === 'Desconocido') {
      await supabase
        .from('leads')
        .update({ name: contactName })
        .eq('id', existingLead.id);
      existingLead.name = contactName;
    }

    return { ...existingLead, isNew: false };
  }

  // Crear nuevo lead
  const { data: newLead, error } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      phone: phoneNormalized,
      phone_normalized: phoneNormalized,
      name: contactName || 'Desconocido',
      source: 'whatsapp',
      status: 'new',
      classification: 'warm', // Nuevo lead es warm por defecto
      score: 50, // Score inicial
      first_contact_at: new Date().toISOString(),
    })
    .select('id, name')
    .single();

  if (error) {
    console.error('[WhatsApp] Error creating lead:', error);
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  console.log(`[WhatsApp] New lead created: ${newLead.id} (${phoneNormalized})`);
  return { ...newLead, isNew: true };
}

// ======================
// CONVERSATION MANAGEMENT
// ======================

/**
 * Busca o crea una conversación activa para el lead
 */
export async function findOrCreateConversation(
  tenantId: string,
  branchId: string | null,
  leadId: string,
  channelConnectionId: string,
  aiEnabled: boolean
): Promise<{ id: string; isNew: boolean }> {
  const supabase = createServerClient();

  // Buscar conversación activa existente
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('lead_id', leadId)
    .eq('channel', 'whatsapp')
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingConv) {
    return { id: existingConv.id, isNew: false };
  }

  // Crear nueva conversación
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      lead_id: leadId,
      channel: 'whatsapp',
      channel_connection_id: channelConnectionId,
      status: 'active',
      ai_handling: aiEnabled, // Respeta configuración del canal
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[WhatsApp] Error creating conversation:', error);
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  console.log(`[WhatsApp] New conversation created: ${newConv.id}`);
  return { id: newConv.id, isNew: true };
}

// ======================
// MESSAGE STORAGE
// ======================

/**
 * Guarda un mensaje entrante en la base de datos
 */
export async function saveIncomingMessage(
  conversationId: string,
  leadId: string,
  parsedMessage: ParsedWhatsAppMessage
): Promise<string> {
  const supabase = createServerClient();

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'lead',
      sender_id: leadId,
      content: parsedMessage.content,
      message_type: parsedMessage.type,
      channel: 'whatsapp',
      media_url: parsedMessage.mediaId, // WhatsApp media ID, se descargará después
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
    console.error('[WhatsApp] Error saving message:', error);
    throw new Error(`Failed to save message: ${error.message}`);
  }

  // Actualizar last_message_at y message_count de la conversación
  // Usamos SQL raw para incrementar el contador correctamente
  try {
    const { error: updateError } = await supabase.rpc('increment_conversation_message_count', {
      p_conversation_id: conversationId
    });

    // Fallback si la función no existe: solo actualizar last_message_at
    if (updateError) {
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }
  } catch {
    // Fallback en caso de error
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  return message.id;
}

// ======================
// STATUS UPDATES
// ======================

/**
 * Procesa actualizaciones de estado de mensajes (sent, delivered, read)
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

  // Buscar mensaje por whatsapp_message_id
  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id, status')
    .eq('metadata->>whatsapp_message_id', status.id)
    .single();

  if (!existingMessage) {
    // Puede ser un mensaje que enviamos, buscar por external_id
    const { error } = await supabase
      .from('messages')
      .update({
        status: internalStatus,
        metadata: supabase.rpc('jsonb_set_key', {
          path: ['status_timestamp'],
          value: status.timestamp,
        }),
      })
      .eq('external_id', status.id);

    if (error) {
      console.log(
        `[WhatsApp] Status update for unknown message: ${status.id}`
      );
    }
    return;
  }

  // Solo actualizar si es un avance en el estado
  const statusOrder = ['pending', 'sent', 'delivered', 'read', 'failed'];
  const currentIndex = statusOrder.indexOf(existingMessage.status);
  const newIndex = statusOrder.indexOf(internalStatus);

  if (newIndex > currentIndex || internalStatus === 'failed') {
    await supabase
      .from('messages')
      .update({
        status: internalStatus,
        metadata: {
          status_updated_at: new Date().toISOString(),
          whatsapp_status: status.status,
        },
      })
      .eq('id', existingMessage.id);

    console.log(
      `[WhatsApp] Message ${existingMessage.id} status: ${internalStatus}`
    );
  }

  // Si falló, registrar el error
  if (status.errors && status.errors.length > 0) {
    console.error('[WhatsApp] Message failed:', status.errors);
    await supabase
      .from('messages')
      .update({
        error_message: status.errors[0].message || status.errors[0].title,
        metadata: {
          whatsapp_errors: status.errors,
        },
      })
      .eq('id', existingMessage.id);
  }
}

// ======================
// JOB QUEUE
// ======================

/**
 * Encola un trabajo de respuesta AI
 */
export async function enqueueAIResponseJob(
  payload: AIResponseJobPayload
): Promise<string> {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from('job_queue')
    .insert({
      tenant_id: payload.tenant_id,
      job_type: 'ai_response',
      payload,
      status: 'pending',
      priority: 1, // Alta prioridad para respuestas
      max_attempts: 3,
      scheduled_for: new Date().toISOString(), // Ejecutar inmediatamente
    })
    .select('id')
    .single();

  if (error) {
    console.error('[WhatsApp] Error enqueueing AI job:', error);
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  console.log(`[WhatsApp] AI response job queued: ${job.id}`);
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

/**
 * Envía un mensaje de texto por WhatsApp
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

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const payload: WhatsAppOutboundMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone.replace('+', ''),
    type: 'text',
    text: {
      preview_url: true,
      body: message,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
    console.error('[WhatsApp] Send failed:', error);
    throw error;
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

  // 4. Guardar mensaje
  const messageId = await saveIncomingMessage(
    conversation.id,
    lead.id,
    parsedMessage
  );

  // 5. Encolar trabajo de AI si está habilitado
  if (context.ai_enabled) {
    await enqueueAIResponseJob({
      conversation_id: conversation.id,
      message_id: messageId,
      lead_id: lead.id,
      tenant_id: context.tenant_id,
      channel: 'whatsapp',
      channel_connection_id: context.channel_connection.id,
    });
  }

  console.log(
    `[WhatsApp] Message processed: lead=${lead.id}, conv=${conversation.id}, msg=${messageId}, ai_queued=${context.ai_enabled}`
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
