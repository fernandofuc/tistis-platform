// =====================================================
// TIS TIS PLATFORM - Audit Trail Service
// Sprint 4: Sistema de auditoría para tracking de operaciones
// =====================================================

import { createServerClient } from './supabase';

// ======================
// TYPES
// ======================

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'READ'
  | 'LOGIN'
  | 'LOGOUT'
  | 'FAILED_LOGIN'
  | 'EXPORT'
  | 'IMPORT'
  | 'BULK_UPDATE'
  | 'SETTINGS_CHANGE'
  | 'PERMISSION_CHANGE'
  | 'AI_RESPONSE'
  | 'ESCALATION'
  | 'BOOKING'
  | 'ORDER_CREATE'
  | 'ORDER_UPDATE'
  | 'ORDER_CANCEL'
  | 'INTEGRATION_SYNC'
  | 'WEBHOOK_RECEIVED'
  | 'CUSTOM';

export type AuditStatus = 'success' | 'failure' | 'partial';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  status?: AuditStatus;
  errorMessage?: string;
}

export interface AuditTrailEntry {
  id: string;
  action: AuditAction;
  userId: string | null;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: AuditStatus;
  createdAt: string;
}

export interface AuditStats {
  action: AuditAction;
  entityType: string;
  count: number;
  successCount: number;
  failureCount: number;
}

// ======================
// AUDIT SERVICE CLASS
// ======================

class AuditService {
  private static instance: AuditService;
  private enabled: boolean = true;

  private constructor() {}

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Enable/disable audit logging (useful for tests)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<string | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const supabase = createServerClient();

      const { data, error } = await supabase.rpc('log_audit', {
        p_tenant_id: entry.tenantId,
        p_user_id: entry.userId || null,
        p_action: entry.action,
        p_entity_type: entry.entityType,
        p_entity_id: entry.entityId || null,
        p_changes: entry.changes || {},
        p_metadata: entry.metadata || {},
        p_request_id: entry.requestId || null,
        p_ip_address: entry.ipAddress || null,
        p_user_agent: entry.userAgent || null,
        p_status: entry.status || 'success',
        p_error_message: entry.errorMessage || null,
      });

      if (error) {
        console.error('[Audit] Failed to log audit entry:', error);
        return null;
      }

      return data as string;
    } catch (error) {
      console.error('[Audit] Exception logging audit entry:', error);
      return null;
    }
  }

  /**
   * Convenience method for CREATE actions
   */
  async logCreate(
    tenantId: string,
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    context?: Partial<AuditLogEntry>
  ): Promise<string | null> {
    return this.log({
      tenantId,
      action: 'CREATE',
      entityType,
      entityId,
      changes: { after: data },
      ...context,
    });
  }

  /**
   * Convenience method for UPDATE actions
   */
  async logUpdate(
    tenantId: string,
    entityType: string,
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    context?: Partial<AuditLogEntry>
  ): Promise<string | null> {
    return this.log({
      tenantId,
      action: 'UPDATE',
      entityType,
      entityId,
      changes: { before, after },
      ...context,
    });
  }

  /**
   * Convenience method for DELETE actions
   */
  async logDelete(
    tenantId: string,
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    context?: Partial<AuditLogEntry>
  ): Promise<string | null> {
    return this.log({
      tenantId,
      action: 'DELETE',
      entityType,
      entityId,
      changes: { before: data },
      ...context,
    });
  }

  /**
   * Get audit trail for a specific entity
   */
  async getEntityTrail(
    tenantId: string,
    entityType: string,
    entityId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditTrailEntry[]> {
    try {
      const supabase = createServerClient();

      const { data, error } = await supabase.rpc('get_entity_audit_trail', {
        p_tenant_id: tenantId,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error('[Audit] Failed to get entity trail:', error);
        return [];
      }

      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        action: row.action as AuditAction,
        userId: row.user_id as string | null,
        changes: row.changes as Record<string, unknown>,
        metadata: row.metadata as Record<string, unknown>,
        status: row.status as AuditStatus,
        createdAt: row.created_at as string,
      }));
    } catch (error) {
      console.error('[Audit] Exception getting entity trail:', error);
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  async getStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditStats[]> {
    try {
      const supabase = createServerClient();

      const { data, error } = await supabase.rpc('get_audit_stats', {
        p_tenant_id: tenantId,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null,
      });

      if (error) {
        console.error('[Audit] Failed to get stats:', error);
        return [];
      }

      return (data || []).map((row: Record<string, unknown>) => ({
        action: row.action as AuditAction,
        entityType: row.entity_type as string,
        count: Number(row.count),
        successCount: Number(row.success_count),
        failureCount: Number(row.failure_count),
      }));
    } catch (error) {
      console.error('[Audit] Exception getting stats:', error);
      return [];
    }
  }

  /**
   * Query audit logs with filters
   */
  async query(
    tenantId: string,
    options: {
      action?: AuditAction;
      entityType?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AuditTrailEntry[]> {
    try {
      const supabase = createServerClient();

      let query = supabase
        .from('audit_logs')
        .select('id, action, user_id, changes, metadata, status, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (options.action) {
        query = query.eq('action', options.action);
      }
      if (options.entityType) {
        query = query.eq('entity_type', options.entityType);
      }
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }
      if (options.startDate) {
        query = query.gte('created_at', options.startDate.toISOString());
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate.toISOString());
      }

      // Use range() when offset is provided, otherwise use limit()
      // Note: range() is inclusive, so we calculate end = offset + limit - 1
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        console.error('[Audit] Failed to query logs:', error);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        action: row.action as AuditAction,
        userId: row.user_id,
        changes: row.changes as Record<string, unknown>,
        metadata: row.metadata as Record<string, unknown>,
        status: row.status as AuditStatus,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('[Audit] Exception querying logs:', error);
      return [];
    }
  }
}

// ======================
// EXPORTS
// ======================

export const auditService = AuditService.getInstance();

// Convenience functions for direct import
export const logAudit = (entry: AuditLogEntry) => auditService.log(entry);
export const logCreate = (
  tenantId: string,
  entityType: string,
  entityId: string,
  data: Record<string, unknown>,
  context?: Partial<AuditLogEntry>
) => auditService.logCreate(tenantId, entityType, entityId, data, context);
export const logUpdate = (
  tenantId: string,
  entityType: string,
  entityId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  context?: Partial<AuditLogEntry>
) => auditService.logUpdate(tenantId, entityType, entityId, before, after, context);
export const logDelete = (
  tenantId: string,
  entityType: string,
  entityId: string,
  data: Record<string, unknown>,
  context?: Partial<AuditLogEntry>
) => auditService.logDelete(tenantId, entityType, entityId, data, context);

// ======================
// MIDDLEWARE HELPERS
// ======================

/**
 * Extract audit context from a request
 */
export function extractAuditContext(request: Request): Partial<AuditLogEntry> {
  const headers = request.headers;
  const requestId = headers.get('x-request-id') || crypto.randomUUID();
  const ipAddress = headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                    headers.get('x-real-ip') ||
                    undefined;
  const userAgent = headers.get('user-agent') || undefined;

  return {
    requestId,
    ipAddress,
    userAgent,
  };
}

/**
 * Create a diff between two objects (only changed fields)
 */
export function createDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeVal = before[key];
    const afterVal = after[key];

    // Skip if values are deeply equal
    if (JSON.stringify(beforeVal) === JSON.stringify(afterVal)) {
      continue;
    }

    if (beforeVal !== undefined) {
      changedBefore[key] = beforeVal;
    }
    if (afterVal !== undefined) {
      changedAfter[key] = afterVal;
    }
  }

  return { before: changedBefore, after: changedAfter };
}
