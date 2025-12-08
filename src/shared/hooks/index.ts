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
