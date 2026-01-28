// =====================================================
// TIS TIS PLATFORM - Setup Assistant Hook
// Sprint 5: AI-powered configuration assistant
// =====================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchWithAuth, getAccessToken } from '@/src/shared/lib/api-client';
import type {
  SetupConversation,
  SetupMessage,
  UsageInfo,
  SendMessageResponse,
  UploadResponse,
  MessageAttachment,
} from '../types';

// =====================================================
// TYPES
// =====================================================

interface UseSetupAssistantOptions {
  conversationId?: string;
}

interface UseSetupAssistantReturn {
  // State
  conversation: SetupConversation | null;
  messages: SetupMessage[];
  usage: UsageInfo | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Actions
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  uploadFile: (file: File) => Promise<UploadResponse>;
  createConversation: (initialMessage?: string) => Promise<string>;
  clearError: () => void;

  // Refs
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

// =====================================================
// HOOK IMPLEMENTATION
// =====================================================

export function useSetupAssistant(
  options: UseSetupAssistantOptions = {}
): UseSetupAssistantReturn {
  const { conversationId: initialConversationId } = options;

  // State
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [conversation, setConversation] = useState<SetupConversation | null>(null);
  const [messages, setMessages] = useState<SetupMessage[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Update conversationId if prop changes
  useEffect(() => {
    if (initialConversationId) {
      setConversationId(initialConversationId);
    }
  }, [initialConversationId]);

  // ======================
  // FETCH CONVERSATION AND MESSAGES
  // ======================
  const fetchConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchWithAuth<{ conversation: SetupConversation; messages: SetupMessage[] }>(
        `/api/setup-assistant/${id}`,
        { throwOnError: false }
      );
      setConversation(data.conversation);
      setMessages(data.messages || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error loading conversation';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch conversation when ID changes
  useEffect(() => {
    if (conversationId) {
      fetchConversation(conversationId);
    }
  }, [conversationId, fetchConversation]);

  // ======================
  // FETCH USAGE
  // ======================
  const fetchUsage = useCallback(async () => {
    try {
      const data = await fetchWithAuth<UsageInfo>(
        '/api/setup-assistant/usage',
        { throwOnError: false }
      );
      if (data) {
        setUsage(data);
      }
    } catch (err) {
      console.error('[useSetupAssistant] Error fetching usage:', err);
    }
  }, []);

  // Fetch usage on mount and periodically
  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchUsage]);

  // ======================
  // SEND MESSAGE
  // ======================
  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      setIsSending(true);
      setError(null);

      try {
        let targetId = conversationId;

        // Create conversation first if needed
        if (!targetId) {
          const createData = await fetchWithAuth<{
            conversation: SetupConversation;
            initialResponse?: SetupMessage;
          }>('/api/setup-assistant', {
            method: 'POST',
            body: JSON.stringify({}),
          });

          targetId = createData.conversation.id;
          setConversationId(targetId);
          setConversation(createData.conversation);
          if (createData.initialResponse) {
            setMessages([createData.initialResponse]);
          }
        }

        // Send message
        const data = await fetchWithAuth<SendMessageResponse>(
          `/api/setup-assistant/${targetId}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({ content, attachments }),
          }
        );

        // Update messages with user and assistant messages
        setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);

        // Update usage
        if (data.usage) {
          setUsage(data.usage);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error sending message';
        setError(errorMessage);
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId]
  );

  // ======================
  // UPLOAD FILE
  // ======================
  const uploadFile = useCallback(async (file: File): Promise<UploadResponse> => {
    setError(null);

    // Get access token for auth (FormData doesn't use fetchWithAuth due to Content-Type)
    const accessToken = await getAccessToken();
    if (!accessToken) {
      const errorMessage = 'Authentication required for file upload';
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/setup-assistant/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || 'Failed to upload file';
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    const data: UploadResponse = await response.json();

    // Refresh usage after upload
    fetchUsage();

    return data;
  }, [fetchUsage]);

  // ======================
  // CREATE CONVERSATION
  // ======================
  const createConversation = useCallback(
    async (initialMessage?: string): Promise<string> => {
      setError(null);
      setIsLoading(true);

      try {
        const data = await fetchWithAuth<{
          conversation: SetupConversation;
          initialResponse?: SetupMessage;
        }>('/api/setup-assistant', {
          method: 'POST',
          body: JSON.stringify({ initialMessage }),
        });

        setConversationId(data.conversation.id);
        setConversation(data.conversation);
        setMessages(data.initialResponse ? [data.initialResponse] : []);

        return data.conversation.id;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error creating conversation';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ======================
  // CLEAR ERROR
  // ======================
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ======================
  // RETURN
  // ======================
  return {
    conversation,
    messages,
    usage,
    isLoading,
    isSending,
    error,
    sendMessage,
    uploadFile,
    createConversation,
    clearError,
    inputRef,
  };
}
