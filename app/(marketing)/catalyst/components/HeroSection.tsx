// =====================================================
// TIS TIS Catalyst - Hero Section
// Sección hero premium estilo Apple.com
// Animaciones fluidas y diseño impactante
// =====================================================

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Play, ChevronDown, ArrowRight } from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  scaleIn,
  type BaseSectionProps,
  GRADIENTS,
  APPLE_EASE,
  buttonHover,
  buttonTap,
} from './types';

// =====================================================
// Types
// =====================================================

interface HeroSectionProps extends BaseSectionProps {
  /** Whether to show scroll indicator */
  showScrollIndicator?: boolean;
}

// =====================================================
// Animation Variants (Hero-specific)
// Uses APPLE_EASE from centralized types for consistency
// =====================================================

const heroVariants = {
  badge: {
    hidden: { opacity: 0, y: -12, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.5, ease: APPLE_EASE },
    },
  },
  title: {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: APPLE_EASE },
    },
  },
  subtitle: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: 0.1, ease: APPLE_EASE },
    },
  },
  cta: {
    hidden: { opacity: 0, y: 16, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.5, delay: 0.2, ease: APPLE_EASE },
    },
  },
  status: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.4, delay: 0.4, ease: APPLE_EASE },
    },
  },
};

// =====================================================
// Sub-Components
// =====================================================

function DecorativeBackground() {
  return (
    <>
      {/* Primary gradient orb - top left */}
      <div
        aria-hidden="true"
        className="absolute top-1/4 left-10 w-72 h-72 bg-tis-coral/10 rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '4s' }}
      />

      {/* Secondary gradient orb - bottom right */}
      <div
        aria-hidden="true"
        className="absolute bottom-1/4 right-10 w-96 h-96 bg-tis-pink/10 rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '5s', animationDelay: '1s' }}
      />

      {/* Center gradient - largest, subtle */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-tis-coral/5 to-tis-purple/5 rounded-full blur-3xl pointer-events-none"
      />

      {/* Accent orb - purple */}
      <div
        aria-hidden="true"
        className="absolute top-20 right-1/4 w-32 h-32 bg-tis-purple/8 rounded-full blur-2xl pointer-events-none animate-pulse"
        style={{ animationDuration: '6s', animationDelay: '2s' }}
      />
    </>
  );
}

function ScrollIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 1.2 }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2"
    >
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500"
      >
        <span className="text-xs font-medium uppercase tracking-widest">
          Desplázate
        </span>
        <ChevronDown className="w-5 h-5" aria-hidden="true" />
      </motion.div>
    </motion.div>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function HeroSection({
  className = '',
  id = 'hero',
  showScrollIndicator = true,
}: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id={id}
      className={`relative min-h-[90vh] flex items-center justify-center overflow-hidden ${className}`}
      aria-label="TIS TIS Catalyst - Capital sin bancos"
    >
      {/* Background decorations */}
      <DecorativeBackground />

      {/* Main content */}
      <motion.div
        className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Coming Soon Badge */}
        <motion.div
          variants={prefersReducedMotion ? fadeInUp : heroVariants.badge}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tis-coral/10 to-tis-pink/10 dark:from-tis-coral/20 dark:to-tis-pink/20 rounded-full mb-6 sm:mb-8 backdrop-blur-sm border border-tis-coral/20"
          role="status"
          aria-label="Estado: Próximamente disponible en 2027"
        >
          <Sparkles className="w-4 h-4 text-tis-coral" aria-hidden="true" />
          <span className="text-sm font-semibold text-tis-coral uppercase tracking-wide">
            Próximamente 2027
          </span>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          variants={prefersReducedMotion ? fadeInUp : heroVariants.title}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight"
        >
          TIS TIS{' '}
          <span className={`bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent`}>
            Catalyst
          </span>
        </motion.h1>

        {/* Subtitle - Bold Statement */}
        <motion.p
          variants={prefersReducedMotion ? fadeInUp : heroVariants.subtitle}
          className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-6 sm:mb-8 leading-relaxed"
        >
          Capital para tu expansión.{' '}
          <span className="font-semibold text-slate-800 dark:text-white">
            Sin bancos. Sin ceder equity.
          </span>
        </motion.p>

        {/* Value Proposition */}
        <motion.p
          variants={prefersReducedMotion ? fadeInUp : heroVariants.subtitle}
          className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-8 sm:mb-10"
        >
          Tokeniza tus proyectos de expansión y accede a inversionistas que confían en tus datos reales verificados por TIS TIS.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={prefersReducedMotion ? scaleIn : heroVariants.cta}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 sm:mb-12"
        >
          {/* Primary CTA - Waitlist */}
          <button
            type="button"
            className={`
              group inline-flex items-center gap-3 px-6 sm:px-8 py-3.5 sm:py-4
              bg-gradient-to-r ${GRADIENTS.coralPink} text-white
              rounded-2xl shadow-xl shadow-tis-coral/25
              transition-all duration-300
              hover:shadow-2xl hover:shadow-tis-coral/30 hover:scale-[1.02]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tis-coral focus-visible:ring-offset-2
              disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-xl
            `}
            disabled
            aria-label="Unirse a la lista de espera (próximamente)"
            aria-disabled="true"
          >
            <Play className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold text-base">Notificarme</span>
            <span className="text-xs px-2 py-0.5 bg-white/20 rounded-full font-medium">
              Pronto
            </span>
          </button>

          {/* Secondary CTA - Learn More */}
          <motion.a
            href="/como-funciona"
            whileHover={prefersReducedMotion ? undefined : buttonHover}
            whileTap={prefersReducedMotion ? undefined : buttonTap}
            className={`
              group inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4
              bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200
              rounded-2xl shadow-lg hover:shadow-xl
              transition-shadow duration-300
              border border-slate-200 dark:border-slate-700
              hover:border-slate-300 dark:hover:border-slate-600
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tis-coral focus-visible:ring-offset-2
            `}
          >
            <span className="font-medium text-base">Conocer TIS TIS</span>
            <ArrowRight
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </motion.a>
        </motion.div>

        {/* Status Badge - Development Progress */}
        <motion.div
          variants={prefersReducedMotion ? scaleIn : heroVariants.status}
          className="inline-flex items-center gap-3 px-5 sm:px-6 py-2.5 sm:py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-xl"
          role="status"
        >
          <div
            className="w-2 h-2 bg-tis-coral rounded-full animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="font-medium text-sm sm:text-base">
            En desarrollo activo
          </span>
          <span className="text-xs px-2 py-0.5 bg-white/10 dark:bg-slate-900/10 rounded-full">
            FASE 3
          </span>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      {showScrollIndicator && <ScrollIndicator />}
    </section>
  );
}
