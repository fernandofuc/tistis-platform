// =====================================================
// TIS TIS PLATFORM - Realtime Dashboard Hook
// Unified realtime updates for dashboard components
// =====================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, ESVA_TENANT_ID } from '@/src/shared/lib/supabase';
import { useAppStore } from '@/src/shared/stores/appStore';

interface DashboardRealtimeState {
  newLeadsCount: number;
  newMessagesCount: number;
  updatedAppointments: string[];
  escalatedConversations: string[];
}

interface UseRealtimeDashboardOptions {
  onNewLead?: (lead: Record<string, unknown>) => void;
  onNewMessage?: (message: Record<string, unknown>) => void;
  onAppointmentUpdate?: (appointment: Record<string, unknown>) => void;
  onEscalation?: (conversation: Record<string, unknown>) => void;
}

export function useRealtimeDashboard(options: UseRealtimeDashboardOptions = {}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { addToast } = useAppStore();

  const [state, setState] = useState<DashboardRealtimeState>({
    newLeadsCount: 0,
    newMessagesCount: 0,
    updatedAppointments: [],
    escalatedConversations: [],
  });

  const resetCounters = useCallback(() => {
    setState({
      newLeadsCount: 0,
      newMessagesCount: 0,
      updatedAppointments: [],
      escalatedConversations: [],
    });
  }, []);

  useEffect(() => {
    const channelName = `dashboard:${ESVA_TENANT_ID}:${Date.now()}`;

    channelRef.current = supabase.channel(channelName);

    // Subscribe to leads
    channelRef.current.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
        filter: `tenant_id=eq.${ESVA_TENANT_ID}`,
      },
      (payload) => {
        console.log('[Dashboard Realtime] New lead:', payload.new);

        setState((prev) => ({
          ...prev,
          newLeadsCount: prev.newLeadsCount + 1,
        }));

        options.onNewLead?.(payload.new as Record<string, unknown>);

        // Show toast notification
        addToast({
          type: 'info',
          title: 'Nuevo Lead',
          message: `${(payload.new as Record<string, unknown>).name || 'Lead'} agregado`,
        });
      }
    );

    // Subscribe to messages
    channelRef.current.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const message = payload.new as Record<string, unknown>;

        // Only notify for incoming messages (from leads)
        if (message.sender_type === 'lead') {
          console.log('[Dashboard Realtime] New message:', message);

          setState((prev) => ({
            ...prev,
            newMessagesCount: prev.newMessagesCount + 1,
          }));

          options.onNewMessage?.(message);

          addToast({
            type: 'info',
            title: 'Nuevo Mensaje',
            message: 'Tienes un nuevo mensaje de WhatsApp',
          });
        }
      }
    );

    // Subscribe to appointments updates
    channelRef.current.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'appointments',
        filter: `tenant_id=eq.${ESVA_TENANT_ID}`,
      },
      (payload) => {
        const appointment = payload.new as Record<string, unknown>;
        console.log('[Dashboard Realtime] Appointment updated:', appointment);

        setState((prev) => ({
          ...prev,
          updatedAppointments: [...prev.updatedAppointments, appointment.id as string],
        }));

        options.onAppointmentUpdate?.(appointment);

        // Notify on status changes
        if (payload.old && (payload.old as Record<string, unknown>).status !== appointment.status) {
          addToast({
            type: appointment.status === 'cancelled' ? 'warning' : 'success',
            title: 'Cita Actualizada',
            message: `Estado cambiado a ${appointment.status}`,
          });
        }
      }
    );

    // Subscribe to conversation escalations
    channelRef.current.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `tenant_id=eq.${ESVA_TENANT_ID}`,
      },
      (payload) => {
        const conversation = payload.new as Record<string, unknown>;
        const oldConversation = payload.old as Record<string, unknown>;

        // Check if this is an escalation
        if (oldConversation.status !== 'escalated' && conversation.status === 'escalated') {
          console.log('[Dashboard Realtime] Conversation escalated:', conversation);

          setState((prev) => ({
            ...prev,
            escalatedConversations: [...prev.escalatedConversations, conversation.id as string],
          }));

          options.onEscalation?.(conversation);

          addToast({
            type: 'warning',
            title: 'Conversación Escalada',
            message: 'Una conversación requiere atención humana',
          });
        }
      }
    );

    // Subscribe to channel
    channelRef.current.subscribe((status) => {
      console.log('[Dashboard Realtime] Subscription status:', status);
    });

    return () => {
      if (channelRef.current) {
        console.log('[Dashboard Realtime] Cleaning up subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [options, addToast]);

  return {
    ...state,
    resetCounters,
  };
}

// ======================
// Hook for individual conversation realtime
// ======================
export function useConversationRealtime(
  conversationId: string | null,
  onNewMessage?: (message: Record<string, unknown>) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const channelName = `conversation:${conversationId}:${Date.now()}`;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[Conversation Realtime] New message:', payload.new);
          onNewMessage?.(payload.new as Record<string, unknown>);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, onNewMessage]);
}

// ======================
// Hook for calendar realtime updates
// ======================
export function useCalendarRealtime(
  branchId: string | null,
  onAppointmentChange?: () => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const filter = branchId
      ? `tenant_id=eq.${ESVA_TENANT_ID},branch_id=eq.${branchId}`
      : `tenant_id=eq.${ESVA_TENANT_ID}`;

    const channelName = `calendar:${branchId || 'all'}:${Date.now()}`;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter,
        },
        (payload) => {
          console.log('[Calendar Realtime] Appointment changed:', payload.eventType);
          onAppointmentChange?.();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [branchId, onAppointmentChange]);
}
