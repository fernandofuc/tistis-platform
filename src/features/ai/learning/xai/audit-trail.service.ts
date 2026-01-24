// =====================================================
// TIS TIS PLATFORM - AUDIT TRAIL SERVICE
// Immutable audit log for AI decisions and changes
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { AuditEvent } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type EventType = AuditEvent['eventType'];
type ActorType = AuditEvent['actorType'];
type ResourceType = AuditEvent['resourceType'];

interface LogEventParams {
  tenantId: string;
  eventType: EventType;
  eventSubtype?: string;
  actorType: ActorType;
  actorId?: string;
  actorName?: string;
  resourceType: ResourceType;
  resourceId?: string;
  action: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  decisionLogId?: string;
  parentEventId?: string;
}

interface AuditQuery {
  tenantId: string;
  eventType?: EventType;
  resourceType?: ResourceType;
  resourceId?: string;
  actorType?: ActorType;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface AuditStats {
  total: number;
  byEventType: Record<string, number>;
  byActorType: Record<string, number>;
  recentActivity: Array<{ date: string; count: number }>;
}

export class AuditTrailService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Log an audit event
   */
  async log(params: LogEventParams): Promise<string> {
    // Calculate checksum for immutability verification
    const checksum = this.calculateChecksum({
      ...params,
      timestamp: new Date().toISOString(),
    });

    const { data, error } = await this.supabase
      .from('ai_audit_trail')
      .insert({
        tenant_id: params.tenantId,
        event_type: params.eventType,
        event_subtype: params.eventSubtype,
        actor_type: params.actorType,
        actor_id: params.actorId,
        actor_name: params.actorName,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        action: params.action,
        before_state: params.beforeState,
        after_state: params.afterState,
        metadata: params.metadata,
        decision_log_id: params.decisionLogId,
        parent_event_id: params.parentEventId,
        checksum,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[AuditTrailService] Error logging event:', error);
      throw new Error(`Failed to log audit event: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Log an AI decision event
   */
  async logDecision(
    tenantId: string,
    decisionLogId: string,
    action: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.log({
      tenantId,
      eventType: 'decision',
      actorType: 'system',
      resourceType: 'conversation',
      action,
      metadata,
      decisionLogId,
    });
  }

  /**
   * Log a model change event
   */
  async logModelChange(
    tenantId: string,
    actorId: string,
    actorName: string,
    resourceId: string,
    beforeModel: string,
    afterModel: string,
    reason?: string
  ): Promise<string> {
    return this.log({
      tenantId,
      eventType: 'model_change',
      actorType: 'admin',
      actorId,
      actorName,
      resourceType: 'model',
      resourceId,
      action: 'model_switched',
      beforeState: { model: beforeModel },
      afterState: { model: afterModel },
      metadata: { reason },
    });
  }

  /**
   * Log a configuration change event
   */
  async logConfigChange(
    tenantId: string,
    actorId: string,
    actorName: string,
    configKey: string,
    beforeValue: unknown,
    afterValue: unknown
  ): Promise<string> {
    return this.log({
      tenantId,
      eventType: 'config_change',
      actorType: 'admin',
      actorId,
      actorName,
      resourceType: 'config',
      action: `config_updated:${configKey}`,
      beforeState: { [configKey]: beforeValue },
      afterState: { [configKey]: afterValue },
    });
  }

  /**
   * Log a feedback event
   */
  async logFeedback(
    tenantId: string,
    userId: string,
    conversationId: string,
    feedbackType: string,
    rating?: number,
    comment?: string
  ): Promise<string> {
    return this.log({
      tenantId,
      eventType: 'feedback',
      actorType: 'user',
      actorId: userId,
      resourceType: 'conversation',
      resourceId: conversationId,
      action: `feedback_${feedbackType}`,
      afterState: { rating, comment },
    });
  }

  /**
   * Log an escalation event
   */
  async logEscalation(
    tenantId: string,
    conversationId: string,
    reason: string,
    decisionLogId?: string
  ): Promise<string> {
    return this.log({
      tenantId,
      eventType: 'escalation',
      actorType: 'system',
      resourceType: 'conversation',
      resourceId: conversationId,
      action: 'escalated_to_human',
      metadata: { reason },
      decisionLogId,
    });
  }

  /**
   * Get an audit event by ID
   */
  async getEvent(id: string): Promise<AuditEvent | null> {
    const { data, error } = await this.supabase
      .from('ai_audit_trail')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapEvent(data);
  }

  /**
   * Query audit events
   */
  async query(params: AuditQuery): Promise<{ events: AuditEvent[]; total: number }> {
    let query = this.supabase
      .from('ai_audit_trail')
      .select('*', { count: 'exact' })
      .eq('tenant_id', params.tenantId)
      .order('created_at', { ascending: false });

    if (params.eventType) {
      query = query.eq('event_type', params.eventType);
    }
    if (params.resourceType) {
      query = query.eq('resource_type', params.resourceType);
    }
    if (params.resourceId) {
      query = query.eq('resource_id', params.resourceId);
    }
    if (params.actorType) {
      query = query.eq('actor_type', params.actorType);
    }
    if (params.actorId) {
      query = query.eq('actor_id', params.actorId);
    }
    if (params.startDate) {
      query = query.gte('created_at', params.startDate.toISOString());
    }
    if (params.endDate) {
      query = query.lt('created_at', params.endDate.toISOString());
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[AuditTrailService] Error querying events:', error);
      return { events: [], total: 0 };
    }

    return {
      events: (data || []).map(this.mapEvent),
      total: count || 0,
    };
  }

  /**
   * Get history for a specific resource
   */
  async getResourceHistory(
    tenantId: string,
    resourceType: ResourceType,
    resourceId: string
  ): Promise<AuditEvent[]> {
    const { events } = await this.query({
      tenantId,
      resourceType,
      resourceId,
      limit: 100,
    });
    return events;
  }

  /**
   * Get activity for a specific user
   */
  async getUserActivity(
    tenantId: string,
    userId: string,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    const { events } = await this.query({
      tenantId,
      actorId: userId,
      limit,
    });
    return events;
  }

  /**
   * Verify integrity of an audit event
   */
  async verifyIntegrity(eventId: string): Promise<{ valid: boolean; details: string }> {
    const { data: event } = await this.supabase
      .from('ai_audit_trail')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) {
      return { valid: false, details: 'Event not found' };
    }

    const expectedChecksum = this.calculateChecksum({
      tenantId: event.tenant_id,
      eventType: event.event_type,
      eventSubtype: event.event_subtype,
      actorType: event.actor_type,
      actorId: event.actor_id,
      actorName: event.actor_name,
      resourceType: event.resource_type,
      resourceId: event.resource_id,
      action: event.action,
      beforeState: event.before_state,
      afterState: event.after_state,
      metadata: event.metadata,
      decisionLogId: event.decision_log_id,
      parentEventId: event.parent_event_id,
      timestamp: event.created_at,
    });

    const valid = expectedChecksum === event.checksum;

    return {
      valid,
      details: valid
        ? 'Checksum verified - event integrity confirmed'
        : 'Checksum mismatch - event may have been tampered with',
    };
  }

  /**
   * Get audit statistics
   */
  async getStats(tenantId: string, days: number = 30): Promise<AuditStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, count } = await this.supabase
      .from('ai_audit_trail')
      .select('event_type, actor_type, created_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString());

    if (!data) {
      return {
        total: 0,
        byEventType: {},
        byActorType: {},
        recentActivity: [],
      };
    }

    const byEventType: Record<string, number> = {};
    const byActorType: Record<string, number> = {};
    const byDate: Record<string, number> = {};

    for (const row of data) {
      byEventType[row.event_type] = (byEventType[row.event_type] || 0) + 1;
      byActorType[row.actor_type] = (byActorType[row.actor_type] || 0) + 1;

      const dateKey = new Date(row.created_at).toISOString().split('T')[0];
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    }

    const recentActivity = Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Last 2 weeks

    return {
      total: count || 0,
      byEventType,
      byActorType,
      recentActivity,
    };
  }

  /**
   * Export audit trail for compliance
   */
  async export(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> {
    const { events } = await this.query({
      tenantId,
      startDate,
      endDate,
      limit: 50000,
    });

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }

    // CSV format
    const headers = [
      'id',
      'timestamp',
      'event_type',
      'event_subtype',
      'actor_type',
      'actor_id',
      'actor_name',
      'resource_type',
      'resource_id',
      'action',
      'checksum',
    ];

    const rows = events.map((e) => [
      e.id,
      e.createdAt.toISOString(),
      e.eventType,
      e.eventSubtype || '',
      e.actorType,
      e.actorId || '',
      e.actorName || '',
      e.resourceType,
      e.resourceId || '',
      e.action,
      e.checksum,
    ]);

    return [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  }

  /**
   * Create a chain of related events
   */
  async logEventChain(
    tenantId: string,
    events: Omit<LogEventParams, 'tenantId' | 'parentEventId'>[]
  ): Promise<string[]> {
    const ids: string[] = [];
    let parentId: string | undefined;

    for (const event of events) {
      const id = await this.log({
        ...event,
        tenantId,
        parentEventId: parentId,
      });
      ids.push(id);
      parentId = id;
    }

    return ids;
  }

  // Private helpers

  private calculateChecksum(data: Record<string, unknown>): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(str).digest('hex');
  }

  private mapEvent(row: Record<string, unknown>): AuditEvent {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      eventType: row.event_type as EventType,
      eventSubtype: row.event_subtype as string | undefined,
      actorType: row.actor_type as ActorType,
      actorId: row.actor_id as string | undefined,
      actorName: row.actor_name as string | undefined,
      resourceType: row.resource_type as ResourceType,
      resourceId: row.resource_id as string | undefined,
      action: row.action as string,
      beforeState: row.before_state as Record<string, unknown> | undefined,
      afterState: row.after_state as Record<string, unknown> | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      decisionLogId: row.decision_log_id as string | undefined,
      parentEventId: row.parent_event_id as string | undefined,
      checksum: row.checksum as string,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// Export singleton instance
export const auditTrailService = new AuditTrailService();
