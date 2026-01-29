// =====================================================
// TIS TIS Genesis - Hero Section
// Sección hero premium estilo Apple.com
// Preparación para integración robótica - Visión 2028+
// =====================================================

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Bot, Sparkles, ChevronDown, ArrowRight } from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  scaleIn,
  type GenesisHeroProps,
  GENESIS_GRADIENTS,
  APPLE_EASE,
  buttonHover,
  buttonTap,
} from './types';

// =====================================================
// Animation Variants (Hero-specific)
// Uses APPLE_EASE for consistency with Apple-style animations
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
      {/* Primary gradient orb - top left with robotic blue tint */}
      <div
        aria-hidden="true"
        className="absolute top-1/4 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '4s' }}
      />

      {/* Secondary gradient orb - bottom right coral */}
      <div
        aria-hidden="true"
        className="absolute bottom-1/4 right-10 w-96 h-96 bg-tis-coral/10 rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '5s', animationDelay: '1s' }}
      />

      {/* Center gradient - largest, robotic purple/blue */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-tis-purple/5 to-blue-500/5 rounded-full blur-3xl pointer-events-none"
      />

      {/* Accent orb - pink */}
      <div
        aria-hidden="true"
        className="absolute top-20 right-1/4 w-32 h-32 bg-tis-pink/8 rounded-full blur-2xl pointer-events-none animate-pulse"
        style={{ animationDuration: '6s', animationDelay: '2s' }}
      />

      {/* Robot-themed circuit pattern hint */}
      <div
        aria-hidden="true"
        className="absolute bottom-10 left-1/4 w-40 h-40 bg-gradient-to-tr from-blue-500/5 to-transparent rounded-full blur-2xl pointer-events-none"
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
}: GenesisHeroProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id={id}
      className={`relative min-h-[90vh] flex items-center justify-center overflow-hidden ${className}`}
      aria-label="TIS TIS Genesis - Prepara tu negocio para robots"
    >
      {/* Background decorations */}
      <DecorativeBackground />

      {/* Bottom fade gradient for smooth transition to dark robot section */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-32 sm:h-40 lg:h-48 bg-gradient-to-b from-transparent via-slate-50/50 to-slate-50 dark:via-slate-900/50 dark:to-slate-900 pointer-events-none z-5"
      />

      {/* Main content */}
      <motion.div
        className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Vision 2028+ Badge */}
        <motion.div
          variants={prefersReducedMotion ? fadeInUp : heroVariants.badge}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 via-tis-purple/10 to-tis-pink/10 dark:from-blue-500/20 dark:via-tis-purple/20 dark:to-tis-pink/20 rounded-full mb-6 sm:mb-8 backdrop-blur-sm border border-blue-500/20"
          role="status"
          aria-label="Estado: Visión 2028+"
        >
          <Bot className="w-4 h-4 text-blue-500" aria-hidden="true" />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            Visión 2028+
          </span>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          variants={prefersReducedMotion ? fadeInUp : heroVariants.title}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight"
        >
          TIS TIS{' '}
          <span className={`bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent`}>
            Genesis
          </span>
        </motion.h1>

        {/* Subtitle - Bold Statement */}
        <motion.p
          variants={prefersReducedMotion ? fadeInUp : heroVariants.subtitle}
          className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-6 sm:mb-8 leading-relaxed"
        >
          Prepara tu negocio para{' '}
          <span className="font-semibold text-slate-800 dark:text-white">
            la era de los robots.
          </span>
        </motion.p>

        {/* Value Proposition */}
        <motion.p
          variants={prefersReducedMotion ? fadeInUp : heroVariants.subtitle}
          className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-8 sm:mb-10"
        >
          Tus datos operativos de años se convierten en el entrenamiento perfecto
          para integrar robots de servicio cuando estén listos comercialmente.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={prefersReducedMotion ? scaleIn : heroVariants.cta}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 sm:mb-12"
        >
          {/* Primary CTA - Discover */}
          <a
            href="#what-is-genesis"
            className={`
              group inline-flex items-center gap-3 px-6 sm:px-8 py-3.5 sm:py-4
              bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} text-white
              rounded-2xl shadow-xl shadow-blue-500/25
              transition-all duration-300
              hover:shadow-2xl hover:shadow-blue-500/30 hover:scale-[1.02]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
            `}
            aria-label="Descubrir Genesis"
          >
            <Sparkles className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold text-base">Descubrir Genesis</span>
            <ArrowRight
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </a>

          {/* Secondary CTA - Learn More */}
          <motion.a
            href="/"
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
            className="w-2 h-2 bg-blue-500 rounded-full animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="font-medium text-sm sm:text-base">
            En investigación activa
          </span>
          <span className="text-xs px-2 py-0.5 bg-white/10 dark:bg-slate-900/10 rounded-full">
            FASE 1
          </span>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      {showScrollIndicator && <ScrollIndicator />}
    </section>
  );
}
