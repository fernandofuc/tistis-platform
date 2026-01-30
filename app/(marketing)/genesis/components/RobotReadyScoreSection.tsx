// =====================================================
// TIS TIS Genesis - Robot-Ready Score Section
// Sección única mostrando el sistema de puntuación 0-100
// Diseño visual con gauge animado y barras de progreso
// =====================================================

'use client';

import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import {
  Database,
  GitBranch,
  Link2,
  BarChart3,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  type RobotReadyScoreSectionProps,
  GENESIS_GRADIENTS,
  SECTION_SPACING,
  VIEWPORT_CONFIG,
  APPLE_EASE,
  ROBOT_SCORE_COMPONENTS_DATA,
} from './types';
import type { LucideIcon } from 'lucide-react';

// =====================================================
// Icon Mapping for Score Components
// =====================================================

const SCORE_COMPONENT_ICONS: Record<string, LucideIcon> = {
  'operational-data': Database,
  'process-mapping': GitBranch,
  'integration-level': Link2,
  'data-quality': BarChart3,
};

// =====================================================
// Color Mapping for Tailwind Purge Safety
// Mapeo explícito para que Tailwind detecte las clases
// =====================================================

const COLOR_TO_BG_MAP: Record<string, { bg: string; bgLight: string }> = {
  'text-tis-coral': { bg: 'bg-tis-coral', bgLight: 'bg-tis-coral/10' },
  'text-tis-pink': { bg: 'bg-tis-pink', bgLight: 'bg-tis-pink/10' },
  'text-tis-purple': { bg: 'bg-tis-purple', bgLight: 'bg-tis-purple/10' },
  'text-blue-500': { bg: 'bg-blue-500', bgLight: 'bg-blue-500/10' },
};

/**
 * Convierte un color de texto a su equivalente de background
 * Usa mapeo explícito para seguridad con Tailwind purge
 */
function getBackgroundColor(textColor: string, light = false): string {
  const mapping = COLOR_TO_BG_MAP[textColor];
  if (!mapping) {
    // Fallback seguro si el color no está mapeado
    return light ? 'bg-slate-100' : 'bg-slate-500';
  }
  return light ? mapping.bgLight : mapping.bg;
}

// =====================================================
// Animation Utilities
// =====================================================

function useAnimatedNumber(
  target: number,
  duration: number = 2000,
  isInView: boolean,
  prefersReducedMotion: boolean | null
): number {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    if (prefersReducedMotion) {
      setCurrent(target);
      return;
    }

    let animationFrameId: number | null = null;
    let isMounted = true;
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      if (!isMounted) return;

      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(startValue + (target - startValue) * eased);

      setCurrent(value);

      if (progress < 1 && isMounted) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    // Cleanup to prevent memory leaks
    return () => {
      isMounted = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [target, duration, isInView, prefersReducedMotion]);

  return current;
}

// =====================================================
// Sub-Components
// =====================================================

interface ScoreGaugeProps {
  score: number;
  isInView: boolean;
  prefersReducedMotion: boolean | null;
}

function ScoreGauge({ score, isInView, prefersReducedMotion }: ScoreGaugeProps) {
  const animatedScore = useAnimatedNumber(score, 2500, isInView, prefersReducedMotion);

  // Calculate the stroke dashoffset for the arc
  // Full arc = 283 (circumference of circle with r=45)
  const circumference = 2 * Math.PI * 45;
  const halfCircumference = circumference * 0.75; // 270 degrees
  const offset = halfCircumference - (halfCircumference * animatedScore) / 100;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#22c55e'; // green-500
    if (score >= 60) return '#667eea'; // tis-purple
    if (score >= 40) return '#DF7373'; // tis-coral
    return '#94a3b8'; // slate-400
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Avanzado';
    if (score >= 40) return 'En progreso';
    return 'Iniciando';
  };

  return (
    <div className="relative w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80 mx-auto">
      {/* Background circle */}
      <svg
        className="w-full h-full transform -rotate-[135deg]"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-slate-200 dark:text-slate-700"
          strokeDasharray={`${halfCircumference} ${circumference}`}
        />

        {/* Progress */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={getScoreColor(animatedScore)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${halfCircumference} ${circumference}`}
          initial={{ strokeDashoffset: halfCircumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: prefersReducedMotion ? 0 : 2.5,
            ease: APPLE_EASE,
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white"
          aria-label={`Score: ${animatedScore} de 100`}
        >
          {animatedScore}
        </span>
        <span className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium mt-1">
          de 100
        </span>
        <span
          className="mt-2 px-3 py-1 text-xs sm:text-sm font-semibold rounded-full"
          style={{
            backgroundColor: `${getScoreColor(animatedScore)}20`,
            color: getScoreColor(animatedScore),
          }}
        >
          {getScoreLabel(animatedScore)}
        </span>
      </div>
    </div>
  );
}

interface ScoreComponentBarProps {
  id: string;
  label: string;
  maxPoints: number;
  currentPoints: number;
  description: string;
  color: string;
  index: number;
  isInView: boolean;
  prefersReducedMotion: boolean | null;
}

function ScoreComponentBar({
  id,
  label,
  maxPoints,
  currentPoints,
  description,
  color,
  index,
  isInView,
  prefersReducedMotion,
}: ScoreComponentBarProps) {
  const Icon = SCORE_COMPONENT_ICONS[id] || Database;
  const percentage = (currentPoints / maxPoints) * 100;
  const animatedPoints = useAnimatedNumber(
    currentPoints,
    1500 + index * 200,
    isInView,
    prefersReducedMotion
  );

  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0, x: -20 }}
      animate={isInView ? { opacity: 1, x: 0 } : undefined}
      transition={{
        duration: 0.5,
        delay: prefersReducedMotion ? 0 : 0.3 + index * 0.1,
        ease: APPLE_EASE,
      }}
      className="group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg ${getBackgroundColor(color, true)} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {label}
            </span>
            <span className={`text-sm font-bold ${color}`}>
              {animatedPoints}/{maxPoints}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${getBackgroundColor(color)}`}
          initial={{ width: 0 }}
          animate={isInView ? { width: `${percentage}%` } : { width: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 1.5,
            delay: prefersReducedMotion ? 0 : 0.5 + index * 0.15,
            ease: APPLE_EASE,
          }}
        />
      </div>

      {/* Description */}
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </motion.div>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function RobotReadyScoreSection({
  className = '',
  id = 'robot-ready-score',
  exampleScore = 73,
}: RobotReadyScoreSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  // Distribute the example score across components
  // This is illustrative - in production, each component would have its own score
  const componentScores = [
    Math.round(exampleScore * 0.26), // Operational Data (slightly higher)
    Math.round(exampleScore * 0.24), // Process Mapping
    Math.round(exampleScore * 0.22), // Integration Level
    Math.round(exampleScore * 0.28), // Data Quality (slightly higher)
  ];

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`${SECTION_SPACING.lg} px-4 sm:px-6 lg:px-8 bg-slate-50/50 dark:bg-slate-900/50 ${className}`}
      aria-labelledby="robot-ready-score-heading"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG.standard}
          variants={staggerContainer}
          className="text-center mb-12 sm:mb-16"
        >
          {/* Eyebrow */}
          <motion.span
            variants={fadeInUp}
            className={`
              inline-block text-xs sm:text-sm font-semibold uppercase tracking-widest
              bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent
              mb-3 sm:mb-4
            `}
          >
            Tu Métrica Clave
          </motion.span>

          {/* Main Heading */}
          <motion.h2
            id="robot-ready-score-heading"
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight"
          >
            Robot-Ready{' '}
            <span className={`bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent`}>
              Score
            </span>
          </motion.h2>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Una puntuación de 0 a 100 que mide qué tan preparado está tu negocio
            para integrar robots de servicio. Cuanto más alto, más rápida será tu integración.
          </motion.p>
        </motion.div>

        {/* Score Display Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Gauge */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
            viewport={VIEWPORT_CONFIG.standard}
            transition={{ duration: 0.6, ease: APPLE_EASE }}
            className="relative"
          >
            {/* Example badge - centered above gauge */}
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold">
                <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                Ejemplo: Clínica 3 años con TIS TIS
              </span>
            </div>

            <ScoreGauge
              score={exampleScore}
              isInView={isInView}
              prefersReducedMotion={prefersReducedMotion}
            />
          </motion.div>

          {/* Right: Component Breakdown */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-500" aria-hidden="true" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Componentes del Score
              </h3>
            </div>

            {ROBOT_SCORE_COMPONENTS_DATA.map((component, index) => (
              <ScoreComponentBar
                key={component.id}
                id={component.id}
                label={component.label}
                maxPoints={component.maxPoints}
                currentPoints={componentScores[index]}
                description={component.description}
                color={component.color}
                index={index}
                isInView={isInView}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}

            {/* Total */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  Score Total
                </span>
                <span className={`text-2xl font-bold bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent`}>
                  {exampleScore}/100
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom explanation */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={VIEWPORT_CONFIG.standard}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 sm:mt-16"
        >
          <div className="
            p-6 sm:p-8 lg:p-10
            bg-white dark:bg-slate-800/50
            rounded-2xl sm:rounded-3xl
            border border-slate-100 dark:border-slate-700/50
          ">
            <div className="grid grid-cols-3 gap-4 sm:gap-8 lg:gap-12">
              {/* Score Range 1 */}
              <div className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <span className="text-base sm:text-lg font-bold text-slate-400">0-39</span>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-1 text-sm sm:text-base">Iniciando</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Comenzando a acumular datos operativos
                </p>
              </div>

              {/* Score Range 2 */}
              <div className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full bg-tis-coral/10 flex items-center justify-center">
                  <span className="text-base sm:text-lg font-bold text-tis-coral">40-<br className="sm:hidden"/>79</span>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-1 text-sm sm:text-base">En Progreso</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Base sólida para integración futura
                </p>
              </div>

              {/* Score Range 3 */}
              <div className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full bg-green-500/10 flex items-center justify-center">
                  <span className="text-base sm:text-lg font-bold text-green-500">80-<br className="sm:hidden"/>100</span>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-1 text-sm sm:text-base">Robot-Ready</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Listo para integración inmediata
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
