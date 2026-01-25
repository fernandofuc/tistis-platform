'use client';

// =====================================================
// TIS TIS PLATFORM - Typing Indicator Component
// Sprint 5: AI-powered configuration assistant
// =====================================================

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

// =====================================================
// COMPONENT
// =====================================================

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
        <Sparkles className="w-4 h-4 text-white" />
      </div>

      {/* Typing dots */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-slate-400 rounded-full"
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
