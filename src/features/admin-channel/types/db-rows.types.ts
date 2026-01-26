/**
 * TIS TIS PLATFORM - Admin Channel DB Row Types
 *
 * Tipos que mapean directamente a las tablas SQL del Admin Channel System.
 * NOTA: Usar snake_case para match exacto con columnas de BD.
 *
 * @module admin-channel/types/db-rows
 */

// =====================================================
// ENUMS (matching SQL ENUMS)
// =====================================================

/** Estado del usuario en el sistema admin channel */
export type AdminUserStatusDB = 'pending' | 'active' | 'suspended' | 'blocked';

/** Tipo de canal de comunicacion */
export type AdminChannelTypeDB = 'whatsapp' | 'telegram';

/** Estado de la conversacion */
export type AdminConversationStatusDB = 'active' | 'resolved' | 'archived';

/** Rol del mensaje en la conversacion */
export type AdminMessageRoleDB = 'user' | 'assistant' | 'system';

/** Estado de entrega del mensaje */
export type AdminMessageStatusDB = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Tipo de notificacion */
export type AdminNotificationTypeDB =
  | 'daily_summary'
  | 'weekly_digest'
  | 'monthly_report'
  | 'low_inventory'
  | 'hot_lead'
  | 'escalation'
  | 'appointment_reminder'
  | 'payment_received'
  | 'custom';

/** Prioridad de notificacion */
export type AdminNotificationPriorityDB = 'low' | 'normal' | 'high' | 'urgent';

/** Categoria de accion de auditoria */
export type AdminAuditCategoryDB = 'auth' | 'analytics' | 'config' | 'notification' | 'system';

/** Tipo de contenido del mensaje */
export type AdminContentTypeDB = 'text' | 'image' | 'document' | 'template';

/** Estado de notificacion */
export type AdminNotificationStatusDB = 'pending' | 'sent' | 'failed' | 'cancelled';

/** Canal de notificacion (incluye 'both') */
export type AdminNotificationChannelDB = 'whatsapp' | 'telegram' | 'both';

// =====================================================
// DB ROW TYPES (snake_case - match SQL)
// =====================================================

/**
 * Representa un registro de la tabla admin_channel_users
 * Vinculacion de telefono/telegram a tenant para gestion B2B
 */
export interface AdminChannelUserRow {
  id: string;
  tenant_id: string;
  staff_id: string | null;

  // Identificadores de canal
  phone_normalized: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;

  // Estado
  status: AdminUserStatusDB;

  // Vinculacion
  link_code: string | null;
  link_code_expires_at: string | null;
  linked_at: string | null;

  // Permisos
  can_view_analytics: boolean;
  can_configure: boolean;
  can_receive_notifications: boolean;

  // Rate limiting
  messages_today: number;
  messages_this_hour: number;
  last_message_at: string | null;
  rate_limit_reset_at: string | null;

  // Preferencias
  preferred_language: string;
  notification_hours_start: number;
  notification_hours_end: number;
  timezone: string;

  // Metadata
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Representa un registro de la tabla admin_channel_conversations
 * Historial de conversaciones con contexto LangGraph
 */
export interface AdminChannelConversationRow {
  id: string;
  tenant_id: string;
  user_id: string;

  // Canal
  channel: AdminChannelTypeDB;
  channel_conversation_id: string | null;

  // Estado
  status: AdminConversationStatusDB;

  // Contexto LangGraph
  current_intent: string | null;
  pending_action: Record<string, unknown> | null;
  context: Record<string, unknown>;

  // Metricas
  message_count: number;
  last_user_message_at: string | null;
  last_bot_message_at: string | null;

  // Timestamps
  started_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Representa un registro de la tabla admin_channel_messages
 * Mensajes individuales con intents y acciones ejecutadas
 */
export interface AdminChannelMessageRow {
  id: string;
  conversation_id: string;

  // Mensaje
  role: AdminMessageRoleDB;
  content: string;
  content_type: AdminContentTypeDB;

  // Canal
  channel_message_id: string | null;

  // IA
  detected_intent: string | null;
  intent_confidence: number | null;
  extracted_data: Record<string, unknown>;

  // Acciones
  actions_executed: Array<Record<string, unknown>>;

  // Tokens (para billing)
  input_tokens: number;
  output_tokens: number;

  // Estado
  status: AdminMessageStatusDB;
  error_message: string | null;

  // Timestamps
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

/**
 * Representa un registro de la tabla admin_channel_notifications
 * Notificaciones programadas y enviadas
 */
export interface AdminChannelNotificationRow {
  id: string;
  tenant_id: string;
  user_id: string | null;

  // Tipo
  notification_type: AdminNotificationTypeDB;

  // Contenido
  title: string | null;
  content: string;
  template_data: Record<string, unknown>;

  // Scheduling
  scheduled_for: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;

  // Estado
  status: AdminNotificationStatusDB;

  // Delivery
  channel: AdminNotificationChannelDB | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;

  // Prioridad
  priority: AdminNotificationPriorityDB;

  // Metadata
  trigger_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Representa un registro de la tabla admin_channel_audit_log
 * Log de auditoria completo para compliance y debugging
 */
export interface AdminChannelAuditLogRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  conversation_id: string | null;
  message_id: string | null;

  // Accion
  action: string;
  action_category: AdminAuditCategoryDB;

  // Detalles
  description: string | null;
  request_data: Record<string, unknown> | null;
  response_data: Record<string, unknown> | null;

  // Resultado
  success: boolean;
  error_code: string | null;
  error_message: string | null;

  // Contexto
  channel: string | null;
  ip_address: string | null;
  user_agent: string | null;

  // Timestamps
  created_at: string;
}

// =====================================================
// RPC RESPONSE TYPES (matching SQL function returns)
// =====================================================

/** Respuesta de generate_admin_link_code */
export interface GenerateLinkCodeResponseDB {
  link_code: string;
  expires_at: string;
  user_id: string;
}

/** Respuesta de verify_admin_link_code */
export interface VerifyLinkCodeResponseDB {
  success: boolean;
  tenant_id: string | null;
  user_id: string | null;
  error_message: string | null;
}

/** Respuesta de get_admin_channel_user */
export interface GetAdminChannelUserResponseDB {
  user_id: string;
  tenant_id: string;
  staff_id: string | null;
  status: string;
  can_view_analytics: boolean;
  can_configure: boolean;
  can_receive_notifications: boolean;
  preferred_language: string;
  timezone: string;
  tenant_name: string;
  tenant_vertical: string;
}

/** Respuesta de update_admin_rate_limit */
export interface UpdateRateLimitResponseDB {
  can_send: boolean;
  messages_remaining_hour: number;
  messages_remaining_day: number;
  reset_at: string;
}

/** Respuesta de get_or_create_admin_conversation */
export interface GetOrCreateConversationResponseDB {
  conversation_id: string;
  is_new: boolean;
  current_intent: string | null;
  pending_action: Record<string, unknown> | null;
  context: Record<string, unknown>;
}

// =====================================================
// INSERT/UPDATE TYPES (for service layer)
// =====================================================

/** Datos para insertar un nuevo usuario admin */
export type AdminChannelUserInsert = Omit<
  AdminChannelUserRow,
  'id' | 'created_at' | 'updated_at' | 'messages_today' | 'messages_this_hour'
>;

/** Datos para actualizar un usuario admin */
export type AdminChannelUserUpdate = Partial<
  Omit<AdminChannelUserRow, 'id' | 'tenant_id' | 'created_at'>
>;

/** Datos para insertar una nueva conversacion */
export type AdminChannelConversationInsert = Omit<
  AdminChannelConversationRow,
  'id' | 'created_at' | 'updated_at' | 'message_count' | 'started_at'
>;

/** Datos para actualizar una conversacion */
export type AdminChannelConversationUpdate = Partial<
  Omit<AdminChannelConversationRow, 'id' | 'tenant_id' | 'user_id' | 'channel' | 'created_at'>
>;

/** Datos para insertar un nuevo mensaje */
export type AdminChannelMessageInsert = Omit<AdminChannelMessageRow, 'id' | 'created_at'>;

/** Datos para insertar una nueva notificacion */
export type AdminChannelNotificationInsert = Omit<
  AdminChannelNotificationRow,
  'id' | 'created_at' | 'updated_at'
>;

/** Datos para insertar un registro de auditoria */
export type AdminChannelAuditLogInsert = Omit<AdminChannelAuditLogRow, 'id' | 'created_at'>;
