// =====================================================
// TIS TIS Catalyst - Benefits Section
// Beneficios clave con estadísticas impactantes
// Diseño premium estilo Apple con hover effects
// =====================================================

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Clock,
  PiggyBank,
  Target,
  Building2,
  LineChart,
  HeartHandshake,
} from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  type BaseSectionProps,
  type BenefitItem,
  GRADIENTS,
  SECTION_SPACING,
  VIEWPORT_CONFIG,
  APPLE_EASE,
  cardHover,
} from './types';

// =====================================================
// Benefits Data
// =====================================================

const BENEFITS: BenefitItem[] = [
  {
    id: 'speed',
    icon: Clock,
    title: 'Velocidad sin precedentes',
    description: 'Olvídate de meses esperando aprobaciones. Con Catalyst, el proceso desde aplicación hasta capital toma semanas, no trimestres.',
    stats: {
      value: '4x',
      label: 'más rápido que bancos',
    },
    gradient: GRADIENTS.coralPink,
  },
  {
    id: 'no-dilution',
    icon: Building2,
    title: 'Mantén tu empresa',
    description: 'No cedas equity ni control. Financia tu expansión sin dar porcentaje de tu negocio. Tú sigues siendo el 100% dueño.',
    stats: {
      value: '100%',
      label: 'ownership mantenido',
    },
    gradient: GRADIENTS.pinkPurple,
  },
  {
    id: 'data-based',
    icon: LineChart,
    title: 'Basado en datos reales',
    description: 'Tus métricas operativas son tu mejor carta de presentación. Inversionistas ven rendimiento real, no proyecciones especulativas.',
    stats: {
      value: '24/7',
      label: 'datos en tiempo real',
    },
    gradient: GRADIENTS.purpleBlue,
  },
  {
    id: 'cost',
    icon: PiggyBank,
    title: 'Costos transparentes',
    description: 'Sin comisiones ocultas ni sorpresas. Conoces exactamente cuánto pagarás y cuándo. Planeación financiera sin incertidumbre.',
    stats: {
      value: '0',
      label: 'costos ocultos',
    },
    gradient: GRADIENTS.blueCoral,
  },
  {
    id: 'focused',
    icon: Target,
    title: 'Capital con propósito',
    description: 'Financiamiento específico para expansión: nuevas sucursales, equipamiento, inventario. Invierte donde más impacte.',
    stats: {
      value: '$50K-2M',
      label: 'rango de capital',
    },
    gradient: GRADIENTS.coralPink,
  },
  {
    id: 'partnership',
    icon: HeartHandshake,
    title: 'Relación ganar-ganar',
    description: 'Inversionistas y negocios alineados. Cuando tu negocio crece, todos ganan. Incentivos perfectamente alineados.',
    stats: {
      value: '95%',
      label: 'tasa de satisfacción',
    },
    gradient: GRADIENTS.pinkPurple,
  },
];

// =====================================================
// Sub-Components
// =====================================================

interface BenefitCardProps {
  benefit: BenefitItem;
  index: number;
  prefersReducedMotion: boolean | null;
}

function BenefitCard({ benefit, index, prefersReducedMotion }: BenefitCardProps) {
  const Icon = benefit.icon;

  return (
    <motion.article
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 32 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      whileHover={prefersReducedMotion ? undefined : cardHover}
      viewport={VIEWPORT_CONFIG.standard}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: 0.5, delay: index * 0.1, ease: APPLE_EASE }
      }
      className="group relative h-full"
    >
      <div className="
        relative h-full flex flex-col
        p-6 sm:p-8
        bg-white dark:bg-slate-800/50
        rounded-2xl sm:rounded-3xl
        border border-slate-100 dark:border-slate-700/50
        shadow-sm group-hover:shadow-xl
        transition-shadow duration-300
        overflow-hidden
      ">
        {/* Background gradient on hover */}
        <div
          aria-hidden="true"
          className={`
            absolute inset-0 opacity-0 group-hover:opacity-5
            bg-gradient-to-br ${benefit.gradient}
            transition-opacity duration-500 pointer-events-none
          `}
        />

        {/* Top: Icon + Stats */}
        <div className="flex items-start justify-between mb-5 relative z-10">
          {/* Icon */}
          <div
            className={`
              w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl
              bg-gradient-to-br ${benefit.gradient}
              flex items-center justify-center
              shadow-lg group-hover:shadow-xl group-hover:scale-105
              transition-all duration-300
            `}
          >
            <Icon
              className="w-6 h-6 sm:w-7 sm:h-7 text-white"
              aria-hidden="true"
            />
          </div>

          {/* Stats badge */}
          {benefit.stats && (
            <div className="text-right">
              <div className={`
                text-2xl sm:text-3xl font-bold tracking-tight
                bg-gradient-to-r ${benefit.gradient} bg-clip-text text-transparent
              `}>
                {benefit.stats.value}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {benefit.stats.label}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 relative z-10">
          {/* Title */}
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3">
            {benefit.title}
          </h3>

          {/* Description */}
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            {benefit.description}
          </p>
        </div>

        {/* Bottom decorative line */}
        <div
          aria-hidden="true"
          className={`
            absolute bottom-0 left-0 right-0 h-1
            bg-gradient-to-r ${benefit.gradient}
            transform scale-x-0 group-hover:scale-x-100
            transition-transform duration-500 origin-left
          `}
        />
      </div>
    </motion.article>
  );
}

// =====================================================
// Stats Bar Component
// =====================================================

function StatsBar() {
  const stats = [
    { id: 'capital', value: '$10M+', label: 'Capital conectado' },
    { id: 'businesses', value: '50+', label: 'Negocios verificados' },
    { id: 'time', value: '2-4', label: 'Semanas promedio' },
    { id: 'success', value: '98%', label: 'Fondeo exitoso' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_CONFIG.standard}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="
        grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6
        p-6 sm:p-8
        bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900
        dark:from-slate-800 dark:via-slate-700 dark:to-slate-800
        rounded-2xl sm:rounded-3xl
        shadow-xl
      "
    >
      {stats.map((stat) => (
        <div key={stat.id} className="text-center">
          <div className={`
            text-2xl sm:text-3xl lg:text-4xl font-bold
            bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent
            mb-1
          `}>
            {stat.value}
          </div>
          <div className="text-xs sm:text-sm text-slate-400 font-medium">
            {stat.label}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function BenefitsSection({
  className = '',
  id = 'benefits',
}: BaseSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id={id}
      className={`${SECTION_SPACING.lg} px-4 sm:px-6 lg:px-8 bg-slate-50/50 dark:bg-slate-900/50 ${className}`}
      aria-labelledby="benefits-heading"
    >
      <div className="max-w-7xl mx-auto">
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
              bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent
              mb-3 sm:mb-4
            `}
          >
            ¿Por qué Catalyst?
          </motion.span>

          {/* Main Heading */}
          <motion.h2
            id="benefits-heading"
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight"
          >
            Beneficios{' '}
            <span className={`bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent`}>
              reales
            </span>
          </motion.h2>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            No solo palabras. Resultados medibles que transforman
            la forma en que los negocios acceden a capital.
          </motion.p>
        </motion.div>

        {/* Stats Bar */}
        <div className="mb-12 sm:mb-16">
          <StatsBar />
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {BENEFITS.map((benefit, index) => (
            <BenefitCard
              key={benefit.id}
              benefit={benefit}
              index={index}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
