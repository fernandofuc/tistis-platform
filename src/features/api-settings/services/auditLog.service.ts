// =====================================================
// TIS TIS PLATFORM - Audit Log Service
// Service for logging and retrieving API Key audit events
// =====================================================

import type {
  AuditAction,
  AuditSeverity,
  AuditStatus,
  AuditLogListItem,
  AuditLogFilters,
  AuditLogListResponse,
  CreateAuditLogRequest,
  AuditStatistics,
} from '../types';

// ======================
// CONSTANTS
// ======================

/**
 * Default severity levels for each action type
 */
const DEFAULT_SEVERITY: Record<AuditAction, AuditSeverity> = {
  'api_key.created': 'info',
  'api_key.updated': 'info',
  'api_key.revoked': 'warning',
  'api_key.rotated': 'info',
  'api_key.viewed': 'info',
  'api_key.used': 'info',
  'api_key.rate_limited': 'warning',
  'api_key.auth_failed': 'error',
  'api_key.ip_blocked': 'error',
  'api_key.scope_denied': 'warning',
  'api_key.expired': 'warning',
};

/**
 * Actions that should be logged to the database
 * (Some high-frequency actions might be sampled or aggregated)
 */
const ALWAYS_LOG_ACTIONS: AuditAction[] = [
  'api_key.created',
  'api_key.updated',
  'api_key.revoked',
  'api_key.rotated',
  'api_key.auth_failed',
  'api_key.ip_blocked',
  'api_key.expired',
];

// ======================
// BUFFER FOR BATCH INSERTS
// ======================

interface BufferedLogEntry extends CreateAuditLogRequest {
  tenant_id: string;
  actor_id?: string;
  actor_type: 'user' | 'system' | 'api_key';
  actor_email?: string;
  resource_type: 'api_key';
  created_at: string;
}

const logBuffer: BufferedLogEntry[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 50;

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Determine if an action should always be logged immediately
 */
function shouldLogImmediately(action: AuditAction): boolean {
  return ALWAYS_LOG_ACTIONS.includes(action);
}

/**
 * Get default severity for an action
 */
function getDefaultSeverity(action: AuditAction, status: AuditStatus): AuditSeverity {
  if (status === 'failure' || status === 'blocked') {
    return action === 'api_key.auth_failed' || action === 'api_key.ip_blocked'
      ? 'error'
      : 'warning';
  }
  return DEFAULT_SEVERITY[action] || 'info';
}

/**
 * Create a log entry from request
 */
function createLogEntry(
  request: CreateAuditLogRequest,
  context: {
    tenantId: string;
    actorId?: string;
    actorType: 'user' | 'system' | 'api_key';
    actorEmail?: string;
  }
): BufferedLogEntry {
  return {
    ...request,
    tenant_id: context.tenantId,
    actor_id: context.actorId,
    actor_type: context.actorType,
    actor_email: context.actorEmail,
    resource_type: 'api_key',
    severity: request.severity || getDefaultSeverity(request.action, request.status),
    created_at: new Date().toISOString(),
  };
}

// ======================
// SERVER-SIDE LOGGING
// ======================

// Supabase client type - using generic to avoid complex type matching
type SupabaseClient = {
  from: (table: string) => {
    insert: (data: Record<string, unknown> | Record<string, unknown>[]) => {
      then: (fn: (result: { error: unknown }) => void) => void;
    };
  };
};

/**
 * Log an audit event (server-side)
 * This function should be called from API routes
 */
export async function logAuditEvent(
  request: CreateAuditLogRequest,
  context: {
    tenantId: string;
    actorId?: string;
    actorType: 'user' | 'system' | 'api_key';
    actorEmail?: string;
    supabase?: SupabaseClient;
  }
): Promise<void> {
  const entry = createLogEntry(request, context);

  // For critical actions, log immediately
  if (shouldLogImmediately(request.action) && context.supabase) {
    try {
      await context.supabase.from('api_key_audit_logs').insert({
        tenant_id: entry.tenant_id,
        actor_id: entry.actor_id,
        actor_type: entry.actor_type,
        actor_email: entry.actor_email,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        status: entry.status,
        severity: entry.severity,
        metadata: entry.metadata || {},
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        created_at: entry.created_at,
      });
    } catch (error) {
      console.error('[AuditLog] Error logging event:', error);
      // Add to buffer as fallback
      logBuffer.push(entry);
    }
    return;
  }

  // For non-critical actions, buffer for batch insert
  logBuffer.push(entry);

  // Schedule flush if needed
  if (logBuffer.length >= FLUSH_THRESHOLD) {
    await flushLogBuffer(context.supabase);
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushLogBuffer(context.supabase);
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Flush buffered logs to database
 */
async function flushLogBuffer(
  supabase?: SupabaseClient
): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (logBuffer.length === 0 || !supabase) {
    return;
  }

  const entries = [...logBuffer];
  logBuffer.length = 0;

  try {
    const { error } = await supabase.from('api_key_audit_logs').insert(
      entries.map((entry) => ({
        tenant_id: entry.tenant_id,
        actor_id: entry.actor_id,
        actor_type: entry.actor_type,
        actor_email: entry.actor_email,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        status: entry.status,
        severity: entry.severity,
        metadata: entry.metadata || {},
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        created_at: entry.created_at,
      }))
    );

    if (error) {
      console.error('[AuditLog] Error flushing buffer:', error);
      // Re-add entries to buffer for retry
      logBuffer.push(...entries);
    }
  } catch (error) {
    console.error('[AuditLog] Error flushing buffer:', error);
    logBuffer.push(...entries);
  }
}

// ======================
// CLIENT-SIDE API
// ======================

/**
 * Fetch audit logs for a tenant (client-side)
 */
export async function fetchAuditLogs(
  filters?: AuditLogFilters
): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();

  if (filters?.key_id) params.set('key_id', filters.key_id);
  if (filters?.action) {
    const actions = Array.isArray(filters.action)
      ? filters.action.join(',')
      : filters.action;
    params.set('action', actions);
  }
  if (filters?.status) params.set('status', filters.status);
  if (filters?.severity) {
    const severities = Array.isArray(filters.severity)
      ? filters.severity.join(',')
      : filters.severity;
    params.set('severity', severities);
  }
  if (filters?.actor_type) params.set('actor_type', filters.actor_type);
  if (filters?.from_date) params.set('from_date', filters.from_date);
  if (filters?.to_date) params.set('to_date', filters.to_date);
  if (filters?.limit) params.set('limit', filters.limit.toString());
  if (filters?.offset) params.set('offset', filters.offset.toString());

  const queryString = params.toString();
  const url = `/api/settings/api-keys/audit${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error fetching audit logs');
  }

  return response.json();
}

/**
 * Fetch audit statistics (client-side)
 */
export async function fetchAuditStatistics(
  period: 'last_7_days' | 'last_30_days' | 'last_90_days' = 'last_30_days'
): Promise<AuditStatistics> {
  const response = await fetch(`/api/settings/api-keys/audit/stats?period=${period}`);

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error fetching audit statistics');
  }

  return response.json();
}

/**
 * Fetch audit logs for a specific API key (client-side)
 */
export async function fetchKeyAuditLogs(
  keyId: string,
  limit: number = 50
): Promise<AuditLogListItem[]> {
  const response = await fetchAuditLogs({
    key_id: keyId,
    limit,
  });

  return response.logs;
}

// ======================
// CONVENIENCE FUNCTIONS
// ======================

/**
 * Log API key creation event
 */
export async function logKeyCreated(
  keyId: string,
  keyName: string,
  context: {
    tenantId: string;
    actorId: string;
    actorEmail?: string;
    supabase?: Parameters<typeof logAuditEvent>[1]['supabase'];
    ip_address?: string;
    user_agent?: string;
  }
): Promise<void> {
  await logAuditEvent(
    {
      action: 'api_key.created',
      resource_id: keyId,
      status: 'success',
      severity: 'info',
      metadata: {
        key_id: keyId,
        key_name: keyName,
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    },
    {
      tenantId: context.tenantId,
      actorId: context.actorId,
      actorType: 'user',
      actorEmail: context.actorEmail,
      supabase: context.supabase,
    }
  );
}

/**
 * Log API key update event
 */
export async function logKeyUpdated(
  keyId: string,
  keyName: string,
  changes: { field: string; old_value: unknown; new_value: unknown }[],
  context: {
    tenantId: string;
    actorId: string;
    actorEmail?: string;
    supabase?: Parameters<typeof logAuditEvent>[1]['supabase'];
    ip_address?: string;
    user_agent?: string;
  }
): Promise<void> {
  await logAuditEvent(
    {
      action: 'api_key.updated',
      resource_id: keyId,
      status: 'success',
      severity: 'info',
      metadata: {
        key_id: keyId,
        key_name: keyName,
        changes,
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    },
    {
      tenantId: context.tenantId,
      actorId: context.actorId,
      actorType: 'user',
      actorEmail: context.actorEmail,
      supabase: context.supabase,
    }
  );
}

/**
 * Log API key revocation event
 */
export async function logKeyRevoked(
  keyId: string,
  keyName: string,
  reason: string | undefined,
  context: {
    tenantId: string;
    actorId: string;
    actorEmail?: string;
    supabase?: Parameters<typeof logAuditEvent>[1]['supabase'];
    ip_address?: string;
    user_agent?: string;
  }
): Promise<void> {
  await logAuditEvent(
    {
      action: 'api_key.revoked',
      resource_id: keyId,
      status: 'success',
      severity: 'warning',
      metadata: {
        key_id: keyId,
        key_name: keyName,
        error_message: reason,
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    },
    {
      tenantId: context.tenantId,
      actorId: context.actorId,
      actorType: 'user',
      actorEmail: context.actorEmail,
      supabase: context.supabase,
    }
  );
}

/**
 * Log API key rotation event
 */
export async function logKeyRotated(
  oldKeyId: string,
  newKeyId: string,
  keyName: string,
  context: {
    tenantId: string;
    actorId: string;
    actorEmail?: string;
    supabase?: Parameters<typeof logAuditEvent>[1]['supabase'];
    ip_address?: string;
    user_agent?: string;
  }
): Promise<void> {
  await logAuditEvent(
    {
      action: 'api_key.rotated',
      resource_id: newKeyId,
      status: 'success',
      severity: 'info',
      metadata: {
        key_id: newKeyId,
        key_name: keyName,
        changes: [
          {
            field: 'key_rotated_from',
            old_value: oldKeyId,
            new_value: newKeyId,
          },
        ],
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    },
    {
      tenantId: context.tenantId,
      actorId: context.actorId,
      actorType: 'user',
      actorEmail: context.actorEmail,
      supabase: context.supabase,
    }
  );
}

/**
 * Log authentication failure
 */
export async function logAuthFailure(
  keyHint: string | undefined,
  errorCode: string,
  errorMessage: string,
  context: {
    tenantId?: string;
    keyId?: string;
    supabase?: Parameters<typeof logAuditEvent>[1]['supabase'];
    ip_address?: string;
    user_agent?: string;
  }
): Promise<void> {
  // Only log if we have a tenant context
  if (!context.tenantId) {
    console.warn('[AuditLog] Cannot log auth failure without tenant context');
    return;
  }

  await logAuditEvent(
    {
      action: 'api_key.auth_failed',
      resource_id: context.keyId,
      status: 'failure',
      severity: 'error',
      metadata: {
        key_id: context.keyId,
        key_hint: keyHint,
        error_code: errorCode,
        error_message: errorMessage,
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    },
    {
      tenantId: context.tenantId,
      actorType: 'api_key',
      supabase: context.supabase,
    }
  );
}

/**
 * Log rate limit exceeded
 */
export async function logRateLimitExceeded(
  keyId: string,
  keyName: string,
  limitType: 'minute' | 'daily',
  limit: number,
  current: number,
  context: {
    tenantId: string;
    supabase?: Parameters<typeof logAuditEvent>[1]['supabase'];
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
  }
): Promise<void> {
  await logAuditEvent(
    {
      action: 'api_key.rate_limited',
      resource_id: keyId,
      status: 'blocked',
      severity: 'warning',
      metadata: {
        key_id: keyId,
        key_name: keyName,
        rate_limit_type: limitType,
        rate_limit_value: limit,
        rate_limit_current: current,
        endpoint: context.endpoint,
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    },
    {
      tenantId: context.tenantId,
      actorType: 'api_key',
      supabase: context.supabase,
    }
  );
}

/**
 * Log IP blocked
 */
export async function logIPBlocked(
  keyId: string,
  keyName: string,
  blockedIP: string,
  allowedIPs: string[],
  context: {
    tenantId: string;
    supabase?: Parameters<typeof logAuditEvent>[1]['supabase'];
    user_agent?: string;
  }
): Promise<void> {
  await logAuditEvent(
    {
      action: 'api_key.ip_blocked',
      resource_id: keyId,
      status: 'blocked',
      severity: 'error',
      metadata: {
        key_id: keyId,
        key_name: keyName,
        blocked_ip: blockedIP,
        allowed_ips: allowedIPs,
      },
      ip_address: blockedIP,
      user_agent: context.user_agent,
    },
    {
      tenantId: context.tenantId,
      actorType: 'api_key',
      supabase: context.supabase,
    }
  );
}

/**
 * Log scope denied
 */
export async function logScopeDenied(
  keyId: string,
  keyName: string,
  requiredScope: string,
  availableScopes: string[],
  context: {
    tenantId: string;
    supabase?: Parameters<typeof logAuditEvent>[1]['supabase'];
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
  }
): Promise<void> {
  await logAuditEvent(
    {
      action: 'api_key.scope_denied',
      resource_id: keyId,
      status: 'blocked',
      severity: 'warning',
      metadata: {
        key_id: keyId,
        key_name: keyName,
        scope_required: requiredScope,
        scope_used: availableScopes.join(', '),
        endpoint: context.endpoint,
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    },
    {
      tenantId: context.tenantId,
      actorType: 'api_key',
      supabase: context.supabase,
    }
  );
}
