/**
 * TIS TIS PLATFORM - Admin Channel Type Converters
 *
 * Funciones de conversion entre tipos DB Row (snake_case) y
 * tipos Application (camelCase).
 *
 * @module admin-channel/types/converters
 */

import type {
  AdminChannelUserRow,
  AdminChannelConversationRow,
  AdminChannelMessageRow,
  AdminChannelNotificationRow,
  AdminChannelAuditLogRow,
  GenerateLinkCodeResponseDB,
  VerifyLinkCodeResponseDB,
  GetAdminChannelUserResponseDB,
  UpdateRateLimitResponseDB,
  GetOrCreateConversationResponseDB,
} from './db-rows.types';

import type {
  AdminChannelUser,
  AdminChannelConversation,
  AdminChannelMessage,
  AdminChannelNotification,
  AdminIntent,
  AdminPendingAction,
  AdminExecutedAction,
  AdminConversationContext,
  GenerateLinkCodeResult,
  VerifyLinkCodeResult,
  RateLimitResult,
  GetOrCreateConversationResult,
  AdminChannelUserWithTenant,
  AdminUserStatus,
  AdminChannelType,
} from './application.types';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Convierte string ISO a Date o null
 */
function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

/**
 * Convierte Date a string ISO o null
 */
function toISOString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Valida si un string es un AdminIntent valido
 */
function toAdminIntent(value: string | null): AdminIntent | null {
  if (!value) return null;

  const validIntents: AdminIntent[] = [
    'analytics_daily_summary',
    'analytics_weekly_summary',
    'analytics_monthly_summary',
    'analytics_sales',
    'analytics_leads',
    'analytics_orders',
    'analytics_inventory',
    'analytics_ai_performance',
    'analytics_appointments',
    'analytics_revenue',
    'config_services',
    'config_prices',
    'config_hours',
    'config_staff',
    'config_ai_settings',
    'config_promotions',
    'config_notifications',
    'operation_inventory_check',
    'operation_pending_orders',
    'operation_escalations',
    'operation_appointments_today',
    'operation_pending_leads',
    'notification_settings',
    'notification_pause',
    'notification_resume',
    'notification_test',
    'help',
    'greeting',
    'confirm',
    'cancel',
    'unknown',
  ];

  return validIntents.includes(value as AdminIntent) ? (value as AdminIntent) : 'unknown';
}

/**
 * Convierte Record a AdminPendingAction o null
 */
function toPendingAction(value: Record<string, unknown> | null): AdminPendingAction | null {
  if (!value) return null;

  return {
    type: value.type as AdminPendingAction['type'],
    entityType: value.entityType as AdminPendingAction['entityType'],
    entityId: value.entityId as string | undefined,
    data: (value.data as Record<string, unknown>) || {},
    options: value.options as AdminPendingAction['options'],
    expiresAt: new Date(value.expiresAt as string),
  };
}

/**
 * Convierte AdminPendingAction a Record
 */
function fromPendingAction(value: AdminPendingAction | null): Record<string, unknown> | null {
  if (!value) return null;

  return {
    type: value.type,
    entityType: value.entityType,
    entityId: value.entityId,
    data: value.data,
    options: value.options,
    expiresAt: value.expiresAt.toISOString(),
  };
}

/**
 * Convierte array de Records a AdminExecutedAction[]
 */
function toExecutedActions(value: Array<Record<string, unknown>>): AdminExecutedAction[] {
  return value.map((action) => ({
    type: action.type as string,
    entityType: action.entityType as string,
    entityId: action.entityId as string | undefined,
    success: action.success as boolean,
    error: action.error as string | undefined,
    resultData: action.resultData as Record<string, unknown> | undefined,
    executedAt: new Date(action.executedAt as string),
  }));
}

/**
 * Convierte AdminExecutedAction[] a array de Records
 */
function fromExecutedActions(value: AdminExecutedAction[]): Array<Record<string, unknown>> {
  return value.map((action) => ({
    type: action.type,
    entityType: action.entityType,
    entityId: action.entityId,
    success: action.success,
    error: action.error,
    resultData: action.resultData,
    executedAt: action.executedAt.toISOString(),
  }));
}

// =====================================================
// USER CONVERTERS
// =====================================================

/**
 * Convierte AdminChannelUserRow (DB) a AdminChannelUser (App)
 */
export function toAdminChannelUser(row: AdminChannelUserRow): AdminChannelUser {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    staffId: row.staff_id,
    phoneNormalized: row.phone_normalized,
    telegramUserId: row.telegram_user_id,
    telegramUsername: row.telegram_username,
    status: row.status,
    linkCode: row.link_code,
    linkCodeExpiresAt: toDate(row.link_code_expires_at),
    linkedAt: toDate(row.linked_at),
    canViewAnalytics: row.can_view_analytics,
    canConfigure: row.can_configure,
    canReceiveNotifications: row.can_receive_notifications,
    messagesToday: row.messages_today,
    messagesThisHour: row.messages_this_hour,
    lastMessageAt: toDate(row.last_message_at),
    rateLimitResetAt: toDate(row.rate_limit_reset_at),
    preferredLanguage: row.preferred_language,
    notificationHoursStart: row.notification_hours_start,
    notificationHoursEnd: row.notification_hours_end,
    timezone: row.timezone,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Convierte AdminChannelUser (App) a datos para insertar/actualizar en DB
 */
export function fromAdminChannelUser(
  user: Partial<AdminChannelUser>
): Partial<AdminChannelUserRow> {
  const result: Partial<AdminChannelUserRow> = {};

  if (user.tenantId !== undefined) result.tenant_id = user.tenantId;
  if (user.staffId !== undefined) result.staff_id = user.staffId;
  if (user.phoneNormalized !== undefined) result.phone_normalized = user.phoneNormalized;
  if (user.telegramUserId !== undefined) result.telegram_user_id = user.telegramUserId;
  if (user.telegramUsername !== undefined) result.telegram_username = user.telegramUsername;
  if (user.status !== undefined) result.status = user.status;
  if (user.linkCode !== undefined) result.link_code = user.linkCode;
  if (user.linkCodeExpiresAt !== undefined)
    result.link_code_expires_at = toISOString(user.linkCodeExpiresAt);
  if (user.linkedAt !== undefined) result.linked_at = toISOString(user.linkedAt);
  if (user.canViewAnalytics !== undefined) result.can_view_analytics = user.canViewAnalytics;
  if (user.canConfigure !== undefined) result.can_configure = user.canConfigure;
  if (user.canReceiveNotifications !== undefined)
    result.can_receive_notifications = user.canReceiveNotifications;
  if (user.preferredLanguage !== undefined) result.preferred_language = user.preferredLanguage;
  if (user.notificationHoursStart !== undefined)
    result.notification_hours_start = user.notificationHoursStart;
  if (user.notificationHoursEnd !== undefined)
    result.notification_hours_end = user.notificationHoursEnd;
  if (user.timezone !== undefined) result.timezone = user.timezone;
  if (user.metadata !== undefined) result.metadata = user.metadata;

  return result;
}

// =====================================================
// CONVERSATION CONVERTERS
// =====================================================

/**
 * Convierte AdminChannelConversationRow (DB) a AdminChannelConversation (App)
 */
export function toAdminChannelConversation(
  row: AdminChannelConversationRow
): AdminChannelConversation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    channel: row.channel,
    channelConversationId: row.channel_conversation_id,
    status: row.status,
    currentIntent: toAdminIntent(row.current_intent),
    pendingAction: toPendingAction(row.pending_action),
    context: row.context as AdminConversationContext,
    messageCount: row.message_count,
    lastUserMessageAt: toDate(row.last_user_message_at),
    lastBotMessageAt: toDate(row.last_bot_message_at),
    startedAt: new Date(row.started_at),
    resolvedAt: toDate(row.resolved_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Convierte AdminChannelConversation (App) a datos para insertar/actualizar en DB
 */
export function fromAdminChannelConversation(
  conv: Partial<AdminChannelConversation>
): Partial<AdminChannelConversationRow> {
  const result: Partial<AdminChannelConversationRow> = {};

  if (conv.tenantId !== undefined) result.tenant_id = conv.tenantId;
  if (conv.userId !== undefined) result.user_id = conv.userId;
  if (conv.channel !== undefined) result.channel = conv.channel;
  if (conv.channelConversationId !== undefined)
    result.channel_conversation_id = conv.channelConversationId;
  if (conv.status !== undefined) result.status = conv.status;
  if (conv.currentIntent !== undefined) result.current_intent = conv.currentIntent;
  if (conv.pendingAction !== undefined)
    result.pending_action = fromPendingAction(conv.pendingAction);
  if (conv.context !== undefined) result.context = conv.context;
  if (conv.resolvedAt !== undefined) result.resolved_at = toISOString(conv.resolvedAt);

  return result;
}

// =====================================================
// MESSAGE CONVERTERS
// =====================================================

/**
 * Convierte AdminChannelMessageRow (DB) a AdminChannelMessage (App)
 */
export function toAdminChannelMessage(row: AdminChannelMessageRow): AdminChannelMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    contentType: row.content_type,
    channelMessageId: row.channel_message_id,
    detectedIntent: toAdminIntent(row.detected_intent),
    intentConfidence: row.intent_confidence,
    extractedData: row.extracted_data,
    actionsExecuted: toExecutedActions(row.actions_executed),
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    deliveredAt: toDate(row.delivered_at),
    readAt: toDate(row.read_at),
  };
}

/**
 * Convierte AdminChannelMessage (App) a datos para insertar en DB
 */
export function fromAdminChannelMessage(
  msg: Partial<AdminChannelMessage>
): Partial<AdminChannelMessageRow> {
  const result: Partial<AdminChannelMessageRow> = {};

  if (msg.conversationId !== undefined) result.conversation_id = msg.conversationId;
  if (msg.role !== undefined) result.role = msg.role;
  if (msg.content !== undefined) result.content = msg.content;
  if (msg.contentType !== undefined) result.content_type = msg.contentType;
  if (msg.channelMessageId !== undefined) result.channel_message_id = msg.channelMessageId;
  if (msg.detectedIntent !== undefined) result.detected_intent = msg.detectedIntent;
  if (msg.intentConfidence !== undefined) result.intent_confidence = msg.intentConfidence;
  if (msg.extractedData !== undefined) result.extracted_data = msg.extractedData;
  if (msg.actionsExecuted !== undefined)
    result.actions_executed = fromExecutedActions(msg.actionsExecuted);
  if (msg.inputTokens !== undefined) result.input_tokens = msg.inputTokens;
  if (msg.outputTokens !== undefined) result.output_tokens = msg.outputTokens;
  if (msg.status !== undefined) result.status = msg.status;
  if (msg.errorMessage !== undefined) result.error_message = msg.errorMessage;

  return result;
}

// =====================================================
// NOTIFICATION CONVERTERS
// =====================================================

/**
 * Convierte AdminChannelNotificationRow (DB) a AdminChannelNotification (App)
 */
export function toAdminChannelNotification(
  row: AdminChannelNotificationRow
): AdminChannelNotification {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    notificationType: row.notification_type,
    title: row.title,
    content: row.content,
    templateData: row.template_data,
    scheduledFor: toDate(row.scheduled_for),
    isRecurring: row.is_recurring,
    recurrenceRule: row.recurrence_rule,
    status: row.status,
    channel: row.channel as AdminChannelNotification['channel'],
    sentAt: toDate(row.sent_at),
    deliveredAt: toDate(row.delivered_at),
    readAt: toDate(row.read_at),
    errorMessage: row.error_message,
    priority: row.priority,
    triggerData: row.trigger_data,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// =====================================================
// RPC RESPONSE CONVERTERS
// =====================================================

/**
 * Convierte GenerateLinkCodeResponseDB a GenerateLinkCodeResult
 */
export function toGenerateLinkCodeResult(
  response: GenerateLinkCodeResponseDB
): GenerateLinkCodeResult {
  return {
    linkCode: response.link_code,
    expiresAt: new Date(response.expires_at),
    userId: response.user_id,
  };
}

/**
 * Convierte VerifyLinkCodeResponseDB a VerifyLinkCodeResult
 */
export function toVerifyLinkCodeResult(response: VerifyLinkCodeResponseDB): VerifyLinkCodeResult {
  return {
    success: response.success,
    tenantId: response.tenant_id,
    userId: response.user_id,
    errorMessage: response.error_message,
  };
}

/**
 * Convierte GetAdminChannelUserResponseDB a AdminChannelUserWithTenant
 */
export function toAdminChannelUserWithTenant(
  response: GetAdminChannelUserResponseDB
): AdminChannelUserWithTenant {
  return {
    userId: response.user_id,
    tenantId: response.tenant_id,
    staffId: response.staff_id,
    status: response.status as AdminUserStatus,
    canViewAnalytics: response.can_view_analytics,
    canConfigure: response.can_configure,
    canReceiveNotifications: response.can_receive_notifications,
    preferredLanguage: response.preferred_language,
    timezone: response.timezone,
    tenantName: response.tenant_name,
    tenantVertical: response.tenant_vertical,
  };
}

/**
 * Convierte UpdateRateLimitResponseDB a RateLimitResult
 */
export function toRateLimitResult(response: UpdateRateLimitResponseDB): RateLimitResult {
  return {
    canSend: response.can_send,
    messagesRemainingHour: response.messages_remaining_hour,
    messagesRemainingDay: response.messages_remaining_day,
    resetAt: new Date(response.reset_at),
  };
}

/**
 * Convierte GetOrCreateConversationResponseDB a GetOrCreateConversationResult
 */
export function toGetOrCreateConversationResult(
  response: GetOrCreateConversationResponseDB
): GetOrCreateConversationResult {
  return {
    conversationId: response.conversation_id,
    isNew: response.is_new,
    currentIntent: toAdminIntent(response.current_intent),
    pendingAction: toPendingAction(response.pending_action),
    context: (response.context || {}) as AdminConversationContext,
  };
}

// =====================================================
// BATCH CONVERTERS
// =====================================================

/**
 * Convierte array de AdminChannelUserRow a AdminChannelUser[]
 */
export function toAdminChannelUsers(rows: AdminChannelUserRow[]): AdminChannelUser[] {
  return rows.map(toAdminChannelUser);
}

/**
 * Convierte array de AdminChannelConversationRow a AdminChannelConversation[]
 */
export function toAdminChannelConversations(
  rows: AdminChannelConversationRow[]
): AdminChannelConversation[] {
  return rows.map(toAdminChannelConversation);
}

/**
 * Convierte array de AdminChannelMessageRow a AdminChannelMessage[]
 */
export function toAdminChannelMessages(rows: AdminChannelMessageRow[]): AdminChannelMessage[] {
  return rows.map(toAdminChannelMessage);
}

/**
 * Convierte array de AdminChannelNotificationRow a AdminChannelNotification[]
 */
export function toAdminChannelNotifications(
  rows: AdminChannelNotificationRow[]
): AdminChannelNotification[] {
  return rows.map(toAdminChannelNotification);
}
