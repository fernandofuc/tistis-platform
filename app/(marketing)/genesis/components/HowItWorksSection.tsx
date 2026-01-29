// =====================================================
// TIS TIS Genesis - How It Works Section
// Timeline visual de las 5 fases de preparación robótica
// Diseño estilo Google/Apple con números grandes
// =====================================================

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Database,
  Gauge,
  Search,
  Bot,
  Users,
  ArrowRight,
} from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  type BaseSectionProps,
  type StepItem,
  GENESIS_GRADIENTS,
  SECTION_SPACING,
  VIEWPORT_CONFIG,
  APPLE_EASE,
  cardHover,
} from './types';

// =====================================================
// Steps Data - 5 Phases of Genesis
// =====================================================

const GENESIS_PHASES: StepItem[] = [
  {
    id: 'data-collection',
    number: 1,
    icon: Database,
    title: 'Acumula tus datos',
    description: 'Mientras usas TIS TIS, cada cita, venta y operación se registra y estructura. Años de datos operativos se convierten en tu mayor activo para la integración robótica.',
    highlight: 'Datos estructurados',
  },
  {
    id: 'robot-ready-score',
    number: 2,
    icon: Gauge,
    title: 'Robot-Ready Score',
    description: 'Medimos qué tan preparado está tu negocio con una puntuación de 0 a 100. Cuanto más tiempo uses TIS TIS, más alto será tu score.',
    highlight: 'Medición continua',
  },
  {
    id: 'task-analysis',
    number: 3,
    icon: Search,
    title: 'Análisis de tareas',
    description: 'Identificamos automáticamente qué procesos de tu operación diaria son candidatos perfectos para automatización robótica futura.',
    highlight: 'Análisis inteligente',
  },
  {
    id: 'robot-training',
    number: 4,
    icon: Bot,
    title: 'Entrenamiento del robot',
    description: 'Cuando los robots estén disponibles, tus datos históricos servirán como entrenamiento personalizado. El robot "aprenderá" tu negocio antes de llegar.',
    highlight: 'Pre-entrenamiento',
  },
  {
    id: 'gradual-integration',
    number: 5,
    icon: Users,
    title: 'Integración gradual',
    description: 'El robot se une a tu equipo humano de forma natural. Sin curva de aprendizaje abrupta, porque ya conoce tus procesos y preferencias.',
    highlight: 'Transición suave',
  },
];

// =====================================================
// Sub-Components
// =====================================================

interface PhaseCardProps {
  phase: StepItem;
  index: number;
  isLast: boolean;
  prefersReducedMotion: boolean | null;
}

function PhaseCard({ phase, index, isLast, prefersReducedMotion }: PhaseCardProps) {
  const Icon = phase.icon;
  const isEven = index % 2 === 0;

  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 32 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      whileHover={prefersReducedMotion ? undefined : cardHover}
      viewport={VIEWPORT_CONFIG.standard}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: 0.6, delay: index * 0.15, ease: APPLE_EASE }
      }
      className="relative group"
    >
      {/* Desktop: Alternating layout */}
      <div className={`
        hidden lg:flex items-center gap-8
        ${isEven ? 'flex-row' : 'flex-row-reverse'}
      `}>
        {/* Content Card */}
        <div className="flex-1">
          <div className={`
            p-6 xl:p-8
            bg-white dark:bg-slate-800/50
            rounded-2xl xl:rounded-3xl
            border border-slate-100 dark:border-slate-700/50
            shadow-sm group-hover:shadow-lg
            transition-shadow duration-300
            ${isEven ? 'text-right' : 'text-left'}
          `}>
            {/* Highlight badge */}
            <span className={`
              inline-block text-xs font-semibold uppercase tracking-widest
              bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent
              mb-3
            `}>
              {phase.highlight}
            </span>

            {/* Title */}
            <h3 className="text-xl xl:text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {phase.title}
            </h3>

            {/* Description */}
            <p className="text-sm xl:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {phase.description}
            </p>
          </div>
        </div>

        {/* Center: Number + Icon */}
        <div className="relative flex flex-col items-center">
          {/* Number circle with Genesis gradient */}
          <div className={`
            w-16 h-16 xl:w-20 xl:h-20 rounded-full
            bg-gradient-to-br ${GENESIS_GRADIENTS.robotic}
            flex items-center justify-center
            shadow-lg shadow-blue-500/25
            relative z-10
          `}>
            <span className="text-2xl xl:text-3xl font-bold text-white">
              {phase.number}
            </span>
          </div>

          {/* Icon below */}
          <div className="
            mt-3 w-10 h-10 xl:w-12 xl:h-12 rounded-xl
            bg-slate-100 dark:bg-slate-800
            flex items-center justify-center
          ">
            <Icon className="w-5 h-5 xl:w-6 xl:h-6 text-blue-500" aria-hidden="true" />
          </div>

          {/* Connector line */}
          {!isLast && (
            <div
              aria-hidden="true"
              className="absolute top-24 xl:top-28 left-1/2 -translate-x-1/2 w-0.5 h-24 bg-gradient-to-b from-blue-500/50 to-transparent"
            />
          )}
        </div>

        {/* Empty space for alignment */}
        <div className="flex-1" />
      </div>

      {/* Mobile/Tablet: Vertical layout */}
      <div className="lg:hidden flex gap-4 sm:gap-6">
        {/* Left: Number + Line */}
        <div className="flex flex-col items-center">
          {/* Number circle */}
          <div className={`
            w-12 h-12 sm:w-14 sm:h-14 rounded-full
            bg-gradient-to-br ${GENESIS_GRADIENTS.robotic}
            flex items-center justify-center
            shadow-lg shadow-blue-500/25
            relative z-10
          `}>
            <span className="text-xl sm:text-2xl font-bold text-white">
              {phase.number}
            </span>
          </div>

          {/* Connector line */}
          {!isLast && (
            <div
              aria-hidden="true"
              className="flex-1 w-0.5 mt-3 bg-gradient-to-b from-blue-500/30 to-transparent min-h-[80px]"
            />
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 pb-8 sm:pb-10">
          {/* Icon + Highlight */}
          <div className="flex items-center gap-3 mb-2">
            <div className="
              w-8 h-8 sm:w-9 sm:h-9 rounded-lg
              bg-blue-500/10 dark:bg-blue-500/20
              flex items-center justify-center
            ">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" aria-hidden="true" />
            </div>
            <span className={`
              text-xs font-semibold uppercase tracking-widest
              bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent
            `}>
              {phase.highlight}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">
            {phase.title}
          </h3>

          {/* Description */}
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            {phase.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function HowItWorksSection({
  className = '',
  id = 'how-it-works',
}: BaseSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id={id}
      className={`${SECTION_SPACING.lg} px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900 ${className}`}
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG.standard}
          variants={staggerContainer}
          className="text-center mb-12 sm:mb-16 lg:mb-20"
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
            Las 5 Fases
          </motion.span>

          {/* Main Heading */}
          <motion.h2
            id="how-it-works-heading"
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight"
          >
            ¿Cómo{' '}
            <span className={`bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent`}>
              funciona
            </span>
            ?
          </motion.h2>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            De usuario de TIS TIS a negocio robot-ready en 5 fases.
            Todo sucede automáticamente mientras operas.
          </motion.p>
        </motion.div>

        {/* Phases Timeline */}
        <div className="relative">
          {/* Desktop center line */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-gradient-to-b from-blue-500/20 via-blue-500/10 to-transparent"
          />

          {/* Phases */}
          <div className="space-y-6 lg:space-y-12">
            {GENESIS_PHASES.map((phase, index) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                index={index}
                isLast={index === GENESIS_PHASES.length - 1}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>
        </div>

        {/* Bottom CTA Hint */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={VIEWPORT_CONFIG.standard}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 sm:mt-16 text-center"
        >
          <div className="
            inline-flex items-center gap-2 px-5 py-2.5
            bg-blue-500/5 dark:bg-blue-500/10
            rounded-full border border-blue-500/20
          ">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Mientras más tiempo uses TIS TIS
            </span>
            <ArrowRight className="w-4 h-4 text-blue-500" aria-hidden="true" />
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              Mayor tu score
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
