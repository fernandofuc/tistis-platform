// =====================================================
// TIS TIS PLATFORM - Shared Hooks Index
// =====================================================

export { useDebounce } from './useDebounce';
export { useLocalStorage } from './useLocalStorage';

// Realtime Subscriptions
export {
  useRealtimeSubscription,
  useLeadsRealtime,
  useAppointmentsRealtime,
  useConversationsRealtime,
  useMessagesRealtime,
} from './useRealtimeSubscription';

export {
  useRealtimeDashboard,
  useConversationRealtime,
  useCalendarRealtime,
} from './useRealtimeDashboard';

// Integrations (WhatsApp & n8n)
export { useIntegrations } from './useIntegrations';

// Notifications
export {
  useNotifications,
  createNotification,
  broadcastNotification,
} from './useNotifications';

// Global Search
export {
  useGlobalSearch,
  getSearchResultIcon,
  getSearchResultLabel,
  type SearchResult,
} from './useGlobalSearch';

// Streaming Text (typing effect)
export {
  useStreamingText,
  useDirectStreaming,
  type UseStreamingTextOptions,
  type UseStreamingTextReturn,
} from './useStreamingText';

