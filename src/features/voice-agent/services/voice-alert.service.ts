// =====================================================
// TIS TIS PLATFORM - Voice Alert Service
// Servicio de alertas proactivas para Voice Minute Limits
// Sistema: Voice Minute Limits (FASE 11 - Proactive Alerts)
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

export type AlertThreshold = 70 | 85 | 95 | 100;
export type AlertChannel = 'in_app' | 'email' | 'webhook';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface VoiceUsageAlert {
  id: string;
  tenantId: string;
  threshold: AlertThreshold;
  severity: AlertSeverity;
  usagePercent: number;
  minutesUsed: number;
  includedMinutes: number;
  overageMinutes: number;
  overageChargePesos: number;
  message: string;
  actionUrl?: string;
  createdAt: Date;
  sentVia: AlertChannel[];
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface AlertConfig {
  tenantId: string;
  enabledThresholds: AlertThreshold[];
  enabledChannels: AlertChannel[];
  webhookUrl?: string;
  emailRecipients?: string[];
  cooldownMinutes: number;
}

export interface SendAlertInput {
  tenantId: string;
  threshold: AlertThreshold;
  usagePercent: number;
  minutesUsed: number;
  includedMinutes: number;
  overageMinutes: number;
  overageChargeCentavos: number;
}

export interface SendAlertResult {
  success: boolean;
  alertId?: string;
  sentChannels: AlertChannel[];
  skippedReason?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const THRESHOLD_CONFIG: Record<AlertThreshold, {
  severity: AlertSeverity;
  title: string;
  messageTemplate: string;
}> = {
  70: {
    severity: 'info',
    title: 'Uso moderado de minutos de voz',
    messageTemplate: 'Has utilizado el {{percent}}% de tus minutos de voz incluidos. Te quedan aproximadamente {{remaining}} minutos.',
  },
  85: {
    severity: 'warning',
    title: 'Próximo al límite de minutos',
    messageTemplate: 'Has utilizado el {{percent}}% de tus minutos de voz. Solo te quedan {{remaining}} minutos incluidos.',
  },
  95: {
    severity: 'warning',
    title: 'Minutos casi agotados',
    messageTemplate: 'Has utilizado el {{percent}}% de tus minutos de voz. Después de agotar los {{remaining}} minutos restantes, se aplicarán cargos adicionales.',
  },
  100: {
    severity: 'critical',
    title: 'Límite de minutos alcanzado',
    messageTemplate: 'Has alcanzado el límite de minutos incluidos. {{overage}} minutos adicionales generarán un cargo de ${{charge}} MXN.',
  },
};

const DEFAULT_COOLDOWN_MINUTES = 60; // Don't re-alert for same threshold within 1 hour

// =====================================================
// SUPABASE CLIENT
// =====================================================

function createServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================================================
// VOICE ALERT SERVICE CLASS
// =====================================================

export class VoiceAlertService {
  private static instance: VoiceAlertService;

  private constructor() {}

  static getInstance(): VoiceAlertService {
    if (!VoiceAlertService.instance) {
      VoiceAlertService.instance = new VoiceAlertService();
    }
    return VoiceAlertService.instance;
  }

  /**
   * Send an alert when usage threshold is reached
   */
  async sendAlert(input: SendAlertInput): Promise<SendAlertResult> {
    const {
      tenantId,
      threshold,
      usagePercent,
      minutesUsed,
      includedMinutes,
      overageMinutes,
      overageChargeCentavos,
    } = input;

    const supabase = createServerClient();

    console.log(`[VoiceAlertService] Processing alert for tenant ${tenantId}, threshold ${threshold}%`);

    // 1. Check if alert should be sent (cooldown, config, etc.)
    const shouldSend = await this.shouldSendAlert(tenantId, threshold);
    if (!shouldSend.send) {
      return {
        success: true,
        sentChannels: [],
        skippedReason: shouldSend.reason,
      };
    }

    // 2. Get alert configuration
    const config = await this.getAlertConfig(tenantId);

    // 3. Generate alert message
    const thresholdConfig = THRESHOLD_CONFIG[threshold];
    const remaining = Math.max(0, includedMinutes - minutesUsed);
    const message = this.formatMessage(thresholdConfig.messageTemplate, {
      percent: usagePercent.toFixed(0),
      remaining: remaining.toFixed(0),
      overage: overageMinutes.toFixed(1),
      charge: (overageChargeCentavos / 100).toFixed(2),
    });

    // 4. Create alert record
    const alert: Omit<VoiceUsageAlert, 'id' | 'createdAt'> = {
      tenantId,
      threshold,
      severity: thresholdConfig.severity,
      usagePercent,
      minutesUsed,
      includedMinutes,
      overageMinutes,
      overageChargePesos: overageChargeCentavos / 100,
      message,
      actionUrl: '/dashboard/settings?tab=voice-agent',
      sentVia: [],
      acknowledged: false,
    };

    // 5. Store alert in database
    const { data: createdAlert, error: insertError } = await supabase
      .from('voice_usage_alerts')
      .insert({
        tenant_id: tenantId,
        threshold,
        severity: thresholdConfig.severity,
        usage_percent: usagePercent,
        minutes_used: minutesUsed,
        included_minutes: includedMinutes,
        overage_minutes: overageMinutes,
        overage_charge_centavos: overageChargeCentavos,
        message,
        title: thresholdConfig.title,
        action_url: alert.actionUrl,
        sent_via: [],
        acknowledged: false,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[VoiceAlertService] Error creating alert:', insertError);
      return {
        success: false,
        skippedReason: insertError.message,
        sentChannels: [],
      };
    }

    const alertId = createdAlert?.id;
    const sentChannels: AlertChannel[] = [];

    // 6. Send to enabled channels
    if (config.enabledChannels.includes('in_app')) {
      await this.sendInAppNotification(tenantId, alertId, thresholdConfig.title, message, thresholdConfig.severity);
      sentChannels.push('in_app');
    }

    if (config.enabledChannels.includes('email') && config.emailRecipients?.length) {
      const emailSent = await this.sendEmailAlert(
        config.emailRecipients,
        thresholdConfig.title,
        message,
        thresholdConfig.severity,
        alert.actionUrl
      );
      if (emailSent) {
        sentChannels.push('email');
      }
    }

    if (config.enabledChannels.includes('webhook') && config.webhookUrl) {
      const webhookSent = await this.sendWebhookAlert(config.webhookUrl, {
        alertId,
        tenantId,
        threshold,
        severity: thresholdConfig.severity,
        title: thresholdConfig.title,
        message,
        usagePercent,
        minutesUsed,
        includedMinutes,
        overageMinutes,
        overageChargePesos: overageChargeCentavos / 100,
      });
      if (webhookSent) {
        sentChannels.push('webhook');
      }
    }

    // 7. Update alert with sent channels
    if (sentChannels.length > 0) {
      await supabase
        .from('voice_usage_alerts')
        .update({ sent_via: sentChannels })
        .eq('id', alertId);
    }

    console.log(`[VoiceAlertService] Alert sent via: ${sentChannels.join(', ') || 'none'}`);

    return {
      success: true,
      alertId,
      sentChannels,
    };
  }

  /**
   * Check usage and send alert if threshold is crossed
   */
  async checkAndAlert(tenantId: string, currentUsage: {
    minutesUsed: number;
    includedMinutes: number;
    overageMinutes: number;
    overageChargeCentavos: number;
  }): Promise<SendAlertResult | null> {
    const { minutesUsed, includedMinutes, overageMinutes, overageChargeCentavos } = currentUsage;
    const usagePercent = includedMinutes > 0 ? (minutesUsed / includedMinutes) * 100 : 0;

    // Get last alerted threshold
    const lastThreshold = await this.getLastAlertedThreshold(tenantId);

    // Find the highest threshold that has been crossed but not yet alerted
    const thresholds: AlertThreshold[] = [100, 95, 85, 70];
    const crossedThreshold = thresholds.find(
      (t) => usagePercent >= t && (!lastThreshold || t > lastThreshold)
    );

    if (!crossedThreshold) {
      return null;
    }

    return this.sendAlert({
      tenantId,
      threshold: crossedThreshold,
      usagePercent,
      minutesUsed,
      includedMinutes,
      overageMinutes,
      overageChargeCentavos,
    });
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('voice_usage_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: acknowledgedBy,
      })
      .eq('id', alertId);

    if (error) {
      console.error('[VoiceAlertService] Error acknowledging alert:', error);
      return false;
    }

    return true;
  }

  /**
   * Get unacknowledged alerts for a tenant
   */
  async getUnacknowledgedAlerts(tenantId: string): Promise<VoiceUsageAlert[]> {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('voice_usage_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[VoiceAlertService] Error fetching alerts:', error);
      return [];
    }

    return (data || []).map(this.mapAlertFromDB);
  }

  /**
   * Get recent alerts for a tenant
   */
  async getRecentAlerts(tenantId: string, limit: number = 20): Promise<VoiceUsageAlert[]> {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('voice_usage_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[VoiceAlertService] Error fetching recent alerts:', error);
      return [];
    }

    return (data || []).map(this.mapAlertFromDB);
  }

  // =====================================================
  // PRIVATE METHODS
  // =====================================================

  private async shouldSendAlert(
    tenantId: string,
    threshold: AlertThreshold
  ): Promise<{ send: boolean; reason?: string }> {
    const supabase = createServerClient();

    // Check if there's a recent alert for this threshold (cooldown)
    const cooldownTime = new Date();
    cooldownTime.setMinutes(cooldownTime.getMinutes() - DEFAULT_COOLDOWN_MINUTES);

    const { data: recentAlert } = await supabase
      .from('voice_usage_alerts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('threshold', threshold)
      .gte('created_at', cooldownTime.toISOString())
      .limit(1);

    if (recentAlert && recentAlert.length > 0) {
      return {
        send: false,
        reason: `Alert for ${threshold}% threshold already sent within cooldown period`,
      };
    }

    // Check tenant alert config
    const config = await this.getAlertConfig(tenantId);
    if (!config.enabledThresholds.includes(threshold)) {
      return {
        send: false,
        reason: `Threshold ${threshold}% is not enabled for this tenant`,
      };
    }

    return { send: true };
  }

  private async getAlertConfig(tenantId: string): Promise<AlertConfig> {
    const supabase = createServerClient();

    const { data } = await supabase
      .from('voice_minute_limits')
      .select('alert_thresholds, alert_channels, webhook_url, email_recipients, alert_cooldown_minutes')
      .eq('tenant_id', tenantId)
      .single();

    return {
      tenantId,
      enabledThresholds: (data?.alert_thresholds as AlertThreshold[]) || [70, 85, 95, 100],
      enabledChannels: (data?.alert_channels as AlertChannel[]) || ['in_app'],
      webhookUrl: data?.webhook_url,
      emailRecipients: data?.email_recipients,
      cooldownMinutes: data?.alert_cooldown_minutes || DEFAULT_COOLDOWN_MINUTES,
    };
  }

  private async getLastAlertedThreshold(tenantId: string): Promise<AlertThreshold | null> {
    const supabase = createServerClient();

    // Get the current billing period
    const { data: period } = await supabase
      .from('voice_minute_usage_periods')
      .select('period_start')
      .eq('tenant_id', tenantId)
      .eq('is_current', true)
      .single();

    if (!period) return null;

    // Get the highest threshold alerted in current period
    const { data: lastAlert } = await supabase
      .from('voice_usage_alerts')
      .select('threshold')
      .eq('tenant_id', tenantId)
      .gte('created_at', period.period_start)
      .order('threshold', { ascending: false })
      .limit(1);

    return lastAlert?.[0]?.threshold || null;
  }

  private formatMessage(template: string, values: Record<string, string>): string {
    let message = template;
    for (const [key, value] of Object.entries(values)) {
      message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return message;
  }

  private async sendInAppNotification(
    tenantId: string,
    alertId: string,
    title: string,
    message: string,
    severity: AlertSeverity
  ): Promise<boolean> {
    const supabase = createServerClient();

    try {
      // Create in-app notification
      const { error } = await supabase.from('notifications').insert({
        tenant_id: tenantId,
        type: 'voice_usage_alert',
        title,
        message,
        severity,
        action_url: '/dashboard/settings?tab=voice-agent',
        metadata: { alertId },
        read: false,
      });

      if (error) {
        console.error('[VoiceAlertService] Error creating in-app notification:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[VoiceAlertService] Error sending in-app notification:', err);
      return false;
    }
  }

  private async sendEmailAlert(
    recipients: string[],
    title: string,
    message: string,
    severity: AlertSeverity,
    actionUrl?: string
  ): Promise<boolean> {
    // Email sending would be implemented here using Resend or similar
    // For now, just log it
    console.log('[VoiceAlertService] Would send email to:', recipients, { title, message, severity, actionUrl });

    // TODO: Implement actual email sending
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'TIS TIS <noreply@tistis.com>',
    //   to: recipients,
    //   subject: title,
    //   html: `<p>${message}</p><a href="${actionUrl}">Ver detalles</a>`,
    // });

    return true; // Placeholder
  }

  private async sendWebhookAlert(
    webhookUrl: string,
    payload: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TIS-Event': 'voice_usage_alert',
        },
        body: JSON.stringify({
          event: 'voice_usage_alert',
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      });

      if (!response.ok) {
        console.error('[VoiceAlertService] Webhook failed:', response.status);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[VoiceAlertService] Error sending webhook:', err);
      return false;
    }
  }

  private mapAlertFromDB(row: Record<string, unknown>): VoiceUsageAlert {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      threshold: row.threshold as AlertThreshold,
      severity: row.severity as AlertSeverity,
      usagePercent: row.usage_percent as number,
      minutesUsed: row.minutes_used as number,
      includedMinutes: row.included_minutes as number,
      overageMinutes: row.overage_minutes as number,
      overageChargePesos: (row.overage_charge_centavos as number) / 100,
      message: row.message as string,
      actionUrl: row.action_url as string | undefined,
      createdAt: new Date(row.created_at as string),
      sentVia: row.sent_via as AlertChannel[],
      acknowledged: row.acknowledged as boolean,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : undefined,
      acknowledgedBy: row.acknowledged_by as string | undefined,
    };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const voiceAlertService = VoiceAlertService.getInstance();
