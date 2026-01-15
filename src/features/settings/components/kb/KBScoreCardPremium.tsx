// =====================================================
// TIS TIS PLATFORM - KB Score Card Premium
// Apple Health-inspired circular progress with premium design
// Part of Knowledge Base Redesign - FASE 1.1
// =====================================================

'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/src/shared/utils';

// Scoring Engine imports
import {
  calculateKBScore,
  getKBStatusSummary,
  getNextStep,
  convertKBDataForScoring,
} from '@/src/shared/config/kb-scoring-service';
import type { KBScoringResult } from '@/src/shared/config/kb-scoring-engine';
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
  branches?: Array<{ id: string; name?: string; operating_hours?: Record<string, unknown> | null; is_active: boolean }>;
  staff?: Array<{ id: string; first_name?: string; last_name?: string; role?: string; is_active: boolean }>;
}

interface Props {
  data: KBData;
  additionalData?: AdditionalData;
  vertical?: VerticalType;
  className?: string;
  previousScore?: number; // For delta calculation
  onNextStepClick?: (step: { category: string; fieldKey: string }) => void;
}

// ======================
// ANIMATED COUNTER
// ======================
function AnimatedScore({ value, className }: { value: number; className?: string }) {
  const springValue = useSpring(0, { stiffness: 100, damping: 30 });
  const displayValue = useTransform(springValue, (v) => Math.round(v));
  const [displayNumber, setDisplayNumber] = useState(0);

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  useEffect(() => {
    const unsubscribe = displayValue.on('change', (v) => setDisplayNumber(v));
    return unsubscribe;
  }, [displayValue]);

  return (
    <span className={cn('tabular-nums', className)}>
      {displayNumber}
    </span>
  );
}

// ======================
// SCORE GRADIENT
// ======================
function getScoreGradient(score: number) {
  // Apple Health-style gradients based on score
  if (score >= 90) {
    return {
      gradient: 'from-emerald-400 via-green-500 to-teal-600',
      glow: 'rgba(16, 185, 129, 0.4)',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      ring: 'ring-emerald-500/30',
      label: 'Excelente',
      icon: '✨',
    };
  }
  if (score >= 70) {
    return {
      gradient: 'from-blue-400 via-indigo-500 to-purple-600',
      glow: 'rgba(99, 102, 241, 0.4)',
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      ring: 'ring-indigo-500/30',
      label: 'Muy Bien',
      icon: '💪',
    };
  }
  if (score >= 50) {
    return {
      gradient: 'from-amber-400 via-orange-500 to-red-500',
      glow: 'rgba(245, 158, 11, 0.4)',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      ring: 'ring-amber-500/30',
      label: 'En Progreso',
      icon: '🚧',
    };
  }
  return {
    gradient: 'from-rose-400 via-red-500 to-pink-600',
    glow: 'rgba(244, 63, 94, 0.4)',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    ring: 'ring-rose-500/30',
    label: 'Necesita Atención',
    icon: '⚠️',
  };
}

// ======================
// CIRCULAR PROGRESS
// ======================
function CircularProgress({
  score,
  size = 140,
  strokeWidth = 12,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const scoreGradient = getScoreGradient(score);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
    >
      {/* Glow effect */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="absolute inset-0 rounded-full blur-xl"
        style={{
          background: `radial-gradient(circle, ${scoreGradient.glow} 0%, transparent 70%)`,
        }}
      />

      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={score >= 90 ? '#34d399' : score >= 70 ? '#818cf8' : score >= 50 ? '#fbbf24' : '#fb7185'} />
            <stop offset="50%" stopColor={score >= 90 ? '#22c55e' : score >= 70 ? '#6366f1' : score >= 50 ? '#f97316' : '#ef4444'} />
            <stop offset="100%" stopColor={score >= 90 ? '#14b8a6' : score >= 70 ? '#a855f7' : score >= 50 ? '#ef4444' : '#ec4899'} />
          </linearGradient>
          {/* Drop shadow filter */}
          <filter id="scoreGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={scoreGradient.glow} floodOpacity="0.5"/>
          </filter>
        </defs>

        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter="url(#scoreGlow)"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${(score / 100) * circumference} ${circumference}` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline">
          <AnimatedScore
            value={score}
            className={cn('text-4xl font-bold', scoreGradient.text)}
          />
          <span className={cn('text-lg font-medium ml-0.5', scoreGradient.text)}>%</span>
        </div>
        <motion.span
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-xs font-medium text-gray-500 mt-1"
        >
          {scoreGradient.label}
        </motion.span>
      </div>
    </div>
  );
}

// ======================
// DELTA BADGE
// ======================
function DeltaBadge({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined || previous === current) return null;

  const delta = current - previous;
  const isPositive = delta > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 1, type: 'spring', stiffness: 200 }}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        isPositive
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-rose-100 text-rose-700'
      )}
    >
      <svg
        className={cn('w-3 h-3', !isPositive && 'rotate-180')}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
      </svg>
      {isPositive ? '+' : ''}{delta}% desde ayer
    </motion.div>
  );
}

// ======================
// NEXT STEP CARD
// ======================
function NextStepCard({
  step,
  onClick
}: {
  step: { fieldKey: string; fieldLabel: string; suggestion: string; impact: number };
  onClick?: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-xl border-2 border-dashed transition-all text-left group',
        'border-purple-200 bg-purple-50/50 hover:border-purple-400 hover:bg-purple-50',
        'dark:border-purple-800'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Animated arrow */}
        <div className={cn(
          'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform',
          'bg-gradient-to-br from-purple-500 to-indigo-600 text-white',
          'group-hover:scale-110 group-hover:rotate-3'
        )}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
              Próximo Paso
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
              +{step.impact} pts
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
            {step.fieldLabel}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {step.suggestion}
          </p>
        </div>

        {/* Chevron */}
        <svg
          className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition-colors flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.button>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function KBScoreCardPremium({
  data,
  additionalData,
  vertical = 'dental',
  className,
  previousScore,
  onNextStepClick,
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

  const scoreGradient = getScoreGradient(scoringResult.totalScore);

  // Quick stats
  const totalItems = data.instructions.length + data.policies.length +
    data.articles.length + data.templates.length + data.competitors.length;
  const activeItems =
    data.instructions.filter(i => i.is_active).length +
    data.policies.filter(p => p.is_active).length +
    data.articles.filter(a => a.is_active).length +
    data.templates.filter(t => t.is_active).length +
    data.competitors.filter(c => c.is_active).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-white',
        'border border-gray-200/60',
        'shadow-lg shadow-gray-200/50',
        className
      )}
    >
      {/* Decorative gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={cn(
          'absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-30 blur-3xl',
          scoreGradient.gradient.replace('from-', 'bg-').split(' ')[0]
        )} />
        <div className={cn(
          'absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-20 blur-3xl',
          'bg-purple-500'
        )} />
      </div>

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">
                Salud de tu Base de Conocimiento
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Pro
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {statusSummary.description}
            </p>
          </div>

          {/* Delta badge */}
          <DeltaBadge current={scoringResult.totalScore} previous={previousScore} />
        </div>

        {/* Main content: Circle + Stats */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">
          {/* Circular Progress */}
          <div className="flex-shrink-0">
            <CircularProgress score={scoringResult.totalScore} />
          </div>

          {/* Stats Grid */}
          <div className="flex-1 w-full">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Total Items */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center p-3 rounded-xl bg-gray-50"
              >
                <div className="text-2xl font-bold text-gray-900 tabular-nums">
                  {totalItems}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  Total Items
                </div>
              </motion.div>

              {/* Active Items */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center p-3 rounded-xl bg-emerald-50"
              >
                <div className="text-2xl font-bold text-emerald-600 tabular-nums">
                  {activeItems}
                </div>
                <div className="text-xs text-emerald-600 font-medium">
                  Activos
                </div>
              </motion.div>

              {/* Fields Complete */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
                className="text-center p-3 rounded-xl bg-indigo-50"
              >
                <div className="text-2xl font-bold text-indigo-600 tabular-nums">
                  {scoringResult.stats.completedFields}/{scoringResult.stats.totalFields}
                </div>
                <div className="text-xs text-indigo-600 font-medium">
                  Campos
                </div>
              </motion.div>
            </div>

            {/* Next Step Card */}
            {nextStep && scoringResult.totalScore < 100 && (
              <NextStepCard
                step={{
                  fieldKey: nextStep.fieldKey,
                  fieldLabel: nextStep.fieldLabel,
                  suggestion: nextStep.suggestion,
                  impact: nextStep.estimatedImpact,
                }}
                onClick={() => onNextStepClick?.({
                  category: nextStep.category,
                  fieldKey: nextStep.fieldKey
                })}
              />
            )}

            {/* Success message when 100% */}
            {scoringResult.totalScore >= 100 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      Base de Conocimiento Completa
                    </p>
                    <p className="text-xs text-emerald-600">
                      Tu asistente tiene toda la información necesaria
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Placeholders warning */}
        <AnimatePresence>
          {scoringResult.stats.placeholdersDetected > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-3 rounded-xl bg-orange-50 border border-orange-200"
            >
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium text-orange-700">
                  {scoringResult.stats.placeholdersDetected} placeholder{scoringResult.stats.placeholdersDetected > 1 ? 's' : ''} detectado{scoringResult.stats.placeholdersDetected > 1 ? 's' : ''}
                </span>
                <span className="text-orange-600">
                  - Reemplázalos con información real
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ======================
// EXPORTS
// ======================
export type { KBData, AdditionalData, Props as KBScoreCardPremiumProps };
