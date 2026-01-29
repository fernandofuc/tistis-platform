// =====================================================
// TIS TIS Catalyst - What Is Section
// Explicación clara de qué es Catalyst
// Diseño Apple-style con cards y features
// =====================================================

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Coins,
  Shield,
  TrendingUp,
  BarChart3,
  Zap,
  Lock,
} from 'lucide-react';
import {
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  staggerContainer,
  type BaseSectionProps,
  type FeatureItem,
  GRADIENTS,
  SECTION_SPACING,
  VIEWPORT_CONFIG,
  APPLE_EASE,
  cardHover,
} from './types';

// =====================================================
// Feature Data
// =====================================================

const CORE_FEATURES: FeatureItem[] = [
  {
    id: 'tokenization',
    icon: Coins,
    title: 'Tokenización Inteligente',
    description: 'Convierte tus planes de expansión en tokens digitales respaldados por datos operativos reales.',
    gradient: GRADIENTS.coralPink,
  },
  {
    id: 'verification',
    icon: Shield,
    title: 'Datos Verificados',
    description: 'TIS TIS audita y verifica automáticamente tus métricas de negocio en tiempo real.',
    gradient: GRADIENTS.pinkPurple,
  },
  {
    id: 'growth',
    icon: TrendingUp,
    title: 'Crecimiento Acelerado',
    description: 'Accede a capital de forma más rápida que los procesos bancarios tradicionales.',
    gradient: GRADIENTS.purpleBlue,
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Analytics en Vivo',
    description: 'Dashboard para inversionistas con métricas actualizadas automáticamente.',
    gradient: GRADIENTS.blueCoral,
  },
  {
    id: 'speed',
    icon: Zap,
    title: 'Proceso Ágil',
    description: 'Sin burocracia bancaria. Desde solicitud hasta capital en semanas, no meses.',
    gradient: GRADIENTS.coralPink,
  },
  {
    id: 'security',
    icon: Lock,
    title: 'Seguridad Total',
    description: 'Infraestructura blockchain-ready con encriptación de nivel empresarial.',
    gradient: GRADIENTS.pinkPurple,
  },
];

// =====================================================
// Sub-Components
// =====================================================

interface FeatureCardProps {
  feature: FeatureItem;
  index: number;
  prefersReducedMotion: boolean | null;
}

function FeatureCard({ feature, index, prefersReducedMotion }: FeatureCardProps) {
  const Icon = feature.icon;

  return (
    <motion.div
      variants={prefersReducedMotion ? fadeInUp : undefined}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      whileHover={prefersReducedMotion ? undefined : cardHover}
      viewport={VIEWPORT_CONFIG.standard}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: 0.5, delay: index * 0.1, ease: APPLE_EASE }
      }
      className="group relative"
    >
      <div className="
        relative h-full p-6 sm:p-8
        bg-white dark:bg-slate-800/50
        rounded-2xl sm:rounded-3xl
        border border-slate-100 dark:border-slate-700/50
        shadow-sm group-hover:shadow-xl
        transition-shadow duration-300
      ">
        {/* Icon */}
        <div
          className={`
            w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl
            bg-gradient-to-br ${feature.gradient}
            flex items-center justify-center mb-4 sm:mb-5
            shadow-lg group-hover:shadow-xl
            transition-shadow duration-300
          `}
        >
          <Icon
            className="w-6 h-6 sm:w-7 sm:h-7 text-white"
            aria-hidden="true"
          />
        </div>

        {/* Title */}
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3">
          {feature.title}
        </h3>

        {/* Description */}
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {feature.description}
        </p>

        {/* Hover gradient effect */}
        <div
          aria-hidden="true"
          className={`
            absolute inset-0 rounded-2xl sm:rounded-3xl opacity-0 group-hover:opacity-5
            bg-gradient-to-br ${feature.gradient}
            transition-opacity duration-300 pointer-events-none
          `}
        />
      </div>
    </motion.div>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function WhatIsSection({
  className = '',
  id = 'what-is',
}: BaseSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id={id}
      className={`${SECTION_SPACING.lg} px-4 sm:px-6 lg:px-8 bg-slate-50/50 dark:bg-slate-900/50 ${className}`}
      aria-labelledby="what-is-heading"
    >
      <div className="max-w-7xl mx-auto">
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
            ¿Qué es Catalyst?
          </motion.span>

          {/* Main Heading */}
          <motion.h2
            id="what-is-heading"
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight"
          >
            Financiamiento{' '}
            <span className={`bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent`}>
              reinventado
            </span>
          </motion.h2>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed"
          >
            Catalyst es la plataforma de tokenización de TIS TIS que conecta negocios
            verificados con inversionistas inteligentes. Tus datos operativos se convierten
            en tu mejor garantía.
          </motion.p>
        </motion.div>

        {/* Value Proposition Cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG.standard}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-12 sm:mb-16 lg:mb-20"
        >
          {/* Traditional Finance Card */}
          <motion.div
            variants={fadeInLeft}
            className="
              relative p-6 sm:p-8 lg:p-10
              bg-slate-100 dark:bg-slate-800/30
              rounded-2xl sm:rounded-3xl
              border border-slate-200 dark:border-slate-700/50
            "
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 block">
              Financiamiento Tradicional
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-500 dark:text-slate-400 mb-4">
              El problema actual
            </h3>
            <ul className="space-y-3 text-sm sm:text-base text-slate-500 dark:text-slate-500">
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✕</span>
                <span>Meses de espera para aprobación</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✕</span>
                <span>Garantías personales requeridas</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✕</span>
                <span>Tasas de interés elevadas</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✕</span>
                <span>Burocracia interminable</span>
              </li>
            </ul>
          </motion.div>

          {/* Catalyst Card */}
          <motion.div
            variants={fadeInRight}
            className={`
              relative p-6 sm:p-8 lg:p-10
              bg-gradient-to-br ${GRADIENTS.coralPink}
              rounded-2xl sm:rounded-3xl
              text-white shadow-xl shadow-tis-coral/20
            `}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-white/80 mb-4 block">
              Con TIS TIS Catalyst
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">
              La nueva forma
            </h3>
            <ul className="space-y-3 text-sm sm:text-base text-white/90">
              <li className="flex items-start gap-3">
                <span className="text-white mt-1">✓</span>
                <span>Capital en semanas, no meses</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-white mt-1">✓</span>
                <span>Tus datos son tu garantía</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-white mt-1">✓</span>
                <span>Condiciones transparentes</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-white mt-1">✓</span>
                <span>100% digital y automatizado</span>
              </li>
            </ul>

            {/* Decorative element */}
            <div
              aria-hidden="true"
              className="absolute top-4 right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none"
            />
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG.standard}
          variants={staggerContainer}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
        >
          {CORE_FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              index={index}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
