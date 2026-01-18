// =====================================================
// TIS TIS PLATFORM - Security Alerts Utilities
// Functions for generating and managing security alerts
// =====================================================

import type {
  SecurityAlert,
  SecurityAlertType,
  AlertPriority,
  KeyExpirationAlert,
  UnusualUsageAlert,
  AuthFailureAlert,
  APIKeyListItem,
} from '../types';

// ======================
// CONSTANTS
// ======================

/**
 * Days before expiration to trigger warnings
 */
export const EXPIRATION_WARNING_DAYS = {
  critical: 3,
  high: 7,
  medium: 14,
  low: 30,
};

/**
 * Days without usage to trigger inactive key alert
 */
export const INACTIVE_KEY_DAYS = 90;

/**
 * Error rate threshold for high error rate alert (percentage)
 */
export const HIGH_ERROR_RATE_THRESHOLD = 20;

/**
 * Number of failed auth attempts to trigger alert
 */
export const FAILED_AUTH_THRESHOLD = 5;

/**
 * Time window for failed auth attempts (in hours)
 */
export const FAILED_AUTH_WINDOW_HOURS = 1;

/**
 * Days since creation to recommend rotation
 */
export const ROTATION_RECOMMENDATION_DAYS = 90;

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Calculate days until a date
 */
export function daysUntil(date: string | Date): number {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffTime = targetDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days since a date
 */
export function daysSince(date: string | Date): number {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffTime = now.getTime() - targetDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Generate a unique ID for alerts
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get priority based on days until expiration
 */
function getExpirationPriority(daysUntilExpiry: number): AlertPriority {
  if (daysUntilExpiry <= 0) return 'critical';
  if (daysUntilExpiry <= EXPIRATION_WARNING_DAYS.critical) return 'critical';
  if (daysUntilExpiry <= EXPIRATION_WARNING_DAYS.high) return 'high';
  if (daysUntilExpiry <= EXPIRATION_WARNING_DAYS.medium) return 'medium';
  return 'low';
}

// ======================
// ALERT GENERATORS
// ======================

/**
 * Generate alerts for keys expiring soon
 */
export function generateExpirationAlerts(
  keys: APIKeyListItem[],
  tenantId: string
): KeyExpirationAlert[] {
  const alerts: KeyExpirationAlert[] = [];
  const now = new Date();

  for (const key of keys) {
    if (!key.is_active || !key.expires_at) continue;

    const expiresAt = new Date(key.expires_at);
    const daysUntilExpiry = daysUntil(expiresAt);

    // Already expired
    if (daysUntilExpiry < 0) {
      alerts.push({
        id: generateAlertId(),
        tenant_id: tenantId,
        key_id: key.id,
        type: 'key_expired',
        priority: 'critical',
        title: 'API Key expirada',
        message: `La API Key "${key.name}" expiró el ${expiresAt.toLocaleDateString('es-ES')}.`,
        details: {
          key_id: key.id,
          key_name: key.name,
          expires_at: key.expires_at,
        },
        action_url: `/dashboard/settings?tab=api&key=${key.id}`,
        action_label: 'Ver detalles',
        dismissible: false,
        is_read: false,
        is_dismissed: false,
        created_at: now.toISOString(),
      });
      continue;
    }

    // Expiring soon
    if (daysUntilExpiry <= EXPIRATION_WARNING_DAYS.low) {
      const priority = getExpirationPriority(daysUntilExpiry);
      const daysText = daysUntilExpiry === 1 ? '1 día' : `${daysUntilExpiry} días`;

      alerts.push({
        id: generateAlertId(),
        tenant_id: tenantId,
        key_id: key.id,
        type: 'key_expiring_soon',
        priority,
        title: 'API Key próxima a expirar',
        message: `La API Key "${key.name}" expirará en ${daysText}. Considera rotarla antes de que expire.`,
        details: {
          key_id: key.id,
          key_name: key.name,
          expires_at: key.expires_at,
          days_until_expiry: daysUntilExpiry,
        },
        action_url: `/dashboard/settings?tab=api&key=${key.id}&action=rotate`,
        action_label: 'Rotar key',
        dismissible: true,
        is_read: false,
        is_dismissed: false,
        created_at: now.toISOString(),
      });
    }
  }

  return alerts;
}

/**
 * Generate alerts for inactive keys
 */
export function generateInactiveKeyAlerts(
  keys: APIKeyListItem[],
  tenantId: string
): SecurityAlert[] {
  const alerts: SecurityAlert[] = [];
  const now = new Date();

  for (const key of keys) {
    if (!key.is_active) continue;

    // Check if key has never been used or not used recently
    const lastUsed = key.last_used_at ? new Date(key.last_used_at) : null;
    const daysSinceLastUse = lastUsed ? daysSince(lastUsed) : null;
    const daysSinceCreation = daysSince(new Date(key.created_at));

    // Never used and created more than 30 days ago
    if (!lastUsed && daysSinceCreation > 30) {
      alerts.push({
        id: generateAlertId(),
        tenant_id: tenantId,
        key_id: key.id,
        type: 'key_not_used',
        priority: 'low',
        title: 'API Key sin uso',
        message: `La API Key "${key.name}" fue creada hace ${daysSinceCreation} días y nunca ha sido utilizada. Considera revocarla si no la necesitas.`,
        action_url: `/dashboard/settings?tab=api&key=${key.id}`,
        action_label: 'Ver detalles',
        dismissible: true,
        is_read: false,
        is_dismissed: false,
        created_at: now.toISOString(),
      });
      continue;
    }

    // Not used in INACTIVE_KEY_DAYS
    if (daysSinceLastUse && daysSinceLastUse > INACTIVE_KEY_DAYS) {
      alerts.push({
        id: generateAlertId(),
        tenant_id: tenantId,
        key_id: key.id,
        type: 'key_not_used',
        priority: 'medium',
        title: 'API Key inactiva',
        message: `La API Key "${key.name}" no ha sido utilizada en ${daysSinceLastUse} días. Considera revocarla si ya no la necesitas.`,
        action_url: `/dashboard/settings?tab=api&key=${key.id}`,
        action_label: 'Ver detalles',
        dismissible: true,
        is_read: false,
        is_dismissed: false,
        created_at: now.toISOString(),
      });
    }
  }

  return alerts;
}

/**
 * Generate alerts for keys that should be rotated
 */
export function generateRotationAlerts(
  keys: APIKeyListItem[],
  tenantId: string
): SecurityAlert[] {
  const alerts: SecurityAlert[] = [];
  const now = new Date();

  for (const key of keys) {
    if (!key.is_active) continue;

    const daysSinceCreation = daysSince(new Date(key.created_at));

    if (daysSinceCreation >= ROTATION_RECOMMENDATION_DAYS) {
      alerts.push({
        id: generateAlertId(),
        tenant_id: tenantId,
        key_id: key.id,
        type: 'key_rotation_recommended',
        priority: 'medium',
        title: 'Rotación de key recomendada',
        message: `La API Key "${key.name}" tiene ${daysSinceCreation} días de antigüedad. Por seguridad, se recomienda rotar las keys cada ${ROTATION_RECOMMENDATION_DAYS} días.`,
        action_url: `/dashboard/settings?tab=api&key=${key.id}&action=rotate`,
        action_label: 'Rotar key',
        dismissible: true,
        is_read: false,
        is_dismissed: false,
        created_at: now.toISOString(),
      });
    }
  }

  return alerts;
}

/**
 * Generate alert for high error rate
 */
export function generateHighErrorRateAlert(
  keyId: string,
  keyName: string,
  tenantId: string,
  errorRate: number,
  totalRequests: number,
  timePeriod: string
): UnusualUsageAlert {
  return {
    id: generateAlertId(),
    tenant_id: tenantId,
    key_id: keyId,
    type: 'high_error_rate',
    priority: errorRate > 50 ? 'critical' : errorRate > 30 ? 'high' : 'medium',
    title: 'Alta tasa de errores detectada',
    message: `La API Key "${keyName}" tiene una tasa de errores del ${errorRate.toFixed(1)}% en ${timePeriod}. Revisa los logs para identificar el problema.`,
    details: {
      key_id: keyId,
      key_name: keyName,
      metric: 'error_rate',
      current_value: errorRate,
      baseline_value: 5, // Expected error rate
      threshold: HIGH_ERROR_RATE_THRESHOLD,
      time_period: timePeriod,
    },
    action_url: `/dashboard/settings?tab=api&key=${keyId}&section=logs`,
    action_label: 'Ver logs',
    dismissible: true,
    is_read: false,
    is_dismissed: false,
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate alert for unusual usage pattern
 */
export function generateUnusualUsageAlert(
  keyId: string,
  keyName: string,
  tenantId: string,
  metric: string,
  currentValue: number,
  baselineValue: number,
  timePeriod: string
): UnusualUsageAlert {
  const increasePercent = ((currentValue - baselineValue) / baselineValue) * 100;

  return {
    id: generateAlertId(),
    tenant_id: tenantId,
    key_id: keyId,
    type: 'unusual_usage_pattern',
    priority: increasePercent > 500 ? 'critical' : increasePercent > 200 ? 'high' : 'medium',
    title: 'Patrón de uso inusual detectado',
    message: `La API Key "${keyName}" muestra un incremento del ${increasePercent.toFixed(0)}% en ${metric} comparado con el promedio. Esto podría indicar un problema o un uso no autorizado.`,
    details: {
      key_id: keyId,
      key_name: keyName,
      metric,
      current_value: currentValue,
      baseline_value: baselineValue,
      threshold: baselineValue * 2, // 200% of baseline
      time_period: timePeriod,
    },
    action_url: `/dashboard/settings?tab=api&key=${keyId}&section=usage`,
    action_label: 'Ver uso',
    dismissible: true,
    is_read: false,
    is_dismissed: false,
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate alert for failed authentication attempts
 */
export function generateFailedAuthAlert(
  tenantId: string,
  failureCount: number,
  ipAddresses: string[],
  keyHint?: string,
  keyId?: string
): AuthFailureAlert {
  const timePeriod = `última${FAILED_AUTH_WINDOW_HOURS === 1 ? ' hora' : `s ${FAILED_AUTH_WINDOW_HOURS} horas`}`;

  return {
    id: generateAlertId(),
    tenant_id: tenantId,
    key_id: keyId,
    type: 'failed_auth_attempts',
    priority: failureCount > 20 ? 'critical' : failureCount > 10 ? 'high' : 'medium',
    title: 'Intentos de autenticación fallidos',
    message: `Se detectaron ${failureCount} intentos de autenticación fallidos en la ${timePeriod}${keyHint ? ` para la key terminada en "${keyHint}"` : ''}. Esto podría indicar un intento de ataque.`,
    details: {
      key_id: keyId,
      key_hint: keyHint,
      failure_count: failureCount,
      time_period: timePeriod,
      ip_addresses: ipAddresses,
    },
    action_url: `/dashboard/settings?tab=api&section=audit`,
    action_label: 'Ver auditoría',
    dismissible: false,
    is_read: false,
    is_dismissed: false,
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate alert for rate limit exceeded frequently
 */
export function generateRateLimitAlert(
  keyId: string,
  keyName: string,
  tenantId: string,
  hitCount: number,
  timePeriod: string
): SecurityAlert {
  return {
    id: generateAlertId(),
    tenant_id: tenantId,
    key_id: keyId,
    type: 'rate_limit_exceeded_frequently',
    priority: hitCount > 100 ? 'high' : 'medium',
    title: 'Rate limit excedido frecuentemente',
    message: `La API Key "${keyName}" ha excedido el rate limit ${hitCount} veces en ${timePeriod}. Considera aumentar los límites o optimizar las llamadas.`,
    action_url: `/dashboard/settings?tab=api&key=${keyId}`,
    action_label: 'Ajustar límites',
    dismissible: true,
    is_read: false,
    is_dismissed: false,
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate alert for IP change detected
 */
export function generateIPChangeAlert(
  keyId: string,
  keyName: string,
  tenantId: string,
  newIP: string,
  previousIPs: string[]
): SecurityAlert {
  return {
    id: generateAlertId(),
    tenant_id: tenantId,
    key_id: keyId,
    type: 'ip_change_detected',
    priority: 'medium',
    title: 'Cambio de IP detectado',
    message: `La API Key "${keyName}" está siendo usada desde una nueva IP (${newIP}) que no se había visto antes. Verifica que sea legítimo.`,
    details: {
      new_ip: newIP,
      previous_ips: previousIPs,
    },
    action_url: `/dashboard/settings?tab=api&key=${keyId}`,
    action_label: 'Ver detalles',
    dismissible: true,
    is_read: false,
    is_dismissed: false,
    created_at: new Date().toISOString(),
  };
}

// ======================
// ALERT AGGREGATION
// ======================

/**
 * Generate all security alerts for a tenant's API keys
 */
export function generateAllAlerts(
  keys: APIKeyListItem[],
  tenantId: string
): SecurityAlert[] {
  const alerts: SecurityAlert[] = [];

  // Expiration alerts
  alerts.push(...generateExpirationAlerts(keys, tenantId));

  // Inactive key alerts
  alerts.push(...generateInactiveKeyAlerts(keys, tenantId));

  // Rotation recommendation alerts
  alerts.push(...generateRotationAlerts(keys, tenantId));

  // Sort by priority (critical first)
  const priorityOrder: Record<AlertPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return alerts;
}

/**
 * Filter out dismissed alerts
 */
export function filterDismissedAlerts(
  alerts: SecurityAlert[],
  dismissedIds: string[]
): SecurityAlert[] {
  return alerts.filter((alert) => !dismissedIds.includes(alert.id) && !alert.is_dismissed);
}

/**
 * Count alerts by priority
 */
export function countAlertsByPriority(
  alerts: SecurityAlert[]
): Record<AlertPriority, number> {
  return alerts.reduce(
    (counts, alert) => {
      counts[alert.priority]++;
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

/**
 * Get the highest priority alert level
 */
export function getHighestAlertPriority(
  alerts: SecurityAlert[]
): AlertPriority | null {
  if (alerts.length === 0) return null;

  const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low'];

  for (const priority of priorities) {
    if (alerts.some((alert) => alert.priority === priority)) {
      return priority;
    }
  }

  return null;
}

// ======================
// CLIENT API
// ======================

/**
 * Fetch security alerts for the current tenant (client-side)
 */
export async function fetchSecurityAlerts(): Promise<SecurityAlert[]> {
  const response = await fetch('/api/settings/api-keys/alerts');

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error fetching security alerts');
  }

  const data = await response.json();
  return data.alerts;
}

/**
 * Dismiss a security alert (client-side)
 */
export async function dismissSecurityAlert(alertId: string): Promise<void> {
  const response = await fetch(`/api/settings/api-keys/alerts/${alertId}/dismiss`, {
    method: 'POST',
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error dismissing alert');
  }
}

/**
 * Mark an alert as read (client-side)
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  const response = await fetch(`/api/settings/api-keys/alerts/${alertId}/read`, {
    method: 'POST',
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error marking alert as read');
  }
}
