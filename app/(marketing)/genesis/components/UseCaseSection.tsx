// =====================================================
// TIS TIS Genesis - Use Cases Section
// Casos de uso específicos por vertical
// Cómo cada tipo de negocio se prepara para robots
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
  Bot,
  Clock,
  Database,
} from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  type BaseSectionProps,
  GENESIS_GRADIENTS,
  SECTION_SPACING,
  VIEWPORT_CONFIG,
  APPLE_EASE,
  buttonTap,
} from './types';
import type { LucideIcon } from 'lucide-react';

// =====================================================
// Types
// =====================================================

interface GenesisUseCase {
  id: string;
  icon: LucideIcon;
  vertical: string;
  title: string;
  description: string;
  robotReadyScore: number;
  yearsWithTIS: number;
  dataPoints: string[];
  potentialRobots: string[];
}

// =====================================================
// Use Cases Data - Genesis Specific
// =====================================================

const GENESIS_USE_CASES: GenesisUseCase[] = [
  {
    id: 'dental',
    icon: Stethoscope,
    vertical: 'Clínicas Dentales',
    title: 'Robot de recepción inteligente',
    description: 'ESVA Dental lleva 4 años con TIS TIS. Sus patrones de check-in, flujo de pacientes y recordatorios están listos para un robot de recepción que conocerá cada paciente por nombre.',
    robotReadyScore: 87,
    yearsWithTIS: 4,
    dataPoints: ['12,000+ check-ins', '8,500 pacientes únicos', '35,000 recordatorios'],
    potentialRobots: ['Robot Recepcionista', 'Asistente de Esterilización'],
  },
  {
    id: 'restaurant',
    icon: UtensilsCrossed,
    vertical: 'Restaurantes',
    title: 'Robot de servicio a mesas',
    description: 'Una taquería popular tiene 3 años de datos de flujo de mesas, tiempos de servicio y patrones de demanda. Un robot mesero se integrará conociendo los picos de hora y preferencias.',
    robotReadyScore: 72,
    yearsWithTIS: 3,
    dataPoints: ['45,000+ órdenes', '180,000 items servidos', 'Mapeo de 24 mesas'],
    potentialRobots: ['Robot Mesero', 'Robot de Delivery Interno'],
  },
  {
    id: 'gym',
    icon: Dumbbell,
    vertical: 'Gimnasios',
    title: 'Robot asistente de entrenamiento',
    description: 'Un gym boutique ha documentado 2 años de rutinas, horarios de clases y uso de equipos. Un robot podrá guiar ejercicios basándose en el historial de cada miembro.',
    robotReadyScore: 65,
    yearsWithTIS: 2,
    dataPoints: ['5,200 miembros', '28,000 check-ins', '150 rutinas documentadas'],
    potentialRobots: ['Robot Trainer', 'Robot de Limpieza'],
  },
  {
    id: 'beauty',
    icon: Scissors,
    vertical: 'Salones de Belleza',
    title: 'Robot de preparación y asistencia',
    description: 'Un salón premium tiene 3.5 años de preferencias de clientes, tiempos de servicio y productos usados. Un robot asistente preparará estaciones conociendo cada cita.',
    robotReadyScore: 78,
    yearsWithTIS: 3.5,
    dataPoints: ['9,800 clientes', '31,000 servicios', '420 productos rastreados'],
    potentialRobots: ['Robot Preparador', 'Robot de Lavado'],
  },
  {
    id: 'clinic',
    icon: Building,
    vertical: 'Consultorios Médicos',
    title: 'Robot de triaje y asistencia',
    description: 'Una clínica de especialidades tiene 5 años de historiales, síntomas comunes y flujos de pacientes. Un robot de triaje inicial acelerará la atención.',
    robotReadyScore: 91,
    yearsWithTIS: 5,
    dataPoints: ['18,000 pacientes', '52,000 consultas', '200+ diagnósticos mapeados'],
    potentialRobots: ['Robot de Triaje', 'Asistente de Farmacia'],
  },
];

// =====================================================
// Sub-Components
// =====================================================

interface UseCaseCardProps {
  useCase: GenesisUseCase;
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
          ? `bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} border-transparent text-white shadow-lg shadow-blue-500/25`
          : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-blue-500/30'
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
            : 'bg-blue-500/10 dark:bg-blue-500/20'
          }
        `}>
          <Icon
            className={`w-5 h-5 sm:w-6 sm:h-6 ${isActive ? 'text-white' : 'text-blue-500'}`}
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
            Score: {useCase.robotReadyScore}
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
  useCase: GenesisUseCase;
  prefersReducedMotion: boolean | null;
}

function UseCaseDetail({ useCase, prefersReducedMotion }: UseCaseDetailProps) {
  const Icon = useCase.icon;

  // Configuración de animación que respeta reduced motion
  const motionProps = prefersReducedMotion
    ? {} // Sin animaciones para usuarios que prefieren reduced motion
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.4, ease: APPLE_EASE },
      };

  return (
    <motion.div
      {...motionProps}
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
          bg-gradient-to-br ${GENESIS_GRADIENTS.robotic}
          flex items-center justify-center
          shadow-lg shadow-blue-500/25
        `}>
          <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
        </div>

        {/* Vertical + Score */}
        <div>
          <span className={`
            text-xs font-semibold uppercase tracking-widest
            bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent
          `}>
            {useCase.vertical}
          </span>
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mt-1">
            {useCase.title}
          </h3>
        </div>
      </div>

      {/* Description */}
      <div className="flex-1 mb-6">
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          {useCase.description}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Robot-Ready Score */}
        <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-blue-500" aria-hidden="true" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Robot-Ready Score
            </span>
          </div>
          <div className={`text-2xl font-bold bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent`}>
            {useCase.robotReadyScore}/100
          </div>
        </div>

        {/* Years with TIS TIS */}
        <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-tis-coral" aria-hidden="true" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Años con TIS TIS
            </span>
          </div>
          <div className="text-2xl font-bold text-tis-coral">
            {useCase.yearsWithTIS} años
          </div>
        </div>
      </div>

      {/* Data Points */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Datos Acumulados
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {useCase.dataPoints.map((point) => (
            <span
              key={point}
              className="
                px-3 py-1 text-xs sm:text-sm font-medium
                bg-slate-100 dark:bg-slate-700
                text-slate-600 dark:text-slate-300 rounded-full
              "
            >
              {point}
            </span>
          ))}
        </div>
      </div>

      {/* Potential Robots */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50">
        <span className="text-sm font-semibold text-slate-900 dark:text-white block mb-3">
          Robots Potenciales (2028+)
        </span>
        <div className="flex flex-wrap gap-2">
          {useCase.potentialRobots.map((robot) => (
            <span
              key={robot}
              className="
                px-3 py-1.5 text-xs sm:text-sm font-medium
                bg-blue-500/10 dark:bg-blue-500/20
                text-blue-600 dark:text-blue-400 rounded-full
                border border-blue-500/20
              "
            >
              <Bot className="w-3 h-3 inline mr-1" aria-hidden="true" />
              {robot}
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
  const activeCase = GENESIS_USE_CASES[activeIndex];

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
              bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent
              mb-3 sm:mb-4
            `}
          >
            Por Industria
          </motion.span>

          {/* Main Heading */}
          <motion.h2
            id="use-cases-heading"
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight"
          >
            Negocios{' '}
            <span className={`bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent`}>
              preparándose
            </span>
          </motion.h2>

          {/* Description */}
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Cada vertical tiene sus propias tareas automatizables.
            Genesis entiende las necesidades específicas de tu industria.
          </motion.p>
        </motion.div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Left: Use Case Selector */}
          <div className="lg:col-span-2 space-y-3">
            {GENESIS_USE_CASES.map((useCase, index) => (
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
          * Casos ilustrativos basados en proyecciones de uso de la plataforma.
          Robots comerciales estimados para 2028+.
        </motion.p>
      </div>
    </section>
  );
}
