/**
 * TIS TIS Platform - Voice Agent v2.0
 * Notification Service
 *
 * Handles sending notifications through various channels:
 * - Slack (webhooks)
 * - Email (SMTP/API)
 * - PagerDuty (events API)
 * - Generic webhooks
 *
 * Features:
 * - Rate limiting to prevent notification storms
 * - Retry logic with exponential backoff
 * - Notification deduplication
 * - Channel-specific formatting
 * - Delivery tracking
 *
 * @module lib/voice-agent/monitoring/notification-service
 */

import type {
  Alert,
  NotificationChannel,
  NotificationConfig,
  SlackNotificationConfig,
  EmailNotificationConfig,
  PagerDutyNotificationConfig,
  WebhookNotificationConfig,
  NotificationPayload,
  AlertSeverity,
} from './types';
import { getVoiceLogger } from './voice-logger';

// =====================================================
// TYPES
// =====================================================

/**
 * Notification service configuration
 */
export interface NotificationServiceConfig {
  /** Enable notifications */
  enabled: boolean;

  /** Default channels if not specified in alert */
  defaultChannels: NotificationChannel[];

  /** Rate limit per channel (notifications per minute) */
  rateLimitPerMinute: number;

  /** Maximum retries per notification */
  maxRetries: number;

  /** Base delay for retries (ms) */
  retryBaseDelayMs: number;

  /** Deduplication window (ms) */
  deduplicationWindowMs: number;

  /** Environment name for formatting */
  environment: string;

  /** Service name for formatting */
  serviceName: string;

  /** Base URL for alert links */
  dashboardBaseUrl?: string;
}

/**
 * Delivery status
 */
export interface DeliveryStatus {
  channel: NotificationChannel;
  success: boolean;
  timestamp: string;
  attempts: number;
  error?: string;
  responseCode?: number;
}

/**
 * Notification record for tracking
 */
export interface NotificationRecord {
  id: string;
  alertId: string;
  payload: NotificationPayload;
  deliveryStatus: DeliveryStatus[];
  createdAt: string;
}

// =====================================================
// DEFAULT CONFIGURATION
// =====================================================

const DEFAULT_CONFIG: NotificationServiceConfig = {
  enabled: process.env.ENABLE_VOICE_NOTIFICATIONS !== 'false',
  defaultChannels: ['slack'],
  rateLimitPerMinute: 10,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  deduplicationWindowMs: 300_000, // 5 minutes
  environment: process.env.NODE_ENV ?? 'development',
  serviceName: 'voice-agent-v2',
  dashboardBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
};

// =====================================================
// CHANNEL CONFIGURATIONS
// =====================================================

/**
 * Default channel configurations from environment
 */
function getDefaultChannelConfigs(): Map<NotificationChannel, NotificationConfig> {
  const configs = new Map<NotificationChannel, NotificationConfig>();

  // Slack configuration
  if (process.env.SLACK_WEBHOOK_URL) {
    configs.set('slack', {
      channel: 'slack',
      enabled: true,
      minSeverity: 'warning',
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channelName: process.env.SLACK_CHANNEL || '#alerts',
      mentionUsers: process.env.SLACK_MENTION_USERS?.split(','),
    } as SlackNotificationConfig);
  }

  // Email configuration
  if (process.env.ALERT_EMAIL_RECIPIENTS) {
    configs.set('email', {
      channel: 'email',
      enabled: true,
      minSeverity: 'critical',
      recipients: process.env.ALERT_EMAIL_RECIPIENTS.split(','),
      smtpConfig: process.env.SMTP_HOST ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
      } : undefined,
    } as EmailNotificationConfig);
  }

  // PagerDuty configuration
  if (process.env.PAGERDUTY_ROUTING_KEY) {
    configs.set('pagerduty', {
      channel: 'pagerduty',
      enabled: true,
      minSeverity: 'critical',
      routingKey: process.env.PAGERDUTY_ROUTING_KEY,
      serviceKey: process.env.PAGERDUTY_SERVICE_KEY,
    } as PagerDutyNotificationConfig);
  }

  return configs;
}

// =====================================================
// NOTIFICATION SERVICE CLASS
// =====================================================

/**
 * Service for sending alert notifications
 */
export class NotificationService {
  private readonly config: NotificationServiceConfig;
  private readonly channelConfigs: Map<NotificationChannel, NotificationConfig>;
  private readonly recentNotifications: Map<string, number> = new Map(); // dedup key -> timestamp
  private readonly rateLimitCounters: Map<NotificationChannel, number[]> = new Map(); // channel -> timestamps
  private readonly notificationHistory: NotificationRecord[] = [];
  private static instance: NotificationService | null = null;
  private readonly logger = getVoiceLogger();

  constructor(config?: Partial<NotificationServiceConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.channelConfigs = getDefaultChannelConfigs();

    // Initialize rate limit counters
    for (const channel of ['slack', 'email', 'pagerduty', 'webhook'] as NotificationChannel[]) {
      this.rateLimitCounters.set(channel, []);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<NotificationServiceConfig>): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(config);
    }
    return NotificationService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    NotificationService.instance = null;
  }

  // =====================================================
  // CONFIGURATION
  // =====================================================

  /**
   * Set configuration for a channel
   */
  setChannelConfig(config: NotificationConfig): void {
    this.channelConfigs.set(config.channel, config);
    this.logger.info('Notification channel configured', {
      data: { channel: config.channel, enabled: config.enabled },
    });
  }

  /**
   * Get channel configuration
   */
  getChannelConfig(channel: NotificationChannel): NotificationConfig | undefined {
    return this.channelConfigs.get(channel);
  }

  /**
   * Check if channel is available
   */
  isChannelAvailable(channel: NotificationChannel): boolean {
    const config = this.channelConfigs.get(channel);
    return Boolean(config?.enabled);
  }

  // =====================================================
  // NOTIFICATION SENDING
  // =====================================================

  /**
   * Send notification for an alert
   */
  async sendAlertNotification(alert: Alert, channels: NotificationChannel[]): Promise<DeliveryStatus[]> {
    if (!this.config.enabled) {
      this.logger.debug('Notifications disabled, skipping', {
        data: { alertId: alert.id },
      });
      return [];
    }

    // Check deduplication
    const dedupKey = this.getDedupKey(alert);
    if (this.isDuplicate(dedupKey)) {
      this.logger.debug('Duplicate notification suppressed', {
        data: { alertId: alert.id },
      });
      return [];
    }

    // Record for deduplication
    this.recentNotifications.set(dedupKey, Date.now());

    const results: DeliveryStatus[] = [];
    const channelsToNotify = channels.length > 0 ? channels : this.config.defaultChannels;

    for (const channel of channelsToNotify) {
      const config = this.channelConfigs.get(channel);

      // Skip if not configured
      if (!config || !config.enabled) {
        continue;
      }

      // Check minimum severity
      if (!this.meetsSeverityThreshold(alert.severity, config.minSeverity)) {
        continue;
      }

      // Check rate limit
      if (this.isRateLimited(channel)) {
        this.logger.warn('Rate limit exceeded for channel', {
          data: { channel, alertId: alert.id },
        });
        results.push({
          channel,
          success: false,
          timestamp: new Date().toISOString(),
          attempts: 0,
          error: 'Rate limit exceeded',
        });
        continue;
      }

      // Send notification
      const result = await this.sendToChannel(alert, channel, config);
      results.push(result);
    }

    // Record notification
    this.recordNotification(alert, results);

    return results;
  }

  /**
   * Send to a specific channel
   */
  private async sendToChannel(
    alert: Alert,
    channel: NotificationChannel,
    config: NotificationConfig
  ): Promise<DeliveryStatus> {
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < this.config.maxRetries) {
      attempts++;

      try {
        // Update rate limit counter
        this.recordRateLimitEvent(channel);

        switch (channel) {
          case 'slack':
            await this.sendSlackNotification(alert, config as SlackNotificationConfig);
            break;
          case 'email':
            await this.sendEmailNotification(alert, config as EmailNotificationConfig);
            break;
          case 'pagerduty':
            await this.sendPagerDutyNotification(alert, config as PagerDutyNotificationConfig);
            break;
          case 'webhook':
            await this.sendWebhookNotification(alert, config as WebhookNotificationConfig);
            break;
        }

        this.logger.info('Notification sent successfully', {
          data: { channel, alertId: alert.id, attempts },
        });

        return {
          channel,
          success: true,
          timestamp: new Date().toISOString(),
          attempts,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Notification attempt ${attempts} failed`, {
          data: { channel, alertId: alert.id, error: lastError },
        });

        // Wait before retry with exponential backoff
        if (attempts < this.config.maxRetries) {
          await this.delay(this.config.retryBaseDelayMs * Math.pow(2, attempts - 1));
        }
      }
    }

    return {
      channel,
      success: false,
      timestamp: new Date().toISOString(),
      attempts,
      error: lastError,
    };
  }

  // =====================================================
  // SLACK NOTIFICATIONS
  // =====================================================

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert, config: SlackNotificationConfig): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    const statusEmoji = alert.status === 'resolved' ? ':white_check_mark:' : ':rotating_light:';

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} ${alert.status === 'resolved' ? 'Resolved' : 'Alert'}: ${alert.name}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Severity:*\n${alert.severity.toUpperCase()}` },
          { type: 'mrkdwn', text: `*Status:*\n${alert.status}` },
          { type: 'mrkdwn', text: `*Value:*\n${alert.value.toFixed(2)}` },
          { type: 'mrkdwn', text: `*Threshold:*\n${alert.threshold}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Description:*\n${alert.description}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Environment: ${this.config.environment} | Service: ${this.config.serviceName} | Time: ${alert.firedAt}`,
          },
        ],
      },
    ];

    // Add dashboard link if available
    if (this.config.dashboardBaseUrl) {
      // Use unknown as intermediate type for Slack block type compatibility
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Dashboard', emoji: true },
            url: `${this.config.dashboardBaseUrl}/admin/monitoring`,
            action_id: 'view_dashboard',
          },
        ],
      } as unknown as typeof blocks[number]);
    }

    // Add mentions for critical alerts
    let text = `Alert: ${alert.name}`;
    if (alert.severity === 'critical' && config.mentionUsers?.length) {
      text = `${config.mentionUsers.map((u) => `<@${u}>`).join(' ')} ${text}`;
    }

    const payload = {
      channel: config.channelName,
      username: 'Voice Agent Monitor',
      icon_emoji: ':telephone_receiver:',
      text,
      attachments: [
        {
          color,
          blocks,
        },
      ],
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }
  }

  // =====================================================
  // EMAIL NOTIFICATIONS
  // =====================================================

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert, config: EmailNotificationConfig): Promise<void> {
    // In a real implementation, this would use nodemailer or an email service API
    // For now, we'll use a placeholder that logs the attempt

    const subject = `[${alert.severity.toUpperCase()}] Voice Agent Alert: ${alert.name}`;
    const body = this.formatEmailBody(alert);

    this.logger.info('Email notification would be sent', {
      data: {
        recipients: config.recipients,
        subject,
        alertId: alert.id,
      },
    });

    // If using an email API like SendGrid, Resend, etc:
    // await sendEmail({ to: config.recipients, subject, html: body });

    // Simulate async operation
    await this.delay(100);
  }

  /**
   * Format email body
   */
  private formatEmailBody(alert: Alert): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .header { background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px; }
    .content { padding: 20px; }
    .field { margin-bottom: 10px; }
    .label { font-weight: bold; color: #666; }
    .footer { background-color: #f5f5f5; padding: 10px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${alert.status === 'resolved' ? 'RESOLVED' : 'ALERT'}: ${alert.name}</h1>
  </div>
  <div class="content">
    <div class="field">
      <span class="label">Severity:</span> ${alert.severity.toUpperCase()}
    </div>
    <div class="field">
      <span class="label">Status:</span> ${alert.status}
    </div>
    <div class="field">
      <span class="label">Description:</span> ${alert.description}
    </div>
    <div class="field">
      <span class="label">Current Value:</span> ${alert.value.toFixed(4)}
    </div>
    <div class="field">
      <span class="label">Threshold:</span> ${alert.threshold}
    </div>
    <div class="field">
      <span class="label">Time:</span> ${alert.firedAt}
    </div>
    ${alert.resolvedAt ? `<div class="field"><span class="label">Resolved At:</span> ${alert.resolvedAt}</div>` : ''}
  </div>
  <div class="footer">
    Environment: ${this.config.environment} | Service: ${this.config.serviceName}
    ${this.config.dashboardBaseUrl ? `<br><a href="${this.config.dashboardBaseUrl}/admin/monitoring">View Dashboard</a>` : ''}
  </div>
</body>
</html>
    `.trim();
  }

  // =====================================================
  // PAGERDUTY NOTIFICATIONS
  // =====================================================

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(alert: Alert, config: PagerDutyNotificationConfig): Promise<void> {
    const eventAction = alert.status === 'resolved' ? 'resolve' : 'trigger';

    const payload = {
      routing_key: config.routingKey,
      event_action: eventAction,
      dedup_key: `voice-agent-${alert.ruleId}`,
      payload: {
        summary: `[${alert.severity.toUpperCase()}] ${alert.name}`,
        severity: this.mapSeverityToPagerDuty(alert.severity),
        source: this.config.serviceName,
        component: 'voice-agent-v2',
        group: 'voice-calls',
        class: alert.ruleId,
        custom_details: {
          description: alert.description,
          value: alert.value,
          threshold: alert.threshold,
          labels: alert.labels,
          environment: this.config.environment,
        },
      },
      links: this.config.dashboardBaseUrl
        ? [{ href: `${this.config.dashboardBaseUrl}/admin/monitoring`, text: 'View Dashboard' }]
        : [],
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`PagerDuty API error: ${response.status} - ${errorBody}`);
    }
  }

  /**
   * Map severity to PagerDuty severity
   */
  private mapSeverityToPagerDuty(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'warning';
    }
  }

  // =====================================================
  // WEBHOOK NOTIFICATIONS
  // =====================================================

  /**
   * Send generic webhook notification
   */
  private async sendWebhookNotification(alert: Alert, config: WebhookNotificationConfig): Promise<void> {
    const payload = {
      alert: {
        id: alert.id,
        name: alert.name,
        description: alert.description,
        severity: alert.severity,
        status: alert.status,
        value: alert.value,
        threshold: alert.threshold,
        firedAt: alert.firedAt,
        resolvedAt: alert.resolvedAt,
        labels: alert.labels,
      },
      metadata: {
        environment: this.config.environment,
        service: this.config.serviceName,
        timestamp: new Date().toISOString(),
      },
    };

    const response = await fetch(config.url, {
      method: config.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Get deduplication key for alert
   */
  private getDedupKey(alert: Alert): string {
    return `${alert.ruleId}:${alert.status}:${JSON.stringify(alert.labels)}`;
  }

  /**
   * Check if notification is duplicate
   */
  private isDuplicate(dedupKey: string): boolean {
    const lastSent = this.recentNotifications.get(dedupKey);
    if (!lastSent) {
      return false;
    }
    return Date.now() - lastSent < this.config.deduplicationWindowMs;
  }

  /**
   * Check if channel is rate limited
   */
  private isRateLimited(channel: NotificationChannel): boolean {
    const timestamps = this.rateLimitCounters.get(channel) ?? [];
    const oneMinuteAgo = Date.now() - 60_000;
    const recentCount = timestamps.filter((t) => t > oneMinuteAgo).length;
    return recentCount >= this.config.rateLimitPerMinute;
  }

  /**
   * Record rate limit event
   */
  private recordRateLimitEvent(channel: NotificationChannel): void {
    const timestamps = this.rateLimitCounters.get(channel) ?? [];
    timestamps.push(Date.now());

    // Clean up old timestamps
    const oneMinuteAgo = Date.now() - 60_000;
    const cleaned = timestamps.filter((t) => t > oneMinuteAgo);
    this.rateLimitCounters.set(channel, cleaned);
  }

  /**
   * Check if alert severity meets threshold
   */
  private meetsSeverityThreshold(alertSeverity: AlertSeverity, minSeverity: AlertSeverity): boolean {
    const severityOrder: AlertSeverity[] = ['info', 'warning', 'critical'];
    return severityOrder.indexOf(alertSeverity) >= severityOrder.indexOf(minSeverity);
  }

  /**
   * Get color for severity
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return '#dc2626'; // red-600
      case 'warning':
        return '#f59e0b'; // amber-500
      case 'info':
        return '#3b82f6'; // blue-500
      default:
        return '#6b7280'; // gray-500
    }
  }

  /**
   * Record notification for history
   */
  private recordNotification(alert: Alert, results: DeliveryStatus[]): void {
    const record: NotificationRecord = {
      id: `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      alertId: alert.id,
      payload: {
        alert,
        channel: results[0]?.channel ?? 'slack',
        message: alert.description,
      },
      deliveryStatus: results,
      createdAt: new Date().toISOString(),
    };

    this.notificationHistory.push(record);

    // Keep only last 1000 records
    if (this.notificationHistory.length > 1000) {
      this.notificationHistory.shift();
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // =====================================================
  // QUERY METHODS
  // =====================================================

  /**
   * Get notification history
   */
  getNotificationHistory(limit: number = 100): NotificationRecord[] {
    return this.notificationHistory.slice(-limit);
  }

  /**
   * Get delivery stats
   */
  getDeliveryStats(): {
    total: number;
    successful: number;
    failed: number;
    byChannel: Record<NotificationChannel, { sent: number; failed: number }>;
  } {
    const stats = {
      total: 0,
      successful: 0,
      failed: 0,
      byChannel: {} as Record<NotificationChannel, { sent: number; failed: number }>,
    };

    for (const record of this.notificationHistory) {
      for (const status of record.deliveryStatus) {
        stats.total++;
        if (status.success) {
          stats.successful++;
        } else {
          stats.failed++;
        }

        if (!stats.byChannel[status.channel]) {
          stats.byChannel[status.channel] = { sent: 0, failed: 0 };
        }
        if (status.success) {
          stats.byChannel[status.channel].sent++;
        } else {
          stats.byChannel[status.channel].failed++;
        }
      }
    }

    return stats;
  }

  /**
   * Clean up old data
   */
  cleanup(): void {
    const now = Date.now();

    // Clean deduplication cache
    for (const [key, timestamp] of this.recentNotifications) {
      if (now - timestamp > this.config.deduplicationWindowMs) {
        this.recentNotifications.delete(key);
      }
    }
  }
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Get notification service instance
 */
export function getNotificationService(): NotificationService {
  return NotificationService.getInstance();
}

/**
 * Send alert notification
 */
export async function sendAlertNotification(alert: Alert, channels?: NotificationChannel[]): Promise<DeliveryStatus[]> {
  return NotificationService.getInstance().sendAlertNotification(alert, channels ?? []);
}

/**
 * Configure notification channel
 */
export function configureNotificationChannel(config: NotificationConfig): void {
  NotificationService.getInstance().setChannelConfig(config);
}

/**
 * Get notification history
 */
export function getNotificationHistory(limit?: number): NotificationRecord[] {
  return NotificationService.getInstance().getNotificationHistory(limit);
}

/**
 * Get delivery stats
 */
export function getNotificationDeliveryStats(): ReturnType<NotificationService['getDeliveryStats']> {
  return NotificationService.getInstance().getDeliveryStats();
}

/**
 * Create notification handler for alert manager
 */
export function createNotificationHandler(): (alert: Alert, channels: NotificationChannel[]) => Promise<void> {
  return async (alert: Alert, channels: NotificationChannel[]) => {
    await NotificationService.getInstance().sendAlertNotification(alert, channels);
  };
}
