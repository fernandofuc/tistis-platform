// =====================================================
// TIS TIS PLATFORM - Settings Feature
// Configuration components for dashboard
// =====================================================

// Components
export { ChannelConnections } from './components/ChannelConnections';
export { ChannelAISettings } from './components/ChannelAISettings';
export { AIConfiguration } from './components/AIConfiguration';
export { BranchManagement } from './components/BranchManagement';
export { SecuritySection } from './components/SecuritySection';
export { PaymentsSection } from './components/PaymentsSection';
export { BillingSection } from './components/BillingSection';
export { MenuCatalogConfig } from './components/MenuCatalogConfig';
export { ServiceCatalogConfig } from './components/ServiceCatalogConfig';

// Hooks
export { useChannels, useChannelAIConfig, useChannel } from './hooks/useChannels';

// Types
export * from './types/channels.types';

// Services
export * as channelsService from './services/channels.service';

// Services
export {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  toggleNotificationPreference,
  type NotificationPreferences,
} from './services/notificationService';

export {
  getStripeConnectStatus,
  createOnboardingLink,
  disconnectStripeAccount,
  getPaymentHistory,
  getPayoutHistory,
  getSubscriptionHistory,
  formatAmount,
  getStatusColor,
  getStatusLabel,
  type StripeConnectStatus,
  type PaymentRecord,
  type PayoutRecord,
  type SubscriptionRecord,
} from './services/paymentsService';
