'use client';

// =====================================================
// TIS TIS PLATFORM - Chat Message Component
// Sprint 5: AI-powered configuration assistant
// =====================================================

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { Avatar } from '@/src/shared/components/ui/Avatar';
import { Badge } from '@/src/shared/components/ui/Badge';
import type { SetupMessage, MessageAction, MessageAttachment, VisionAnalysis } from '../types';

// Icons (using lucide-react)
import {
  CheckCircle,
  XCircle,
  FileText,
  Sparkles,
} from 'lucide-react';

// =====================================================
// TYPES
// =====================================================

interface ChatMessageProps {
  message: SetupMessage;
}

// Apple-like easing for smooth animations
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// =====================================================
// MAIN COMPONENT
// =====================================================

export const ChatMessage = memo(function ChatMessage({
  message,
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
          <Avatar size="sm" name="Usuario" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
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
              : 'bg-slate-100 text-slate-900 rounded-tl-md'
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
              <AttachmentPreview key={`${attachment.url}-${index}`} attachment={attachment} />
            ))}
          </div>
        )}

        {/* Actions taken (only for assistant) */}
        {isAssistant && message.actionsTaken && message.actionsTaken.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.actionsTaken.map((action, index) => (
              <ActionBadge key={`${action.type}-${action.module}-${index}`} action={action} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-slate-400">
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
  attachment: MessageAttachment;
}

function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const isImage = attachment.type === 'image' || attachment.mimeType?.startsWith('image/');

  if (isImage) {
    return (
      <div className="relative group">
        <img
          src={attachment.url}
          alt={attachment.filename || 'Imagen'}
          loading="lazy"
          className="w-32 h-32 object-cover rounded-lg border border-slate-200"
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
      className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
    >
      <FileText className="w-4 h-4 text-slate-500" />
      <span className="text-sm text-slate-700 truncate max-w-[150px]">
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
    promotions: 'promoción',
    staff: 'personal',
    branches: 'sucursal',
  };

  return (
    <Badge
      variant={isSuccess ? 'success' : 'danger'}
      size="sm"
      className="gap-1"
    >
      {isSuccess ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
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
