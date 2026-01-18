// =====================================================
// TIS TIS PLATFORM - Audit Types
// Type definitions for API Key audit and security features
// =====================================================

// ======================
// AUDIT ACTION TYPES
// ======================

/**
 * Types of auditable actions for API Keys
 */
export type AuditAction =
  | 'api_key.created'
  | 'api_key.updated'
  | 'api_key.revoked'
  | 'api_key.rotated'
  | 'api_key.viewed'
  | 'api_key.used'
  | 'api_key.rate_limited'
  | 'api_key.auth_failed'
  | 'api_key.ip_blocked'
  | 'api_key.scope_denied'
  | 'api_key.expired';

/**
 * Severity levels for audit events
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Status of the audited action
 */
export type AuditStatus = 'success' | 'failure' | 'blocked';

// ======================
// AUDIT LOG INTERFACES
// ======================

/**
 * Metadata associated with an audit event
 */
export interface AuditMetadata {
  // API Key identification
  key_id?: string;
  key_name?: string;
  key_hint?: string;

  // Request context
  endpoint?: string;
  method?: string;
  scope_used?: string;
  scope_required?: string;

  // Changes (for updates)
  changes?: {
    field: string;
    old_value: unknown;
    new_value: unknown;
  }[];

  // Rate limiting
  rate_limit_type?: 'minute' | 'daily';
  rate_limit_value?: number;
  rate_limit_current?: number;

  // Security context
  ip_address?: string;
  user_agent?: string;
  blocked_ip?: string;
  allowed_ips?: string[];

  // Error details
  error_code?: string;
  error_message?: string;

  // Additional context
  [key: string]: unknown;
}

/**
 * Full audit log entry
 */
export interface AuditLogEntry {
  id: string;
  tenant_id: string;

  // Actor information
  actor_id?: string; // User ID or 'system' for automated actions
  actor_type: 'user' | 'system' | 'api_key';
  actor_email?: string;

  // Action details
  action: AuditAction;
  resource_type: 'api_key';
  resource_id?: string;

  // Result
  status: AuditStatus;
  severity: AuditSeverity;

  // Context
  metadata: AuditMetadata;

  // Client info
  ip_address?: string;
  user_agent?: string;

  // Timestamp
  created_at: string;
}

/**
 * Simplified audit log entry for list display
 */
export interface AuditLogListItem {
  id: string;
  action: AuditAction;
  status: AuditStatus;
  severity: AuditSeverity;
  actor_email?: string;
  actor_type: 'user' | 'system' | 'api_key';
  resource_id?: string;
  ip_address?: string;
  created_at: string;
  metadata: Pick<AuditMetadata, 'key_name' | 'key_hint' | 'endpoint' | 'error_message'>;
}

// ======================
// AUDIT LOG REQUEST/RESPONSE
// ======================

/**
 * Request to log an audit event
 */
export interface CreateAuditLogRequest {
  action: AuditAction;
  resource_id?: string;
  status: AuditStatus;
  severity?: AuditSeverity;
  metadata?: AuditMetadata;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  key_id?: string;
  action?: AuditAction | AuditAction[];
  status?: AuditStatus;
  severity?: AuditSeverity | AuditSeverity[];
  actor_type?: 'user' | 'system' | 'api_key';
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Response for audit log list endpoint
 */
export interface AuditLogListResponse {
  logs: AuditLogListItem[];
  total: number;
  has_more: boolean;
}

// ======================
// SECURITY ALERT TYPES
// ======================

/**
 * Types of security alerts
 */
export type SecurityAlertType =
  | 'key_expiring_soon'
  | 'key_expired'
  | 'key_not_used'
  | 'high_error_rate'
  | 'unusual_usage_pattern'
  | 'rate_limit_exceeded_frequently'
  | 'failed_auth_attempts'
  | 'ip_change_detected'
  | 'key_rotation_recommended';

/**
 * Priority levels for security alerts
 */
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security alert entity
 */
export interface SecurityAlert {
  id: string;
  tenant_id: string;
  key_id?: string;

  type: SecurityAlertType;
  priority: AlertPriority;

  title: string;
  message: string;
  details?: Record<string, unknown>;

  // Actions
  action_url?: string;
  action_label?: string;
  dismissible: boolean;

  // State
  is_read: boolean;
  is_dismissed: boolean;
  dismissed_at?: string;
  dismissed_by?: string;

  // Timestamps
  created_at: string;
  expires_at?: string;
}

/**
 * Alert for keys expiring soon
 */
export interface KeyExpirationAlert extends SecurityAlert {
  type: 'key_expiring_soon' | 'key_expired';
  details: {
    key_id: string;
    key_name: string;
    expires_at: string;
    days_until_expiry?: number;
  };
}

/**
 * Alert for unusual usage patterns
 */
export interface UnusualUsageAlert extends SecurityAlert {
  type: 'unusual_usage_pattern' | 'high_error_rate';
  details: {
    key_id: string;
    key_name: string;
    metric: string;
    current_value: number;
    baseline_value: number;
    threshold: number;
    time_period: string;
  };
}

/**
 * Alert for authentication failures
 */
export interface AuthFailureAlert extends SecurityAlert {
  type: 'failed_auth_attempts';
  details: {
    key_id?: string;
    key_hint?: string;
    failure_count: number;
    time_period: string;
    ip_addresses: string[];
  };
}

// ======================
// KEY ROTATION TYPES
// ======================

/**
 * Status of a key rotation process
 */
export type RotationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Key rotation request
 */
export interface RotateAPIKeyRequest {
  reason?: string;
  grace_period_hours?: number; // Hours to keep old key active (default: 24)
  copy_settings?: boolean; // Copy scopes, rate limits, etc. to new key
}

/**
 * Key rotation response
 */
export interface RotateAPIKeyResponse {
  old_key: {
    id: string;
    name: string;
    deactivation_scheduled_at: string;
  };
  new_key: {
    id: string;
    name: string;
    api_key_secret: string; // New key - SHOWN ONLY ONCE
  };
  message: string;
}

/**
 * Key rotation status
 */
export interface KeyRotationStatus {
  rotation_id: string;
  status: RotationStatus;
  old_key_id: string;
  new_key_id?: string;
  started_at: string;
  completed_at?: string;
  grace_period_ends_at?: string;
  error?: string;
}

// ======================
// AUDIT STATISTICS
// ======================

/**
 * Statistics for audit dashboard
 */
export interface AuditStatistics {
  period: string; // e.g., "last_7_days", "last_30_days"

  // Action counts
  total_events: number;
  events_by_action: Record<AuditAction, number>;
  events_by_severity: Record<AuditSeverity, number>;

  // Security metrics
  failed_auth_attempts: number;
  rate_limit_hits: number;
  ip_blocks: number;

  // Key usage
  most_active_keys: {
    key_id: string;
    key_name: string;
    request_count: number;
  }[];

  // Trends
  events_by_day: {
    date: string;
    count: number;
    failures: number;
  }[];
}

// ======================
// DISPLAY HELPERS
// ======================

/**
 * Human-readable labels for audit actions
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'api_key.created': 'API Key creada',
  'api_key.updated': 'API Key actualizada',
  'api_key.revoked': 'API Key revocada',
  'api_key.rotated': 'API Key rotada',
  'api_key.viewed': 'API Key vista',
  'api_key.used': 'API Key usada',
  'api_key.rate_limited': 'Rate limit alcanzado',
  'api_key.auth_failed': 'Autenticación fallida',
  'api_key.ip_blocked': 'IP bloqueada',
  'api_key.scope_denied': 'Scope denegado',
  'api_key.expired': 'API Key expirada',
};

/**
 * Human-readable labels for security alert types
 */
export const SECURITY_ALERT_LABELS: Record<SecurityAlertType, string> = {
  key_expiring_soon: 'Key próxima a expirar',
  key_expired: 'Key expirada',
  key_not_used: 'Key sin uso',
  high_error_rate: 'Alta tasa de errores',
  unusual_usage_pattern: 'Patrón de uso inusual',
  rate_limit_exceeded_frequently: 'Rate limit excedido frecuentemente',
  failed_auth_attempts: 'Intentos de autenticación fallidos',
  ip_change_detected: 'Cambio de IP detectado',
  key_rotation_recommended: 'Rotación de key recomendada',
};

/**
 * Icons for audit actions (for UI use)
 */
export const AUDIT_ACTION_ICONS: Record<AuditAction, string> = {
  'api_key.created': 'plus-circle',
  'api_key.updated': 'edit',
  'api_key.revoked': 'x-circle',
  'api_key.rotated': 'refresh-cw',
  'api_key.viewed': 'eye',
  'api_key.used': 'check-circle',
  'api_key.rate_limited': 'alert-triangle',
  'api_key.auth_failed': 'shield-off',
  'api_key.ip_blocked': 'shield-x',
  'api_key.scope_denied': 'lock',
  'api_key.expired': 'clock',
};

/**
 * Colors for severity levels
 */
export const SEVERITY_COLORS: Record<AuditSeverity, string> = {
  info: 'blue',
  warning: 'amber',
  error: 'red',
  critical: 'purple',
};

/**
 * Colors for alert priorities
 */
export const ALERT_PRIORITY_COLORS: Record<AlertPriority, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'amber',
  critical: 'red',
};
