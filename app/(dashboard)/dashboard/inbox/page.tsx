// =====================================================
// TIS TIS PLATFORM - Inbox Page
// Premium Design with Apple/Lovable aesthetic
// =====================================================

'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Avatar, SearchInput } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { useBranch } from '@/src/shared/stores';
import { formatRelativeTime, cn } from '@/src/shared/utils';
import { ChannelIcon, ChannelBadge } from '@/src/shared/components/ChannelBadge';
import type { Conversation, Message, Lead } from '@/src/shared/types';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ======================
// ICONS - Refined SVG icons
// ======================
const icons = {
  whatsapp: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  send: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  ai: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  user: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  inbox: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  chat: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
};

// ======================
// EXTENDED TYPES
// ======================
interface ConversationWithLead extends Conversation {
  leads?: Lead;
  messages?: Message[];
}

// ======================
// FILTER TABS CONFIG
// ======================
const FILTER_TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Activas' },
  { key: 'escalated', label: 'Escaladas' },
] as const;

// Channel filter options
const CHANNEL_FILTERS = [
  { key: 'all', label: 'Todos', icon: null },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
  { key: 'instagram', label: 'Instagram', icon: 'instagram' },
  { key: 'facebook', label: 'Facebook', icon: 'facebook' },
  { key: 'tiktok', label: 'TikTok', icon: 'tiktok' },
  { key: 'webchat', label: 'Web', icon: 'webchat' },
] as const;

type ChannelFilterType = typeof CHANNEL_FILTERS[number]['key'];

// ======================
// COMPONENT
// ======================
export default function InboxPage() {
  const { tenant } = useAuthContext();
  const { selectedBranchId, selectedBranch } = useBranch();
  const [conversations, setConversations] = useState<ConversationWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithLead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'escalated'>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilterType>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Send message function
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || sending) return;

    const content = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          content,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[Inbox] Failed to send message:', result.error);
        setMessageText(content); // Restore message on error
        return;
      }

      // Add message to local state immediately
      const newMessage: Message = {
        id: result.message_id,
        conversation_id: selectedConversation.id,
        role: 'assistant', // Staff messages appear as assistant role
        content,
        channel_message_id: null,
        metadata: { sent_by: 'staff' },
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);

      console.log('[Inbox] Message sent:', result.message_id);
    } catch (error) {
      console.error('[Inbox] Error sending message:', error);
      setMessageText(content); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch conversations
  useEffect(() => {
    async function fetchConversations() {
      if (!tenant?.id) {
        console.log('[Inbox] Waiting for tenant...');
        return;
      }

      console.log('[Inbox] Fetching conversations for tenant:', tenant.id);

      try {
        let query = supabase
          .from('conversations')
          .select('*, leads(id, full_name, first_name, last_name, phone, classification, score)')
          .eq('tenant_id', tenant.id)
          .in('status', ['active', 'waiting_response', 'escalated']);

        if (selectedBranchId) {
          query = query.eq('branch_id', selectedBranchId);
        }

        const { data, error } = await query.order('last_message_at', { ascending: false });

        if (error) throw error;
        console.log('[Inbox] Fetched', data?.length, 'conversations');
        setConversations(data as ConversationWithLead[]);

        if (data && data.length > 0) {
          setSelectedConversation((prev) => prev || (data[0] as ConversationWithLead));
        }
      } catch (error) {
        console.error('[Inbox] Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchConversations();
  }, [tenant?.id, selectedBranchId]);

  const selectedConversationId = selectedConversation?.id;

  // REVISIÓN 5.4.1: Message pagination limit to prevent memory issues
  const MESSAGE_FETCH_LIMIT = 100;

  // Fetch messages when conversation is selected
  useEffect(() => {
    async function fetchMessages() {
      if (!selectedConversationId) return;

      try {
        // REVISIÓN 5.4.1: Fetch only last 100 messages to prevent unbounded memory growth
        // For older messages, implement "load more" functionality if needed
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', selectedConversationId)
          .order('created_at', { ascending: false })
          .limit(MESSAGE_FETCH_LIMIT);

        if (error) throw error;
        // Reverse to get chronological order (oldest first for display)
        setMessages((data as Message[]).reverse());
      } catch (error) {
        console.error('[Inbox] Error fetching messages:', error);
      }
    }

    fetchMessages();
  }, [selectedConversationId]);

  // ======================
  // REVISIÓN 5.4 G-I9: REALTIME SUBSCRIPTIONS
  // ======================
  // Escucha cambios en tiempo real para actualizar el inbox sin refresh manual

  // Callback para refetch de conversaciones (estable para evitar re-renders)
  const refetchConversations = useCallback(async () => {
    if (!tenant?.id) return;

    try {
      let query = supabase
        .from('conversations')
        .select('*, leads(id, full_name, first_name, last_name, phone, classification, score)')
        .eq('tenant_id', tenant.id)
        .in('status', ['active', 'waiting_response', 'escalated']);

      if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      const { data, error } = await query.order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data as ConversationWithLead[]);
    } catch (error) {
      console.error('[Inbox Realtime] Error refetching conversations:', error);
    }
  }, [tenant?.id, selectedBranchId]);

  // Realtime: Nuevos mensajes en la conversación seleccionada
  useEffect(() => {
    if (!selectedConversationId) return;

    let messagesChannel: RealtimeChannel | null = null;

    const setupMessagesSubscription = () => {
      messagesChannel = supabase
        .channel(`inbox-messages-${selectedConversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversationId}`,
          },
          (payload: RealtimePostgresChangesPayload<Message>) => {
            const newMessage = payload.new as Message;

            // Evitar duplicados (puede pasar con optimistic updates)
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === newMessage.id);
              if (exists) return prev;

              console.log('[Inbox Realtime] New message received:', newMessage.id);
              return [...prev, newMessage];
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Inbox Realtime] Messages channel subscribed for conversation:', selectedConversationId);
          }
        });
    };

    setupMessagesSubscription();

    return () => {
      if (messagesChannel) {
        console.log('[Inbox Realtime] Unsubscribing from messages channel');
        // REVISIÓN 5.4.1: Proper cleanup - unsubscribe before removeChannel to prevent memory leak
        messagesChannel.unsubscribe().then(() => {
          supabase.removeChannel(messagesChannel!);
        });
      }
    };
  }, [selectedConversationId]);

  // Realtime: Cambios en conversaciones del tenant
  useEffect(() => {
    if (!tenant?.id) return;

    let conversationsChannel: RealtimeChannel | null = null;

    const setupConversationsSubscription = () => {
      conversationsChannel = supabase
        .channel(`inbox-conversations-${tenant.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'conversations',
            filter: `tenant_id=eq.${tenant.id}`,
          },
          (payload: RealtimePostgresChangesPayload<Conversation>) => {
            console.log('[Inbox Realtime] Conversation change:', payload.eventType, payload.new);

            // Refetch completo para asegurar datos consistentes con joins
            refetchConversations();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Inbox Realtime] Conversations channel subscribed for tenant:', tenant.id);
          }
        });
    };

    setupConversationsSubscription();

    return () => {
      if (conversationsChannel) {
        console.log('[Inbox Realtime] Unsubscribing from conversations channel');
        // REVISIÓN 5.4.1: Proper cleanup - unsubscribe before removeChannel to prevent memory leak
        conversationsChannel.unsubscribe().then(() => {
          supabase.removeChannel(conversationsChannel!);
        });
      }
    };
  }, [tenant?.id, refetchConversations]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      // Status filter
      if (filter === 'active' && conv.status === 'escalated') return false;
      if (filter === 'escalated' && conv.status !== 'escalated') return false;

      // Channel filter
      if (channelFilter !== 'all' && conv.channel !== channelFilter) return false;

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const leadName = conv.leads?.full_name?.toLowerCase() || '';
        const leadPhone = conv.leads?.phone || '';
        return leadName.includes(searchLower) || leadPhone.includes(search);
      }

      return true;
    });
  }, [conversations, filter, channelFilter, search]);

  // Counts for tabs
  const counts = useMemo(() => ({
    all: conversations.length,
    active: conversations.filter((c) => c.status !== 'escalated').length,
    escalated: conversations.filter((c) => c.status === 'escalated').length,
  }), [conversations]);

  // Counts by channel
  const channelCounts = useMemo(() => {
    const result: Record<string, number> = { all: conversations.length };
    conversations.forEach((c) => {
      if (c.channel) {
        result[c.channel] = (result[c.channel] || 0) + 1;
      }
    });
    return result;
  }, [conversations]);

  // Get classification emoji
  const getClassificationEmoji = (classification?: string) => {
    switch (classification) {
      case 'hot': return '🔥';
      case 'warm': return '🌡️';
      case 'cold': return '❄️';
      default: return null;
    }
  };

  return (
    <PageWrapper
      title="Inbox"
      subtitle={selectedBranch
        ? `${conversations.length} conversaciones en ${selectedBranch.name}`
        : `${conversations.length} conversaciones activas`
      }
    >
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-10rem)] lg:h-[calc(100vh-12rem)]">
        {/* ============================================ */}
        {/* LEFT PANEL: Conversations List */}
        {/* ============================================ */}
        <div className={cn(
          "bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden",
          "w-full lg:w-[380px] lg:flex-shrink-0",
          selectedConversation ? "hidden lg:flex" : "flex"
        )}>
          {/* Search & Filters Header */}
          <div className="p-3 sm:p-4 border-b border-slate-100">
            <SearchInput
              placeholder="Buscar conversación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              className="mb-3 sm:mb-4"
            />

            {/* Filter Tabs - TIS TIS Style */}
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as typeof filter)}
                  className={cn(
                    'px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap min-h-[36px] sm:min-h-0 active:scale-95',
                    filter === tab.key
                      ? 'bg-tis-coral/10 text-tis-coral border border-tis-coral/20'
                      : 'text-slate-500 hover:bg-slate-50 border border-transparent'
                  )}
                >
                  {tab.label}
                  <span className="ml-1 sm:ml-1.5 text-[10px] opacity-70">
                    ({counts[tab.key as keyof typeof counts]})
                  </span>
                </button>
              ))}
            </div>

            {/* Channel Filters */}
            <div className="flex gap-1 sm:gap-1.5 mt-2 sm:mt-3 flex-wrap">
              {CHANNEL_FILTERS.map((channel) => {
                const count = channelCounts[channel.key] || 0;
                // Solo mostrar canales que tienen conversaciones (excepto "all")
                if (channel.key !== 'all' && count === 0) return null;

                return (
                  <button
                    key={channel.key}
                    onClick={() => setChannelFilter(channel.key)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-[11px] font-medium transition-all duration-200 min-h-[32px] sm:min-h-0 active:scale-95',
                      channelFilter === channel.key
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {channel.icon && (
                      <ChannelIcon channel={channel.icon} size="xs" />
                    )}
                    <span className="hidden sm:inline">{channel.label}</span>
                    {count > 0 && (
                      <span className={cn(
                        'ml-0.5 text-[10px]',
                        channelFilter === channel.key ? 'text-white/70' : 'text-slate-400'
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              // Skeleton Loading - TIS TIS Style
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl">
                    <div className="w-11 h-11 bg-slate-100 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-100 rounded-lg w-3/4 mb-2" />
                      <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              // Empty State
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                  {icons.inbox}
                </div>
                <p className="text-slate-500 font-medium">No hay conversaciones</p>
                <p className="text-sm text-slate-400 mt-1">
                  {search ? 'Intenta con otra búsqueda' : 'Las conversaciones aparecerán aquí'}
                </p>
              </div>
            ) : (
              // Conversations
              <div className="p-2">
                {filteredConversations.map((conv) => {
                  const isSelected = selectedConversation?.id === conv.id;
                  const classificationEmoji = getClassificationEmoji(conv.leads?.classification);

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={cn(
                        'w-full p-3 rounded-xl text-left transition-all duration-200 mb-1',
                        isSelected
                          ? 'bg-tis-coral/5 border border-tis-coral/20'
                          : 'hover:bg-slate-50 border border-transparent'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar with Channel indicator */}
                        <div className="relative flex-shrink-0">
                          <Avatar
                            name={conv.leads?.full_name || conv.leads?.phone || '?'}
                            size="md"
                            className={cn(
                              'ring-2 ring-offset-2 transition-all',
                              isSelected ? 'ring-tis-coral/30' : 'ring-transparent'
                            )}
                          />
                          {/* Channel icon - bottom right of avatar */}
                          {conv.channel && (
                            <span className="absolute -bottom-0.5 -right-0.5">
                              <ChannelIcon channel={conv.channel} size="xs" />
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={cn(
                              'font-medium truncate text-sm',
                              isSelected ? 'text-slate-900' : 'text-slate-700'
                            )}>
                              {conv.leads?.full_name || conv.leads?.phone || 'Sin nombre'}
                            </span>
                            <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2">
                              {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : ''}
                            </span>
                          </div>

                          {/* Badges row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {conv.status === 'escalated' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-600 border border-red-100">
                                Escalada
                              </span>
                            )}
                            {conv.ai_handling && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-600 border border-purple-100">
                                {icons.ai}
                                <span>IA</span>
                              </span>
                            )}
                            {classificationEmoji && (
                              <span className="text-sm">{classificationEmoji}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* RIGHT PANEL: Chat Area */}
        {/* ============================================ */}
        <div className={cn(
          "flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden",
          selectedConversation ? "flex" : "hidden lg:flex"
        )}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    {/* Back button for mobile */}
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg active:bg-slate-200 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {/* Avatar with channel indicator */}
                    <div className="relative flex-shrink-0">
                      <Avatar
                        name={selectedConversation.leads?.full_name || '?'}
                        size="md"
                        className="ring-2 ring-slate-100"
                      />
                      {selectedConversation.channel && (
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <ChannelIcon channel={selectedConversation.channel} size="sm" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm sm:text-base truncate">
                        {selectedConversation.leads?.full_name || 'Sin nombre'}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm text-slate-500 truncate">
                          {selectedConversation.leads?.phone}
                        </p>
                        {/* Channel badge - hidden on small screens */}
                        {selectedConversation.channel && (
                          <span className="hidden sm:inline-flex">
                            <ChannelBadge
                              channel={selectedConversation.channel}
                              size="xs"
                              showLabel
                            />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    {selectedConversation.ai_handling ? (
                      <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                        {icons.ai}
                        <span className="hidden sm:inline">IA Activa</span>
                        <span className="sm:hidden">IA</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                        {icons.user}
                        <span className="hidden sm:inline">Humano</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white">
                <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
                  {messages.map((message) => {
                    const isUser = message.role === 'user';

                    return (
                      <div
                        key={message.id}
                        className={cn('flex', isUser ? 'justify-start' : 'justify-end')}
                      >
                        <div
                          className={cn(
                            'max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl',
                            isUser
                              ? 'bg-white border border-slate-200 rounded-bl-md'
                              : 'bg-tis-coral text-white rounded-br-md shadow-sm'
                          )}
                        >
                          <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>
                          <p
                            className={cn(
                              'text-[10px] sm:text-[11px] mt-1.5 sm:mt-2',
                              isUser ? 'text-slate-400' : 'text-white/70'
                            )}
                          >
                            {formatRelativeTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message Input */}
              <div className="p-3 sm:p-4 border-t border-slate-100 bg-white pb-safe">
                <div className={cn(
                  'flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-2xl border-2 transition-all duration-200',
                  'bg-slate-50 border-slate-200 focus-within:border-tis-coral focus-within:bg-white focus-within:shadow-sm'
                )}>
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-2 py-1.5 sm:py-1 text-sm sm:text-[15px] text-slate-700 placeholder:text-slate-400 bg-transparent border-none focus:outline-none min-h-[40px] sm:min-h-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && messageText.trim() && !sending) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={sending}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sending}
                    className={cn(
                      'p-2.5 sm:p-2.5 rounded-xl transition-all duration-200 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center active:scale-95',
                      messageText.trim() && !sending
                        ? 'bg-tis-coral text-white hover:bg-tis-pink shadow-sm'
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    )}
                  >
                    {sending ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : icons.send}
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Empty State - No conversation selected
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl flex items-center justify-center mb-6 text-slate-300">
                {icons.chat}
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Selecciona una conversación
              </h3>
              <p className="text-slate-500 text-sm max-w-sm">
                Elige una conversación de la lista para ver los mensajes y responder a tus clientes
              </p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
