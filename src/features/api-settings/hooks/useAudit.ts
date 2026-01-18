// =====================================================
// TIS TIS PLATFORM - Audit Hooks
// React hooks for audit log management
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  AuditLogListItem,
  AuditLogFilters,
  AuditStatistics,
  SecurityAlert,
  AlertPriority,
} from '../types';
import {
  fetchAuditLogs,
  fetchAuditStatistics,
  fetchKeyAuditLogs,
} from '../services/auditLog.service';
import {
  fetchSecurityAlerts,
  dismissSecurityAlert,
  markAlertAsRead,
  countAlertsByPriority,
  getHighestAlertPriority,
} from '../utils/securityAlerts';

// ======================
// AUDIT LOG HOOK
// ======================

export interface UseAuditLogsReturn {
  logs: AuditLogListItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setFilters: (filters: AuditLogFilters) => void;
  filters: AuditLogFilters;
}

export function useAuditLogs(
  initialFilters: AuditLogFilters = {}
): UseAuditLogsReturn {
  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>(initialFilters);
  const [offset, setOffset] = useState(0);

  const limit = filters.limit || 50;

  // Fetch logs
  const fetchLogs = useCallback(async (reset: boolean = true) => {
    try {
      setLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;

      const response = await fetchAuditLogs({
        ...filters,
        limit,
        offset: currentOffset,
      });

      if (reset) {
        setLogs(response.logs);
        setOffset(limit);
      } else {
        setLogs((prev) => [...prev, ...response.logs]);
        setOffset((prev) => prev + limit);
      }

      setHasMore(response.has_more);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar logs');
    } finally {
      setLoading(false);
    }
  }, [filters, limit, offset]);

  // Initial fetch and refetch when filters change
  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Refresh
  const refresh = useCallback(async () => {
    await fetchLogs(true);
  }, [fetchLogs]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchLogs(false);
  }, [fetchLogs, hasMore, loading]);

  return {
    logs,
    loading,
    error,
    hasMore,
    total,
    refresh,
    loadMore,
    setFilters,
    filters,
  };
}

// ======================
// KEY AUDIT LOG HOOK
// ======================

export interface UseKeyAuditLogsReturn {
  logs: AuditLogListItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useKeyAuditLogs(
  keyId: string | null,
  limit: number = 20
): UseKeyAuditLogsReturn {
  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!keyId) {
      setLogs([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchKeyAuditLogs(keyId, limit);
      setLogs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar logs');
    } finally {
      setLoading(false);
    }
  }, [keyId, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    refresh: fetchLogs,
  };
}

// ======================
// AUDIT STATISTICS HOOK
// ======================

export interface UseAuditStatisticsReturn {
  statistics: AuditStatistics | null;
  loading: boolean;
  error: string | null;
  refresh: (period?: 'last_7_days' | 'last_30_days' | 'last_90_days') => Promise<void>;
}

export function useAuditStatistics(
  initialPeriod: 'last_7_days' | 'last_30_days' | 'last_90_days' = 'last_30_days'
): UseAuditStatisticsReturn {
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(initialPeriod);

  const fetchStats = useCallback(async (
    newPeriod?: 'last_7_days' | 'last_30_days' | 'last_90_days'
  ) => {
    try {
      setLoading(true);
      setError(null);
      const targetPeriod = newPeriod || period;
      if (newPeriod) setPeriod(newPeriod);

      const result = await fetchAuditStatistics(targetPeriod);
      setStatistics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    statistics,
    loading,
    error,
    refresh: fetchStats,
  };
}

// ======================
// SECURITY ALERTS HOOK
// ======================

export interface UseSecurityAlertsReturn {
  alerts: SecurityAlert[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  dismiss: (alertId: string) => Promise<void>;
  markAsRead: (alertId: string) => Promise<void>;
  alertCounts: Record<AlertPriority, number>;
  highestPriority: AlertPriority | null;
  hasUrgentAlerts: boolean;
}

export function useSecurityAlerts(): UseSecurityAlertsReturn {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchSecurityAlerts();
      setAlerts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Dismiss alert
  const dismiss = useCallback(async (alertId: string) => {
    try {
      await dismissSecurityAlert(alertId);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, is_dismissed: true } : a
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descartar alerta');
    }
  }, []);

  // Mark as read
  const markAsReadHandler = useCallback(async (alertId: string) => {
    try {
      await markAlertAsRead(alertId);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, is_read: true } : a
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al marcar como leída');
    }
  }, []);

  // Computed values
  const activeAlerts = useMemo(
    () => alerts.filter((a) => !a.is_dismissed),
    [alerts]
  );

  const alertCounts = useMemo(
    () => countAlertsByPriority(activeAlerts),
    [activeAlerts]
  );

  const highestPriority = useMemo(
    () => getHighestAlertPriority(activeAlerts),
    [activeAlerts]
  );

  const hasUrgentAlerts = useMemo(
    () => alertCounts.critical > 0 || alertCounts.high > 0,
    [alertCounts]
  );

  return {
    alerts: activeAlerts,
    loading,
    error,
    refresh: fetchAlerts,
    dismiss,
    markAsRead: markAsReadHandler,
    alertCounts,
    highestPriority,
    hasUrgentAlerts,
  };
}
