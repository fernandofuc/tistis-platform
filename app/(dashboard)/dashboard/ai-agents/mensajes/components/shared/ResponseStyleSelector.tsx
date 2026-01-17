// =====================================================
// TIS TIS PLATFORM - Response Style Selector Component
// Premium UI component for selecting response styles
// Design: Apple/Google/Lovable aesthetics with TIS TIS colors
// =====================================================

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { ResponseStyle } from '@/src/shared/config/agent-templates';
import { RESPONSE_STYLES, RESPONSE_STYLE_EXAMPLES } from '@/src/shared/config/agent-templates';

// ======================
// TYPES
// ======================

interface ResponseStyleSelectorProps {
  value: ResponseStyle;
  onChange: (value: ResponseStyle) => void;
  colorScheme?: 'purple' | 'orange';
  showExtendedExamples?: boolean;
  disabled?: boolean;
}

type ExampleType = 'greeting' | 'priceInquiry' | 'objection' | 'appointment' | 'farewell';

const EXAMPLE_LABELS: Record<ExampleType, { label: string; icon: string }> = {
  greeting: { label: 'Saludo', icon: '👋' },
  priceInquiry: { label: 'Precios', icon: '💰' },
  objection: { label: 'Objeción', icon: '🤔' },
  appointment: { label: 'Cita', icon: '📅' },
  farewell: { label: 'Despedida', icon: '✨' },
};

// ======================
// COMPONENT
// ======================

export function ResponseStyleSelector({
  value,
  onChange,
  colorScheme = 'purple',
  showExtendedExamples = true,
  disabled = false,
}: ResponseStyleSelectorProps) {
  const [selectedExample, setSelectedExample] = useState<ExampleType>('priceInquiry');

  const colors = {
    purple: {
      border: 'border-purple-500',
      bg: 'bg-purple-50',
      gradient: 'from-purple-50 to-indigo-50',
      borderGradient: 'border-purple-100',
      dot: 'bg-purple-500',
      text: 'text-purple-600',
      badge: 'bg-purple-100 text-purple-700',
      badgeRecommended: 'bg-green-100 text-green-700',
      tabActive: 'bg-purple-500 text-white',
      tabInactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    },
    orange: {
      border: 'border-orange-500',
      bg: 'bg-orange-50',
      gradient: 'from-orange-50 to-pink-50',
      borderGradient: 'border-orange-100',
      dot: 'bg-orange-500',
      text: 'text-orange-600',
      badge: 'bg-orange-100 text-orange-700',
      badgeRecommended: 'bg-green-100 text-green-700',
      tabActive: 'bg-orange-500 text-white',
      tabInactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    },
  };

  const c = colors[colorScheme];

  const currentStyleExamples = RESPONSE_STYLE_EXAMPLES[value];

  return (
    <div className="space-y-4">
      {/* Style Selection Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {RESPONSE_STYLES.map((style) => (
          <button
            key={style.value}
            onClick={() => !disabled && onChange(style.value)}
            disabled={disabled}
            className={cn(
              'relative p-4 rounded-xl border-2 text-left transition-all duration-200',
              value === style.value
                ? `${c.border} ${c.bg} shadow-sm`
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Selection indicator */}
            {value === style.value && (
              <motion.div
                layoutId="styleIndicator"
                className={cn('absolute top-2 right-2 w-2 h-2 rounded-full', c.dot)}
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}

            {/* Content */}
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 text-sm">{style.label}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{style.description}</div>

              {/* Recommended badge */}
              {style.recommended && (
                <div className="pt-1">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', c.badgeRecommended)}>
                    Recomendado
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Example Preview Section */}
      {showExtendedExamples && value && currentStyleExamples && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-5 rounded-2xl border',
            `bg-gradient-to-br ${c.gradient} ${c.borderGradient}`
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', c.dot)} />
              <span className="text-sm font-semibold text-slate-700">
                Vista previa del estilo
              </span>
            </div>
            <span className={cn('text-xs px-2 py-1 rounded-lg font-medium', c.badge)}>
              {RESPONSE_STYLES.find(s => s.value === value)?.label}
            </span>
          </div>

          {/* Example Type Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(EXAMPLE_LABELS) as ExampleType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedExample(type)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  selectedExample === type ? c.tabActive : c.tabInactive
                )}
              >
                <span className="mr-1">{EXAMPLE_LABELS[type].icon}</span>
                {EXAMPLE_LABELS[type].label}
              </button>
            ))}
          </div>

          {/* Example Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedExample}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {/* Avatar placeholder */}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  colorScheme === 'purple' ? 'bg-purple-500' : 'bg-orange-500',
                  'text-white text-xs font-bold'
                )}>
                  AI
                </div>

                {/* Message bubble */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {currentStyleExamples[selectedExample]}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Tip */}
          <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Estos ejemplos muestran cómo tu asistente responderá según el estilo seleccionado.
              Puedes personalizar aún más con instrucciones adicionales.
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default ResponseStyleSelector;
