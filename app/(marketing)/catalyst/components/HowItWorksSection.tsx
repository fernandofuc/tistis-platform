// =====================================================
// TIS TIS Catalyst - How It Works Section
// Timeline visual del proceso de tokenización
// Diseño estilo Google/Apple con números grandes
// =====================================================

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  UserPlus,
  BarChart3,
  Coins,
  Users,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  type BaseSectionProps,
  type StepItem,
  GRADIENTS,
  SECTION_SPACING,
  VIEWPORT_CONFIG,
  APPLE_EASE,
  cardHover,
} from './types';

// =====================================================
// Steps Data
// =====================================================

const PROCESS_STEPS: StepItem[] = [
  {
    id: 'connect',
    number: 1,
    icon: UserPlus,
    title: 'Conecta tu negocio',
    description: 'Integra TIS TIS a tu operación. Capturamos automáticamente tus métricas de ventas, reservaciones y clientes.',
    highlight: 'Integración automática',
  },
  {
    id: 'verify',
    number: 2,
    icon: BarChart3,
    title: 'Verificamos tus datos',
    description: 'Nuestro sistema audita y valida tu historial operativo. Creamos un perfil de confianza basado en datos reales.',
    highlight: 'Auditoría inteligente',
  },
  {
    id: 'tokenize',
    number: 3,
    icon: Coins,
    title: 'Tokeniza tu proyecto',
    description: 'Define tu plan de expansión y conviértelo en tokens. Establece montos, plazos y condiciones de retorno.',
    highlight: 'Proceso digital',
  },
  {
    id: 'investors',
    number: 4,
    icon: Users,
    title: 'Inversionistas participan',
    description: 'Tu proyecto se presenta a nuestra red de inversionistas verificados que confían en datos, no en promesas.',
    highlight: 'Red de capital',
  },
  {
    id: 'fund',
    number: 5,
    icon: Wallet,
    title: 'Recibe tu capital',
    description: 'Una vez fondeado, recibe el capital directamente. Sin intermediarios, sin sorpresas, con total transparencia.',
    highlight: 'Capital directo',
  },
];

// =====================================================
// Sub-Components
// =====================================================

interface StepCardProps {
  step: StepItem;
  index: number;
  isLast: boolean;
  prefersReducedMotion: boolean | null;
}

function StepCard({ step, index, isLast, prefersReducedMotion }: StepCardProps) {
  const Icon = step.icon;
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
              bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent
              mb-3
            `}>
              {step.highlight}
            </span>

            {/* Title */}
            <h3 className="text-xl xl:text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {step.title}
            </h3>

            {/* Description */}
            <p className="text-sm xl:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {step.description}
            </p>
          </div>
        </div>

        {/* Center: Number + Icon */}
        <div className="relative flex flex-col items-center">
          {/* Number circle */}
          <div className={`
            w-16 h-16 xl:w-20 xl:h-20 rounded-full
            bg-gradient-to-br ${GRADIENTS.coralPink}
            flex items-center justify-center
            shadow-lg shadow-tis-coral/25
            relative z-10
          `}>
            <span className="text-2xl xl:text-3xl font-bold text-white">
              {step.number}
            </span>
          </div>

          {/* Icon below */}
          <div className="
            mt-3 w-10 h-10 xl:w-12 xl:h-12 rounded-xl
            bg-slate-100 dark:bg-slate-800
            flex items-center justify-center
          ">
            <Icon className="w-5 h-5 xl:w-6 xl:h-6 text-tis-coral" aria-hidden="true" />
          </div>

          {/* Connector line */}
          {!isLast && (
            <div
              aria-hidden="true"
              className="absolute top-24 xl:top-28 left-1/2 -translate-x-1/2 w-0.5 h-24 bg-gradient-to-b from-tis-coral/50 to-transparent"
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
            bg-gradient-to-br ${GRADIENTS.coralPink}
            flex items-center justify-center
            shadow-lg shadow-tis-coral/25
            relative z-10
          `}>
            <span className="text-xl sm:text-2xl font-bold text-white">
              {step.number}
            </span>
          </div>

          {/* Connector line */}
          {!isLast && (
            <div
              aria-hidden="true"
              className="flex-1 w-0.5 mt-3 bg-gradient-to-b from-tis-coral/30 to-transparent min-h-[80px]"
            />
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 pb-8 sm:pb-10">
          {/* Icon + Highlight */}
          <div className="flex items-center gap-3 mb-2">
            <div className="
              w-8 h-8 sm:w-9 sm:h-9 rounded-lg
              bg-tis-coral/10 dark:bg-tis-coral/20
              flex items-center justify-center
            ">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-tis-coral" aria-hidden="true" />
            </div>
            <span className={`
              text-xs font-semibold uppercase tracking-widest
              bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent
            `}>
              {step.highlight}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">
            {step.title}
          </h3>

          {/* Description */}
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            {step.description}
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
              bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent
              mb-3 sm:mb-4
            `}
          >
            Proceso Simple
          </motion.span>

          {/* Main Heading */}
          <motion.h2
            id="how-it-works-heading"
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight"
          >
            ¿Cómo{' '}
            <span className={`bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent`}>
              funciona
            </span>
            ?
          </motion.h2>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            De tus datos a capital en 5 pasos simples.
            Sin burocracia, sin sorpresas.
          </motion.p>
        </motion.div>

        {/* Steps Timeline */}
        <div className="relative">
          {/* Desktop center line */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-gradient-to-b from-tis-coral/20 via-tis-coral/10 to-transparent"
          />

          {/* Steps */}
          <div className="space-y-6 lg:space-y-12">
            {PROCESS_STEPS.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                isLast={index === PROCESS_STEPS.length - 1}
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
            bg-tis-coral/5 dark:bg-tis-coral/10
            rounded-full border border-tis-coral/20
          ">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Desde solicitud hasta capital
            </span>
            <ArrowRight className="w-4 h-4 text-tis-coral" aria-hidden="true" />
            <span className="text-sm font-bold text-tis-coral">
              2-4 semanas
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
