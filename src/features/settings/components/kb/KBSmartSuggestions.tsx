// =====================================================
// TIS TIS PLATFORM - KB Smart Suggestions
// Intelligent suggestions based on AI Learning patterns
// Part of Knowledge Base Redesign - FASE 5
// =====================================================

'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { KBCategory } from './KBCategoryNavigation';

// ======================
// TYPES
// ======================
interface Suggestion {
  id: string;
  type: 'missing' | 'improvement' | 'ai_learning' | 'trending';
  category: KBCategory;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  source?: string;
  actionLabel?: string;
  data?: Record<string, unknown>;
}

interface AILearningInsight {
  id: string;
  pattern_type: string;
  pattern_value: string;
  frequency: number;
  confidence: number;
  example_context?: string;
}

interface Props {
  suggestions: Suggestion[];
  aiLearningInsights?: AILearningInsight[];
  onSuggestionClick: (suggestion: Suggestion) => void;
  onDismiss: (suggestionId: string) => void;
  className?: string;
  maxSuggestions?: number;
}

// ======================
// CATEGORY COLORS
// ======================
const CATEGORY_COLORS: Record<KBCategory, {
  gradient: string;
  bg: string;
  text: string;
// ARQUITECTURA V7: Solo 3 categorías (instructions y templates se movieron a Agente Mensajes)
}> = {
  policies: {
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  articles: {
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  competitors: {
    gradient: 'from-rose-500 to-pink-600',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
  },
};

// ======================
// IMPACT STYLES
// ======================
const IMPACT_STYLES = {
  high: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  medium: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  low: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
};

// ======================
// TYPE ICONS
// ======================
const TYPE_ICONS: Record<Suggestion['type'], React.ReactNode> = {
  missing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  improvement: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  ai_learning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  trending: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  ),
};

// ======================
// SUGGESTION CARD
// ======================
function SuggestionCard({
  suggestion,
  onClick,
  onDismiss,
}: {
  suggestion: Suggestion;
  onClick: () => void;
  onDismiss: () => void;
}) {
  const categoryColors = CATEGORY_COLORS[suggestion.category];
  const impactStyles = IMPACT_STYLES[suggestion.impact];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      whileHover={{ scale: 1.01 }}
      className={cn(
        'relative group rounded-xl border overflow-hidden transition-all',
        impactStyles.border,
        'bg-white',
        'hover:shadow-md'
      )}
    >
      {/* Left accent bar */}
      <div className={cn(
        'absolute left-0 top-0 bottom-0 w-1',
        `bg-gradient-to-b ${categoryColors.gradient}`
      )} />

      <div className="p-4 pl-5">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
            impactStyles.bg,
            impactStyles.text
          )}>
            {TYPE_ICONS[suggestion.type]}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header badges */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn(
                'text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded',
                impactStyles.badge
              )}>
                {suggestion.impact === 'high' ? 'Alta prioridad' :
                 suggestion.impact === 'medium' ? 'Recomendado' : 'Opcional'}
              </span>
              {suggestion.type === 'ai_learning' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  AI Learning
                </span>
              )}
            </div>

            {/* Title */}
            <h5 className="font-semibold text-gray-900 mb-1">
              {suggestion.title}
            </h5>

            {/* Description */}
            <p className="text-sm text-gray-600 line-clamp-2">
              {suggestion.description}
            </p>

            {/* Source */}
            {suggestion.source && (
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {suggestion.source}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClick}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all',
                `bg-gradient-to-r ${categoryColors.gradient}`,
                'shadow-sm hover:shadow-md'
              )}
            >
              {suggestion.actionLabel || 'Agregar'}
            </motion.button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Descartar
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ======================
// AI LEARNING INSIGHT CARD
// ======================
function AILearningCard({ insight, onApply }: { insight: AILearningInsight; onApply: () => void }) {
  const confidencePercent = Math.round(insight.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'p-4 rounded-xl',
        'bg-gradient-to-br from-purple-500/10 to-indigo-500/10',
        'border border-purple-200/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-purple-600 uppercase tracking-wider">
              {insight.pattern_type}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">
              {insight.frequency} veces detectado
            </span>
          </div>
          <p className="font-medium text-gray-900 text-sm">
            &ldquo;{insight.pattern_value}&rdquo;
          </p>
          {insight.example_context && (
            <p className="text-xs text-gray-500 mt-1 italic">
              Contexto: {insight.example_context}
            </p>
          )}
          {/* Confidence bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${confidencePercent}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              />
            </div>
            <span className="text-xs font-medium text-purple-600 tabular-nums">
              {confidencePercent}%
            </span>
          </div>
        </div>
        <button
          onClick={onApply}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-sm hover:shadow-md transition-all"
        >
          Aplicar
        </button>
      </div>
    </motion.div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function KBSmartSuggestions({
  suggestions,
  aiLearningInsights = [],
  onSuggestionClick,
  onDismiss,
  className,
  maxSuggestions = 5,
}: Props) {
  // Sort suggestions by impact
  const sortedSuggestions = useMemo(() => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    return [...suggestions]
      .sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact])
      .slice(0, maxSuggestions);
  }, [suggestions, maxSuggestions]);

  if (sortedSuggestions.length === 0 && aiLearningInsights.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-6', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Sugerencias Inteligentes
            </h3>
            <p className="text-sm text-gray-500">
              Recomendaciones para mejorar tu Knowledge Base
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
          {sortedSuggestions.length} sugerencias
        </span>
      </div>

      {/* AI Learning Insights Section */}
      {aiLearningInsights.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Patrones detectados por AI Learning
          </h4>
          <div className="space-y-2">
            {aiLearningInsights.slice(0, 3).map((insight) => (
              <AILearningCard
                key={insight.id}
                insight={insight}
                onApply={() => {
                  // Convert insight to suggestion format
                  // ARQUITECTURA V7: AI Learning ahora sugiere artículos en lugar de instrucciones
                  const suggestion: Suggestion = {
                    id: insight.id,
                    type: 'ai_learning',
                    category: 'articles',
                    title: `Agregar "${insight.pattern_value}"`,
                    description: `Patrón detectado ${insight.frequency} veces con ${Math.round(insight.confidence * 100)}% de confianza`,
                    impact: insight.confidence > 0.8 ? 'high' : insight.confidence > 0.5 ? 'medium' : 'low',
                    source: 'AI Learning',
                    data: insight as unknown as Record<string, unknown>,
                  };
                  onSuggestionClick(suggestion);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* General Suggestions */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {sortedSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onClick={() => onSuggestionClick(suggestion)}
              onDismiss={() => onDismiss(suggestion.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ======================
// EXPORTS
// ======================
export type { Suggestion, AILearningInsight, Props as KBSmartSuggestionsProps };
