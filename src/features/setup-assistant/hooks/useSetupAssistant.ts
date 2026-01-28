// =====================================================
// TIS TIS PLATFORM - Setup Assistant Hook
// Sprint 5: AI-powered configuration assistant
// Enhanced: Streaming support for real-time AI responses
// Fixed: Memory leaks, race conditions, validation
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
  /** Enable streaming responses (default: true) */
  enableStreaming?: boolean;
}

/** Streaming state for progressive text display */
export interface StreamingState {
  isStreaming: boolean;
  currentText: string;
}

interface UseSetupAssistantReturn {
  // State
  conversation: SetupConversation | null;
  messages: SetupMessage[];
  usage: UsageInfo | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Streaming state
  streamingState: StreamingState;

  // Actions
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  uploadFile: (file: File) => Promise<UploadResponse>;
  createConversation: (initialMessage?: string) => Promise<string>;
  clearError: () => void;

  // Refs
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

// =====================================================
// CONSTANTS
// =====================================================

const initialStreamingState: StreamingState = {
  isStreaming: false,
  currentText: '',
};

/** Maximum SSE buffer size to prevent memory overflow (100KB) */
const MAX_BUFFER_SIZE = 1024 * 100;

/** Maximum file size for upload (10MB) - must match server config */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Presigned URL response type */
interface PresignedUrlResponse {
  uploadUrl: string;
  path: string;
  token: string;
  expiresAt: string;
}

// =====================================================
// HOOK IMPLEMENTATION
// =====================================================

export function useSetupAssistant(
  options: UseSetupAssistantOptions = {}
): UseSetupAssistantReturn {
  const { conversationId: initialConversationId, enableStreaming = true } = options;

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

  // Streaming state
  const [streamingState, setStreamingState] = useState<StreamingState>(initialStreamingState);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Update conversationId if prop changes
  useEffect(() => {
    if (initialConversationId) {
      setConversationId(initialConversationId);
    }
  }, [initialConversationId]);

  // Cleanup on unmount - FIX: Also clean streaming state (#2)
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Abort any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

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
      if (isMountedRef.current) {
        setConversation(data.conversation);
        setMessages(data.messages || []);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Error loading conversation';
        setError(errorMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
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
      if (data && isMountedRef.current) {
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
  // SEND MESSAGE WITH STREAMING
  // ======================
  const sendMessageWithStreaming = useCallback(
    async (targetId: string, content: string, attachments?: MessageAttachment[]) => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      // FIX H1: Abort previous request if still pending (prevents leak on rapid calls)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      const response = await fetch(`/api/setup-assistant/${targetId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ content, attachments }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // Start streaming state
      if (isMountedRef.current) {
        setStreamingState({
          isStreaming: true,
          currentText: '',
        });
      }

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          // FIX H2: Check buffer size BEFORE adding new data to prevent overflow
          const decodedChunk = decoder.decode(value, { stream: true });
          if (buffer.length + decodedChunk.length > MAX_BUFFER_SIZE) {
            throw new Error('SSE buffer overflow - response too large');
          }
          buffer += decodedChunk;

          // Process complete SSE messages
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep incomplete message in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));

              // FIX: Validate SSE data structure (#3)
              if (!data || typeof data.type !== 'string') {
                console.warn('[useSetupAssistant] Invalid SSE data structure:', data);
                continue;
              }

              // Don't update state if unmounted
              if (!isMountedRef.current) break;

              switch (data.type) {
                case 'user_message':
                  // Validate message structure before adding
                  if (data.message && typeof data.message === 'object' && data.message.id) {
                    setMessages((prev) => [...prev, data.message]);
                  }
                  break;

                case 'generating_start':
                  // Generation started, keep streaming state
                  break;

                case 'text_chunk':
                  // Update streaming text progressively
                  if (typeof data.content === 'string') {
                    setStreamingState((prev) => ({
                      ...prev,
                      currentText: prev.currentText + data.content,
                    }));
                  }
                  break;

                case 'done': {
                  // Generation complete - add final message
                  // FIX H5: Validate assistantMessage has required id field
                  if (data.assistantMessage && typeof data.assistantMessage === 'object' && data.assistantMessage.id) {
                    setMessages((prev) => [...prev, data.assistantMessage]);
                  } else {
                    console.warn('[useSetupAssistant] Done event received without valid assistantMessage');
                  }
                  // Update usage if provided
                  if (data.usage && typeof data.usage === 'object') {
                    setUsage((prev) => prev ? { ...prev, ...data.usage } : null);
                  }
                  // Small delay to avoid flash when transitioning from streaming to final message
                  setTimeout(() => {
                    if (isMountedRef.current) {
                      setStreamingState(initialStreamingState);
                    }
                  }, 50);
                  break;
                }

                case 'error':
                  // FIX: Handle error directly instead of throwing (#13)
                  if (isMountedRef.current) {
                    setError(data.error || 'Streaming error');
                    setStreamingState(initialStreamingState);
                  }
                  return; // Exit the function
              }
            } catch (parseError) {
              // Only warn for actual parse errors, not for thrown errors
              if (parseError instanceof SyntaxError) {
                console.warn('[useSetupAssistant] SSE parse error:', parseError);
              } else {
                throw parseError;
              }
            }
          }
        }
      } finally {
        // FIX: Cancel stream before releasing lock to prevent memory leak (#1)
        try {
          await reader.cancel();
        } catch {
          // Ignore cancel errors
        }
        reader.releaseLock();
        abortControllerRef.current = null;
      }
    },
    []
  );

  // ======================
  // SEND MESSAGE (NON-STREAMING FALLBACK)
  // ======================
  const sendMessageNonStreaming = useCallback(
    async (targetId: string, content: string, attachments?: MessageAttachment[]) => {
      const data = await fetchWithAuth<SendMessageResponse>(
        `/api/setup-assistant/${targetId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content, attachments }),
        }
      );

      if (isMountedRef.current) {
        // Update messages with user and assistant messages
        setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);

        // Update usage
        if (data.usage) {
          setUsage(data.usage);
        }
      }
    },
    []
  );

  // ======================
  // SEND MESSAGE (MAIN FUNCTION)
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
          if (isMountedRef.current) {
            setConversationId(targetId);
            setConversation(createData.conversation);
            if (createData.initialResponse) {
              setMessages([createData.initialResponse]);
            }
          }
        }

        // Send message with streaming or fallback to non-streaming
        if (enableStreaming) {
          await sendMessageWithStreaming(targetId, content, attachments);
        } else {
          await sendMessageNonStreaming(targetId, content, attachments);
        }
      } catch (err) {
        // FIX: Clean streaming state on abort (#4)
        if (err instanceof Error && err.name === 'AbortError') {
          if (isMountedRef.current) {
            setStreamingState(initialStreamingState);
          }
          return;
        }

        if (isMountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Error sending message';
          setError(errorMessage);

          // Clear streaming state on error
          setStreamingState(initialStreamingState);
        }

        throw err;
      } finally {
        if (isMountedRef.current) {
          setIsSending(false);
        }
      }
    },
    [conversationId, enableStreaming, sendMessageWithStreaming, sendMessageNonStreaming]
  );

  // ======================
  // UPLOAD FILE (Presigned URL flow to bypass Vercel 4.5MB limit)
  // ======================
  const uploadFile = useCallback(async (file: File): Promise<UploadResponse> => {
    setError(null);

    // Client-side validation: empty files
    if (file.size === 0) {
      const errorMessage = 'El archivo está vacío';
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    }

    // Client-side validation: oversized files
    if (file.size > MAX_FILE_SIZE) {
      const errorMessage = `Archivo demasiado grande. Máximo ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    }

    // Get access token for auth
    const accessToken = await getAccessToken();
    if (!accessToken) {
      const errorMessage = 'Authentication required for file upload';
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    // Step 1: Get presigned upload URL from server
    const presignedResponse = await fetch('/api/setup-assistant/upload/presigned', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }),
    });

    if (!presignedResponse.ok) {
      const errorData = await presignedResponse.json().catch(() => ({}));
      const errorMessage = errorData.error || 'Error al preparar subida';
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    }

    const presignedData: PresignedUrlResponse = await presignedResponse.json();

    // Step 2: Upload file directly to Supabase Storage (bypasses Vercel limit)
    const uploadResponse = await fetch(presignedData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errorMessage = 'Error al subir archivo a storage';
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    }

    // Step 3: Confirm upload and get signed URL for reading
    const confirmResponse = await fetch('/api/setup-assistant/upload/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        path: presignedData.path,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }),
    });

    if (!confirmResponse.ok) {
      const errorData = await confirmResponse.json().catch(() => ({}));
      const errorMessage = errorData.error || 'Error al confirmar subida';
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    }

    const data: UploadResponse = await confirmResponse.json();

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
      setStreamingState(initialStreamingState); // Reset streaming state

      try {
        const data = await fetchWithAuth<{
          conversation: SetupConversation;
          initialResponse?: SetupMessage;
        }>('/api/setup-assistant', {
          method: 'POST',
          body: JSON.stringify({ initialMessage }),
        });

        if (isMountedRef.current) {
          setConversationId(data.conversation.id);
          setConversation(data.conversation);
          setMessages(data.initialResponse ? [data.initialResponse] : []);
        }

        return data.conversation.id;
      } catch (err) {
        if (isMountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Error creating conversation';
          setError(errorMessage);
        }
        throw err;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
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
    streamingState,
    sendMessage,
    uploadFile,
    createConversation,
    clearError,
    inputRef,
  };
}
