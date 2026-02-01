/**
 * TIS TIS PLATFORM - Admin Channel Service
 *
 * Servicio core para el Admin Channel System.
 * Maneja usuarios, conversaciones, mensajes y notificaciones
 * del canal de administracion via WhatsApp/Telegram.
 *
 * @module admin-channel/services
 */

import { createServerClient } from '@/src/shared/lib/supabase';

import type {
  // DB Row types
  AdminChannelUserRow,
  AdminChannelConversationRow,
  AdminChannelMessageRow,
  AdminChannelNotificationRow,
  // RPC types
  GenerateLinkCodeResponseDB,
  VerifyLinkCodeResponseDB,
  GetAdminChannelUserResponseDB,
  UpdateRateLimitResponseDB,
  GetOrCreateConversationResponseDB,
  // Application types
  AdminChannelType,
  AdminChannelUser,
  AdminChannelConversation,
  AdminChannelMessage,
  AdminChannelNotification,
  AdminIntent,
  AdminExecutedAction,
  GenerateLinkCodeResult,
  VerifyLinkCodeResult,
  RateLimitResult,
  GetOrCreateConversationResult,
  AdminChannelUserWithTenant,
  AdminConversationContext,
  // Converters
} from '../types';

import {
  toAdminChannelUser,
  toAdminChannelUsers,
  toAdminChannelConversation,
  toAdminChannelConversations,
  toAdminChannelMessage,
  toAdminChannelMessages,
  toAdminChannelNotification,
  toAdminChannelNotifications,
  toGenerateLinkCodeResult,
  toVerifyLinkCodeResult,
  toAdminChannelUserWithTenant,
  toRateLimitResult,
  toGetOrCreateConversationResult,
  fromAdminChannelUser,
  fromAdminChannelConversation,
  fromAdminChannelMessage,
} from '../types';

import { validateUUID } from '../utils/helpers';

// =====================================================
// SERVICE LOGGING PREFIX
// =====================================================

const LOG_PREFIX = '[Admin Channel]';

// =====================================================
// USER MANAGEMENT
// =====================================================

/**
 * Genera un codigo de vinculacion para un nuevo usuario admin.
 */
async function generateLinkCode(
  tenantId: string,
  staffId?: string
): Promise<GenerateLinkCodeResult | null> {
  // P0 Security: Validate UUIDs
  validateUUID(tenantId, 'tenantId');
  if (staffId) {
    validateUUID(staffId, 'staffId');
  }

  const supabase = createServerClient();

  try {
    console.log(`${LOG_PREFIX} Generating link code for tenant ${tenantId}`);

    const { data, error } = await supabase.rpc('generate_admin_link_code', {
      p_tenant_id: tenantId,
      p_staff_id: staffId || null,
    });

    if (error) {
      console.error(`${LOG_PREFIX} Error generating link code:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      console.error(`${LOG_PREFIX} No data returned from generate_admin_link_code`);
      return null;
    }

    const response = data[0] as GenerateLinkCodeResponseDB;
    // SEGURIDAD: No logueamos el codigo completo, solo confirmamos exito
    console.log(`${LOG_PREFIX} Link code generated successfully for user ${response.user_id}`);

    return toGenerateLinkCodeResult(response);
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception generating link code:`, err);
    return null;
  }
}

/**
 * Verifica un codigo de vinculacion y activa la cuenta del usuario.
 */
async function verifyLinkCode(
  linkCode: string,
  phoneNormalized?: string,
  telegramUserId?: string,
  telegramUsername?: string
): Promise<VerifyLinkCodeResult> {
  const supabase = createServerClient();

  try {
    // SEGURIDAD: No logueamos el codigo completo
    console.log(`${LOG_PREFIX} Verifying link code (length: ${linkCode.length})`);

    const { data, error } = await supabase.rpc('verify_admin_link_code', {
      p_link_code: linkCode,
      p_phone_normalized: phoneNormalized || null,
      p_telegram_user_id: telegramUserId || null,
      p_telegram_username: telegramUsername || null,
    });

    if (error) {
      console.error(`${LOG_PREFIX} Error verifying link code:`, error);
      return {
        success: false,
        tenantId: null,
        userId: null,
        errorMessage: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        tenantId: null,
        userId: null,
        errorMessage: 'Codigo invalido o expirado',
      };
    }

    const response = data[0] as VerifyLinkCodeResponseDB;
    console.log(`${LOG_PREFIX} Link code verification result: ${response.success}`);

    return toVerifyLinkCodeResult(response);
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception verifying link code:`, err);
    return {
      success: false,
      tenantId: null,
      userId: null,
      errorMessage: 'Error interno al verificar codigo',
    };
  }
}

/**
 * Obtiene un usuario admin por telefono o Telegram ID.
 */
async function getUserByChannel(
  phoneNormalized?: string,
  telegramUserId?: string
): Promise<AdminChannelUserWithTenant | null> {
  const supabase = createServerClient();

  try {
    // SEGURIDAD: No logueamos PII completo, solo indicadores
    const hasPhone = !!phoneNormalized;
    const hasTelegram = !!telegramUserId;
    console.log(`${LOG_PREFIX} Getting user by channel: hasPhone=${hasPhone}, hasTelegram=${hasTelegram}`);

    const { data, error } = await supabase.rpc('get_admin_channel_user', {
      p_phone_normalized: phoneNormalized || null,
      p_telegram_user_id: telegramUserId || null,
    });

    if (error) {
      console.error(`${LOG_PREFIX} Error getting user by channel:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`${LOG_PREFIX} No user found for channel`);
      return null;
    }

    const response = data[0] as GetAdminChannelUserResponseDB;
    return toAdminChannelUserWithTenant(response);
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception getting user by channel:`, err);
    return null;
  }
}

/**
 * Obtiene un usuario admin por ID.
 */
async function getUserById(userId: string): Promise<AdminChannelUser | null> {
  // P0 Security: Validate UUID
  validateUUID(userId, 'userId');

  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('admin_channel_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error(`${LOG_PREFIX} Error getting user by ID:`, error);
      return null;
    }

    return toAdminChannelUser(data as AdminChannelUserRow);
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception getting user by ID:`, err);
    return null;
  }
}

/**
 * Lista usuarios admin de un tenant.
 */
async function listUsersByTenant(
  tenantId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ users: AdminChannelUser[]; total: number }> {
  // P0 Security: Validate UUID
  validateUUID(tenantId, 'tenantId');

  const supabase = createServerClient();

  try {
    let query = supabase
      .from('admin_channel_users')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error(`${LOG_PREFIX} Error listing users:`, error);
      return { users: [], total: 0 };
    }

    return {
      users: toAdminChannelUsers((data || []) as AdminChannelUserRow[]),
      total: count || 0,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception listing users:`, err);
    return { users: [], total: 0 };
  }
}

/**
 * Actualiza un usuario admin.
 */
async function updateUser(
  userId: string,
  updates: Partial<AdminChannelUser>
): Promise<AdminChannelUser | null> {
  // P0 Security: Validate UUID
  validateUUID(userId, 'userId');

  const supabase = createServerClient();

  try {
    const dbUpdates = fromAdminChannelUser(updates);

    const { data, error } = await supabase
      .from('admin_channel_users')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      console.error(`${LOG_PREFIX} Error updating user:`, error);
      return null;
    }

    return toAdminChannelUser(data as AdminChannelUserRow);
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception updating user:`, err);
    return null;
  }
}

// =====================================================
// RATE LIMITING
// =====================================================

/**
 * Verifica y actualiza el rate limit de un usuario.
 */
async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  // P0 Security: Validate UUID
  validateUUID(userId, 'userId');

  const supabase = createServerClient();

  try {
    const { data, error } = await supabase.rpc('update_admin_rate_limit', {
      p_user_id: userId,
    });

    if (error) {
      console.error(`${LOG_PREFIX} Error checking rate limit:`, error);
      return {
        canSend: false,
        messagesRemainingHour: 0,
        messagesRemainingDay: 0,
        resetAt: new Date(),
      };
    }

    if (!data || data.length === 0) {
      return {
        canSend: false,
        messagesRemainingHour: 0,
        messagesRemainingDay: 0,
        resetAt: new Date(),
      };
    }

    const response = data[0] as UpdateRateLimitResponseDB;
    return toRateLimitResult(response);
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception checking rate limit:`, err);
    return {
      canSend: false,
      messagesRemainingHour: 0,
      messagesRemainingDay: 0,
      resetAt: new Date(),
    };
  }
}

// =====================================================
// CONVERSATION MANAGEMENT
// =====================================================

/**
 * Obtiene o crea una conversacion activa para un usuario.
 */
async function getOrCreateConversation(
  userId: string,
  channel: AdminChannelType
): Promise<GetOrCreateConversationResult | null> {
  // P0 Security: Validate UUID
  validateUUID(userId, 'userId');

  const supabase = createServerClient();

  try {
    console.log(`${LOG_PREFIX} Getting/creating conversation for user ${userId}`);

    const { data, error } = await supabase.rpc('get_or_create_admin_conversation', {
      p_user_id: userId,
      p_channel: channel,
    });

    if (error) {
      console.error(`${LOG_PREFIX} Error getting/creating conversation:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      console.error(`${LOG_PREFIX} No data returned from get_or_create_admin_conversation`);
      return null;
    }

    const response = data[0] as GetOrCreateConversationResponseDB;
    const result = toGetOrCreateConversationResult(response);

    console.log(
      `${LOG_PREFIX} Conversation ${result.isNew ? 'created' : 'retrieved'}: ${result.conversationId}`
    );

    return result;
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception getting/creating conversation:`, err);
    return null;
  }
}

/**
 * Obtiene una conversacion por ID.
 */
async function getConversationById(
  conversationId: string
): Promise<AdminChannelConversation | null> {
  // P0 Security: Validate UUID
  validateUUID(conversationId, 'conversationId');

  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('admin_channel_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error || !data) {
      console.error(`${LOG_PREFIX} Error getting conversation:`, error);
      return null;
    }

    return toAdminChannelConversation(data as AdminChannelConversationRow);
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception getting conversation:`, err);
    return null;
  }
}

/**
 * Lista conversaciones de un usuario.
 */
async function listConversationsByUser(
  userId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ conversations: AdminChannelConversation[]; total: number }> {
  // P0 Security: Validate UUID
  validateUUID(userId, 'userId');

  const supabase = createServerClient();

  try {
    let query = supabase
      .from('admin_channel_conversations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error(`${LOG_PREFIX} Error listing conversations:`, error);
      return { conversations: [], total: 0 };
    }

    return {
      conversations: toAdminChannelConversations((data || []) as AdminChannelConversationRow[]),
      total: count || 0,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception listing conversations:`, err);
    return { conversations: [], total: 0 };
  }
}

/**
 * Actualiza el contexto de una conversacion.
 */
async function updateConversationContext(
  conversationId: string,
  context: Partial<AdminConversationContext>,
  currentIntent?: AdminIntent,
  pendingAction?: Record<string, unknown> | null
): Promise<boolean> {
  // P0 Security: Validate UUID
  validateUUID(conversationId, 'conversationId');

  const supabase = createServerClient();

  try {
    const updates: Record<string, unknown> = {
      context,
      updated_at: new Date().toISOString(),
    };

    if (currentIntent !== undefined) {
      updates.current_intent = currentIntent;
    }

    if (pendingAction !== undefined) {
      updates.pending_action = pendingAction;
    }

    const { error } = await supabase
      .from('admin_channel_conversations')
      .update(updates)
      .eq('id', conversationId);

    if (error) {
      console.error(`${LOG_PREFIX} Error updating conversation context:`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception updating conversation context:`, err);
    return false;
  }
}

/**
 * Resuelve una conversacion.
 */
async function resolveConversation(conversationId: string): Promise<boolean> {
  // P0 Security: Validate UUID
  validateUUID(conversationId, 'conversationId');

  const supabase = createServerClient();

  try {
    const { error } = await supabase
      .from('admin_channel_conversations')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (error) {
      console.error(`${LOG_PREFIX} Error resolving conversation:`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception resolving conversation:`, err);
    return false;
  }
}

// =====================================================
// MESSAGE MANAGEMENT
// =====================================================

/**
 * Guarda un mensaje en una conversacion.
 */
async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  options?: {
    detectedIntent?: AdminIntent;
    intentConfidence?: number;
    extractedData?: Record<string, unknown>;
    actionsExecuted?: Array<Record<string, unknown>>;
    inputTokens?: number;
    outputTokens?: number;
    channelMessageId?: string;
  }
): Promise<string | null> {
  // P0 Security: Validate UUID
  validateUUID(conversationId, 'conversationId');

  const supabase = createServerClient();

  try {
    console.log(`${LOG_PREFIX} Saving message to conversation ${conversationId}`);

    const { data, error } = await supabase.rpc('save_admin_message', {
      p_conversation_id: conversationId,
      p_role: role,
      p_content: content,
      p_detected_intent: options?.detectedIntent || null,
      p_intent_confidence: options?.intentConfidence || null,
      p_extracted_data: options?.extractedData || {},
      p_actions_executed: options?.actionsExecuted || [],
      p_input_tokens: options?.inputTokens || 0,
      p_output_tokens: options?.outputTokens || 0,
      p_channel_message_id: options?.channelMessageId || null,
    });

    if (error) {
      console.error(`${LOG_PREFIX} Error saving message:`, error);
      return null;
    }

    console.log(`${LOG_PREFIX} Message saved successfully: ${data}`);
    return data as string;
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception saving message:`, err);
    return null;
  }
}

/**
 * Lista mensajes de una conversacion.
 */
async function listMessagesByConversation(
  conversationId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ messages: AdminChannelMessage[]; total: number }> {
  // P0 Security: Validate UUID
  validateUUID(conversationId, 'conversationId');

  const supabase = createServerClient();

  try {
    let query = supabase
      .from('admin_channel_messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error(`${LOG_PREFIX} Error listing messages:`, error);
      return { messages: [], total: 0 };
    }

    return {
      messages: toAdminChannelMessages((data || []) as AdminChannelMessageRow[]),
      total: count || 0,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception listing messages:`, err);
    return { messages: [], total: 0 };
  }
}

/**
 * Obtiene los ultimos N mensajes de una conversacion (para contexto de IA).
 */
async function getRecentMessages(
  conversationId: string,
  limit: number = 10
): Promise<AdminChannelMessage[]> {
  // P0 Security: Validate UUID
  validateUUID(conversationId, 'conversationId');

  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('admin_channel_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`${LOG_PREFIX} Error getting recent messages:`, error);
      return [];
    }

    // Reverse to get chronological order
    const messages = toAdminChannelMessages((data || []) as AdminChannelMessageRow[]);
    return messages.reverse();
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception getting recent messages:`, err);
    return [];
  }
}

// =====================================================
// NOTIFICATION MANAGEMENT
// =====================================================

/**
 * Crea una notificacion.
 */
async function createNotification(notification: {
  tenantId: string;
  userId?: string;
  notificationType: string;
  title?: string;
  content: string;
  channel?: AdminChannelType | 'both';
  priority?: string;
  scheduledFor?: Date;
  templateData?: Record<string, unknown>;
  triggerData?: Record<string, unknown>;
}): Promise<string | null> {
  // P0 Security: Validate UUIDs
  validateUUID(notification.tenantId, 'tenantId');
  if (notification.userId) {
    validateUUID(notification.userId, 'userId');
  }

  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('admin_channel_notifications')
      .insert({
        tenant_id: notification.tenantId,
        user_id: notification.userId || null,
        notification_type: notification.notificationType,
        title: notification.title || null,
        content: notification.content,
        channel: notification.channel || 'both',
        priority: notification.priority || 'normal',
        scheduled_for: notification.scheduledFor?.toISOString() || null,
        template_data: notification.templateData || {},
        trigger_data: notification.triggerData || null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error(`${LOG_PREFIX} Error creating notification:`, error);
      return null;
    }

    console.log(`${LOG_PREFIX} Notification created: ${data.id}`);
    return data.id;
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception creating notification:`, err);
    return null;
  }
}

/**
 * Lista notificaciones pendientes para envio.
 */
async function getPendingNotifications(
  limit: number = 50
): Promise<AdminChannelNotification[]> {
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('admin_channel_notifications')
      .select('*')
      .eq('status', 'pending')
      .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error(`${LOG_PREFIX} Error getting pending notifications:`, error);
      return [];
    }

    return toAdminChannelNotifications((data || []) as AdminChannelNotificationRow[]);
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception getting pending notifications:`, err);
    return [];
  }
}

/**
 * Actualiza el estado de una notificacion despues de enviarla.
 */
async function updateNotificationStatus(
  notificationId: string,
  status: 'sent' | 'failed',
  errorMessage?: string
): Promise<boolean> {
  // P0 Security: Validate UUID
  validateUUID(notificationId, 'notificationId');

  const supabase = createServerClient();

  try {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'sent') {
      updates.sent_at = new Date().toISOString();
    } else if (errorMessage) {
      updates.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('admin_channel_notifications')
      .update(updates)
      .eq('id', notificationId);

    if (error) {
      console.error(`${LOG_PREFIX} Error updating notification status:`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception updating notification status:`, err);
    return false;
  }
}

// =====================================================
// AUDIT LOGGING
// =====================================================

/**
 * Registra una accion en el log de auditoria.
 */
async function logAuditAction(entry: {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  messageId?: string;
  action: string;
  actionCategory: 'auth' | 'analytics' | 'config' | 'notification' | 'system';
  description?: string;
  requestData?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
  channel?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<boolean> {
  // P0 Security: Validate UUIDs
  validateUUID(entry.tenantId, 'tenantId');
  if (entry.userId) {
    validateUUID(entry.userId, 'userId');
  }
  if (entry.conversationId) {
    validateUUID(entry.conversationId, 'conversationId');
  }
  if (entry.messageId) {
    validateUUID(entry.messageId, 'messageId');
  }

  const supabase = createServerClient();

  try {
    const { error } = await supabase.from('admin_channel_audit_log').insert({
      tenant_id: entry.tenantId,
      user_id: entry.userId || null,
      conversation_id: entry.conversationId || null,
      message_id: entry.messageId || null,
      action: entry.action,
      action_category: entry.actionCategory,
      description: entry.description || null,
      request_data: entry.requestData || null,
      response_data: entry.responseData || null,
      success: entry.success ?? true,
      error_code: entry.errorCode || null,
      error_message: entry.errorMessage || null,
      channel: entry.channel || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
    });

    if (error) {
      console.error(`${LOG_PREFIX} Error logging audit action:`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception logging audit action:`, err);
    return false;
  }
}

// =====================================================
// CONVENIENCE WRAPPER FUNCTIONS (for webhooks)
// =====================================================

/**
 * Guarda un mensaje entrante del usuario.
 * Wrapper convenience para saveMessage con role='user'.
 */
async function saveIncomingMessage(
  conversationId: string,
  content: string,
  channelMessageId?: string
): Promise<{ id: string } | null> {
  const messageId = await saveMessage(conversationId, 'user', content, {
    channelMessageId,
  });

  return messageId ? { id: messageId } : null;
}

/**
 * Guarda un mensaje de respuesta del asistente.
 * Wrapper convenience para saveMessage con role='assistant'.
 */
async function saveAssistantMessage(
  conversationId: string,
  content: string,
  detectedIntent?: AdminIntent,
  intentConfidence?: number,
  extractedData?: Record<string, unknown>,
  actionsExecuted?: AdminExecutedAction[],
  tokens?: { input: number; output: number }
): Promise<{ id: string } | null> {
  const messageId = await saveMessage(conversationId, 'assistant', content, {
    detectedIntent,
    intentConfidence,
    extractedData,
    actionsExecuted: actionsExecuted as unknown as Record<string, unknown>[],
    inputTokens: tokens?.input,
    outputTokens: tokens?.output,
  });

  return messageId ? { id: messageId } : null;
}

/**
 * Obtiene el contexto completo de un usuario para procesar mensajes.
 * Incluye usuario, tenant y conversacion activa.
 */
async function getFullUserContext(
  channel: 'whatsapp' | 'telegram',
  identifier: string
): Promise<{
  user: AdminChannelUserWithTenant;
  conversationId: string;
  tenantId: string;
  isNewConversation: boolean;
  conversationHistory: Array<{ role: string; content: string }>;
} | null> {
  // Obtener usuario
  const user =
    channel === 'whatsapp'
      ? await getUserByChannel(identifier, undefined)
      : await getUserByChannel(undefined, identifier);

  if (!user) {
    return null;
  }

  // Obtener o crear conversacion
  const convResult = await getOrCreateConversation(user.userId, channel);
  if (!convResult) {
    return null;
  }

  // Obtener historial de conversacion para contexto de LangGraph
  const recentMessages = await getRecentMessages(convResult.conversationId, 10);
  const conversationHistory = recentMessages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  return {
    user,
    conversationId: convResult.conversationId,
    tenantId: user.tenantId,
    isNewConversation: convResult.isNew,
    conversationHistory,
  };
}

/**
 * Actualiza el estado de entrega de un mensaje por su channel_message_id.
 */
async function updateMessageDeliveryStatus(
  channelMessageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed'
): Promise<boolean> {
  const supabase = createServerClient();

  try {
    const updates: Record<string, unknown> = {
      status,
    };

    if (status === 'delivered') {
      updates.delivered_at = new Date().toISOString();
    } else if (status === 'read') {
      updates.read_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('admin_channel_messages')
      .update(updates)
      .eq('channel_message_id', channelMessageId);

    if (error) {
      console.error(`${LOG_PREFIX} Error updating message delivery status:`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} Exception updating message delivery status:`, err);
    return false;
  }
}

// =====================================================
// EXPORT SERVICE AS SINGLETON
// =====================================================

/**
 * Admin Channel Service
 *
 * Servicio singleton para gestionar el canal de administracion.
 */
export const AdminChannelService = {
  // User management
  generateLinkCode,
  verifyLinkCode,
  getUserByChannel,
  getUserById,
  listUsersByTenant,
  updateUser,

  // Rate limiting
  checkRateLimit,

  // Conversation management
  getOrCreateConversation,
  getConversationById,
  listConversationsByUser,
  updateConversationContext,
  resolveConversation,

  // Message management
  saveMessage,
  listMessagesByConversation,
  getRecentMessages,

  // Notification management
  createNotification,
  getPendingNotifications,
  updateNotificationStatus,

  // Audit logging
  logAuditAction,

  // Convenience wrappers (for webhooks)
  saveIncomingMessage,
  saveAssistantMessage,
  getFullUserContext,
  updateMessageDeliveryStatus,
};

/**
 * Funcion getter para obtener el servicio.
 * Util para imports dinamicos y testing.
 */
export function getAdminChannelService() {
  return AdminChannelService;
}

export default AdminChannelService;
