'use client';

// =====================================================
// TIS TIS PLATFORM - Chat Input Component
// Sprint 5: AI-powered configuration assistant
// =====================================================

import React, { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { Button } from '@/src/shared/components/ui/Button';
import type { MessageAttachment, UploadResponse } from '../types';

// Icons (using lucide-react)
import {
  Send,
  Image as ImageIcon,
  Paperclip,
  X,
} from 'lucide-react';

// =====================================================
// TYPES
// =====================================================

interface PendingAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type: 'image' | 'document';
}

interface ChatInputProps {
  onSend: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  onUpload: (file: File) => Promise<UploadResponse>;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// =====================================================
// COMPONENT
// =====================================================

export function ChatInput({
  onSend,
  onUpload,
  disabled = false,
  isLoading = false,
  placeholder = '¿Qué te gustaría configurar?',
  inputRef: externalRef,
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
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
        const result = await onUpload(file);
        setAttachments((prev) => [
          ...prev,
          {
            url: result.url,
            filename: result.filename,
            mimeType: result.mimeType,
            size: result.size,
            type: result.mimeType.startsWith('image/') ? 'image' : 'document',
          },
        ]);
      }
    } catch (error) {
      console.error('[ChatInput] Upload failed:', error);
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
    if (isLoading) return; // Prevent double-click

    try {
      // Convert to MessageAttachment format
      const messageAttachments: MessageAttachment[] = attachments.map(att => ({
        type: att.type,
        url: att.url,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
      }));

      await onSend(
        trimmedContent || 'Analiza estas imágenes',
        messageAttachments.length > 0 ? messageAttachments : undefined
      );

      // Clear input
      setContent('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('[ChatInput] Send failed:', error);
    }
  }, [content, attachments, isLoading, onSend, textareaRef]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const canSend = (content.trim() || attachments.length > 0) && !disabled && !isLoading;

  return (
    <div>
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
                  <Image
                    src={attachment.url}
                    alt={attachment.filename}
                    width={64}
                    height={64}
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                    unoptimized
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                    <Paperclip className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  aria-label={`Eliminar ${attachment.filename}`}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
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
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
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
            className="text-slate-500 hover:text-slate-700"
          >
            <ImageIcon className="w-5 h-5" />
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
              'w-full resize-none rounded-2xl border border-slate-200',
              'bg-slate-50 px-4 py-3 pr-12',
              'text-sm text-slate-900',
              'placeholder:text-slate-400',
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
              'rounded-full w-8 h-8 p-0 min-h-0',
              'bg-tis-coral hover:bg-tis-pink',
              'disabled:bg-slate-300'
            )}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <Send className="w-4 h-4 text-white" />
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
            className="mt-2 text-xs text-slate-500 flex items-center gap-2"
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
