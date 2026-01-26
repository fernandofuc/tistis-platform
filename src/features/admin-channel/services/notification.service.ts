/**
 * TIS TIS PLATFORM - Admin Channel Notification Service
 *
 * CRUD de notificaciones proactivas para clientes B2B.
 * Maneja creación, scheduling, recurrencia y consultas de notificaciones.
 *
 * @module admin-channel/services/notification
 */

import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminChannelNotification,
  AdminNotificationType,
  AdminNotificationPriority,
  AdminChannelType,
} from '../types';
import { validateUUID, withTimeout, sanitizeUserContent } from '../utils/helpers';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Notification]';

// Timeout for database operations (10 seconds)
const DB_TIMEOUT_MS = 10000;

// Maximum notifications per batch
const MAX_BATCH_SIZE = 50;

// =====================================================
// TYPES
// =====================================================

export interface CreateNotificationParams {
  tenantId: string;
  userId?: string;
  type: AdminNotificationType;
  title?: string;
  content: string;
  templateData?: Record<string, unknown>;
  scheduledFor?: Date;
  isRecurring?: boolean;
  recurrenceRule?: string;
  channel?: AdminChannelType | 'both';
  priority?: AdminNotificationPriority;
  triggerData?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  notification?: AdminChannelNotification;
  error?: string;
}

export interface LowInventoryItem {
  name: string;
  current: number;
  min: number;
}

export interface HotLeadData {
  name: string;
  phone: string;
  source: string;
  score: number;
}

export interface EscalationData {
  id: string;
  customerName: string;
  reason: string;
  channel: string;
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class NotificationService {
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
  // CREATE NOTIFICATION
  // =====================================================

  async createNotification(params: CreateNotificationParams): Promise<NotificationResult> {
    // P0 Security: Validate UUIDs
    validateUUID(params.tenantId, 'tenantId');
    if (params.userId) {
      validateUUID(params.userId, 'userId');
    }

    try {
      const { data, error } = await withTimeout(
        this.supabase
          .from('admin_channel_notifications')
          .insert({
            tenant_id: params.tenantId,
            user_id: params.userId || null,
            notification_type: params.type,
            title: params.title || null,
            content: params.content,
            template_data: params.templateData || {},
            scheduled_for: params.scheduledFor?.toISOString() || null,
            is_recurring: params.isRecurring || false,
            recurrence_rule: params.recurrenceRule || null,
            channel: params.channel || 'both',
            priority: params.priority || 'normal',
            trigger_data: params.triggerData || null,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Create notification'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Create error:`, error);
        return { success: false, error: error.message };
      }

      console.log(`${LOG_PREFIX} Notification created: ${data?.id}`);
      return {
        success: true,
        notification: this.mapToNotification(data),
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} createNotification error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error creando notificación',
      };
    }
  }

  // =====================================================
  // GET PENDING NOTIFICATIONS
  // =====================================================

  async getPendingNotifications(limit: number = MAX_BATCH_SIZE): Promise<AdminChannelNotification[]> {
    try {
      const safeLimit = Math.min(limit, MAX_BATCH_SIZE);
      const now = new Date().toISOString();

      const { data, error } = await withTimeout(
        this.supabase
          .from('admin_channel_notifications')
          .select('*')
          .eq('status', 'pending')
          .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
          .order('priority', { ascending: false }) // urgent first
          .order('created_at', { ascending: true }) // oldest first
          .limit(safeLimit)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get pending notifications'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Get pending error:`, error);
        return [];
      }

      return (data || []).map(this.mapToNotification);
    } catch (error) {
      console.error(`${LOG_PREFIX} getPendingNotifications error:`, error);
      return [];
    }
  }

  // =====================================================
  // GET USER NOTIFICATIONS
  // =====================================================

  async getUserNotifications(
    userId: string,
    limit: number = 20
  ): Promise<AdminChannelNotification[]> {
    validateUUID(userId, 'userId');

    try {
      const safeLimit = Math.min(limit, MAX_BATCH_SIZE);

      const { data, error } = await withTimeout(
        this.supabase
          .from('admin_channel_notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(safeLimit)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get user notifications'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Get user notifications error:`, error);
        return [];
      }

      return (data || []).map(this.mapToNotification);
    } catch (error) {
      console.error(`${LOG_PREFIX} getUserNotifications error:`, error);
      return [];
    }
  }

  // =====================================================
  // MARK AS SENT
  // =====================================================

  async markAsSent(
    notificationId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
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
        'Mark as sent'
      );

      console.log(`${LOG_PREFIX} Notification ${notificationId} marked as ${success ? 'sent' : 'failed'}`);
    } catch (error) {
      console.error(`${LOG_PREFIX} markAsSent error:`, error);
    }
  }

  // =====================================================
  // CANCEL NOTIFICATION
  // =====================================================

  async cancelNotification(notificationId: string): Promise<NotificationResult> {
    validateUUID(notificationId, 'notificationId');

    try {
      const { error } = await withTimeout(
        this.supabase
          .from('admin_channel_notifications')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', notificationId)
          .eq('status', 'pending') // Only cancel pending
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Cancel notification'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Cancel error:`, error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error(`${LOG_PREFIX} cancelNotification error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error cancelando notificación',
      };
    }
  }

  // =====================================================
  // SCHEDULE DAILY SUMMARY
  // =====================================================

  async scheduleDailySummary(
    tenantId: string,
    userId: string,
    scheduledHour: number = 9
  ): Promise<NotificationResult> {
    validateUUID(tenantId, 'tenantId');
    validateUUID(userId, 'userId');

    // Validate hour
    if (scheduledHour < 0 || scheduledHour > 23) {
      return { success: false, error: 'Hora debe estar entre 0 y 23' };
    }

    // Calculate next execution
    const now = new Date();
    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledHour, 0, 0, 0);

    if (scheduledFor <= now) {
      scheduledFor.setDate(scheduledFor.getDate() + 1);
    }

    return this.createNotification({
      tenantId,
      userId,
      type: 'daily_summary',
      title: 'Resumen del día',
      content: '', // Will be generated dynamically
      scheduledFor,
      isRecurring: true,
      recurrenceRule: 'RRULE:FREQ=DAILY',
      priority: 'normal',
    });
  }

  // =====================================================
  // CREATE ALERT NOTIFICATIONS
  // =====================================================

  async createLowInventoryAlert(
    tenantId: string,
    items: LowInventoryItem[]
  ): Promise<void> {
    validateUUID(tenantId, 'tenantId');

    if (!items || items.length === 0) {
      return;
    }

    try {
      // Get users who receive notifications
      const { data: users, error: usersError } = await withTimeout(
        this.supabase
          .from('admin_channel_users')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .eq('can_receive_notifications', true)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get notification users'
      );

      if (usersError || !users || users.length === 0) {
        console.log(`${LOG_PREFIX} No users to notify for tenant ${tenantId}`);
        return;
      }

      const itemsList = items
        .slice(0, 10) // Limit items in message
        .map((i) => `• ${sanitizeUserContent(i.name, 50)}: ${i.current}/${i.min}`)
        .join('\n');

      const content =
        `⚠️ *Alerta de Inventario Bajo*\n\n${itemsList}\n\n` +
        `Revisa tu inventario para reabastecer.`;

      // Create notifications in parallel for better performance
      const results = await Promise.allSettled(
        users.map((user) =>
          this.createNotification({
            tenantId,
            userId: user.id,
            type: 'low_inventory',
            title: 'Inventario Bajo',
            content,
            priority: 'high',
            triggerData: { items },
          })
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      console.log(`${LOG_PREFIX} Low inventory alerts created: ${succeeded}/${users.length}`);
    } catch (error) {
      console.error(`${LOG_PREFIX} createLowInventoryAlert error:`, error);
    }
  }

  async createHotLeadAlert(
    tenantId: string,
    lead: HotLeadData
  ): Promise<void> {
    validateUUID(tenantId, 'tenantId');

    try {
      const { data: users, error: usersError } = await withTimeout(
        this.supabase
          .from('admin_channel_users')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .eq('can_receive_notifications', true)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get notification users'
      );

      if (usersError || !users || users.length === 0) {
        return;
      }

      const content =
        `🔥 *Nuevo Lead Caliente*\n\n` +
        `Nombre: ${sanitizeUserContent(lead.name, 100)}\n` +
        `Teléfono: ${sanitizeUserContent(lead.phone, 20)}\n` +
        `Fuente: ${sanitizeUserContent(lead.source, 50)}\n` +
        `Score: ${lead.score}%\n\n` +
        `¡Contacta pronto!`;

      // Create notifications in parallel for better performance
      const results = await Promise.allSettled(
        users.map((user) =>
          this.createNotification({
            tenantId,
            userId: user.id,
            type: 'hot_lead',
            title: 'Lead Caliente',
            content,
            priority: 'urgent',
            triggerData: { ...lead }, // Convert to Record<string, unknown>
          })
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      console.log(`${LOG_PREFIX} Hot lead alerts created: ${succeeded}/${users.length}`);
    } catch (error) {
      console.error(`${LOG_PREFIX} createHotLeadAlert error:`, error);
    }
  }

  async createEscalationAlert(
    tenantId: string,
    conversation: EscalationData
  ): Promise<void> {
    validateUUID(tenantId, 'tenantId');

    try {
      const { data: users, error: usersError } = await withTimeout(
        this.supabase
          .from('admin_channel_users')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .eq('can_receive_notifications', true)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get notification users'
      );

      if (usersError || !users || users.length === 0) {
        return;
      }

      const content =
        `🙋 *Conversación Escalada*\n\n` +
        `Cliente: ${sanitizeUserContent(conversation.customerName, 100)}\n` +
        `Canal: ${sanitizeUserContent(conversation.channel, 20)}\n` +
        `Razón: ${sanitizeUserContent(conversation.reason, 150)}\n\n` +
        `Revisa el inbox para atender.`;

      // Create notifications in parallel for better performance
      const results = await Promise.allSettled(
        users.map((user) =>
          this.createNotification({
            tenantId,
            userId: user.id,
            type: 'escalation',
            title: 'Escalación',
            content,
            priority: 'urgent',
            triggerData: { ...conversation }, // Convert to Record<string, unknown>
          })
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      console.log(`${LOG_PREFIX} Escalation alerts created: ${succeeded}/${users.length}`);
    } catch (error) {
      console.error(`${LOG_PREFIX} createEscalationAlert error:`, error);
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private mapToNotification(row: Record<string, unknown>): AdminChannelNotification {
    // Type guards for required fields
    const id = row.id;
    const tenantId = row.tenant_id;
    const notificationType = row.notification_type;
    const content = row.content;
    const status = row.status;
    const priority = row.priority;
    const createdAt = row.created_at;
    const updatedAt = row.updated_at;

    // Defensive: validate required fields exist
    if (
      typeof id !== 'string' ||
      typeof tenantId !== 'string' ||
      typeof notificationType !== 'string' ||
      typeof content !== 'string' ||
      typeof status !== 'string' ||
      typeof priority !== 'string'
    ) {
      console.error(`${LOG_PREFIX} Invalid notification row:`, { id, tenantId });
      // Return a minimal valid object to prevent crashes
      return {
        id: String(id || 'invalid'),
        tenantId: String(tenantId || 'invalid'),
        userId: null,
        notificationType: 'custom' as AdminNotificationType,
        title: null,
        content: '',
        templateData: {},
        scheduledFor: null,
        isRecurring: false,
        recurrenceRule: null,
        status: 'failed',
        channel: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        errorMessage: 'Invalid notification data',
        priority: 'normal' as AdminNotificationPriority,
        triggerData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return {
      id,
      tenantId,
      userId: (row.user_id as string | null) || null,
      notificationType: notificationType as AdminNotificationType,
      title: (row.title as string | null) || null,
      content,
      templateData: (row.template_data || {}) as Record<string, unknown>,
      scheduledFor: row.scheduled_for ? new Date(row.scheduled_for as string) : null,
      isRecurring: Boolean(row.is_recurring),
      recurrenceRule: (row.recurrence_rule as string | null) || null,
      status: status as 'pending' | 'sent' | 'failed' | 'cancelled',
      channel: (row.channel as AdminChannelType | 'both' | null) || null,
      sentAt: row.sent_at ? new Date(row.sent_at as string) : null,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at as string) : null,
      readAt: row.read_at ? new Date(row.read_at as string) : null,
      errorMessage: (row.error_message as string | null) || null,
      priority: priority as AdminNotificationPriority,
      triggerData: (row.trigger_data || null) as Record<string, unknown> | null,
      createdAt: createdAt ? new Date(createdAt as string) : new Date(),
      updatedAt: updatedAt ? new Date(updatedAt as string) : new Date(),
    };
  }
}

// =====================================================
// SINGLETON
// =====================================================

let _service: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!_service) {
    _service = new NotificationService();
  }
  return _service;
}

/**
 * Reset the singleton instance.
 * Useful for testing and hot reload scenarios.
 */
export function resetNotificationService(): void {
  _service = null;
}
