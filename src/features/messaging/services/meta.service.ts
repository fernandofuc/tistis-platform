// =====================================================
// TIS TIS PLATFORM - Meta Graph API Service
// Shared service for Instagram Direct & Facebook Messenger
// Both platforms use Meta's Graph API with similar structures
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import crypto from 'crypto';
import type {
  MetaWebhookPayload,
  MetaMessagingEvent,
  MetaMessage,
  ParsedMetaMessage,
  MetaMessageType,
  MetaOutboundMessage,
  MetaUserProfile,
  MetaSendMessageJobPayload,
} from '@/src/shared/types/meta-messaging';
import type { AIResponseJobPayload } from '@/src/shared/types/whatsapp';

// ======================
// CONSTANTS
// ======================

const META_GRAPH_API_VERSION = 'v18.0';
const META_GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

// ======================
// TYPES
// ======================

type Platform = 'instagram' | 'facebook';

interface TenantContext {
  tenant_id: string;
  tenant_slug: string;
  branch_id: string | null;
  channel_connection_id: string;
  page_id: string;
  access_token: string;
  ai_enabled: boolean;
  // Per-channel AI configuration
  ai_personality_override?: string | null;
  first_message_delay_seconds?: number;
  subsequent_message_delay_seconds?: number;
  custom_instructions_override?: string | null;
}

interface ProcessResult {
  success: boolean;
  messages_processed: number;
  errors: string[];
}

// ======================
// SIGNATURE VERIFICATION
// ======================

/**
 * Verifica la firma X-Hub-Signature-256 de Meta
 * Igual que WhatsApp, Meta usa HMAC SHA256
 */
export function verifyMetaSignature(
  payload: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) {
    console.error('[Meta] Missing X-Hub-Signature-256 header');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

    if (!isValid) {
      console.error('[Meta] Invalid signature - possible tampering');
    }

    return isValid;
  } catch {
    return false;
  }
}

// ======================
// MESSAGE PARSER
// ======================

/**
 * Parsea un evento de mensaje de Meta a formato interno
 */
export function parseMetaMessage(
  platform: Platform,
  event: MetaMessagingEvent,
  pageId: string
): ParsedMetaMessage | null {
  const message = event.message;

  // Ignorar echoes (mensajes que enviamos nosotros)
  if (message?.is_echo) {
    return null;
  }

  // Ignorar mensajes eliminados o no soportados
  if (message?.is_deleted || message?.is_unsupported) {
    return null;
  }

  // Determinar tipo de mensaje y contenido
  let type: MetaMessageType = 'text';
  let content = '';
  let mediaUrl: string | undefined;
  let mediaType: string | undefined;
  let isStoryReply = false;
  let isStoryMention = false;
  let storyUrl: string | undefined;

  if (event.postback) {
    // Postback (botón presionado)
    type = 'postback';
    content = event.postback.title || event.postback.payload;
  } else if (event.reaction) {
    // Reacción a mensaje
    type = 'reaction';
    content = event.reaction.emoji || event.reaction.reaction || '[Reaccion]';
  } else if (message) {
    if (message.quick_reply) {
      // Quick reply seleccionado
      type = 'quick_reply';
      content = message.text || message.quick_reply.payload;
    } else if (message.text) {
      // Mensaje de texto
      type = 'text';
      content = message.text;
    } else if (message.attachments && message.attachments.length > 0) {
      // Mensaje con adjuntos
      const attachment = message.attachments[0];
      type = attachment.type as MetaMessageType;

      switch (attachment.type) {
        case 'image':
          content = '[Imagen recibida]';
          mediaUrl = attachment.payload.url;
          mediaType = 'image';
          break;
        case 'video':
          content = '[Video recibido]';
          mediaUrl = attachment.payload.url;
          mediaType = 'video';
          break;
        case 'audio':
          content = '[Audio recibido]';
          mediaUrl = attachment.payload.url;
          mediaType = 'audio';
          break;
        case 'file':
          content = attachment.payload.title || '[Archivo recibido]';
          mediaUrl = attachment.payload.url;
          mediaType = 'file';
          break;
        case 'location':
          if (attachment.payload.coordinates) {
            const { lat, long } = attachment.payload.coordinates;
            content = `[Ubicacion: ${lat}, ${long}]`;
          } else {
            content = '[Ubicacion compartida]';
          }
          type = 'location';
          break;
        case 'story_mention':
          // Instagram: Usuario mencionó al negocio en su historia
          type = 'story_mention';
          isStoryMention = true;
          storyUrl = attachment.payload.story_url;
          content = '[Te mencionaron en una historia]';
          break;
        case 'story_reply':
          // Instagram: Usuario respondió a la historia del negocio
          type = 'story_reply';
          isStoryReply = true;
          storyUrl = attachment.payload.story_url;
          content = message.text || '[Respuesta a historia]';
          break;
        default:
          type = 'unsupported';
          content = `[Mensaje tipo ${attachment.type}]`;
      }
    }
  }

  // Si no pudimos extraer contenido, ignorar
  if (!content) {
    return null;
  }

  return {
    platform,
    senderId: event.sender.id,
    recipientId: event.recipient.id,
    messageId: message?.mid || `postback_${event.timestamp}`,
    timestamp: new Date(event.timestamp),
    type,
    content,
    mediaUrl,
    mediaType,
    isEcho: false,
    isReply: !!message?.reply_to,
    replyToMessageId: message?.reply_to?.mid,
    metadata: {
      pageId,
      isStoryReply,
      isStoryMention,
      storyUrl,
    },
  };
}

// ======================
// TENANT CONTEXT
// ======================

/**
 * Obtiene el contexto del tenant a partir del slug y page_id
 */
export async function getMetaTenantContext(
  tenantSlug: string,
  pageId: string,
  platform: Platform
): Promise<TenantContext | null> {
  const supabase = createServerClient();

  // Buscar tenant por slug
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', tenantSlug)
    .eq('status', 'active')
    .single();

  if (tenantError || !tenant) {
    console.error(`[Meta] Tenant not found: ${tenantSlug}`);
    return null;
  }

  // Buscar channel_connection
  const pageIdColumn = platform === 'instagram' ? 'instagram_page_id' : 'facebook_page_id';

  const { data: connection, error: connError } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('channel', platform)
    .eq(pageIdColumn, pageId)
    .eq('status', 'connected')
    .single();

  if (connError || !connection) {
    console.error(
      `[Meta] Channel connection not found for tenant ${tenantSlug}, page ${pageId}`
    );
    return null;
  }

  // Obtener access token del campo correcto
  const accessToken = platform === 'instagram'
    ? connection.instagram_access_token
    : connection.facebook_access_token;

  if (!accessToken) {
    console.error(`[Meta] No access token for ${platform} connection`);
    return null;
  }

  return {
    tenant_id: tenant.id,
    tenant_slug: tenantSlug,
    branch_id: connection.branch_id,
    channel_connection_id: connection.id,
    page_id: pageId,
    access_token: accessToken,
    ai_enabled: connection.ai_enabled,
    // Per-channel AI configuration
    ai_personality_override: connection.ai_personality_override || null,
    first_message_delay_seconds: connection.first_message_delay_seconds || 0,
    subsequent_message_delay_seconds: connection.subsequent_message_delay_seconds || 0,
    custom_instructions_override: connection.custom_instructions_override || null,
  };
}

// ======================
// USER PROFILE
// ======================

/**
 * Obtiene el perfil del usuario desde Meta Graph API
 */
export async function getMetaUserProfile(
  psid: string,
  accessToken: string,
  platform: Platform
): Promise<MetaUserProfile | null> {
  const fields = platform === 'instagram'
    ? 'id,username,name,profile_pic'
    : 'id,first_name,last_name,name,profile_pic';

  const url = `${META_GRAPH_API_BASE}/${psid}?fields=${fields}&access_token=${accessToken}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('[Meta] Error fetching user profile:', data.error);
      return null;
    }

    return data as MetaUserProfile;
  } catch (error) {
    console.error('[Meta] Failed to fetch user profile:', error);
    return null;
  }
}

// ======================
// LEAD MANAGEMENT
// ======================

/**
 * Busca o crea un lead basado en el PSID de Meta
 * PSID es Page-Scoped ID - único por usuario por página
 */
export async function findOrCreateMetaLead(
  tenantId: string,
  branchId: string | null,
  platform: Platform,
  psid: string,
  accessToken: string
): Promise<{ id: string; name: string; isNew: boolean }> {
  const supabase = createServerClient();

  // Campo según plataforma
  const psidField = platform === 'instagram' ? 'instagram_psid' : 'facebook_psid';

  // Buscar lead existente por PSID
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq(psidField, psid)
    .single();

  if (existingLead) {
    return { ...existingLead, isNew: false };
  }

  // Obtener perfil del usuario
  const profile = await getMetaUserProfile(psid, accessToken, platform);
  const name = profile?.name || profile?.username || 'Desconocido';

  // Crear nuevo lead
  const leadData: Record<string, unknown> = {
    tenant_id: tenantId,
    branch_id: branchId,
    name,
    source: platform,
    status: 'new',
    classification: 'warm',
    score: 50,
    first_contact_at: new Date().toISOString(),
    [psidField]: psid,
  };

  // Agregar datos adicionales del perfil
  if (profile) {
    leadData.profile_image_url = profile.profile_pic;
    if (platform === 'instagram' && profile.username) {
      leadData.instagram_username = profile.username;
    }
  }

  const { data: newLead, error } = await supabase
    .from('leads')
    .insert(leadData)
    .select('id, name')
    .single();

  if (error) {
    console.error('[Meta] Error creating lead:', error);
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  console.log(`[Meta] New ${platform} lead created: ${newLead.id}`);
  return { ...newLead, isNew: true };
}

// ======================
// CONVERSATION MANAGEMENT
// ======================

/**
 * Busca o crea una conversación activa
 */
export async function findOrCreateMetaConversation(
  tenantId: string,
  branchId: string | null,
  leadId: string,
  platform: Platform,
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
    .eq('channel', platform)
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
      channel: platform,
      channel_connection_id: channelConnectionId,
      status: 'active',
      ai_handling: aiEnabled,
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Meta] Error creating conversation:', error);
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  console.log(`[Meta] New ${platform} conversation created: ${newConv.id}`);
  return { id: newConv.id, isNew: true };
}

// ======================
// MESSAGE STORAGE
// ======================

/**
 * Guarda un mensaje entrante
 */
export async function saveMetaIncomingMessage(
  conversationId: string,
  leadId: string,
  parsedMessage: ParsedMetaMessage
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
      channel: parsedMessage.platform,
      media_url: parsedMessage.mediaUrl,
      status: 'received',
      metadata: {
        meta_message_id: parsedMessage.messageId,
        page_id: parsedMessage.metadata.pageId,
        sender_psid: parsedMessage.senderId,
        is_reply: parsedMessage.isReply,
        reply_to_message_id: parsedMessage.replyToMessageId,
        is_story_reply: parsedMessage.metadata.isStoryReply,
        is_story_mention: parsedMessage.metadata.isStoryMention,
        story_url: parsedMessage.metadata.storyUrl,
        media_type: parsedMessage.mediaType,
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Meta] Error saving message:', error);
    throw new Error(`Failed to save message: ${error.message}`);
  }

  // Actualizar conversación
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return message.id;
}

// ======================
// JOB QUEUE
// ======================

/**
 * Encola trabajo de respuesta AI con delay configurable por canal
 */
export async function enqueueMetaAIJob(
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
      priority: 1,
      max_attempts: 3,
      scheduled_for: scheduledFor.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Meta] Error enqueueing AI job:', error);
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  const delayInfo = delaySeconds > 0 ? ` (delay: ${delaySeconds}s)` : '';
  console.log(`[Meta] AI response job queued: ${job.id}${delayInfo}`);
  return job.id;
}

/**
 * Encola trabajo de envío de mensaje
 */
export async function enqueueMetaSendJob(
  payload: MetaSendMessageJobPayload
): Promise<string> {
  const supabase = createServerClient();

  const jobType = payload.channel === 'instagram' ? 'send_instagram' : 'send_facebook';

  const { data: job, error } = await supabase
    .from('job_queue')
    .insert({
      tenant_id: payload.tenant_id,
      job_type: jobType,
      payload,
      status: 'pending',
      priority: 1,
      max_attempts: 3,
      scheduled_for: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Meta] Error enqueueing send job:', error);
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  return job.id;
}

// ======================
// OUTBOUND MESSAGING
// ======================

/**
 * Envía un mensaje por Instagram o Facebook Messenger
 * NOTA: Instagram usa el page_id de la página conectada
 * Facebook usa el page_id directamente
 */
export async function sendMetaMessage(
  platform: Platform,
  accessToken: string,
  recipientPsid: string,
  message: string
): Promise<{ messageId?: string; success: boolean; error?: string }> {
  // Para Instagram y Facebook, usamos el endpoint de me/messages
  // ya que el access_token determina la página
  const url = `${META_GRAPH_API_BASE}/me/messages`;

  const payload: MetaOutboundMessage = {
    recipient: { id: recipientPsid },
    messaging_type: 'RESPONSE',
    message: { text: message },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.error) {
      console.error(`[Meta] Send ${platform} error:`, data.error);
      return {
        success: false,
        error: data.error.message || 'Failed to send message',
      };
    }

    console.log(`[Meta] ${platform} message sent: ${data.message_id}`);

    return {
      messageId: data.message_id,
      success: true,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    console.error(`[Meta] ${platform} send failed:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// ======================
// MAIN PROCESSOR
// ======================

/**
 * Procesa un webhook de Meta (Instagram o Facebook)
 */
export async function processMetaWebhook(
  tenantSlug: string,
  platform: Platform,
  payload: MetaWebhookPayload
): Promise<ProcessResult> {
  const result: ProcessResult = {
    success: true,
    messages_processed: 0,
    errors: [],
  };

  for (const entry of payload.entry) {
    const pageId = entry.id;
    const events = entry.messaging || [];

    if (events.length === 0) continue;

    // Obtener contexto del tenant
    const context = await getMetaTenantContext(tenantSlug, pageId, platform);

    if (!context) {
      result.errors.push(`Tenant context not found for ${tenantSlug}/${pageId}`);
      continue;
    }

    // Procesar cada evento de mensajería
    for (const event of events) {
      try {
        await processMetaEvent(platform, event, context);
        result.messages_processed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Event at ${event.timestamp}: ${errorMsg}`);
      }
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Procesa un evento individual
 * Aplica delay de respuesta y configuración de personalidad por canal
 */
async function processMetaEvent(
  platform: Platform,
  event: MetaMessagingEvent,
  context: TenantContext
): Promise<void> {
  // Parsear mensaje
  const parsedMessage = parseMetaMessage(platform, event, context.page_id);

  if (!parsedMessage) {
    // Echo, deleted, o unsupported - ignorar silenciosamente
    return;
  }

  console.log(
    `[Meta] Processing ${platform} message from ${parsedMessage.senderId}: "${parsedMessage.content.substring(0, 50)}..."`
  );

  // Buscar o crear lead
  const lead = await findOrCreateMetaLead(
    context.tenant_id,
    context.branch_id,
    platform,
    parsedMessage.senderId,
    context.access_token
  );

  // Buscar o crear conversación
  const conversation = await findOrCreateMetaConversation(
    context.tenant_id,
    context.branch_id,
    lead.id,
    platform,
    context.channel_connection_id,
    context.ai_enabled
  );

  // Guardar mensaje
  const messageId = await saveMetaIncomingMessage(
    conversation.id,
    lead.id,
    parsedMessage
  );

  // Encolar trabajo de AI si está habilitado
  if (context.ai_enabled) {
    // Determine if this is the first message in conversation
    const isFirstMessage = conversation.isNew;

    // Get appropriate delay based on message position
    const delaySeconds = isFirstMessage
      ? (context.first_message_delay_seconds || 0)
      : (context.subsequent_message_delay_seconds || 0);

    await enqueueMetaAIJob(
      {
        conversation_id: conversation.id,
        message_id: messageId,
        lead_id: lead.id,
        tenant_id: context.tenant_id,
        channel: platform,
        channel_connection_id: context.channel_connection_id,
        // Pass per-channel AI configuration
        ai_personality_override: context.ai_personality_override as AIResponseJobPayload['ai_personality_override'],
        custom_instructions_override: context.custom_instructions_override,
        is_first_message: isFirstMessage,
      },
      delaySeconds
    );
  }

  console.log(
    `[Meta] ${platform} message processed: lead=${lead.id}, conv=${conversation.id}, msg=${messageId}, ai_queued=${context.ai_enabled}`
  );
}

// ======================
// EXPORTS
// ======================
export const MetaService = {
  verifySignature: verifyMetaSignature,
  parseMessage: parseMetaMessage,
  getTenantContext: getMetaTenantContext,
  getUserProfile: getMetaUserProfile,
  findOrCreateLead: findOrCreateMetaLead,
  findOrCreateConversation: findOrCreateMetaConversation,
  saveIncomingMessage: saveMetaIncomingMessage,
  enqueueAIJob: enqueueMetaAIJob,
  enqueueSendJob: enqueueMetaSendJob,
  sendMessage: sendMetaMessage,
  processWebhook: processMetaWebhook,
};
