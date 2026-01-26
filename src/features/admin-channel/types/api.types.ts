/**
 * TIS TIS PLATFORM - Admin Channel API Types
 *
 * Tipos de entrada y salida para los API endpoints del Admin Channel.
 * Estos tipos definen el contrato de la API REST.
 *
 * @module admin-channel/types/api
 */

import type {
  AdminChannelType,
  AdminUserStatus,
  AdminIntent,
  AdminNotificationType,
  AdminNotificationPriority,
  AdminChannelUser,
  AdminChannelConversation,
  AdminChannelMessage,
  AdminChannelNotification,
  DailySummary,
  AdminChannelUserWithTenant,
} from './application.types';

// =====================================================
// WEBHOOK INPUT TYPES (from WhatsApp/Telegram)
// =====================================================

/**
 * Payload de mensaje entrante desde WhatsApp
 */
export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'image' | 'document' | 'interactive';
          text?: { body: string };
          image?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; filename: string };
          interactive?: {
            type: 'button_reply' | 'list_reply';
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string; description?: string };
          };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
 * Payload de mensaje entrante desde Telegram
 */
export interface TelegramWebhookPayload {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
    }>;
    document?: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
    };
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: { id: number };
    };
    data?: string;
  };
}

/**
 * Mensaje normalizado desde cualquier canal
 */
export interface NormalizedIncomingMessage {
  channel: AdminChannelType;
  channelMessageId: string;
  senderId: string; // phone_normalized o telegram_user_id
  senderName?: string;
  content: string;
  contentType: 'text' | 'image' | 'document' | 'interactive';
  timestamp: Date;
  metadata?: {
    phoneNumberId?: string; // WhatsApp
    chatId?: number; // Telegram
    mediaId?: string;
    mimeType?: string;
    filename?: string;
    interactiveResponse?: {
      type: 'button' | 'list';
      id: string;
      title: string;
    };
  };
}

// =====================================================
// API REQUEST TYPES
// =====================================================

/**
 * Request para generar codigo de vinculacion
 */
export interface GenerateLinkCodeRequest {
  tenantId: string;
  staffId?: string;
}

/**
 * Request para verificar codigo de vinculacion
 */
export interface VerifyLinkCodeRequest {
  linkCode: string;
  phoneNormalized?: string;
  telegramUserId?: string;
  telegramUsername?: string;
}

/**
 * Request para procesar mensaje del admin
 */
export interface ProcessMessageRequest {
  channel: AdminChannelType;
  senderId: string; // phone_normalized o telegram_user_id
  content: string;
  contentType?: 'text' | 'image' | 'document' | 'interactive';
  channelMessageId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request para enviar notificacion
 */
export interface SendNotificationRequest {
  tenantId: string;
  userId?: string; // Si no se especifica, se envia a todos los usuarios activos del tenant
  notificationType: AdminNotificationType;
  title?: string;
  content: string;
  channel?: AdminChannelType | 'both';
  priority?: AdminNotificationPriority;
  scheduledFor?: string; // ISO datetime
  templateData?: Record<string, unknown>;
}

/**
 * Request para actualizar permisos de usuario
 */
export interface UpdateUserPermissionsRequest {
  userId: string;
  canViewAnalytics?: boolean;
  canConfigure?: boolean;
  canReceiveNotifications?: boolean;
}

/**
 * Request para actualizar preferencias de usuario
 */
export interface UpdateUserPreferencesRequest {
  userId: string;
  preferredLanguage?: string;
  notificationHoursStart?: number;
  notificationHoursEnd?: number;
  timezone?: string;
}

/**
 * Request para bloquear/suspender usuario
 */
export interface UpdateUserStatusRequest {
  userId: string;
  status: AdminUserStatus;
  reason?: string;
}

/**
 * Request para obtener analytics
 */
export interface GetAnalyticsRequest {
  tenantId: string;
  dateRange: 'today' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
  metrics?: Array<'leads' | 'appointments' | 'revenue' | 'ai' | 'inventory'>;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

/**
 * Response base para todas las APIs
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Response de generar codigo de vinculacion
 */
export interface GenerateLinkCodeResponse {
  linkCode: string;
  expiresAt: string;
  userId: string;
  instructions: string;
}

/**
 * Response de verificar codigo
 */
export interface VerifyLinkCodeResponse {
  success: boolean;
  userId?: string;
  tenantId?: string;
  tenantName?: string;
  welcomeMessage?: string;
  errorMessage?: string;
}

/**
 * Response de procesar mensaje
 */
export interface ProcessMessageResponse {
  messageId: string;
  responseText: string;
  detectedIntent: AdminIntent;
  intentConfidence: number;
  actionsExecuted: Array<{
    type: string;
    success: boolean;
    error?: string;
  }>;
  pendingAction?: {
    type: string;
    message: string;
    options?: Array<{ label: string; value: string }>;
  };
  tokens: {
    input: number;
    output: number;
  };
}

/**
 * Response de obtener usuario
 */
export interface GetUserResponse extends AdminChannelUserWithTenant {
  recentMessages?: AdminChannelMessage[];
  activeConversation?: AdminChannelConversation;
}

/**
 * Response de listar usuarios
 */
export interface ListUsersResponse {
  users: AdminChannelUser[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Response de listar conversaciones
 */
export interface ListConversationsResponse {
  conversations: AdminChannelConversation[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Response de obtener mensajes de conversacion
 */
export interface GetConversationMessagesResponse {
  conversationId: string;
  messages: AdminChannelMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Response de analytics
 */
export interface GetAnalyticsResponse {
  period: {
    start: string;
    end: string;
  };
  summary: DailySummary;
  trends?: {
    leadsChange: number;
    revenueChange: number;
    appointmentsChange: number;
  };
  topMetrics?: {
    topServices: Array<{ name: string; count: number; revenue: number }>;
    topSources: Array<{ name: string; count: number }>;
    peakHours: Array<{ hour: number; count: number }>;
  };
}

/**
 * Response de notificaciones pendientes
 */
export interface GetPendingNotificationsResponse {
  notifications: AdminChannelNotification[];
  total: number;
}

// =====================================================
// PAGINATION & FILTER TYPES
// =====================================================

/**
 * Parametros de paginacion
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

/**
 * Filtros para listar usuarios
 */
export interface ListUsersFilters extends PaginationParams {
  status?: AdminUserStatus;
  channel?: AdminChannelType;
  search?: string; // Busca en phone, telegram_username
}

/**
 * Filtros para listar conversaciones
 */
export interface ListConversationsFilters extends PaginationParams {
  status?: 'active' | 'resolved' | 'archived';
  channel?: AdminChannelType;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Filtros para listar mensajes
 */
export interface ListMessagesFilters extends PaginationParams {
  role?: 'user' | 'assistant' | 'system';
  intent?: AdminIntent;
  dateFrom?: string;
  dateTo?: string;
}

// =====================================================
// ERROR CODES
// =====================================================

/**
 * Codigos de error especificos del Admin Channel
 */
export type AdminChannelErrorCode =
  | 'INVALID_LINK_CODE'
  | 'LINK_CODE_EXPIRED'
  | 'USER_NOT_FOUND'
  | 'USER_NOT_ACTIVE'
  | 'USER_BLOCKED'
  | 'USER_SUSPENDED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_CHANNEL'
  | 'PERMISSION_DENIED'
  | 'TENANT_NOT_FOUND'
  | 'CONVERSATION_NOT_FOUND'
  | 'MESSAGE_DELIVERY_FAILED'
  | 'AI_PROCESSING_ERROR'
  | 'NOTIFICATION_FAILED'
  | 'INVALID_REQUEST'
  | 'INTERNAL_ERROR';

/**
 * Error estructurado del Admin Channel
 */
export interface AdminChannelError {
  code: AdminChannelErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  httpStatus: number;
}

// =====================================================
// WEBHOOK RESPONSE TYPES
// =====================================================

/**
 * Response para webhook de WhatsApp
 */
export interface WhatsAppWebhookResponse {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'interactive' | 'template';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  interactive?: {
    type: 'button' | 'list';
    header?: {
      type: 'text';
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action:
      | {
          buttons: Array<{
            type: 'reply';
            reply: { id: string; title: string };
          }>;
        }
      | {
          button: string;
          sections: Array<{
            title: string;
            rows: Array<{ id: string; title: string; description?: string }>;
          }>;
        };
  };
}

/**
 * Response para webhook de Telegram
 */
export interface TelegramWebhookResponse {
  chat_id: number;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: {
    inline_keyboard?: Array<
      Array<{
        text: string;
        callback_data?: string;
        url?: string;
      }>
    >;
    keyboard?: Array<
      Array<{
        text: string;
        request_contact?: boolean;
      }>
    >;
    one_time_keyboard?: boolean;
    resize_keyboard?: boolean;
  };
}
