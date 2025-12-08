// =====================================================
// TIS TIS PLATFORM - Realtime Subscription Hook
// =====================================================

import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, ESVA_TENANT_ID } from '@/src/shared/lib/supabase';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscriptionConfig {
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  filter?: string;
}

interface RealtimePayload<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
}

interface UseRealtimeSubscriptionOptions<T extends Record<string, unknown>> {
  config: SubscriptionConfig;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: { old: T; new: T }) => void;
  onDelete?: (payload: T) => void;
  onChange?: (payload: RealtimePayload<T>) => void;
  enabled?: boolean;
}

export function useRealtimeSubscription<T extends Record<string, unknown>>({
  config,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseRealtimeSubscriptionOptions<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const setupSubscription = useCallback(() => {
    if (!enabled) return;

    const channelName = `realtime:${config.table}:${Date.now()}`;

    // Build filter with tenant_id
    const filter = config.filter
      ? `${config.filter},tenant_id=eq.${ESVA_TENANT_ID}`
      : `tenant_id=eq.${ESVA_TENANT_ID}`;

    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes' as never,
      {
        event: config.event || '*',
        schema: config.schema || 'public',
        table: config.table,
        filter,
      } as never,
      (payload: RealtimePayload<T>) => {
        console.log(`[Realtime] ${config.table}:`, payload.eventType);

        // Call general onChange handler
        onChange?.(payload);

        // Call specific event handlers
        switch (payload.eventType) {
          case 'INSERT':
            onInsert?.(payload.new as T);
            break;
          case 'UPDATE':
            onUpdate?.({
              old: payload.old as T,
              new: payload.new as T,
            });
            break;
          case 'DELETE':
            onDelete?.(payload.old as T);
            break;
        }
      }
    );

    channel.subscribe((status) => {
      console.log(`[Realtime] ${config.table} subscription:`, status);
    });

    channelRef.current = channel;
  }, [config, onInsert, onUpdate, onDelete, onChange, enabled]);

  useEffect(() => {
    setupSubscription();

    return () => {
      if (channelRef.current) {
        console.log(`[Realtime] Unsubscribing from ${config.table}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setupSubscription, config.table]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  return { unsubscribe };
}

// ======================
// Pre-configured subscription hooks
// ======================

export function useLeadsRealtime(handlers: {
  onInsert?: (lead: Record<string, unknown>) => void;
  onUpdate?: (data: { old: Record<string, unknown>; new: Record<string, unknown> }) => void;
  onDelete?: (lead: Record<string, unknown>) => void;
}) {
  return useRealtimeSubscription({
    config: { table: 'leads' },
    ...handlers,
  });
}

export function useAppointmentsRealtime(handlers: {
  onInsert?: (appointment: Record<string, unknown>) => void;
  onUpdate?: (data: { old: Record<string, unknown>; new: Record<string, unknown> }) => void;
  onDelete?: (appointment: Record<string, unknown>) => void;
}) {
  return useRealtimeSubscription({
    config: { table: 'appointments' },
    ...handlers,
  });
}

export function useConversationsRealtime(handlers: {
  onInsert?: (conversation: Record<string, unknown>) => void;
  onUpdate?: (data: { old: Record<string, unknown>; new: Record<string, unknown> }) => void;
}) {
  return useRealtimeSubscription({
    config: { table: 'conversations' },
    ...handlers,
  });
}

export function useMessagesRealtime(
  conversationId: string,
  handlers: {
    onInsert?: (message: Record<string, unknown>) => void;
  }
) {
  return useRealtimeSubscription({
    config: {
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    ...handlers,
    enabled: !!conversationId,
  });
}
