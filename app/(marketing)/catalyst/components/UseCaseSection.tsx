// =====================================================
// TIS TIS Catalyst - Use Cases Section
// Casos de uso específicos por vertical
// Tarjetas interactivas con ejemplos reales
// =====================================================

'use client';

import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  Stethoscope,
  UtensilsCrossed,
  Dumbbell,
  Scissors,
  Building,
  ArrowRight,
  Quote,
} from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  type BaseSectionProps,
  type UseCaseItem,
  GRADIENTS,
  SECTION_SPACING,
  VIEWPORT_CONFIG,
  APPLE_EASE,
  buttonTap,
} from './types';

// =====================================================
// Use Cases Data
// =====================================================

const USE_CASES: UseCaseItem[] = [
  {
    id: 'dental',
    icon: Stethoscope,
    vertical: 'Clínicas Dentales',
    title: 'Nueva sucursal en 90 días',
    description: 'ESVA Dental usó Catalyst para abrir su tercera sucursal. Sus métricas de ocupación del 85% fueron la garantía perfecta para inversionistas.',
    highlight: '$180,000 MXN',
    tags: ['Expansión', 'Equipamiento', 'Marketing'],
  },
  {
    id: 'restaurant',
    icon: UtensilsCrossed,
    vertical: 'Restaurantes',
    title: 'Expansión de franquicia',
    description: 'Una cadena de taquerías fondeó 2 nuevas ubicaciones basándose en su ticket promedio y rotación de mesas verificados por TIS TIS.',
    highlight: '$350,000 MXN',
    tags: ['Franquicia', 'Inventario', 'Remodelación'],
  },
  {
    id: 'gym',
    icon: Dumbbell,
    vertical: 'Gimnasios',
    title: 'Equipamiento premium',
    description: 'Un gym boutique renovó todo su equipamiento. Su tasa de retención del 78% demostró la lealtad de sus miembros a inversionistas.',
    highlight: '$220,000 MXN',
    tags: ['Equipamiento', 'Tecnología', 'Membresías'],
  },
  {
    id: 'beauty',
    icon: Scissors,
    vertical: 'Salones de Belleza',
    title: 'Segunda ubicación',
    description: 'Un salón premium abrió su segunda sucursal. Las reservaciones recurrentes y el LTV de clientes fueron clave para el fondeo.',
    highlight: '$150,000 MXN',
    tags: ['Expansión', 'Mobiliario', 'Capacitación'],
  },
  {
    id: 'clinic',
    icon: Building,
    vertical: 'Consultorios Médicos',
    title: 'Actualización tecnológica',
    description: 'Una clínica de especialidades modernizó su equipo diagnóstico. Su flujo constante de pacientes respaldó la inversión.',
    highlight: '$400,000 MXN',
    tags: ['Equipo médico', 'Software', 'Infraestructura'],
  },
];

// =====================================================
// Sub-Components
// =====================================================

interface UseCaseCardProps {
  useCase: UseCaseItem;
  isActive: boolean;
  onClick: () => void;
  prefersReducedMotion: boolean | null;
}

function UseCaseCard({ useCase, isActive, onClick, prefersReducedMotion }: UseCaseCardProps) {
  const Icon = useCase.icon;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={prefersReducedMotion ? undefined : { opacity: 0, x: -20 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
      whileTap={prefersReducedMotion ? undefined : buttonTap}
      viewport={VIEWPORT_CONFIG.standard}
      transition={{ duration: 0.4, ease: APPLE_EASE }}
      className={`
        w-full text-left p-4 sm:p-5
        rounded-xl sm:rounded-2xl
        border transition-colors transition-shadow duration-300
        ${isActive
          ? `bg-gradient-to-r ${GRADIENTS.coralPink} border-transparent text-white shadow-lg shadow-tis-coral/25`
          : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-tis-coral/30'
        }
      `}
      aria-pressed={isActive}
      aria-label={`Ver caso de uso: ${useCase.vertical}`}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`
          w-10 h-10 sm:w-11 sm:h-11 rounded-xl
          flex items-center justify-center
          ${isActive
            ? 'bg-white/20'
            : 'bg-tis-coral/10 dark:bg-tis-coral/20'
          }
        `}>
          <Icon
            className={`w-5 h-5 sm:w-6 sm:h-6 ${isActive ? 'text-white' : 'text-tis-coral'}`}
            aria-hidden="true"
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3 className={`
            font-semibold text-sm sm:text-base truncate
            ${isActive ? 'text-white' : 'text-slate-900 dark:text-white'}
          `}>
            {useCase.vertical}
          </h3>
          <p className={`
            text-xs sm:text-sm truncate
            ${isActive ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}
          `}>
            {useCase.highlight}
          </p>
        </div>

        {/* Arrow */}
        <ArrowRight
          className={`
            w-4 h-4 flex-shrink-0 transition-transform
            ${isActive ? 'text-white translate-x-1' : 'text-slate-400'}
          `}
          aria-hidden="true"
        />
      </div>
    </motion.button>
  );
}

interface UseCaseDetailProps {
  useCase: UseCaseItem;
  prefersReducedMotion: boolean | null;
}

function UseCaseDetail({ useCase, prefersReducedMotion }: UseCaseDetailProps) {
  const Icon = useCase.icon;

  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: APPLE_EASE }}
      className="
        h-full flex flex-col
        p-6 sm:p-8 lg:p-10
        bg-white dark:bg-slate-800/50
        rounded-2xl sm:rounded-3xl
        border border-slate-100 dark:border-slate-700/50
        shadow-lg
      "
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        {/* Icon */}
        <div className={`
          w-14 h-14 sm:w-16 sm:h-16 rounded-2xl
          bg-gradient-to-br ${GRADIENTS.coralPink}
          flex items-center justify-center
          shadow-lg shadow-tis-coral/25
        `}>
          <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
        </div>

        {/* Vertical + Highlight */}
        <div>
          <span className={`
            text-xs font-semibold uppercase tracking-widest
            bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent
          `}>
            {useCase.vertical}
          </span>
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mt-1">
            {useCase.title}
          </h3>
        </div>
      </div>

      {/* Quote/Description */}
      <div className="flex-1">
        <div className="relative pl-4 border-l-2 border-tis-coral/30">
          <Quote
            className="absolute -left-3 -top-1 w-6 h-6 text-tis-coral/30"
            aria-hidden="true"
          />
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed italic">
            {useCase.description}
          </p>
        </div>
      </div>

      {/* Stats + Tags */}
      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700/50">
        {/* Funding Amount */}
        <div className="mb-4">
          <span className="text-sm text-slate-500 dark:text-slate-400">Capital fondeado</span>
          <div className={`
            text-3xl sm:text-4xl font-bold
            bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent
          `}>
            {useCase.highlight}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {useCase.tags.map((tag) => (
            <span
              key={tag}
              className="
                px-3 py-1 text-xs sm:text-sm font-medium
                bg-tis-coral/5 dark:bg-tis-coral/10
                text-tis-coral rounded-full
              "
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function UseCaseSection({
  className = '',
  id = 'use-cases',
}: BaseSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCase = USE_CASES[activeIndex];

  return (
    <section
      id={id}
      className={`${SECTION_SPACING.lg} px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900 ${className}`}
      aria-labelledby="use-cases-heading"
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
            Casos de Éxito
          </motion.span>

          {/* Main Heading */}
          <motion.h2
            id="use-cases-heading"
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight"
          >
            Negocios{' '}
            <span className={`bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent`}>
              que crecieron
            </span>
          </motion.h2>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Cada vertical tiene sus propias métricas de éxito.
            Catalyst las entiende y las transforma en oportunidades.
          </motion.p>
        </motion.div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Left: Use Case Selector */}
          <div className="lg:col-span-2 space-y-3">
            {USE_CASES.map((useCase, index) => (
              <UseCaseCard
                key={useCase.id}
                useCase={useCase}
                isActive={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>

          {/* Right: Active Case Detail */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <UseCaseDetail
                key={activeCase.id}
                useCase={activeCase}
                prefersReducedMotion={prefersReducedMotion}
              />
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom note */}
        <motion.p
          initial={prefersReducedMotion ? undefined : { opacity: 0 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1 }}
          viewport={VIEWPORT_CONFIG.standard}
          transition={{ duration: 0.4, delay: 0.3, ease: APPLE_EASE }}
          className="mt-8 sm:mt-12 text-center text-sm text-slate-500 dark:text-slate-400"
        >
          * Casos basados en proyecciones de uso de la plataforma.
          Resultados pueden variar según el negocio.
        </motion.p>
      </div>
    </section>
  );
}
