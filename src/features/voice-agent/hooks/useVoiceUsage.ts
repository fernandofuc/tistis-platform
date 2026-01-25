'use client';

// =====================================================
// TIS TIS PLATFORM - useVoiceUsage Hook
// Hook para datos de uso de minutos del agente de voz
// Sistema: Voice Minute Limits (FASE 4.5)
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MinuteUsageSummary,
  VoiceMinuteTransaction,
  VoiceMinuteLimits,
  OveragePolicy,
} from '../types';

// =====================================================
// TYPES
// =====================================================

interface FormattedTransaction extends VoiceMinuteTransaction {
  formatted: {
    minutes: string;
    charge: string | null;
    date: string;
    type: string;
  };
}

interface UsageHistoryPagination {
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface UseVoiceUsageOptions {
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
  /** Page size for history */
  pageSize?: number;
  /** Enable/disable auto-fetch on mount */
  autoFetch?: boolean;
}

interface UseVoiceUsageReturn {
  // Usage summary
  usage: MinuteUsageSummary | null;
  limits: VoiceMinuteLimits | null;
  isLoadingUsage: boolean;
  usageError: string | null;
  refetchUsage: () => Promise<void>;

  // Usage history
  history: FormattedTransaction[];
  isLoadingHistory: boolean;
  historyError: string | null;
  pagination: UsageHistoryPagination;
  fetchHistory: (offset?: number) => Promise<void>;
  nextPage: () => void;
  prevPage: () => void;

  // Policy management
  updatePolicy: (policy: OveragePolicy) => Promise<boolean>;
  isUpdatingPolicy: boolean;
  policyError: string | null;

  // Formatted values for UI
  formatted: {
    used: string;
    remaining: string;
    percent: string;
    overageCharges: string;
    resetDate: string;
  } | null;
}

// =====================================================
// HELPERS
// =====================================================

function formatMinutes(minutes: number): string {
  // Handle negative values
  if (minutes <= 0) {
    return '0 min';
  }
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatCurrency(centavos: number): string {
  const pesos = centavos / 100;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(pesos);
}

// =====================================================
// HOOK
// =====================================================

export function useVoiceUsage(options: UseVoiceUsageOptions = {}): UseVoiceUsageReturn {
  const {
    refreshInterval = 0,
    pageSize = 20,
    autoFetch = true,
  } = options;

  // Usage summary state
  const [usage, setUsage] = useState<MinuteUsageSummary | null>(null);
  const [limits, setLimits] = useState<VoiceMinuteLimits | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<FormattedTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<UsageHistoryPagination>({
    limit: pageSize,
    offset: 0,
    hasMore: false,
  });

  // Policy update state
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  // Track if mounted for cleanup
  const isMountedRef = useRef(true);

  // =====================================================
  // FETCH USAGE SUMMARY
  // =====================================================

  const fetchUsage = useCallback(async () => {
    try {
      setUsageError(null);

      const response = await fetch('/api/voice-agent/usage');
      const data = await response.json();

      if (!isMountedRef.current) return;

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar datos de uso');
      }

      if (data.success) {
        setUsage(data.usage);
        setLimits(data.limits);
      } else {
        throw new Error(data.error || 'Error al cargar datos de uso');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setUsageError(message);
      console.error('[useVoiceUsage] Error fetching usage:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingUsage(false);
      }
    }
  }, []);

  // =====================================================
  // FETCH USAGE HISTORY
  // =====================================================

  const fetchHistory = useCallback(async (offset: number = 0) => {
    try {
      setIsLoadingHistory(true);
      setHistoryError(null);

      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/voice-agent/usage-history?${params}`);
      const data = await response.json();

      if (!isMountedRef.current) return;

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar historial');
      }

      if (data.success) {
        setHistory(data.transactions || []);
        setPagination({
          limit: data.pagination?.limit || pageSize,
          offset: data.pagination?.offset || offset,
          hasMore: data.pagination?.hasMore || false,
        });
      } else {
        throw new Error(data.error || 'Error al cargar historial');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setHistoryError(message);
      console.error('[useVoiceUsage] Error fetching history:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingHistory(false);
      }
    }
  }, [pageSize]);

  // Pagination helpers
  const nextPage = useCallback(() => {
    if (pagination.hasMore) {
      fetchHistory(pagination.offset + pagination.limit);
    }
  }, [pagination, fetchHistory]);

  const prevPage = useCallback(() => {
    if (pagination.offset > 0) {
      fetchHistory(Math.max(0, pagination.offset - pagination.limit));
    }
  }, [pagination, fetchHistory]);

  // =====================================================
  // UPDATE OVERAGE POLICY
  // =====================================================

  const updatePolicy = useCallback(async (policy: OveragePolicy): Promise<boolean> => {
    try {
      setIsUpdatingPolicy(true);
      setPolicyError(null);

      const response = await fetch('/api/voice-agent/overage-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overage_policy: policy }),
      });

      const data = await response.json();

      if (!isMountedRef.current) return false;

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar política');
      }

      // Refresh usage to get updated policy
      await fetchUsage();

      return true;
    } catch (err) {
      if (!isMountedRef.current) return false;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setPolicyError(message);
      console.error('[useVoiceUsage] Error updating policy:', err);
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsUpdatingPolicy(false);
      }
    }
  }, [fetchUsage]);

  // =====================================================
  // EFFECTS
  // =====================================================

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;

    if (autoFetch) {
      fetchUsage();
    } else {
      setIsLoadingUsage(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchUsage, autoFetch]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0 || !autoFetch) return;

    const interval = setInterval(fetchUsage, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchUsage, autoFetch]);

  // =====================================================
  // FORMATTED VALUES
  // =====================================================

  const formatted = usage ? {
    used: formatMinutes(usage.total_minutes_used),
    remaining: formatMinutes(Math.max(0, usage.remaining_included)),
    percent: `${Math.max(0, usage.usage_percent).toFixed(1)}%`,
    overageCharges: formatCurrency(usage.overage_charges_centavos),
    resetDate: (() => {
      try {
        const date = new Date(usage.billing_period_end);
        if (isNaN(date.getTime())) return 'Fecha no disponible';
        return date.toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'long',
        });
      } catch {
        return 'Fecha no disponible';
      }
    })(),
  } : null;

  // =====================================================
  // RETURN
  // =====================================================

  return {
    // Usage summary
    usage,
    limits,
    isLoadingUsage,
    usageError,
    refetchUsage: fetchUsage,

    // Usage history
    history,
    isLoadingHistory,
    historyError,
    pagination,
    fetchHistory,
    nextPage,
    prevPage,

    // Policy management
    updatePolicy,
    isUpdatingPolicy,
    policyError,

    // Formatted values
    formatted,
  };
}

export default useVoiceUsage;
