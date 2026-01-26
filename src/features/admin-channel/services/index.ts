/**
 * TIS TIS PLATFORM - Admin Channel Services
 *
 * Barrel exports para los servicios del Admin Channel System.
 *
 * @module admin-channel/services
 */

export {
  AdminChannelService,
  getAdminChannelService,
  default,
} from './admin-channel.service';

export { processAdminMessage } from './message-processor.service';
export type {
  ProcessMessageInput,
  ProcessMessageResult,
} from './message-processor.service';

export { AnalyticsService, getAnalyticsService } from './analytics.service';

export {
  ConfigService,
  getConfigService,
  resetConfigService,
} from './config.service';
export type {
  ConfigResult,
  ServiceData,
  PriceUpdateData,
  HoursData,
  StaffData,
  PromotionData,
} from './config.service';

// Notification Services
export {
  NotificationService,
  getNotificationService,
  resetNotificationService,
} from './notification.service';
export type {
  CreateNotificationParams,
  NotificationResult,
  LowInventoryItem,
  HotLeadData,
  EscalationData,
} from './notification.service';

export {
  NotificationSenderService,
  getNotificationSenderService,
  resetNotificationSenderService,
} from './notification-sender.service';
export type { SendResult } from './notification-sender.service';
