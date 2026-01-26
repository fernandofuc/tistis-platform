/**
 * TIS TIS PLATFORM - Admin Channel Feature
 *
 * Sistema de canal de administracion para clientes B2B.
 * Permite interactuar via WhatsApp/Telegram para consultar analytics,
 * configurar servicios y recibir alertas.
 *
 * @module admin-channel
 */

// =====================================================
// SERVICES
// =====================================================

export { AdminChannelService, getAdminChannelService } from './services';
export { ConfigService, getConfigService } from './services';
export type { ConfigResult, ServiceData, HoursData, StaffData, PromotionData } from './services';

// =====================================================
// TYPES - Re-export from types module
// =====================================================

// DB Row types
export type {
  AdminUserStatusDB,
  AdminChannelTypeDB,
  AdminConversationStatusDB,
  AdminMessageRoleDB,
  AdminMessageStatusDB,
  AdminNotificationTypeDB,
  AdminNotificationPriorityDB,
  AdminAuditCategoryDB,
  AdminChannelUserRow,
  AdminChannelConversationRow,
  AdminChannelMessageRow,
  AdminChannelNotificationRow,
  AdminChannelAuditLogRow,
} from './types';

// Application types
export type {
  AdminChannelType,
  AdminUserStatus,
  AdminConversationStatus,
  AdminMessageRole,
  AdminMessageStatus,
  AdminNotificationType,
  AdminNotificationPriority,
  AdminAuditCategory,
  AdminIntent,
  AdminChannelUser,
  AdminChannelConversation,
  AdminChannelMessage,
  AdminChannelNotification,
  AdminPendingAction,
  AdminExecutedAction,
  AdminConversationContext,
  DailySummary,
  LowInventoryAlert,
  HotLeadAlert,
  GenerateLinkCodeResult,
  VerifyLinkCodeResult,
  RateLimitResult,
  GetOrCreateConversationResult,
  AdminChannelUserWithTenant,
} from './types';

// API types
export type {
  WhatsAppWebhookPayload,
  TelegramWebhookPayload,
  NormalizedIncomingMessage,
  ProcessMessageRequest,
  ProcessMessageResponse,
  SendNotificationRequest,
  ApiResponse,
  AdminChannelErrorCode,
  AdminChannelError,
} from './types';

// =====================================================
// CONSTANTS
// =====================================================

export {
  MAX_MESSAGES_PER_HOUR,
  MAX_MESSAGES_PER_DAY,
  LINK_CODE_EXPIRATION_MINUTES,
  INTENT_KEYWORDS,
  USER_STATUS_META,
  NOTIFICATION_TYPE_META,
  NOTIFICATION_PRIORITY_META,
  CHANNEL_META,
  ERROR_META,
  INTENT_CATEGORIES,
  DEFAULT_USER_VALUES,
  SUPPORTED_TIMEZONES,
  SUPPORTED_LANGUAGES,
} from './types';

// =====================================================
// CONVERTERS
// =====================================================

export {
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
  toRateLimitResult,
  toGetOrCreateConversationResult,
} from './types';

// =====================================================
// GRAPH (LangGraph)
// =====================================================

export {
  buildAdminChannelGraph,
  getAdminChannelGraph,
  resetAdminChannelGraph,
  AdminChannelState,
} from './graph';

export type { AdminChannelStateType } from './graph';

// =====================================================
// ADDITIONAL TYPES (LangGraph context)
// =====================================================

export type {
  AdminChannelContext,
  AdminAnalyticsReport,
  AdminActionOption,
  AdminContentType,
} from './types';

// =====================================================
// ANALYTICS SERVICE
// =====================================================

export { AnalyticsService, getAnalyticsService } from './services';

// =====================================================
// NOTIFICATION SERVICES
// =====================================================

export {
  NotificationService,
  getNotificationService,
  resetNotificationService,
  NotificationSenderService,
  getNotificationSenderService,
  resetNotificationSenderService,
} from './services';

export type {
  CreateNotificationParams,
  NotificationResult,
  LowInventoryItem,
  HotLeadData,
  EscalationData,
  SendResult,
} from './services';

// =====================================================
// UTILS
// =====================================================

export { formatReportForChannel } from './utils/report-formatter';

// Shared helpers
export {
  validateUUID,
  isValidUUID,
  withTimeout,
  extractString,
  extractNumber,
  extractBoolean,
  escapeLikePattern,
  sanitizeUserContent,
} from './utils';
