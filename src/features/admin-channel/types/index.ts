/**
 * TIS TIS PLATFORM - Admin Channel Types
 *
 * Barrel exports para todos los tipos del Admin Channel System.
 *
 * @module admin-channel/types
 */

// =====================================================
// DB ROW TYPES (snake_case - matching SQL)
// =====================================================

export type {
  // Enums
  AdminUserStatusDB,
  AdminChannelTypeDB,
  AdminConversationStatusDB,
  AdminMessageRoleDB,
  AdminMessageStatusDB,
  AdminNotificationTypeDB,
  AdminNotificationPriorityDB,
  AdminAuditCategoryDB,
  AdminContentTypeDB,
  AdminNotificationStatusDB,
  AdminNotificationChannelDB,
  // Row types
  AdminChannelUserRow,
  AdminChannelConversationRow,
  AdminChannelMessageRow,
  AdminChannelNotificationRow,
  AdminChannelAuditLogRow,
  // RPC response types
  GenerateLinkCodeResponseDB,
  VerifyLinkCodeResponseDB,
  GetAdminChannelUserResponseDB,
  UpdateRateLimitResponseDB,
  GetOrCreateConversationResponseDB,
  // Insert/Update types
  AdminChannelUserInsert,
  AdminChannelUserUpdate,
  AdminChannelConversationInsert,
  AdminChannelConversationUpdate,
  AdminChannelMessageInsert,
  AdminChannelNotificationInsert,
  AdminChannelAuditLogInsert,
} from './db-rows.types';

// =====================================================
// APPLICATION TYPES (camelCase - for components/services)
// =====================================================

export type {
  // Enums (cleaner names)
  AdminChannelType,
  AdminUserStatus,
  AdminConversationStatus,
  AdminMessageRole,
  AdminMessageStatus,
  AdminNotificationType,
  AdminNotificationPriority,
  AdminAuditCategory,
  AdminContentType,
  AdminIntent,
  // Entity types
  AdminChannelUser,
  AdminChannelConversation,
  AdminChannelMessage,
  AdminChannelNotification,
  // Action types
  AdminPendingAction,
  AdminActionOption,
  AdminExecutedAction,
  // Context types
  AdminConversationContext,
  // Analytics types
  DailySummary,
  LowInventoryAlert,
  HotLeadAlert,
  // Service result types
  GenerateLinkCodeResult,
  VerifyLinkCodeResult,
  RateLimitResult,
  GetOrCreateConversationResult,
  AdminChannelUserWithTenant,
  // LangGraph types
  AdminChannelContext,
  AdminAnalyticsReport,
} from './application.types';

// =====================================================
// API TYPES (for endpoints)
// =====================================================

export type {
  // Webhook payloads
  WhatsAppWebhookPayload,
  TelegramWebhookPayload,
  NormalizedIncomingMessage,
  // Request types
  GenerateLinkCodeRequest,
  VerifyLinkCodeRequest,
  ProcessMessageRequest,
  SendNotificationRequest,
  UpdateUserPermissionsRequest,
  UpdateUserPreferencesRequest,
  UpdateUserStatusRequest,
  GetAnalyticsRequest,
  // Response types
  ApiResponse,
  GenerateLinkCodeResponse,
  VerifyLinkCodeResponse,
  ProcessMessageResponse,
  GetUserResponse,
  ListUsersResponse,
  ListConversationsResponse,
  GetConversationMessagesResponse,
  GetAnalyticsResponse,
  GetPendingNotificationsResponse,
  // Pagination & filters
  PaginationParams,
  ListUsersFilters,
  ListConversationsFilters,
  ListMessagesFilters,
  // Error types
  AdminChannelErrorCode,
  AdminChannelError,
  // Webhook response types
  WhatsAppWebhookResponse,
  TelegramWebhookResponse,
} from './api.types';

// =====================================================
// CONVERTERS
// =====================================================

export {
  // User converters
  toAdminChannelUser,
  fromAdminChannelUser,
  toAdminChannelUsers,
  // Conversation converters
  toAdminChannelConversation,
  fromAdminChannelConversation,
  toAdminChannelConversations,
  // Message converters
  toAdminChannelMessage,
  fromAdminChannelMessage,
  toAdminChannelMessages,
  // Notification converters
  toAdminChannelNotification,
  toAdminChannelNotifications,
  // RPC response converters
  toGenerateLinkCodeResult,
  toVerifyLinkCodeResult,
  toAdminChannelUserWithTenant,
  toRateLimitResult,
  toGetOrCreateConversationResult,
} from './converters';

// =====================================================
// CONSTANTS
// =====================================================

export {
  // Rate limiting
  MAX_MESSAGES_PER_HOUR,
  MAX_MESSAGES_PER_DAY,
  LINK_CODE_EXPIRATION_MINUTES,
  LINK_CODE_LENGTH,
  // Intent keywords
  INTENT_KEYWORDS,
  // Metadata records
  USER_STATUS_META,
  NOTIFICATION_TYPE_META,
  NOTIFICATION_PRIORITY_META,
  AUDIT_CATEGORY_META,
  CHANNEL_META,
  ERROR_META,
  // Intent categories
  INTENT_CATEGORIES,
  // Default values
  DEFAULT_USER_VALUES,
  SUPPORTED_TIMEZONES,
  SUPPORTED_LANGUAGES,
} from './constants';
