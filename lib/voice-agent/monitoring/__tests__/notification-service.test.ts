/**
 * TIS TIS Platform - Voice Agent v2.0
 * Notification Service Tests
 *
 * Tests for the notification system:
 * - Channel configuration
 * - Notification sending
 * - Rate limiting
 * - Deduplication
 * - Delivery tracking
 */

import {
  NotificationService,
  getNotificationService,
  sendAlertNotification,
  configureNotificationChannel,
  getNotificationHistory,
  getNotificationDeliveryStats,
  createNotificationHandler,
} from '../notification-service';
import type {
  Alert,
  SlackNotificationConfig,
  EmailNotificationConfig,
  PagerDutyNotificationConfig,
  WebhookNotificationConfig,
  NotificationChannel,
} from '../types';

// =====================================================
// TEST SETUP
// =====================================================

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Notification Service', () => {
  let notificationService: NotificationService;

  // Create a test alert
  const createTestAlert = (overrides: Partial<Alert> = {}): Alert => ({
    id: `alert_${Date.now()}`,
    ruleId: 'test-rule',
    name: 'Test Alert',
    description: 'Test alert description',
    severity: 'warning',
    status: 'firing',
    firedAt: new Date().toISOString(),
    value: 0.1,
    threshold: 0.05,
    labels: { environment: 'test' },
    annotations: {},
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    NotificationService.resetInstance();

    // Create new service with short intervals for testing
    notificationService = new NotificationService({
      enabled: true,
      rateLimitPerMinute: 5,
      deduplicationWindowMs: 100,
      maxRetries: 2,
      retryBaseDelayMs: 10,
    });

    // Mock successful fetch by default
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('ok'),
    });
  });

  // =====================================================
  // CONFIGURATION TESTS
  // =====================================================

  describe('Channel Configuration', () => {
    it('should set Slack channel config', () => {
      const config: SlackNotificationConfig = {
        channel: 'slack',
        enabled: true,
        minSeverity: 'warning',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      };

      notificationService.setChannelConfig(config);

      const retrieved = notificationService.getChannelConfig('slack');
      expect(retrieved).toBeDefined();
      expect(retrieved?.channel).toBe('slack');
      expect(retrieved?.enabled).toBe(true);
    });

    it('should set Email channel config', () => {
      const config: EmailNotificationConfig = {
        channel: 'email',
        enabled: true,
        minSeverity: 'critical',
        recipients: ['admin@test.com'],
      };

      notificationService.setChannelConfig(config);

      const retrieved = notificationService.getChannelConfig('email');
      expect(retrieved).toBeDefined();
      expect(retrieved?.channel).toBe('email');
    });

    it('should set PagerDuty channel config', () => {
      const config: PagerDutyNotificationConfig = {
        channel: 'pagerduty',
        enabled: true,
        minSeverity: 'critical',
        routingKey: 'test-routing-key',
      };

      notificationService.setChannelConfig(config);

      const retrieved = notificationService.getChannelConfig('pagerduty');
      expect(retrieved).toBeDefined();
      expect(retrieved?.channel).toBe('pagerduty');
    });

    it('should set Webhook channel config', () => {
      const config: WebhookNotificationConfig = {
        channel: 'webhook',
        enabled: true,
        minSeverity: 'info',
        url: 'https://example.com/webhook',
        method: 'POST',
      };

      notificationService.setChannelConfig(config);

      const retrieved = notificationService.getChannelConfig('webhook');
      expect(retrieved).toBeDefined();
      expect(retrieved?.channel).toBe('webhook');
    });

    it('should check channel availability', () => {
      notificationService.setChannelConfig({
        channel: 'slack',
        enabled: true,
        minSeverity: 'warning',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });

      notificationService.setChannelConfig({
        channel: 'email',
        enabled: false,
        minSeverity: 'critical',
        recipients: [],
      });

      expect(notificationService.isChannelAvailable('slack')).toBe(true);
      expect(notificationService.isChannelAvailable('email')).toBe(false);
      expect(notificationService.isChannelAvailable('pagerduty')).toBe(false);
    });
  });

  // =====================================================
  // NOTIFICATION SENDING TESTS
  // =====================================================

  describe('Notification Sending', () => {
    beforeEach(() => {
      // Configure Slack channel for tests
      notificationService.setChannelConfig({
        channel: 'slack',
        enabled: true,
        minSeverity: 'warning',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });
    });

    it('should send Slack notification', async () => {
      const alert = createTestAlert();

      const results = await notificationService.sendAlertNotification(alert, ['slack']);

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('slack');
      expect(results[0].success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should send to multiple channels', async () => {
      notificationService.setChannelConfig({
        channel: 'webhook',
        enabled: true,
        minSeverity: 'warning',
        url: 'https://example.com/webhook',
      });

      const alert = createTestAlert();

      const results = await notificationService.sendAlertNotification(alert, ['slack', 'webhook']);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should handle failed notifications', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Error'),
      });

      const alert = createTestAlert();

      const results = await notificationService.sendAlertNotification(alert, ['slack']);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });

    it('should retry failed notifications', async () => {
      // Fail first two attempts, succeed on third
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const alert = createTestAlert();

      const results = await notificationService.sendAlertNotification(alert, ['slack']);

      // Should have attempted retries
      expect(mockFetch).toHaveBeenCalledTimes(2); // maxRetries = 2
      expect(results[0].attempts).toBe(2);
    });

    it('should not send when disabled', async () => {
      const disabledService = new NotificationService({ enabled: false });
      disabledService.setChannelConfig({
        channel: 'slack',
        enabled: true,
        minSeverity: 'warning',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });

      const alert = createTestAlert();

      const results = await disabledService.sendAlertNotification(alert, ['slack']);

      expect(results).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not send to disabled channels', async () => {
      notificationService.setChannelConfig({
        channel: 'slack',
        enabled: false,
        minSeverity: 'warning',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });

      const alert = createTestAlert();

      const results = await notificationService.sendAlertNotification(alert, ['slack']);

      expect(results).toHaveLength(0);
    });
  });

  // =====================================================
  // SEVERITY FILTERING TESTS
  // =====================================================

  describe('Severity Filtering', () => {
    beforeEach(() => {
      // Configure channel with critical minimum severity
      notificationService.setChannelConfig({
        channel: 'slack',
        enabled: true,
        minSeverity: 'critical',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });
    });

    it('should send notifications for matching severity', async () => {
      const alert = createTestAlert({ severity: 'critical' });

      const results = await notificationService.sendAlertNotification(alert, ['slack']);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should skip notifications below minimum severity', async () => {
      const alert = createTestAlert({ severity: 'warning' });

      const results = await notificationService.sendAlertNotification(alert, ['slack']);

      expect(results).toHaveLength(0);
    });

    it('should respect severity hierarchy', async () => {
      notificationService.setChannelConfig({
        channel: 'slack',
        enabled: true,
        minSeverity: 'warning',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });

      // Warning should trigger for warning channel
      const warningAlert = createTestAlert({ severity: 'warning' });
      const warningResults = await notificationService.sendAlertNotification(warningAlert, ['slack']);
      expect(warningResults).toHaveLength(1);

      // Info should not trigger for warning channel
      const infoAlert = createTestAlert({ severity: 'info', id: 'info-alert' });
      const infoResults = await notificationService.sendAlertNotification(infoAlert, ['slack']);
      expect(infoResults).toHaveLength(0);

      // Critical should trigger for warning channel
      const criticalAlert = createTestAlert({ severity: 'critical', id: 'critical-alert' });
      const criticalResults = await notificationService.sendAlertNotification(criticalAlert, ['slack']);
      expect(criticalResults).toHaveLength(1);
    });
  });

  // =====================================================
  // RATE LIMITING TESTS
  // =====================================================

  describe('Rate Limiting', () => {
    beforeEach(() => {
      notificationService.setChannelConfig({
        channel: 'slack',
        enabled: true,
        minSeverity: 'info',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });
    });

    it('should rate limit notifications', async () => {
      // Send more than rate limit (5 per minute)
      for (let i = 0; i < 10; i++) {
        const alert = createTestAlert({ id: `alert-${i}` });
        await notificationService.sendAlertNotification(alert, ['slack']);
      }

      const history = notificationService.getNotificationHistory();
      const successCount = history.flatMap((r) => r.deliveryStatus).filter((s) => s.success).length;
      const rateLimitedCount = history.flatMap((r) => r.deliveryStatus).filter((s) => !s.success && s.error?.includes('Rate limit')).length;

      expect(successCount).toBe(5); // rateLimitPerMinute
      expect(rateLimitedCount).toBe(5);
    });
  });

  // =====================================================
  // DEDUPLICATION TESTS
  // =====================================================

  describe('Deduplication', () => {
    beforeEach(() => {
      notificationService.setChannelConfig({
        channel: 'slack',
        enabled: true,
        minSeverity: 'info',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });
    });

    it('should deduplicate identical alerts', async () => {
      const alert = createTestAlert();

      // Send same alert twice quickly
      await notificationService.sendAlertNotification(alert, ['slack']);
      const secondResults = await notificationService.sendAlertNotification(alert, ['slack']);

      // Second should be deduplicated (empty results)
      expect(secondResults).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not deduplicate different alerts', async () => {
      const alert1 = createTestAlert({ id: 'alert-1' });
      const alert2 = createTestAlert({ id: 'alert-2' });

      await notificationService.sendAlertNotification(alert1, ['slack']);
      const secondResults = await notificationService.sendAlertNotification(alert2, ['slack']);

      expect(secondResults).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should allow re-sending after deduplication window', async () => {
      // Use very short deduplication window service
      const shortWindowService = new NotificationService({
        enabled: true,
        deduplicationWindowMs: 50,
        rateLimitPerMinute: 100,
      });
      shortWindowService.setChannelConfig({
        channel: 'slack',
        enabled: true,
        minSeverity: 'info',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });

      const alert = createTestAlert();

      await shortWindowService.sendAlertNotification(alert, ['slack']);

      // Wait for deduplication window
      await new Promise((resolve) => setTimeout(resolve, 60));

      const secondResults = await shortWindowService.sendAlertNotification(alert, ['slack']);

      // Second should not be deduplicated after window
      expect(secondResults).toHaveLength(1);
    });
  });

  // =====================================================
  // HISTORY AND STATS TESTS
  // =====================================================

  describe('History and Stats', () => {
    beforeEach(() => {
      notificationService.setChannelConfig({
        channel: 'slack',
        enabled: true,
        minSeverity: 'info',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });
    });

    it('should track notification history', async () => {
      const alert = createTestAlert();

      await notificationService.sendAlertNotification(alert, ['slack']);

      const history = notificationService.getNotificationHistory();

      expect(history).toHaveLength(1);
      expect(history[0].alertId).toBe(alert.id);
      expect(history[0].deliveryStatus).toHaveLength(1);
    });

    it('should limit history size', async () => {
      // Send many notifications
      for (let i = 0; i < 10; i++) {
        const alert = createTestAlert({ id: `alert-${i}` });
        await notificationService.sendAlertNotification(alert, ['slack']);
      }

      const history = notificationService.getNotificationHistory(5);

      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should track delivery stats', async () => {
      // Send some successful notifications
      for (let i = 0; i < 3; i++) {
        const alert = createTestAlert({ id: `success-${i}` });
        await notificationService.sendAlertNotification(alert, ['slack']);
      }

      // Send a failing notification
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' });
      const failAlert = createTestAlert({ id: 'fail-alert' });
      await notificationService.sendAlertNotification(failAlert, ['slack']);

      const stats = notificationService.getDeliveryStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.successful).toBeGreaterThan(0);
      expect(stats.byChannel.slack).toBeDefined();
    });
  });

  // =====================================================
  // PAGERDUTY TESTS
  // =====================================================

  describe('PagerDuty Integration', () => {
    beforeEach(() => {
      notificationService.setChannelConfig({
        channel: 'pagerduty',
        enabled: true,
        minSeverity: 'critical',
        routingKey: 'test-routing-key',
      });
    });

    it('should send PagerDuty notification', async () => {
      const alert = createTestAlert({ severity: 'critical' });

      const results = await notificationService.sendAlertNotification(alert, ['pagerduty']);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://events.pagerduty.com/v2/enqueue',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should send resolve event for resolved alerts', async () => {
      const alert = createTestAlert({
        severity: 'critical',
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
      });

      await notificationService.sendAlertNotification(alert, ['pagerduty']);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_action).toBe('resolve');
    });
  });

  // =====================================================
  // WEBHOOK TESTS
  // =====================================================

  describe('Webhook Integration', () => {
    beforeEach(() => {
      notificationService.setChannelConfig({
        channel: 'webhook',
        enabled: true,
        minSeverity: 'info',
        url: 'https://example.com/webhook',
        headers: { 'X-Custom-Header': 'test-value' },
        method: 'POST',
      });
    });

    it('should send webhook notification', async () => {
      const alert = createTestAlert();

      const results = await notificationService.sendAlertNotification(alert, ['webhook']);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Custom-Header': 'test-value',
          }),
        })
      );
    });

    it('should include alert payload in webhook', async () => {
      const alert = createTestAlert();

      await notificationService.sendAlertNotification(alert, ['webhook']);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.alert.id).toBe(alert.id);
      expect(callBody.alert.name).toBe(alert.name);
      expect(callBody.metadata).toBeDefined();
    });
  });

  // =====================================================
  // CONVENIENCE FUNCTION TESTS
  // =====================================================

  describe('Convenience Functions', () => {
    beforeEach(() => {
      NotificationService.resetInstance();
    });

    it('should work with getNotificationService', () => {
      const service1 = getNotificationService();
      const service2 = getNotificationService();

      expect(service1).toBe(service2);
    });

    it('should work with configureNotificationChannel', () => {
      configureNotificationChannel({
        channel: 'slack',
        enabled: true,
        minSeverity: 'warning',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });

      const service = getNotificationService();
      expect(service.isChannelAvailable('slack')).toBe(true);
    });

    it('should work with createNotificationHandler', async () => {
      configureNotificationChannel({
        channel: 'slack',
        enabled: true,
        minSeverity: 'info',
        webhookUrl: 'https://hooks.slack.com/test',
        channelName: '#alerts',
      });

      const handler = createNotificationHandler();
      const alert = createTestAlert();

      await handler(alert, ['slack']);

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
