/**
 * TIS TIS PLATFORM - Admin Channel Notification Sender Service
 *
 * Servicio de envío de notificaciones a WhatsApp y Telegram.
 * Maneja la entrega, horarios, timezone y recurrencia.
 *
 * @module admin-channel/services/notification-sender
 */

import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AdminChannelNotification, AdminChannelType } from '../types';
import { getAnalyticsService } from './analytics.service';
import { formatReportForChannel } from '../utils/report-formatter';
import { validateUUID, withTimeout } from '../utils/helpers';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Sender]';

// Timeout for operations
const DB_TIMEOUT_MS = 10000;
const API_TIMEOUT_MS = 15000;

// WhatsApp API version
const WHATSAPP_API_VERSION = 'v18.0';

// =====================================================
// TYPES
// =====================================================

export interface SendResult {
  success: boolean;
  error?: string;
  rescheduled?: boolean;
}

interface UserNotificationPrefs {
  id: string;
  tenant_id: string;
  phone_normalized: string | null;
  telegram_user_id: string | null;
  notification_hours_start: number;
  notification_hours_end: number;
  timezone: string;
  can_receive_notifications: boolean;
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class NotificationSenderService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // =====================================================
  // SEND NOTIFICATION
  // =====================================================

  async sendNotification(notification: AdminChannelNotification): Promise<SendResult> {
    const startTime = Date.now();

    try {
      // P0 Security: Validate IDs
      validateUUID(notification.id, 'notificationId');
      if (notification.userId) {
        validateUUID(notification.userId, 'userId');
      }

      // 1. Get user and their channel preferences
      const user = await this.getUserPrefs(notification.userId);

      if (!user) {
        await this.updateNotificationStatus(notification.id, false, 'Usuario no encontrado');
        return { success: false, error: 'Usuario no encontrado' };
      }

      // 2. Check if within notification hours
      if (!this.isWithinNotificationHours(user)) {
        await this.rescheduleForTomorrow(notification.id, user.notification_hours_start);
        console.log(`${LOG_PREFIX} Notification ${notification.id} rescheduled - outside hours`);
        return { success: true, rescheduled: true };
      }

      // 3. Generate dynamic content if needed
      let content = notification.content;
      if (notification.notificationType === 'daily_summary' && !content) {
        content = await this.generateDailySummaryContent(
          user.tenant_id,
          user.phone_normalized ? 'whatsapp' : 'telegram'
        );
      }

      // 4. Send to configured channels
      const results: boolean[] = [];

      const targetChannel = notification.channel || 'both';

      if (targetChannel === 'whatsapp' || targetChannel === 'both') {
        if (user.phone_normalized) {
          const sent = await this.sendWhatsApp(user.phone_normalized, content);
          results.push(sent);
        }
      }

      if (targetChannel === 'telegram' || targetChannel === 'both') {
        if (user.telegram_user_id) {
          // Convert markdown to HTML for Telegram
          const telegramContent = this.convertToTelegramFormat(content);
          const sent = await this.sendTelegram(user.telegram_user_id, telegramContent);
          results.push(sent);
        }
      }

      // 5. Update status
      const success = results.length > 0 && results.some((r) => r);

      await this.updateNotificationStatus(
        notification.id,
        success,
        success ? undefined : 'Error sending to all channels'
      );

      // 6. Schedule next recurrence if applicable
      if (success && notification.isRecurring) {
        await this.scheduleNextRecurrence(notification);
      }

      console.log(
        `${LOG_PREFIX} Notification ${notification.id} sent: ${success} in ${Date.now() - startTime}ms`
      );

      return { success };
    } catch (error) {
      console.error(`${LOG_PREFIX} sendNotification error:`, error);

      await this.updateNotificationStatus(
        notification.id,
        false,
        error instanceof Error ? error.message : 'Error desconocido'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  // =====================================================
  // SEND TO WHATSAPP
  // =====================================================

  private async sendWhatsApp(phone: string, content: string): Promise<boolean> {
    const accessToken = process.env.ADMIN_CHANNEL_WA_ACCESS_TOKEN;
    const phoneNumberId = process.env.ADMIN_CHANNEL_WA_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.warn(`${LOG_PREFIX} WhatsApp not configured`);
      return false;
    }

    try {
      // Sanitize phone number
      const sanitizedPhone = phone.replace(/[^0-9]/g, '');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(
        `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: sanitizedPhone,
            type: 'text',
            text: { body: content },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`${LOG_PREFIX} WhatsApp API error:`, errorData);
        return false;
      }

      console.log(`${LOG_PREFIX} WhatsApp sent to ${sanitizedPhone.substring(0, 6)}***`);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`${LOG_PREFIX} WhatsApp timeout`);
      } else {
        console.error(`${LOG_PREFIX} WhatsApp error:`, error);
      }
      return false;
    }
  }

  // =====================================================
  // SEND TO TELEGRAM
  // =====================================================

  private async sendTelegram(chatId: string, content: string): Promise<boolean> {
    const botToken = process.env.ADMIN_CHANNEL_TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.warn(`${LOG_PREFIX} Telegram not configured`);
      return false;
    }

    // P0 Security: Validate chatId is numeric (Telegram requires numeric chat IDs)
    if (!/^-?\d+$/.test(chatId)) {
      console.error(`${LOG_PREFIX} Invalid Telegram chatId format`);
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: content,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!data.ok) {
        console.error(`${LOG_PREFIX} Telegram API error:`, data);
        return false;
      }

      console.log(`${LOG_PREFIX} Telegram sent to chat ${chatId}`);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`${LOG_PREFIX} Telegram timeout`);
      } else {
        console.error(`${LOG_PREFIX} Telegram error:`, error);
      }
      return false;
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private async getUserPrefs(userId: string | null): Promise<UserNotificationPrefs | null> {
    if (!userId) return null;

    // P0 Security: Validate UUID before query
    validateUUID(userId, 'userId');

    try {
      const { data, error } = await withTimeout(
        this.supabase
          .from('admin_channel_users')
          .select(
            'id, tenant_id, phone_normalized, telegram_user_id, ' +
            'notification_hours_start, notification_hours_end, timezone, can_receive_notifications'
          )
          .eq('id', userId)
          .single()
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get user prefs'
      );

      if (error || !data) {
        return null;
      }

      // Type guard for the returned data
      const result = data as unknown as UserNotificationPrefs;
      if (!result.id || !result.tenant_id) {
        return null;
      }

      return result;
    } catch (error) {
      console.error(`${LOG_PREFIX} getUserPrefs error:`, error);
      return null;
    }
  }

  private isWithinNotificationHours(user: UserNotificationPrefs): boolean {
    const startHour = user.notification_hours_start ?? 8;
    const endHour = user.notification_hours_end ?? 20;

    try {
      // Get current hour in user's timezone
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: user.timezone || 'America/Mexico_City',
        hour: 'numeric',
        hour12: false,
      });

      const currentHour = parseInt(formatter.format(now), 10);
      return currentHour >= startHour && currentHour < endHour;
    } catch {
      // If timezone is invalid, default to allowing notifications
      // Log for debugging but don't block notifications
      console.warn(`${LOG_PREFIX} Invalid timezone: ${user.timezone}, defaulting to allowed`);
      return true;
    }
  }

  private async rescheduleForTomorrow(
    notificationId: string,
    hour: number
  ): Promise<void> {
    // P0 Security: Validate UUID
    validateUUID(notificationId, 'notificationId');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hour, 0, 0, 0);

    try {
      await withTimeout(
        this.supabase
          .from('admin_channel_notifications')
          .update({
            scheduled_for: tomorrow.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', notificationId)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Reschedule notification'
      );
    } catch (error) {
      console.error(`${LOG_PREFIX} rescheduleForTomorrow error:`, error);
    }
  }

  private async updateNotificationStatus(
    notificationId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    // P0 Security: Validate UUID
    validateUUID(notificationId, 'notificationId');

    try {
      await withTimeout(
        this.supabase
          .from('admin_channel_notifications')
          .update({
            status: success ? 'sent' : 'failed',
            sent_at: success ? new Date().toISOString() : null,
            error_message: errorMessage || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notificationId)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Update notification status'
      );
    } catch (error) {
      console.error(`${LOG_PREFIX} updateNotificationStatus error:`, error);
    }
  }

  private async scheduleNextRecurrence(
    notification: AdminChannelNotification
  ): Promise<void> {
    const rule = notification.recurrenceRule || '';

    let nextDate = new Date();

    if (rule.includes('FREQ=DAILY')) {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (rule.includes('FREQ=WEEKLY')) {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (rule.includes('FREQ=MONTHLY')) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
      return; // Unknown frequency
    }

    // Preserve original time
    if (notification.scheduledFor) {
      const original = new Date(notification.scheduledFor);
      nextDate.setHours(original.getHours(), original.getMinutes(), 0, 0);
    }

    try {
      await withTimeout(
        this.supabase
          .from('admin_channel_notifications')
          .insert({
            tenant_id: notification.tenantId,
            user_id: notification.userId,
            notification_type: notification.notificationType,
            title: notification.title,
            content: '', // Will be regenerated
            template_data: notification.templateData,
            scheduled_for: nextDate.toISOString(),
            is_recurring: true,
            recurrence_rule: notification.recurrenceRule,
            channel: notification.channel,
            priority: notification.priority,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Schedule next recurrence'
      );

      console.log(`${LOG_PREFIX} Next recurrence scheduled for ${nextDate.toISOString()}`);
    } catch (error) {
      console.error(`${LOG_PREFIX} scheduleNextRecurrence error:`, error);
    }
  }

  private async generateDailySummaryContent(
    tenantId: string,
    channel: AdminChannelType
  ): Promise<string> {
    // P0 Security: Validate tenantId
    validateUUID(tenantId, 'tenantId');

    try {
      const analyticsService = getAnalyticsService();

      // Get tenant vertical
      const { data: tenant } = await withTimeout(
        this.supabase
          .from('tenants')
          .select('vertical')
          .eq('id', tenantId)
          .single()
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get tenant'
      );

      const vertical = tenant?.vertical || 'general';

      const report = await analyticsService.getFullReport(
        tenantId,
        'daily',
        vertical
      );

      const formatted = formatReportForChannel(
        report,
        channel,
        vertical,
        'analytics_daily_summary'
      );

      return formatted.text;
    } catch (error) {
      console.error(`${LOG_PREFIX} generateDailySummaryContent error:`, error);
      return '📊 Error generando resumen diario. Intenta más tarde.';
    }
  }

  private convertToTelegramFormat(content: string): string {
    // P0 Security: Escape HTML entities first to prevent injection
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Convert WhatsApp markdown to Telegram HTML
    return escaped
      .replace(/\*([^*]+)\*/g, '<b>$1</b>') // *bold* -> <b>bold</b>
      .replace(/_([^_]+)_/g, '<i>$1</i>'); // _italic_ -> <i>italic</i>
  }
}

// =====================================================
// SINGLETON
// =====================================================

let _sender: NotificationSenderService | null = null;

export function getNotificationSenderService(): NotificationSenderService {
  if (!_sender) {
    _sender = new NotificationSenderService();
  }
  return _sender;
}

/**
 * Reset the singleton instance.
 * Useful for testing and hot reload scenarios.
 */
export function resetNotificationSenderService(): void {
  _sender = null;
}
