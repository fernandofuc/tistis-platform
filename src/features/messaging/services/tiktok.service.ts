// =====================================================
// TIS TIS PLATFORM - TikTok Business API Service
// Service for TikTok Direct Messages
// Note: TikTok API is different from Meta Graph API
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import crypto from 'crypto';
import type {
  TikTokWebhookPayload,
  TikTokMessageContent,
  TikTokMessageType,
  ParsedTikTokMessage,
  TikTokOutboundMessage,
  TikTokUserProfile,
  TikTokSendMessageJobPayload,
  TikTokChannelConnection,
  TIKTOK_MESSAGE_WINDOW_HOURS,
} from '@/src/shared/types/tiktok-messaging';
import type { AIResponseJobPayload } from '@/src/shared/types/whatsapp';

// ======================
// CONSTANTS
// ======================

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

// TikTok tiene una ventana de 24 horas para responder
const MESSAGE_WINDOW_HOURS = 24;

// ======================
// TYPES
// ======================

interface TenantContext {
  tenant_id: string;
  tenant_slug: string;
  branch_id: string | null;
  channel_connection_id: string;
  client_key: string;
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
 * Verifica la firma del webhook de TikTok
 * TikTok usa un método diferente a Meta
 */
export function verifyTikTokSignature(
  payload: string,
  signature: string | null,
  clientSecret: string,
  timestamp: string | null
): boolean {
  if (!signature || !timestamp) {
    console.error('[TikTok] Missing signature or timestamp');
    return false;
  }

  // TikTok signature: SHA256(client_secret + timestamp + payload)
  const signatureBase = `${clientSecret}${timestamp}${payload}`;
  const expectedSignature = crypto
    .createHash('sha256')
    .update(signatureBase)
    .digest('hex');

  // Usar timingSafeEqual para prevenir timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(signature, 'hex')
  );

  if (!isValid) {
    console.error('[TikTok] Invalid signature');
  }

  return isValid;
}

// ======================
// MESSAGE PARSER
// ======================

/**
 * Parsea un mensaje de TikTok a formato interno
 */
export function parseTikTokMessage(
  payload: TikTokWebhookPayload
): ParsedTikTokMessage | null {
  const { event, content, client_key, create_time } = payload;

  // Solo procesar mensajes recibidos
  if (event !== 'direct_message.receive') {
    return null;
  }

  if (!content.open_id || !content.message_id) {
    return null;
  }

  const messageContent = content.message_content;
  const messageType = content.message_type || 'text';

  // Extraer contenido según tipo
  let textContent = '';
  let mediaUrl: string | undefined;
  let mediaType: string | undefined;
  let isSharedVideo = false;
  let sharedVideoId: string | undefined;

  switch (messageType) {
    case 'text':
      textContent = messageContent?.text || '';
      break;
    case 'image':
      textContent = '[Imagen recibida]';
      mediaUrl = messageContent?.media_url;
      mediaType = 'image';
      break;
    case 'video':
      textContent = '[Video recibido]';
      mediaUrl = messageContent?.media_url;
      mediaType = 'video';
      break;
    case 'sticker':
      textContent = '[Sticker recibido]';
      break;
    case 'share':
      textContent = '[Video de TikTok compartido]';
      isSharedVideo = true;
      sharedVideoId = messageContent?.shared_video_id;
      mediaUrl = messageContent?.shared_video_url;
      break;
    default:
      textContent = `[Mensaje tipo ${messageType}]`;
  }

  return {
    platform: 'tiktok',
    openId: content.open_id,
    messageId: content.message_id,
    timestamp: new Date(create_time * 1000),
    type: messageType,
    content: textContent,
    mediaUrl,
    mediaType,
    metadata: {
      clientKey: client_key,
      isSharedVideo,
      sharedVideoId,
    },
  };
}

// ======================
// TENANT CONTEXT
// ======================

/**
 * Obtiene el contexto del tenant a partir del slug y client_key
 */
export async function getTikTokTenantContext(
  tenantSlug: string,
  clientKey: string
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
    console.error(`[TikTok] Tenant not found: ${tenantSlug}`);
    return null;
  }

  // Buscar channel_connection por client_key
  const { data: connection, error: connError } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('channel', 'tiktok')
    .eq('tiktok_client_key', clientKey)
    .eq('status', 'connected')
    .single();

  if (connError || !connection) {
    console.error(
      `[TikTok] Channel connection not found for tenant ${tenantSlug}, client_key ${clientKey}`
    );
    return null;
  }

  if (!connection.tiktok_access_token) {
    console.error(`[TikTok] No access token for connection`);
    return null;
  }

  return {
    tenant_id: tenant.id,
    tenant_slug: tenantSlug,
    branch_id: connection.branch_id,
    channel_connection_id: connection.id,
    client_key: clientKey,
    access_token: connection.tiktok_access_token,
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
 * Obtiene el perfil del usuario desde TikTok API
 */
export async function getTikTokUserProfile(
  openId: string,
  accessToken: string
): Promise<TikTokUserProfile | null> {
  const url = `${TIKTOK_API_BASE}/user/info/?fields=open_id,display_name,avatar_url,bio_description`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (data.error?.code !== 0) {
      console.error('[TikTok] Error fetching user profile:', data.error);
      return null;
    }

    return data.data.user as TikTokUserProfile;
  } catch (error) {
    console.error('[TikTok] Failed to fetch user profile:', error);
    return null;
  }
}

// ======================
// LEAD MANAGEMENT
// ======================

/**
 * Busca o crea un lead basado en el open_id de TikTok
 * IMPROVED: Uses smart cross-channel identity detection
 * - First tries to find existing lead by TikTok open_id
 * - Then uses find_or_create_lead_smart RPC to detect cross-channel matches
 * - Falls back to legacy method if RPC not available
 */
export async function findOrCreateTikTokLead(
  tenantId: string,
  branchId: string | null,
  openId: string,
  accessToken: string
): Promise<{ id: string; name: string; isNew: boolean; wasLinked?: boolean }> {
  const supabase = createServerClient();

  // Obtener perfil del usuario primero (lo necesitamos para ambos paths)
  const profile = await getTikTokUserProfile(openId, accessToken);
  const name = profile?.display_name || 'Usuario TikTok';

  // Try smart cross-channel lead finding first
  // This detects if same person already exists via different channel
  const { data: smartResult, error: smartError } = await supabase.rpc('find_or_create_lead_smart', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_channel: 'tiktok',
    p_identifier: openId,
    p_contact_name: name,
    p_email: null,
    p_phone: null,
  });

  if (!smartError && smartResult) {
    const result = Array.isArray(smartResult) ? smartResult[0] : smartResult;

    if (result?.lead_id) {
      const wasLinked = result.match_type === 'cross_channel_linked';

      if (wasLinked) {
        console.log(
          `[TikTok] Cross-channel match: TikTok user ${openId} linked to existing lead ${result.lead_id} ` +
          `(matched via ${result.matched_channel || 'unknown channel'})`
        );
      } else if (result.is_new) {
        console.log(`[TikTok] New lead created via smart RPC: ${result.lead_id}`);
      }

      // ALWAYS update profile if we have profile data (new leads need it too!)
      if (profile) {
        await updateTikTokLeadProfile(result.lead_id, profile);
      }

      return {
        id: result.lead_id,
        name: result.lead_name || name,
        isNew: result.is_new || false,
        wasLinked,
      };
    }
  }

  // Fallback: Smart RPC not available or failed, use legacy method
  if (smartError) {
    console.warn('[TikTok] find_or_create_lead_smart not available, using legacy method:', smartError.message);
  }

  // Legacy: Buscar lead existente por TikTok open_id
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('tiktok_open_id', openId)
    .is('deleted_at', null)
    .single();

  if (existingLead) {
    // Update profile if we have new data
    if (profile) {
      await updateTikTokLeadProfile(existingLead.id, profile);
    }
    return { ...existingLead, isNew: false };
  }

  // Crear nuevo lead (use 'other' as 'tiktok' is not valid in leads.source constraint)
  const leadData: Record<string, unknown> = {
    tenant_id: tenantId,
    branch_id: branchId,
    name,
    source: 'other',
    source_details: { platform: 'tiktok' },
    status: 'new',
    classification: 'warm',
    score: 50,
    first_contact_at: new Date().toISOString(),
    tiktok_open_id: openId,
  };

  if (profile) {
    leadData.profile_image_url = profile.avatar_url;
  }

  const { data: newLead, error } = await supabase
    .from('leads')
    .insert(leadData)
    .select('id, name')
    .single();

  if (error) {
    console.error('[TikTok] Error creating lead:', error);
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  console.log(`[TikTok] New lead created: ${newLead.id}`);
  return { ...newLead, isNew: true };
}

/**
 * Helper: Update TikTok lead profile with latest data
 */
async function updateTikTokLeadProfile(
  leadId: string,
  profile: TikTokUserProfile
): Promise<void> {
  const supabase = createServerClient();

  const updates: Record<string, unknown> = {
    last_interaction_at: new Date().toISOString(),
  };

  if (profile.avatar_url) {
    updates.profile_image_url = profile.avatar_url;
  }

  if (profile.display_name) {
    // Only update name if current is generic
    const { data: lead } = await supabase
      .from('leads')
      .select('name')
      .eq('id', leadId)
      .single();

    if (lead?.name === 'Usuario TikTok' || lead?.name === 'Unknown') {
      updates.name = profile.display_name;
    }
  }

  await supabase
    .from('leads')
    .update(updates)
    .eq('id', leadId);
}

// ======================
// CONVERSATION MANAGEMENT
// ======================

/**
 * Busca o crea una conversación activa
 */
export async function findOrCreateTikTokConversation(
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
    .eq('channel', 'tiktok')
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
      channel: 'tiktok',
      channel_connection_id: channelConnectionId,
      status: 'active',
      ai_handling: aiEnabled,
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[TikTok] Error creating conversation:', error);
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  console.log(`[TikTok] New conversation created: ${newConv.id}`);
  return { id: newConv.id, isNew: true };
}

// ======================
// MESSAGE STORAGE
// ======================

/**
 * Guarda un mensaje entrante
 */
export async function saveTikTokIncomingMessage(
  conversationId: string,
  leadId: string,
  parsedMessage: ParsedTikTokMessage
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
      channel: 'tiktok',
      media_url: parsedMessage.mediaUrl,
      status: 'received',
      metadata: {
        tiktok_message_id: parsedMessage.messageId,
        open_id: parsedMessage.openId,
        client_key: parsedMessage.metadata.clientKey,
        is_shared_video: parsedMessage.metadata.isSharedVideo,
        shared_video_id: parsedMessage.metadata.sharedVideoId,
        media_type: parsedMessage.mediaType,
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('[TikTok] Error saving message:', error);
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
export async function enqueueTikTokAIJob(
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
    console.error('[TikTok] Error enqueueing AI job:', error);
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  const delayInfo = delaySeconds > 0 ? ` (delay: ${delaySeconds}s)` : '';
  console.log(`[TikTok] AI response job queued: ${job.id}${delayInfo}`);
  return job.id;
}

/**
 * Encola trabajo de envío de mensaje
 */
export async function enqueueTikTokSendJob(
  payload: TikTokSendMessageJobPayload
): Promise<string> {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from('job_queue')
    .insert({
      tenant_id: payload.tenant_id,
      job_type: 'send_tiktok',
      payload,
      status: 'pending',
      priority: 1,
      max_attempts: 3,
      scheduled_for: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[TikTok] Error enqueueing send job:', error);
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  return job.id;
}

// ======================
// OUTBOUND MESSAGING
// ======================

/**
 * Envía un mensaje por TikTok
 * IMPORTANTE: TikTok tiene límite de 10 mensajes por usuario por día
 * y ventana de 24 horas para responder
 */
export async function sendTikTokMessage(
  accessToken: string,
  recipientOpenId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const url = `${TIKTOK_API_BASE}/direct_message/send/`;

  const payload: TikTokOutboundMessage = {
    open_id: recipientOpenId,
    message_type: 'text',
    message_content: {
      text: message,
    },
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

    if (data.error?.code !== 0) {
      console.error('[TikTok] Send error:', data.error);

      // Manejar errores específicos de TikTok
      if (data.error.code === 10003) {
        return { success: false, error: 'Rate limit exceeded - max 10 messages per user per day' };
      }
      if (data.error.code === 10004) {
        return { success: false, error: '24-hour messaging window expired' };
      }

      return { success: false, error: data.error.message };
    }

    console.log(`[TikTok] Message sent to ${recipientOpenId}`);
    return { success: true };
  } catch (error) {
    console.error('[TikTok] Send failed:', error);
    return { success: false, error: 'Network error' };
  }
}

// ======================
// MAIN PROCESSOR
// ======================

/**
 * Procesa un webhook de TikTok
 */
export async function processTikTokWebhook(
  tenantSlug: string,
  payload: TikTokWebhookPayload
): Promise<ProcessResult> {
  const result: ProcessResult = {
    success: true,
    messages_processed: 0,
    errors: [],
  };

  try {
    // Obtener contexto del tenant
    const context = await getTikTokTenantContext(tenantSlug, payload.client_key);

    if (!context) {
      result.errors.push(`Tenant context not found for ${tenantSlug}`);
      result.success = false;
      return result;
    }

    // Parsear mensaje
    const parsedMessage = parseTikTokMessage(payload);

    if (!parsedMessage) {
      // No es un mensaje entrante (podría ser otro tipo de evento)
      return result;
    }

    console.log(
      `[TikTok] Processing message from ${parsedMessage.openId}: "${parsedMessage.content.substring(0, 50)}..."`
    );

    // Buscar o crear lead
    const lead = await findOrCreateTikTokLead(
      context.tenant_id,
      context.branch_id,
      parsedMessage.openId,
      context.access_token
    );

    // Buscar o crear conversación
    const conversation = await findOrCreateTikTokConversation(
      context.tenant_id,
      context.branch_id,
      lead.id,
      context.channel_connection_id,
      context.ai_enabled
    );

    // Guardar mensaje
    const messageId = await saveTikTokIncomingMessage(
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

      await enqueueTikTokAIJob(
        {
          conversation_id: conversation.id,
          message_id: messageId,
          lead_id: lead.id,
          tenant_id: context.tenant_id,
          channel: 'tiktok',
          channel_connection_id: context.channel_connection_id,
          // Pass per-channel AI configuration
          ai_personality_override: context.ai_personality_override as AIResponseJobPayload['ai_personality_override'],
          custom_instructions_override: context.custom_instructions_override,
          is_first_message: isFirstMessage,
        },
        delaySeconds
      );
    }

    result.messages_processed++;

    console.log(
      `[TikTok] Message processed: lead=${lead.id}, conv=${conversation.id}, msg=${messageId}, ai_queued=${context.ai_enabled}`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMsg);
    result.success = false;
  }

  return result;
}

// ======================
// EXPORTS
// ======================
export const TikTokService = {
  verifySignature: verifyTikTokSignature,
  parseMessage: parseTikTokMessage,
  getTenantContext: getTikTokTenantContext,
  getUserProfile: getTikTokUserProfile,
  findOrCreateLead: findOrCreateTikTokLead,
  findOrCreateConversation: findOrCreateTikTokConversation,
  saveIncomingMessage: saveTikTokIncomingMessage,
  enqueueAIJob: enqueueTikTokAIJob,
  enqueueSendJob: enqueueTikTokSendJob,
  sendMessage: sendTikTokMessage,
  processWebhook: processTikTokWebhook,
  MESSAGE_WINDOW_HOURS,
};
