'use client';

// =====================================================
// TIS TIS PLATFORM - Chat Input Component
// Sprint 5: AI-powered configuration assistant
// Redesigned: Cowork-inspired layout with file cards
// Layout: File cards above, input with inline buttons
// =====================================================

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { FilePreviewCard } from './FilePreviewCard';
import type { MessageAttachment, UploadResponse } from '../types';

// Icons (using lucide-react)
import {
  Send,
  Image as ImageIcon,
  Paperclip,
  Loader2,
  X,
  AlertCircle,
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

// Supported file types
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp';
const ACCEPTED_DOC_TYPES = '.pdf,.doc,.docx,.txt,.csv,.xlsx,.md';

// Limits
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB - must match server config

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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
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

  // Handle file selection (generic handler for both image and doc inputs)
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Clear previous error
    setUploadError(null);

    // Check if adding these files would exceed the limit
    const currentCount = attachments.length;
    const availableSlots = MAX_ATTACHMENTS - currentCount;

    if (availableSlots <= 0) {
      setUploadError(`Máximo ${MAX_ATTACHMENTS} archivos permitidos`);
      e.target.value = '';
      return;
    }

    // Only process files up to the available slots
    const filesToUpload = Array.from(files).slice(0, availableSlots);

    // Client-side validation: empty files
    const emptyFile = filesToUpload.find(f => f.size === 0);
    if (emptyFile) {
      setUploadError(`"${emptyFile.name}" está vacío`);
      e.target.value = '';
      return;
    }

    // Client-side validation: oversized files
    const oversizedFile = filesToUpload.find(f => f.size > MAX_FILE_SIZE);
    if (oversizedFile) {
      const maxMB = MAX_FILE_SIZE / (1024 * 1024);
      setUploadError(`"${oversizedFile.name}" es demasiado grande. Máximo ${maxMB}MB`);
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      for (const file of filesToUpload) {
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
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Error al subir archivo';
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      // Reset input value to allow re-selecting same file
      e.target.value = '';
    }
  }, [attachments.length, onUpload]);

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
        trimmedContent || 'Analiza estos archivos',
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
  const hasAttachments = attachments.length > 0;
  const isAtMaxAttachments = attachments.length >= MAX_ATTACHMENTS;

  return (
    <div className="flex flex-col gap-3">
      {/* File Preview Cards - Above input (Cowork style) */}
      <AnimatePresence mode="popLayout">
        {hasAttachments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: appleEasing }}
            className="flex flex-wrap gap-2"
          >
            {attachments.map((attachment, index) => (
              <FilePreviewCard
                key={`${attachment.url}-${index}`}
                url={attachment.url}
                filename={attachment.filename}
                mimeType={attachment.mimeType}
                size={attachment.size}
                type={attachment.type}
                onRemove={() => removeAttachment(index)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Container - Cowork-inspired design */}
      <div
        className={cn(
          'relative flex items-center',
          'bg-slate-50 dark:bg-slate-800 rounded-2xl',
          'border border-slate-200 dark:border-slate-700',
          'focus-within:border-tis-coral focus-within:ring-2 focus-within:ring-tis-coral/20',
          'transition-all duration-200',
          'px-2 py-1.5',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Subir imagen"
        />
        <input
          ref={docInputRef}
          type="file"
          accept={ACCEPTED_DOC_TYPES}
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Subir documento"
        />

        {/* Left side buttons - Image and Document */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Image upload button */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled || isUploading || isAtMaxAttachments}
            aria-label={isAtMaxAttachments ? `Máximo ${MAX_ATTACHMENTS} archivos` : 'Adjuntar imagen'}
            title={isAtMaxAttachments ? `Máximo ${MAX_ATTACHMENTS} archivos` : 'Adjuntar imagen'}
            className={cn(
              'p-2 rounded-lg flex-shrink-0',
              'text-slate-400 dark:text-slate-500',
              'hover:text-tis-coral hover:bg-slate-100 dark:hover:bg-slate-700',
              'transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400'
            )}
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Document upload button */}
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={disabled || isUploading || isAtMaxAttachments}
            aria-label={isAtMaxAttachments ? `Máximo ${MAX_ATTACHMENTS} archivos` : 'Adjuntar documento'}
            title={isAtMaxAttachments ? `Máximo ${MAX_ATTACHMENTS} archivos` : 'Adjuntar documento'}
            className={cn(
              'p-2 rounded-lg flex-shrink-0',
              'text-slate-400 dark:text-slate-500',
              'hover:text-tis-coral hover:bg-slate-100 dark:hover:bg-slate-700',
              'transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400'
            )}
          >
            <Paperclip className="w-5 h-5" />
          </button>
        </div>

        {/* Textarea - Center */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className={cn(
            'flex-1 py-2 px-2',
            'bg-transparent resize-none',
            'text-sm text-slate-900 dark:text-slate-100',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'focus:outline-none',
            'disabled:cursor-not-allowed',
            'min-w-0'
          )}
          style={{ minHeight: '40px', maxHeight: '200px' }}
        />

        {/* Right side - Send button */}
        <div className="flex items-center flex-shrink-0">
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Enviar mensaje"
            className={cn(
              'p-2.5 rounded-xl flex-shrink-0',
              'transition-all duration-200',
              canSend
                ? 'bg-tis-coral text-white hover:bg-tis-pink shadow-sm hover:shadow-md'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Upload indicator / Error message */}
      <AnimatePresence mode="wait">
        {isUploading && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 text-xs text-slate-500 px-1"
          >
            <Loader2 className="w-3 h-3 animate-spin text-tis-coral" />
            <span>Subiendo archivo...</span>
          </motion.div>
        )}
        {uploadError && !isUploading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 text-xs text-red-500 px-1"
          >
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span className="flex-1">{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="p-0.5 hover:bg-red-100 rounded transition-colors"
              aria-label="Cerrar error"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
