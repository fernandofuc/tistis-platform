# FASE 5: UI Components

## Objetivo
Implementar la interfaz de chat del AI Setup Assistant, con un diseno moderno al estilo Claude Cowork, animaciones fluidas, y soporte para archivos.

---

## Arquitectura de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SETUP ASSISTANT PAGE                             │
│                  app/(dashboard)/dashboard/ai-setup/page.tsx        │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │                     SetupAssistantLayout                        │ │
│ │ ┌───────────────┐ ┌───────────────────────────────────────────┐ │ │
│ │ │   Sidebar     │ │            ChatContainer                  │ │ │
│ │ │ (optional)    │ │ ┌───────────────────────────────────────┐ │ │ │
│ │ │               │ │ │           ChatHeader                  │ │ │ │
│ │ │ - History     │ │ │   Title | Usage | New Chat            │ │ │ │
│ │ │ - Modules     │ │ └───────────────────────────────────────┘ │ │ │
│ │ │               │ │ ┌───────────────────────────────────────┐ │ │ │
│ │ │               │ │ │           MessageList                 │ │ │ │
│ │ │               │ │ │   ┌─────────────────────────────────┐ │ │ │ │
│ │ │               │ │ │   │    ChatMessage (user)           │ │ │ │ │
│ │ │               │ │ │   └─────────────────────────────────┘ │ │ │ │
│ │ │               │ │ │   ┌─────────────────────────────────┐ │ │ │ │
│ │ │               │ │ │   │    ChatMessage (assistant)      │ │ │ │ │
│ │ │               │ │ │   │    + ActionBadges               │ │ │ │ │
│ │ │               │ │ │   └─────────────────────────────────┘ │ │ │ │
│ │ │               │ │ │   ┌─────────────────────────────────┐ │ │ │ │
│ │ │               │ │ │   │    TypingIndicator              │ │ │ │ │
│ │ │               │ │ │   └─────────────────────────────────┘ │ │ │ │
│ │ │               │ │ └───────────────────────────────────────┘ │ │ │
│ │ │               │ │ ┌───────────────────────────────────────┐ │ │ │
│ │ │               │ │ │           ChatInput                   │ │ │ │
│ │ │               │ │ │   ┌───────────┐ ┌─────────┐          │ │ │ │
│ │ │               │ │ │   │ TextArea  │ │ Actions │          │ │ │ │
│ │ │               │ │ │   │           │ │ 📎 📷 ▶ │          │ │ │ │
│ │ │               │ │ │   └───────────┘ └─────────┘          │ │ │ │
│ │ │               │ │ └───────────────────────────────────────┘ │ │ │
│ │ └───────────────┘ └───────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Microfases

### 5.1 Types and Hooks

**Archivo:** `src/features/setup-assistant/hooks/useSetupAssistant.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Hook
// =====================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SetupConversation,
  SetupMessage,
  UsageInfo,
  SendMessageResponse,
} from '../types';

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
  sendMessage: (content: string, attachments?: string[]) => Promise<void>;
  uploadFile: (file: File) => Promise<string>;
  createConversation: (initialMessage?: string) => Promise<string>;
  clearError: () => void;

  // Refs
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

export function useSetupAssistant(
  options: UseSetupAssistantOptions = {}
): UseSetupAssistantReturn {
  const { conversationId: initialConversationId } = options;

  const [conversationId, setConversationId] = useState(initialConversationId);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversation and messages
  const {
    data: conversationData,
    isLoading: isLoadingConversation,
  } = useQuery({
    queryKey: ['setup-assistant', 'conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const response = await fetch(`/api/setup-assistant/${conversationId}`);
      if (!response.ok) throw new Error('Failed to fetch conversation');
      return response.json();
    },
    enabled: !!conversationId,
  });

  // Fetch usage
  const { data: usageData } = useQuery({
    queryKey: ['setup-assistant', 'usage'],
    queryFn: async () => {
      const response = await fetch('/api/setup-assistant/usage');
      if (!response.ok) throw new Error('Failed to fetch usage');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      attachments,
    }: {
      content: string;
      attachments?: string[];
    }) => {
      const response = await fetch(
        `/api/setup-assistant/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, attachments }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      return response.json() as Promise<SendMessageResponse>;
    },
    onSuccess: (data) => {
      // Update messages in cache
      queryClient.setQueryData(
        ['setup-assistant', 'conversation', conversationId],
        (old: { messages: SetupMessage[] } | undefined) => ({
          ...old,
          messages: [...(old?.messages || []), data.userMessage, data.assistantMessage],
        })
      );

      // Update usage
      queryClient.setQueryData(['setup-assistant', 'usage'], data.usage);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/setup-assistant/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      return response.json();
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (initialMessage?: string) => {
      const response = await fetch('/api/setup-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialMessage }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create conversation');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setConversationId(data.conversation.id);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  // Actions
  const sendMessage = useCallback(
    async (content: string, attachments?: string[]) => {
      if (!conversationId) {
        // Create conversation first
        const result = await createConversationMutation.mutateAsync();
        setConversationId(result.conversation.id);
        // Then send message (will use new conversationId on next render)
      }
      await sendMessageMutation.mutateAsync({ content, attachments });
    },
    [conversationId, createConversationMutation, sendMessageMutation]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const result = await uploadFileMutation.mutateAsync(file);
      return result.url;
    },
    [uploadFileMutation]
  );

  const createConversation = useCallback(
    async (initialMessage?: string) => {
      const result = await createConversationMutation.mutateAsync(initialMessage);
      return result.conversation.id;
    },
    [createConversationMutation]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    conversation: conversationData?.conversation || null,
    messages: conversationData?.messages || [],
    usage: usageData || null,
    isLoading: isLoadingConversation,
    isSending: sendMessageMutation.isPending,
    error,
    sendMessage,
    uploadFile,
    createConversation,
    clearError,
    inputRef,
  };
}
```

**Criterios de aceptación:**
- [ ] Hook maneja estado completo
- [ ] Mutations funcionan correctamente
- [ ] Cache de React Query actualizado
- [ ] Manejo de errores

---

### 5.2 Chat Message Component

**Archivo:** `src/features/setup-assistant/components/ChatMessage.tsx`

```typescript
'use client';

// =====================================================
// TIS TIS PLATFORM - Chat Message Component
// =====================================================

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { Avatar } from '@/src/shared/components/ui/Avatar';
import { Badge } from '@/src/shared/components/ui/Badge';
import type { SetupMessage, MessageAction } from '../types';

// Icons
import {
  CheckCircleIcon,
  XCircleIcon,
  PhotoIcon,
  DocumentIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface ChatMessageProps {
  message: SetupMessage;
  isLast?: boolean;
}

const appleEasing = [0.25, 0.1, 0.25, 1];

export const ChatMessage = memo(function ChatMessage({
  message,
  isLast,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: appleEasing }}
      className={cn(
        'flex gap-3 px-4 py-3',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <Avatar size="sm" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
            <SparklesIcon className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex flex-col gap-2 max-w-[75%]',
          isUser && 'items-end'
        )}
      >
        {/* Message bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isUser
              ? 'bg-tis-coral text-white rounded-tr-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-md'
          )}
        >
          {/* Text content */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment, index) => (
              <AttachmentPreview key={index} attachment={attachment} />
            ))}
          </div>
        )}

        {/* Actions taken (only for assistant) */}
        {isAssistant && message.actionsTaken && message.actionsTaken.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.actionsTaken.map((action, index) => (
              <ActionBadge key={index} action={action} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </motion.div>
  );
});

// =====================================================
// ATTACHMENT PREVIEW
// =====================================================

interface AttachmentPreviewProps {
  attachment: {
    type: string;
    url: string;
    filename?: string;
    analysis?: {
      description: string;
    };
  };
}

function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const isImage = attachment.type === 'image';

  if (isImage) {
    return (
      <div className="relative group">
        <img
          src={attachment.url}
          alt={attachment.filename || 'Imagen'}
          className="w-32 h-32 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
        />
        {attachment.analysis && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center p-2">
            <span className="text-xs text-white text-center line-clamp-3">
              {attachment.analysis.description}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
    >
      <DocumentIcon className="w-4 h-4 text-slate-500" />
      <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
        {attachment.filename || 'Documento'}
      </span>
    </a>
  );
}

// =====================================================
// ACTION BADGE
// =====================================================

interface ActionBadgeProps {
  action: MessageAction;
}

function ActionBadge({ action }: ActionBadgeProps) {
  const isSuccess = action.status === 'success';

  const actionLabels: Record<string, string> = {
    create: 'Creado',
    update: 'Actualizado',
    delete: 'Eliminado',
    configure: 'Configurado',
  };

  const moduleLabels: Record<string, string> = {
    services: 'servicio',
    loyalty: 'lealtad',
    knowledge_base: 'FAQ',
    general: 'config',
    agents: 'agente',
  };

  return (
    <Badge
      variant={isSuccess ? 'success' : 'danger'}
      size="xs"
      className="gap-1"
    >
      {isSuccess ? (
        <CheckCircleIcon className="w-3 h-3" />
      ) : (
        <XCircleIcon className="w-3 h-3" />
      )}
      <span>
        {actionLabels[action.type] || action.type} {moduleLabels[action.module] || action.module}
      </span>
    </Badge>
  );
}

// =====================================================
// HELPERS
// =====================================================

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
```

**Criterios de aceptación:**
- [ ] Mensajes de usuario y asistente diferenciados
- [ ] Attachments mostrados correctamente
- [ ] Actions badges visibles
- [ ] Animaciones fluidas

---

### 5.3 Chat Input Component

**Archivo:** `src/features/setup-assistant/components/ChatInput.tsx`

```typescript
'use client';

// =====================================================
// TIS TIS PLATFORM - Chat Input Component
// =====================================================

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { Button } from '@/src/shared/components/ui/Button';

// Icons
import {
  PaperAirplaneIcon,
  PhotoIcon,
  PaperClipIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface ChatInputProps {
  onSend: (content: string, attachments?: string[]) => Promise<void>;
  onUpload: (file: File) => Promise<string>;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

const appleEasing = [0.25, 0.1, 0.25, 1];

export function ChatInput({
  onSend,
  onUpload,
  disabled = false,
  isLoading = false,
  placeholder = '¿Qué te gustaría configurar?',
  inputRef: externalRef,
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Array<{ url: string; name: string; type: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalRef;

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setContent(textarea.value);

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set new height (max 200px)
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await onUpload(file);
        setAttachments((prev) => [
          ...prev,
          {
            url,
            name: file.name,
            type: file.type.startsWith('image/') ? 'image' : 'file',
          },
        ]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onUpload]);

  // Remove attachment
  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle send
  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && attachments.length === 0) return;

    try {
      await onSend(
        trimmedContent || 'Analiza estas imágenes',
        attachments.map((a) => a.url)
      );

      // Clear input
      setContent('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Send failed:', error);
    }
  }, [content, attachments, onSend, textareaRef]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const canSend = (content.trim() || attachments.length > 0) && !disabled && !isLoading;

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      {/* Attachments preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: appleEasing }}
            className="flex flex-wrap gap-2 mb-3"
          >
            {attachments.map((attachment, index) => (
              <motion.div
                key={attachment.url}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative group"
              >
                {attachment.type === 'image' ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    <PaperClipIcon className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* File upload buttons */}
        <div className="flex gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <PhotoIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className={cn(
              'w-full resize-none rounded-2xl border border-slate-200 dark:border-slate-700',
              'bg-slate-50 dark:bg-slate-800 px-4 py-3 pr-12',
              'text-sm text-slate-900 dark:text-slate-100',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            style={{ minHeight: '48px', maxHeight: '200px' }}
          />

          {/* Send button inside textarea */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'absolute right-2 bottom-2',
              'rounded-full w-8 h-8 p-0',
              'bg-tis-coral hover:bg-tis-pink',
              'disabled:bg-slate-300 dark:disabled:bg-slate-600'
            )}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <PaperAirplaneIcon className="w-4 h-4 text-white" />
            )}
          </Button>
        </div>
      </div>

      {/* Upload indicator */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-3 h-3 border-2 border-tis-coral border-t-transparent rounded-full"
            />
            Subiendo archivo...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Criterios de aceptación:**
- [ ] Textarea auto-resize
- [ ] Upload de archivos funciona
- [ ] Preview de attachments
- [ ] Enter para enviar, Shift+Enter para nueva línea
- [ ] Loading state visible

---

### 5.4 Typing Indicator

**Archivo:** `src/features/setup-assistant/components/TypingIndicator.tsx`

```typescript
'use client';

// =====================================================
// TIS TIS PLATFORM - Typing Indicator
// =====================================================

import React from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-3 px-4 py-3"
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center flex-shrink-0">
        <SparklesIcon className="w-4 h-4 text-white" />
      </div>

      {/* Typing dots */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full"
            animate={{
              y: [0, -6, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
```

**Criterios de aceptación:**
- [ ] Animación fluida de puntos
- [ ] Consistente con estilo de mensajes

---

### 5.5 Usage Indicator Component

**Archivo:** `src/features/setup-assistant/components/UsageIndicator.tsx`

```typescript
'use client';

// =====================================================
// TIS TIS PLATFORM - Usage Indicator
// =====================================================

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { UsageInfo } from '../types';

// Icons
import {
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

interface UsageIndicatorProps {
  usage: UsageInfo;
  className?: string;
}

export function UsageIndicator({ usage, className }: UsageIndicatorProps) {
  const items = [
    {
      icon: ChatBubbleLeftRightIcon,
      label: 'Mensajes',
      current: usage.messagesCount,
      limit: usage.messagesLimit,
    },
    {
      icon: PhotoIcon,
      label: 'Archivos',
      current: usage.filesUploaded,
      limit: usage.filesLimit,
    },
    {
      icon: EyeIcon,
      label: 'Vision',
      current: usage.visionRequests,
      limit: usage.visionLimit,
    },
  ];

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {items.map((item) => {
        const percentage = (item.current / item.limit) * 100;
        const isNearLimit = percentage >= 80;
        const isAtLimit = percentage >= 100;

        return (
          <div
            key={item.label}
            className="flex items-center gap-2"
            title={`${item.label}: ${item.current}/${item.limit}`}
          >
            <item.icon
              className={cn(
                'w-4 h-4',
                isAtLimit
                  ? 'text-red-500'
                  : isNearLimit
                  ? 'text-amber-500'
                  : 'text-slate-400 dark:text-slate-500'
              )}
            />
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  'text-xs font-medium',
                  isAtLimit
                    ? 'text-red-500'
                    : isNearLimit
                    ? 'text-amber-500'
                    : 'text-slate-600 dark:text-slate-400'
                )}
              >
                {item.current}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                /{item.limit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Criterios de aceptación:**
- [ ] Muestra los 3 tipos de uso
- [ ] Indicador visual de límite cercano
- [ ] Tooltips informativos

---

### 5.6 Main Page Component

**Archivo:** `app/(dashboard)/dashboard/ai-setup/page.tsx`

```typescript
'use client';

// =====================================================
// TIS TIS PLATFORM - AI Setup Assistant Page
// =====================================================

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/src/features/dashboard/components/PageWrapper';
import { useSetupAssistant } from '@/src/features/setup-assistant/hooks/useSetupAssistant';
import { ChatMessage } from '@/src/features/setup-assistant/components/ChatMessage';
import { ChatInput } from '@/src/features/setup-assistant/components/ChatInput';
import { TypingIndicator } from '@/src/features/setup-assistant/components/TypingIndicator';
import { UsageIndicator } from '@/src/features/setup-assistant/components/UsageIndicator';
import { Button } from '@/src/shared/components/ui/Button';
import { cn } from '@/src/shared/utils';

// Icons
import {
  SparklesIcon,
  PlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const appleEasing = [0.25, 0.1, 0.25, 1];

export default function AISetupPage() {
  const {
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
  } = useSetupAssistant();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Check if at limit
  const isAtLimit = usage?.isAtLimit || false;

  return (
    <PageWrapper
      title="AI Setup Assistant"
      subtitle="Configura tu negocio con ayuda de IA"
    >
      <div className="h-[calc(100vh-200px)] flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Asistente de Configuración
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Powered by Gemini 3.0 Flash
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {usage && <UsageIndicator usage={usage} />}
            <Button
              variant="outline"
              size="sm"
              onClick={() => createConversation()}
              className="gap-1"
            >
              <PlusIcon className="w-4 h-4" />
              Nueva Conversación
            </Button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={sendMessage} />
          ) : (
            <div className="py-4">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1}
                />
              ))}
              <AnimatePresence>
                {isSending && <TypingIndicator />}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
                <button
                  onClick={clearError}
                  className="text-xs text-red-500 hover:text-red-600 underline"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Limit warning */}
        <AnimatePresence>
          {isAtLimit && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-800"
            >
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span className="text-sm">
                  Has alcanzado el límite diario. Vuelve mañana o actualiza tu plan.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          onUpload={uploadFile}
          disabled={isAtLimit}
          isLoading={isSending}
          inputRef={inputRef}
        />
      </div>
    </PageWrapper>
  );
}

// =====================================================
// WELCOME SCREEN
// =====================================================

interface WelcomeScreenProps {
  onSuggestionClick: (content: string) => void;
}

function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
  const suggestions = [
    {
      icon: '🍽️',
      title: 'Agregar mi menú',
      description: 'Sube una foto de tu menú y lo agregaré automáticamente',
      prompt: 'Quiero agregar los platillos de mi restaurante',
    },
    {
      icon: '🏆',
      title: 'Programa de lealtad',
      description: 'Crea un sistema de puntos para premiar a tus clientes',
      prompt: 'Quiero crear un programa de lealtad para mis clientes',
    },
    {
      icon: '🤖',
      title: 'Configurar el bot',
      description: 'Personaliza cómo responde tu asistente de WhatsApp',
      prompt: 'Quiero configurar la personalidad de mi bot de WhatsApp',
    },
    {
      icon: '❓',
      title: 'Crear FAQs',
      description: 'Define las respuestas a preguntas frecuentes',
      prompt: 'Quiero crear FAQs para que el bot responda preguntas comunes',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: appleEasing }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
          <SparklesIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          ¡Hola! Soy tu asistente de configuración
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Puedo ayudarte a configurar tu negocio completamente. Dime qué necesitas
          o elige una de estas opciones:
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={suggestion.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.1 + index * 0.1,
              ease: appleEasing,
            }}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            className={cn(
              'text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700',
              'bg-slate-50 dark:bg-slate-800/50',
              'hover:border-tis-coral dark:hover:border-tis-coral',
              'hover:shadow-md transition-all duration-200',
              'group'
            )}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{suggestion.icon}</span>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white group-hover:text-tis-coral transition-colors">
                  {suggestion.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {suggestion.description}
                </p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
```

**Criterios de aceptación:**
- [ ] Layout completo funciona
- [ ] Welcome screen con sugerencias
- [ ] Scroll automático a nuevos mensajes
- [ ] Error y warning banners

---

### 5.7 Sidebar Navigation Update

**Archivo:** `src/features/dashboard/components/Sidebar.tsx`

Agregar nuevo item de navegación:

```typescript
// En la sección de navigation items, agregar después de Dashboard:

{
  name: 'AI Setup',
  href: '/dashboard/ai-setup',
  icon: SparklesIcon,
  badge: 'Nuevo',
},
```

**Criterios de aceptación:**
- [ ] Link visible en sidebar
- [ ] Badge "Nuevo" visible
- [ ] Navegación funciona

---

### 5.8 Export Barrel

**Archivo:** `src/features/setup-assistant/index.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Exports
// =====================================================

// Types
export type {
  SetupConversation,
  SetupMessage,
  MessageAttachment,
  MessageAction,
  VisionAnalysis,
  UsageInfo,
  ConversationStatus,
  MessageRole,
  SetupModule,
  CreateConversationRequest,
  CreateConversationResponse,
  SendMessageRequest,
  SendMessageResponse,
  UploadResponse,
  AnalyzeImageRequest,
  AnalyzeImageResponse,
} from './types';

// Hooks
export { useSetupAssistant } from './hooks/useSetupAssistant';

// Components
export { ChatMessage } from './components/ChatMessage';
export { ChatInput } from './components/ChatInput';
export { TypingIndicator } from './components/TypingIndicator';
export { UsageIndicator } from './components/UsageIndicator';

// Services
export { setupAssistantService } from './services/setup-assistant.service';
export { visionService } from './services/vision.service';
```

**Criterios de aceptación:**
- [ ] Todos los exports necesarios
- [ ] Sin dependencias circulares

---

## Validación de Fase 5

```bash
# Verificar tipos
npm run typecheck

# Verificar lint
npm run lint

# Verificar build
npm run build

# Test manual
# 1. Navegar a /dashboard/ai-setup
# 2. Verificar welcome screen
# 3. Enviar mensaje de prueba
# 4. Subir imagen
# 5. Verificar animaciones
```

---

## Checklist de Fase 5

- [ ] 5.1 Hook useSetupAssistant funcional
- [ ] 5.2 ChatMessage renderiza correctamente
- [ ] 5.3 ChatInput con upload funciona
- [ ] 5.4 TypingIndicator animado
- [ ] 5.5 UsageIndicator muestra límites
- [ ] 5.6 Page completa funciona
- [ ] 5.7 Sidebar actualizado
- [ ] 5.8 Exports configurados
- [ ] Typecheck pasa
- [ ] Lint pasa
- [ ] Build exitoso
- [ ] UI responsiva

---

## Siguiente Fase

→ [FASE-6-LIMITS.md](./FASE-6-LIMITS.md)
