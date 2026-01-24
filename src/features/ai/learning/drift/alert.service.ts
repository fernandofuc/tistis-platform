// =====================================================
// TIS TIS PLATFORM - DRIFT ALERT SERVICE
// Manages drift alerts and notifications
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { DriftAlert, DriftBaseline } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type MetricType = DriftBaseline['metricType'];
type Severity = DriftAlert['severity'];
type AlertType = DriftAlert['alertType'];

interface CreateAlertParams {
  tenantId: string;
  alertType: AlertType;
  severity: Severity;
  metricName: string;
  metricType: MetricType;
  currentValue: number;
  baselineValue: number;
  threshold: number;
  driftScore?: number;
  message: string;
  metadata?: Record<string, unknown>;
}

interface AlertQuery {
  tenantId: string;
  status?: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  severity?: Severity;
  alertType?: AlertType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

interface AlertStats {
  total: number;
  active: number;
  bySeverity: Record<Severity, number>;
  byType: Record<string, number>;
  avgResolutionTimeMs?: number;
}

type AlertHandler = (alert: DriftAlert) => Promise<void>;

export class AlertService {
  private supabase;
  private handlers: Map<string, AlertHandler[]> = new Map();

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Create a new alert
   */
  async createAlert(params: CreateAlertParams): Promise<string> {
    // Check for duplicate active alerts
    const { data: existing } = await this.supabase
      .from('ai_drift_alerts')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('metric_name', params.metricName)
      .eq('metric_type', params.metricType)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (existing) {
      // Update existing alert instead of creating duplicate
      await this.updateAlert(existing.id, {
        currentValue: params.currentValue,
        driftScore: params.driftScore,
        severity: params.severity,
      });
      return existing.id;
    }

    const { data, error } = await this.supabase
      .from('ai_drift_alerts')
      .insert({
        tenant_id: params.tenantId,
        alert_type: params.alertType,
        severity: params.severity,
        metric_name: params.metricName,
        metric_type: params.metricType,
        current_value: params.currentValue,
        baseline_value: params.baselineValue,
        threshold: params.threshold,
        drift_score: params.driftScore,
        message: params.message,
        status: 'active',
        metadata: params.metadata || {},
      })
      .select('*')
      .single();

    if (error) {
      console.error('[AlertService] Error creating alert:', error);
      throw new Error(`Failed to create alert: ${error.message}`);
    }

    // Trigger handlers
    const alert = this.mapAlert(data);
    await this.triggerHandlers(alert);

    return data.id;
  }

  /**
   * Get an alert by ID
   */
  async getAlert(id: string): Promise<DriftAlert | null> {
    const { data, error } = await this.supabase
      .from('ai_drift_alerts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapAlert(data);
  }

  /**
   * Query alerts
   */
  async query(params: AlertQuery): Promise<{ alerts: DriftAlert[]; total: number }> {
    let query = this.supabase
      .from('ai_drift_alerts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', params.tenantId)
      .order('created_at', { ascending: false });

    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.severity) {
      query = query.eq('severity', params.severity);
    }
    if (params.alertType) {
      query = query.eq('alert_type', params.alertType);
    }
    if (params.startDate) {
      query = query.gte('created_at', params.startDate.toISOString());
    }
    if (params.endDate) {
      query = query.lt('created_at', params.endDate.toISOString());
    }

    const limit = params.limit || 50;
    query = query.limit(limit);

    const { data, count, error } = await query;

    if (error) {
      console.error('[AlertService] Error querying alerts:', error);
      return { alerts: [], total: 0 };
    }

    return {
      alerts: (data || []).map(this.mapAlert),
      total: count || 0,
    };
  }

  /**
   * Get active alerts for a tenant
   */
  async getActiveAlerts(tenantId: string): Promise<DriftAlert[]> {
    const { alerts } = await this.query({
      tenantId,
      status: 'active',
      limit: 100,
    });
    return alerts;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy?: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_drift_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: acknowledgedBy,
      })
      .eq('id', alertId);

    if (error) {
      console.error('[AlertService] Error acknowledging alert:', error);
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolution?: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_drift_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution,
      })
      .eq('id', alertId);

    if (error) {
      console.error('[AlertService] Error resolving alert:', error);
      throw new Error(`Failed to resolve alert: ${error.message}`);
    }
  }

  /**
   * Dismiss an alert (false positive)
   */
  async dismissAlert(alertId: string, reason?: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_drift_alerts')
      .update({
        status: 'dismissed',
        resolved_at: new Date().toISOString(),
        resolution: reason || 'Dismissed as false positive',
      })
      .eq('id', alertId);

    if (error) {
      console.error('[AlertService] Error dismissing alert:', error);
      throw new Error(`Failed to dismiss alert: ${error.message}`);
    }
  }

  /**
   * Update an alert
   */
  async updateAlert(
    alertId: string,
    updates: Partial<{
      severity: Severity;
      currentValue: number;
      driftScore: number;
      message: string;
    }>
  ): Promise<void> {
    const updateData: Record<string, unknown> = {};

    if (updates.severity) updateData.severity = updates.severity;
    if (updates.currentValue !== undefined) updateData.current_value = updates.currentValue;
    if (updates.driftScore !== undefined) updateData.drift_score = updates.driftScore;
    if (updates.message) updateData.message = updates.message;

    if (Object.keys(updateData).length === 0) return;

    const { error } = await this.supabase
      .from('ai_drift_alerts')
      .update(updateData)
      .eq('id', alertId);

    if (error) {
      console.error('[AlertService] Error updating alert:', error);
      throw new Error(`Failed to update alert: ${error.message}`);
    }
  }

  /**
   * Get alert statistics
   */
  async getStats(tenantId: string, days: number = 30): Promise<AlertStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, count } = await this.supabase
      .from('ai_drift_alerts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString());

    if (!data) {
      return {
        total: 0,
        active: 0,
        bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
        byType: {},
      };
    }

    const bySeverity: Record<Severity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byType: Record<string, number> = {};
    let active = 0;
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const alert of data) {
      bySeverity[alert.severity as Severity]++;
      byType[alert.alert_type] = (byType[alert.alert_type] || 0) + 1;

      if (alert.status === 'active') {
        active++;
      }

      if (alert.resolved_at && alert.created_at) {
        const resTime = new Date(alert.resolved_at).getTime() - new Date(alert.created_at).getTime();
        totalResolutionTime += resTime;
        resolvedCount++;
      }
    }

    return {
      total: count || 0,
      active,
      bySeverity,
      byType,
      avgResolutionTimeMs: resolvedCount > 0 ? totalResolutionTime / resolvedCount : undefined,
    };
  }

  /**
   * Auto-resolve alerts that have normalized
   */
  async autoResolveNormalizedAlerts(tenantId: string): Promise<number> {
    // Get all active drift alerts
    const { alerts } = await this.query({
      tenantId,
      status: 'active',
      alertType: 'drift',
    });

    let resolved = 0;

    for (const alert of alerts) {
      // Check if the metric is back to normal
      // This would ideally re-run the drift detection
      // For now, auto-resolve alerts older than 24 hours with low drift scores
      const ageHours = (Date.now() - alert.createdAt.getTime()) / (1000 * 60 * 60);

      if (ageHours > 24 && (alert.driftScore || 0) < 0.3) {
        await this.resolveAlert(alert.id, 'Auto-resolved: Metric normalized');
        resolved++;
      }
    }

    return resolved;
  }

  /**
   * Register an alert handler
   */
  onAlert(event: 'created' | 'resolved', handler: AlertHandler): void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  /**
   * Send alert notification (placeholder for actual notification integration)
   */
  async sendNotification(alert: DriftAlert): Promise<void> {
    // This would integrate with your notification system
    // e.g., Slack, email, PagerDuty, etc.
    console.log(`[AlertService] Alert notification: ${alert.severity.toUpperCase()} - ${alert.message}`);

    // Example: Could call external API here
    // await fetch('https://hooks.slack.com/...', { ... });
  }

  // Private helpers

  private async triggerHandlers(alert: DriftAlert): Promise<void> {
    const handlers = this.handlers.get('created') || [];
    for (const handler of handlers) {
      try {
        await handler(alert);
      } catch (error) {
        console.error('[AlertService] Handler error:', error);
      }
    }

    // Always send notification for high/critical alerts
    if (alert.severity === 'high' || alert.severity === 'critical') {
      await this.sendNotification(alert);
    }
  }

  private mapAlert(row: Record<string, unknown>): DriftAlert {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      alertType: row.alert_type as AlertType,
      severity: row.severity as Severity,
      metricName: row.metric_name as string,
      metricType: row.metric_type as MetricType,
      currentValue: row.current_value as number,
      baselineValue: row.baseline_value as number,
      threshold: row.threshold as number,
      driftScore: row.drift_score as number | undefined,
      message: row.message as string,
      status: row.status as 'active' | 'acknowledged' | 'resolved' | 'dismissed',
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : undefined,
      acknowledgedBy: row.acknowledged_by as string | undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
      resolution: row.resolution as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const alertService = new AlertService();
