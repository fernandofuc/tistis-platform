// =====================================================
// TIS TIS PLATFORM - Inbox Page
// =====================================================

'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Avatar, SearchInput } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { supabase, ESVA_TENANT_ID } from '@/src/shared/lib/supabase';
import { formatRelativeTime, cn, truncate } from '@/src/shared/utils';
import { CONVERSATION_STATUSES } from '@/src/shared/constants';
import type { Conversation, Message, Lead } from '@/src/shared/types';

// ======================
// ICONS
// ======================
const icons = {
  whatsapp: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  send: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  ai: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  user: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
// COMPONENT
// ======================
export default function InboxPage() {
  const [conversations, setConversations] = useState<ConversationWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithLead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'escalated'>('all');

  // Fetch conversations
  useEffect(() => {
    async function fetchConversations() {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('*, leads(id, name, phone, classification, score)')
          .eq('tenant_id', ESVA_TENANT_ID)
          .in('status', ['active', 'waiting_response', 'escalated'])
          .order('last_message_at', { ascending: false });

        if (error) throw error;
        setConversations(data as ConversationWithLead[]);

        // Auto-select first conversation if none selected
        if (data && data.length > 0) {
          setSelectedConversation((prev) => prev || (data[0] as ConversationWithLead));
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchConversations();
  }, []);

  // Get conversation ID for dependency
  const selectedConversationId = selectedConversation?.id;

  // Fetch messages when conversation is selected
  useEffect(() => {
    async function fetchMessages() {
      if (!selectedConversationId) return;

      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', selectedConversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data as Message[]);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    }

    fetchMessages();
  }, [selectedConversationId]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      // Status filter
      if (filter === 'active' && conv.status === 'escalated') return false;
      if (filter === 'escalated' && conv.status !== 'escalated') return false;

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const leadName = conv.leads?.name?.toLowerCase() || '';
        const leadPhone = conv.leads?.phone || '';
        return leadName.includes(searchLower) || leadPhone.includes(search);
      }

      return true;
    });
  }, [conversations, filter, search]);

  // Counts
  const counts = useMemo(() => ({
    all: conversations.length,
    active: conversations.filter((c) => c.status !== 'escalated').length,
    escalated: conversations.filter((c) => c.status === 'escalated').length,
  }), [conversations]);

  return (
    <PageWrapper title="Inbox" subtitle={`${conversations.length} conversaciones activas`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <Card variant="bordered" className="h-full flex flex-col">
            <CardHeader>
              <div className="space-y-3 w-full">
                <SearchInput
                  placeholder="Buscar conversación..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch('')}
                />
                <div className="flex gap-2">
                  {[
                    { key: 'all', label: 'Todas' },
                    { key: 'active', label: 'Activas' },
                    { key: 'escalated', label: 'Escaladas' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setFilter(tab.key as typeof filter)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                        filter === tab.key
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-500 hover:bg-gray-100'
                      )}
                    >
                      {tab.label}
                      <span className="ml-1">({counts[tab.key as keyof typeof counts]})</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No hay conversaciones</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={cn(
                        'w-full p-4 text-left hover:bg-gray-50 transition-colors',
                        selectedConversation?.id === conv.id && 'bg-blue-50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <Avatar name={conv.leads?.name || conv.leads?.phone || '?'} size="md" />
                          {conv.ai_handling && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                              {icons.ai}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900 truncate">
                              {conv.leads?.name || conv.leads?.phone || 'Sin nombre'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {conv.status === 'escalated' && (
                              <Badge variant="danger" size="sm">Escalada</Badge>
                            )}
                            {conv.leads?.classification && (
                              <Badge variant={conv.leads.classification as 'hot' | 'warm' | 'cold'} size="sm">
                                {conv.leads.classification === 'hot' && '🔥'}
                                {conv.leads.classification === 'warm' && '🌡️'}
                                {conv.leads.classification === 'cold' && '❄️'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-2">
          <Card variant="bordered" className="h-full flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <Avatar name={selectedConversation.leads?.name || '?'} size="md" />
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {selectedConversation.leads?.name || 'Sin nombre'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {selectedConversation.leads?.phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedConversation.ai_handling ? (
                        <Badge variant="info" size="sm">
                          <span className="mr-1">{icons.ai}</span>
                          IA Activa
                        </Badge>
                      ) : (
                        <Badge variant="default" size="sm">
                          <span className="mr-1">{icons.user}</span>
                          Humano
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        message.role === 'user' ? 'justify-start' : 'justify-end'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] px-4 py-2 rounded-2xl',
                          message.role === 'user'
                            ? 'bg-white border border-gray-200 rounded-bl-none'
                            : 'bg-blue-600 text-white rounded-br-none'
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={cn(
                            'text-xs mt-1',
                            message.role === 'user' ? 'text-gray-400' : 'text-blue-200'
                          )}
                        >
                          {formatRelativeTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-200">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Button disabled={!messageText.trim()}>
                      {icons.send}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <p>Selecciona una conversación para ver los mensajes</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
