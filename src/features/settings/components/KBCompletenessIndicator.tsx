// =====================================================
// TIS TIS PLATFORM - KB Completeness Indicator
// Shows intelligent quality scoring of Knowledge Base
// Premium design with Apple/Lovable inspiration
// =====================================================

'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';

// Scoring Engine imports
import {
  calculateKBScore,
  getKBStatusSummary,
  getNextStep,
  convertKBDataForScoring,
} from '@/src/shared/config/kb-scoring-service';
import {
  getStatusColor,
  getCategoryIcon,
  type ScoringCategory,
  type KBScoringResult,
} from '@/src/shared/config/kb-scoring-engine';
import type { VerticalType } from '@/src/shared/config/verticals';

// ======================
// TYPES
// ======================
interface KBData {
  instructions: Array<{ instruction_type?: string; is_active: boolean; instruction?: string; title?: string; id?: string }>;
  policies: Array<{ policy_type?: string; is_active: boolean; policy_text?: string; title?: string; id?: string }>;
  articles: Array<{ category?: string; is_active: boolean; content?: string; title?: string; id?: string }>;
  templates: Array<{ trigger_type?: string; is_active: boolean; template_text?: string; name?: string; id?: string }>;
  competitors: Array<{ is_active: boolean; competitor_name?: string; response_strategy?: string; id?: string }>;
}

interface AdditionalData {
  services?: Array<{ id: string; name?: string; is_active: boolean }>;
  branches?: Array<{ id: string; name?: string; operating_hours?: Record<string, unknown>; is_active: boolean }>;
  staff?: Array<{ id: string; first_name?: string; last_name?: string; role?: string; is_active: boolean }>;
}

interface Props {
  data: KBData;
  additionalData?: AdditionalData;
  vertical?: VerticalType;
  className?: string;
  compact?: boolean;
  showRecommendations?: boolean;
  maxRecommendations?: number;
}

// ======================
// COMPONENT
// ======================
export function KBCompletenessIndicator({
  data,
  additionalData,
  vertical = 'dental',
  className,
  compact = false,
  showRecommendations = true,
  maxRecommendations = 3,
}: Props) {
  // Calculate scoring result
  const scoringResult = useMemo<KBScoringResult>(() => {
    const convertedData = convertKBDataForScoring(data, additionalData);
    return calculateKBScore(convertedData, vertical);
  }, [data, additionalData, vertical]);

  // Get status summary
  const statusSummary = useMemo(
    () => getKBStatusSummary(scoringResult),
    [scoringResult]
  );

  // Get next step
  const nextStep = useMemo(
    () => getNextStep(scoringResult),
    [scoringResult]
  );

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50', ring: 'ring-green-500/20' };
    if (score >= 70) return { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50', ring: 'ring-blue-500/20' };
    if (score >= 50) return { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50', ring: 'ring-amber-500/20' };
    return { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50', ring: 'ring-red-500/20' };
  };

  const scoreColors = getScoreColor(scoringResult.totalScore);

  // ======================
  // COMPACT VERSION
  // ======================
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div
          className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden"
          role="progressbar"
          aria-valuenow={scoringResult.totalScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Calidad de Knowledge Base: ${scoringResult.totalScore}%`}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${scoringResult.totalScore}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={cn('h-full rounded-full', scoreColors.bg)}
          />
        </div>
        <span className={cn('text-sm font-semibold tabular-nums', scoreColors.text)} aria-hidden="true">
          {scoringResult.totalScore}%
        </span>
      </div>
    );
  }

  // ======================
  // FULL VERSION
  // ======================
  return (
    <div className={cn('bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm', className)}>
      {/* Header with Score */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-gray-900 text-lg">
              Completitud de tu Base de Conocimiento
            </h4>
            <p className="text-sm text-gray-500 mt-0.5">
              {statusSummary.description}
            </p>
          </div>

          {/* Score Badge - Apple-style circular indicator */}
          <div className={cn(
            'relative flex items-center justify-center w-16 h-16 rounded-full',
            scoreColors.light,
            'ring-4',
            scoreColors.ring
          )}>
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-gray-200"
              />
              <motion.circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                className={scoreColors.text}
                initial={{ strokeDasharray: '0 100' }}
                animate={{ strokeDasharray: `${scoringResult.totalScore} 100` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                style={{
                  strokeDashoffset: 0,
                }}
              />
            </svg>
            <span className={cn('text-lg font-bold tabular-nums', scoreColors.text)}>
              {scoringResult.totalScore}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div
            className="bg-gray-100 rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-valuenow={scoringResult.totalScore}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${scoringResult.totalScore}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              className={cn('h-full rounded-full', scoreColors.bg)}
            />
          </div>
        </div>
      </div>

      {/* Category Scores - Grid Layout */}
      <div className="p-5 bg-gray-50/50">
        <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Desglose por Categoría
        </h5>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(Object.keys(scoringResult.categoryScores) as ScoringCategory[]).map((category) => {
            const categoryScore = scoringResult.categoryScores[category];
            const categoryColors = getStatusColor(categoryScore.status);

            return (
              <div
                key={category}
                className="bg-white rounded-xl p-3 border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base" aria-hidden="true">
                    {getCategoryIcon(category)}
                  </span>
                  <span className="text-xs font-medium text-gray-600 truncate">
                    {categoryScore.label}
                  </span>
                </div>

                {/* Mini progress bar */}
                <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden mb-1.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${categoryScore.score}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
                    className={cn('h-full rounded-full', categoryColors.bg)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-semibold tabular-nums', categoryColors.text)}>
                    {categoryScore.score}%
                  </span>
                  <span className="text-xs text-gray-400">
                    {categoryScore.earnedPoints}/{categoryScore.possiblePoints} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations Section */}
      {showRecommendations && scoringResult.recommendations.length > 0 && (
        <div className="p-5 border-t border-gray-100">
          <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Próximos Pasos Recomendados
          </h5>
          <div className="space-y-2">
            <AnimatePresence>
              {scoringResult.recommendations.slice(0, maxRecommendations).map((rec, index) => (
                <motion.div
                  key={rec.fieldKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border transition-colors',
                    rec.priority === 'critical' ? 'bg-red-50 border-red-200' :
                    rec.priority === 'high' ? 'bg-amber-50 border-amber-200' :
                    'bg-gray-50 border-gray-200'
                  )}
                >
                  {/* Priority indicator */}
                  <div className={cn(
                    'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    rec.priority === 'critical' ? 'bg-red-500 text-white' :
                    rec.priority === 'high' ? 'bg-amber-500 text-white' :
                    rec.priority === 'medium' ? 'bg-blue-500 text-white' :
                    'bg-gray-400 text-white'
                  )}>
                    {index + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium',
                      rec.priority === 'critical' ? 'text-red-900' :
                      rec.priority === 'high' ? 'text-amber-900' :
                      'text-gray-900'
                    )}>
                      {rec.message}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {rec.suggestion}
                    </p>
                  </div>

                  {/* Impact badge */}
                  <div className="flex-shrink-0">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      rec.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    )}>
                      +{rec.estimatedImpact} pts
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {scoringResult.recommendations.length > maxRecommendations && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              +{scoringResult.recommendations.length - maxRecommendations} recomendaciones más
            </p>
          )}
        </div>
      )}

      {/* Next Tip - Legacy compatibility */}
      {!showRecommendations && nextStep && (
        <div className="p-5 border-t border-gray-100">
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200" role="note">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-purple-900">
                  Siguiente paso: {nextStep.fieldLabel}
                </p>
                <p className="text-xs text-purple-700 mt-0.5">
                  {nextStep.suggestion}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {scoringResult.totalScore >= 90 && (
        <div className="p-4 bg-green-50 border-t border-green-100">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-green-900">
                ¡Excelente trabajo! 🌟
              </p>
              <p className="text-xs text-green-700">
                Tu Base de Conocimiento está optimizada para generar respuestas de alta calidad
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warning for low scores */}
      {scoringResult.totalScore < 50 && (
        <div className="p-4 bg-amber-50 border-t border-amber-100">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900">
                Tu agente necesita más información
              </p>
              <p className="text-xs text-amber-700">
                Completa los campos esenciales para que el agente pueda responder correctamente
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>
          {scoringResult.stats.completedFields} de {scoringResult.stats.totalFields} campos completos
        </span>
        {scoringResult.stats.placeholdersDetected > 0 && (
          <span className="text-orange-600 font-medium">
            ⚠️ {scoringResult.stats.placeholdersDetected} placeholder{scoringResult.stats.placeholdersDetected > 1 ? 's' : ''} detectado{scoringResult.stats.placeholdersDetected > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ======================
// EXPORTS
// ======================
export type { KBData, AdditionalData, Props as KBCompletenessIndicatorProps };
