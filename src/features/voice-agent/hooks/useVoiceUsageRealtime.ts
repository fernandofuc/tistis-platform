'use client';

// =====================================================
// TIS TIS PLATFORM - useVoiceUsageRealtime Hook
// Hook con Supabase Real-time para Voice Minute Usage
// Sistema: Voice Minute Limits (FASE 9 - Real-time Dashboard)
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  MinuteUsageSummary,
  VoiceMinuteLimits,
  OveragePolicy,
} from '../types';

// =====================================================
// TYPES
// =====================================================

interface RealtimeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  timestamp: Date;
  data?: unknown;
}

interface UseVoiceUsageRealtimeOptions {
  /** Enable real-time subscriptions (default: true) */
  enableRealtime?: boolean;
  /** Debounce delay for real-time updates in ms (default: 500) */
  debounceMs?: number;
  /** Called when real-time event is received */
  onRealtimeEvent?: (event: RealtimeEvent) => void;
  /** Called when usage threshold is exceeded */
  onThresholdExceeded?: (threshold: number, usage: MinuteUsageSummary) => void;
  /** Thresholds to monitor (default: [70, 85, 95, 100]) */
  alertThresholds?: number[];
}

interface UseVoiceUsageRealtimeReturn {
  // Usage data
  usage: MinuteUsageSummary | null;
  limits: VoiceMinuteLimits | null;
  isLoading: boolean;
  error: string | null;

  // Real-time status
  isConnected: boolean;
  lastUpdate: Date | null;
  realtimeEvents: RealtimeEvent[];

  // Actions
  refetch: () => Promise<void>;
  updatePolicy: (policy: OveragePolicy) => Promise<boolean>;
  isUpdatingPolicy: boolean;

  // Formatted values
  formatted: {
    used: string;
    remaining: string;
    percent: string;
    overageCharges: string;
    status: 'normal' | 'caution' | 'warning' | 'critical';
    statusMessage: string;
  } | null;
}

// =====================================================
// CONSTANTS
// =====================================================

const DEFAULT_THRESHOLDS = [70, 85, 95, 100];

// =====================================================
// HELPERS
// =====================================================

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min';
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
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

function getUsageStatus(percent: number): {
  status: 'normal' | 'caution' | 'warning' | 'critical';
  statusMessage: string;
} {
  if (percent >= 100) {
    return { status: 'critical', statusMessage: 'Límite alcanzado' };
  }
  if (percent >= 85) {
    return { status: 'warning', statusMessage: 'Próximo al límite' };
  }
  if (percent >= 70) {
    return { status: 'caution', statusMessage: 'Uso moderado' };
  }
  return { status: 'normal', statusMessage: 'Uso normal' };
}

function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// =====================================================
// HOOK
// =====================================================

export function useVoiceUsageRealtime(
  options: UseVoiceUsageRealtimeOptions = {}
): UseVoiceUsageRealtimeReturn {
  const {
    enableRealtime = true,
    debounceMs = 500,
    onRealtimeEvent,
    onThresholdExceeded,
    alertThresholds = DEFAULT_THRESHOLDS,
  } = options;

  // State
  const [usage, setUsage] = useState<MinuteUsageSummary | null>(null);
  const [limits, setLimits] = useState<VoiceMinuteLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);

  // Refs
  const isMountedRef = useRef(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastThresholdRef = useRef<number>(0);
  const supabaseRef = useRef(createSupabaseClient());

  // =====================================================
  // FETCH USAGE
  // =====================================================

  const fetchUsage = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/voice-agent/usage');
      const data = await response.json();

      if (!isMountedRef.current) return;

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar datos de uso');
      }

      if (data.success) {
        const newUsage = data.usage as MinuteUsageSummary;
        setUsage(newUsage);
        setLimits(data.limits);
        setLastUpdate(new Date());

        // Check thresholds
        if (onThresholdExceeded && newUsage) {
          const currentThreshold = alertThresholds.find(
            (t) => newUsage.usage_percent >= t && lastThresholdRef.current < t
          );
          if (currentThreshold) {
            lastThresholdRef.current = currentThreshold;
            onThresholdExceeded(currentThreshold, newUsage);
          }
        }
      } else {
        throw new Error(data.error || 'Error al cargar datos de uso');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      console.error('[useVoiceUsageRealtime] Error fetching usage:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [onThresholdExceeded, alertThresholds]);

  // =====================================================
  // DEBOUNCED REFETCH
  // =====================================================

  const debouncedRefetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchUsage();
    }, debounceMs);
  }, [fetchUsage, debounceMs]);

  // =====================================================
  // UPDATE POLICY
  // =====================================================

  const updatePolicy = useCallback(async (policy: OveragePolicy): Promise<boolean> => {
    try {
      setIsUpdatingPolicy(true);
      setError(null);

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

      // Refresh usage
      await fetchUsage();
      return true;
    } catch (err) {
      if (!isMountedRef.current) return false;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      console.error('[useVoiceUsageRealtime] Error updating policy:', err);
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsUpdatingPolicy(false);
      }
    }
  }, [fetchUsage]);

  // =====================================================
  // REAL-TIME SUBSCRIPTION
  // =====================================================

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    fetchUsage();

    // Set up real-time subscription if enabled
    if (!enableRealtime) return;

    const supabase = supabaseRef.current;

    // Subscribe to voice_minute_usage_periods changes
    // This includes updates to included_used_minutes, overage_used_minutes, etc.
    const channel = supabase
      .channel('voice-usage-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_minute_usage_periods',
        },
        (payload) => {
          if (!isMountedRef.current) return;

          console.log('[useVoiceUsageRealtime] Usage period change:', payload.eventType);

          const event: RealtimeEvent = {
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'voice_minute_usage_periods',
            timestamp: new Date(),
            data: payload.new || payload.old,
          };

          setRealtimeEvents((prev) => [...prev.slice(-9), event]);
          onRealtimeEvent?.(event);
          debouncedRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_call_records',
        },
        (payload) => {
          if (!isMountedRef.current) return;

          console.log('[useVoiceUsageRealtime] New call record:', payload.new);

          const event: RealtimeEvent = {
            type: 'INSERT',
            table: 'voice_call_records',
            timestamp: new Date(),
            data: payload.new,
          };

          setRealtimeEvents((prev) => [...prev.slice(-9), event]);
          onRealtimeEvent?.(event);
          debouncedRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_minute_limits',
        },
        (payload) => {
          if (!isMountedRef.current) return;

          console.log('[useVoiceUsageRealtime] Limits change:', payload.eventType);

          const event: RealtimeEvent = {
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'voice_minute_limits',
            timestamp: new Date(),
            data: payload.new || payload.old,
          };

          setRealtimeEvents((prev) => [...prev.slice(-9), event]);
          onRealtimeEvent?.(event);
          debouncedRefetch();
        }
      )
      .subscribe((status) => {
        if (!isMountedRef.current) return;
        setIsConnected(status === 'SUBSCRIBED');
        console.log('[useVoiceUsageRealtime] Subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      isMountedRef.current = false;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchUsage, enableRealtime, debouncedRefetch, onRealtimeEvent]);

  // =====================================================
  // FORMATTED VALUES
  // =====================================================

  const formatted = usage
    ? {
        used: formatMinutes(usage.total_minutes_used),
        remaining: formatMinutes(Math.max(0, usage.remaining_included)),
        percent: `${Math.max(0, usage.usage_percent).toFixed(1)}%`,
        overageCharges: formatCurrency(usage.overage_charges_centavos),
        ...getUsageStatus(usage.usage_percent),
      }
    : null;

  // =====================================================
  // RETURN
  // =====================================================

  return {
    usage,
    limits,
    isLoading,
    error,
    isConnected,
    lastUpdate,
    realtimeEvents,
    refetch: fetchUsage,
    updatePolicy,
    isUpdatingPolicy,
    formatted,
  };
}

export default useVoiceUsageRealtime;
