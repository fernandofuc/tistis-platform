// =====================================================
// TIS TIS PLATFORM - Settings Feature
// Configuration components for dashboard
// =====================================================

// Components
export { ChannelConnections } from './components/ChannelConnections';
export { AIConfiguration } from './components/AIConfiguration';
export { BranchManagement } from './components/BranchManagement';
export { SecuritySection } from './components/SecuritySection';
export { PaymentsSection } from './components/PaymentsSection';

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
