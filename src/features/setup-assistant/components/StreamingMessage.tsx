'use client';

// =====================================================
// TIS TIS PLATFORM - Streaming Message Component
// Shows AI response text progressively with typing effect
// NOTE: Scroll is handled by parent (page.tsx), not here
// =====================================================

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { Sparkles } from 'lucide-react';

// =====================================================
// TYPES
// =====================================================

interface StreamingMessageProps {
  /** Current streamed text content */
  text: string;
  /** Whether streaming is still in progress */
  isStreaming: boolean;
  /** Optional className for styling */
  className?: string;
}

// Apple-like easing for smooth animations
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// =====================================================
// BLINKING CURSOR COMPONENT
// =====================================================

const BlinkingCursor = memo(function BlinkingCursor() {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className="inline-block w-0.5 h-4 bg-tis-coral ml-0.5 align-middle"
      aria-hidden="true"
    />
  );
});

// =====================================================
// MAIN COMPONENT
// =====================================================

export const StreamingMessage = memo(function StreamingMessage({
  text,
  isStreaming,
  className,
}: StreamingMessageProps) {
  // Don't render if no text and not streaming
  if (!text && !isStreaming) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.2, ease: appleEasing }}
      className={cn('flex gap-3 px-4 py-3', className)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 max-w-[75%]">
        {/* Message bubble */}
        <div className="rounded-2xl px-4 py-2.5 bg-slate-100 text-slate-900 rounded-tl-md">
          {/* Text content with cursor */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {text || (isStreaming ? '' : 'Pensando...')}
            {isStreaming && <BlinkingCursor />}
          </div>
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-xs text-slate-400"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-3 h-3 border border-tis-coral border-t-transparent rounded-full"
            />
            <span>Generando respuesta...</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
});

// =====================================================
// EXPORTS
// =====================================================

export default StreamingMessage;
