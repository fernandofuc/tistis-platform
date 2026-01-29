// =====================================================
// TIS TIS Genesis - Coming Soon CTA Section
// CTA final con visión 2028+ y diseño impactante
// Estilo Apple Keynote - gradient hero + call to action
// =====================================================

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Bot,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Rocket,
} from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  type ComingSoonCTAProps,
  GENESIS_GRADIENTS,
  SECTION_SPACING,
  VIEWPORT_CONFIG,
  APPLE_EASE,
  buttonHover,
  buttonTap,
} from './types';

// =====================================================
// Sub-Components
// =====================================================

function FeatureHighlights() {
  const features = [
    'Datos acumulándose desde hoy',
    'Score en constante mejora',
    'Ventaja competitiva asegurada',
  ];

  return (
    <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
      {features.map((feature) => (
        <div
          key={feature}
          className="flex items-center gap-2 text-white/80"
        >
          <CheckCircle2 className="w-4 h-4 text-blue-400" aria-hidden="true" />
          <span className="text-sm font-medium">{feature}</span>
        </div>
      ))}
    </div>
  );
}

function TimelinePreview() {
  const milestones = [
    { year: '2024', label: 'Hoy', description: 'Comienza la acumulación', active: true },
    { year: '2026', label: 'Preparación', description: 'Score en desarrollo' },
    { year: '2028+', label: 'Integración', description: 'Robots disponibles' },
  ];

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-8 py-6">
      {milestones.map((milestone, index) => (
        <div key={milestone.year} className="flex items-center">
          <div className="text-center">
            <div
              className={`
                w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-2
                ${milestone.active
                  ? 'bg-blue-500 shadow-lg shadow-blue-500/30'
                  : 'bg-white/10 border border-white/20'
                }
              `}
            >
              <span className={`text-sm sm:text-base font-bold ${milestone.active ? 'text-white' : 'text-white/70'}`}>
                {milestone.year}
              </span>
            </div>
            <span className={`block text-xs font-semibold ${milestone.active ? 'text-white' : 'text-white/60'}`}>
              {milestone.label}
            </span>
            <span className="block text-xs text-white/40 mt-0.5">
              {milestone.description}
            </span>
          </div>

          {index < milestones.length - 1 && (
            <div className="w-8 sm:w-12 h-0.5 bg-white/20 mx-2 sm:mx-4" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function ComingSoonCTA({
  className = '',
  id = 'coming-soon',
  showBackLink = true,
  showStartNow = true,
}: ComingSoonCTAProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id={id}
      className={`relative overflow-hidden ${className}`}
      aria-labelledby="coming-soon-heading"
    >
      {/* Gradient Background */}
      <div className={`
        ${SECTION_SPACING.xl} px-4 sm:px-6 lg:px-8
        bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
        dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
      `}>
        {/* Decorative elements - Robot/Tech themed */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 right-1/4 w-80 h-80 bg-tis-purple/10 rounded-full blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-tis-pink/5 rounded-full blur-3xl pointer-events-none"
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Content */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT_CONFIG.standard}
            variants={staggerContainer}
            className="mb-10 sm:mb-12"
          >
            {/* Badge */}
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-6 sm:mb-8 border border-white/10"
            >
              <Bot className="w-4 h-4 text-blue-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-white/90 uppercase tracking-wide">
                Visión 2028+
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h2
              id="coming-soon-heading"
              variants={fadeInUp}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 tracking-tight"
            >
              El futuro se{' '}
              <span className={`bg-gradient-to-r ${GENESIS_GRADIENTS.robotic} bg-clip-text text-transparent`}>
                construye hoy
              </span>
            </motion.h2>

            {/* Description */}
            <motion.p
              variants={fadeInUp}
              className="text-base sm:text-lg lg:text-xl text-white/70 max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed"
            >
              Los robots de servicio comerciales llegarán. La pregunta es:
              ¿estará tu negocio listo para integrarlos desde el día uno?
            </motion.p>

            {/* Timeline Preview */}
            <motion.div variants={fadeInUp}>
              <TimelinePreview />
            </motion.div>

            {/* Feature highlights */}
            <motion.div variants={fadeInUp} className="mt-6">
              <FeatureHighlights />
            </motion.div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={VIEWPORT_CONFIG.standard}
            transition={{ duration: 0.6, delay: 0.3, ease: APPLE_EASE }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 sm:mb-16"
          >
            {/* Primary CTA - Start Now */}
            {showStartNow && (
              <motion.a
                href="/"
                whileHover={prefersReducedMotion ? undefined : buttonHover}
                whileTap={prefersReducedMotion ? undefined : buttonTap}
                className="
                  group inline-flex items-center gap-3 px-6 sm:px-8 py-3.5 sm:py-4
                  bg-white text-slate-900
                  rounded-2xl shadow-xl
                  transition-shadow duration-300 hover:shadow-2xl
                  font-semibold text-base
                "
              >
                <Rocket className="w-5 h-5" aria-hidden="true" />
                <span>Empieza con TIS TIS</span>
                <ArrowRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </motion.a>
            )}

            {/* Secondary CTA - Learn about main product */}
            <motion.a
              href="/catalyst"
              whileHover={prefersReducedMotion ? undefined : buttonHover}
              whileTap={prefersReducedMotion ? undefined : buttonTap}
              className="
                group inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4
                bg-white/10 backdrop-blur-sm text-white
                rounded-2xl
                border border-white/20 hover:border-white/30
                transition-all duration-300
                font-medium text-base
              "
            >
              <Sparkles className="w-5 h-5" aria-hidden="true" />
              <span>Conocer Catalyst</span>
              <ArrowRight
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </motion.a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1 }}
            viewport={VIEWPORT_CONFIG.standard}
            transition={{ duration: 0.5, delay: 0.5, ease: APPLE_EASE }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-white/50 text-sm"
          >
            <span>✓ Acumulación automática</span>
            <span className="hidden sm:inline">•</span>
            <span>✓ Sin costo adicional</span>
            <span className="hidden sm:inline">•</span>
            <span>✓ Incluido en tu plan</span>
          </motion.div>
        </div>
      </div>

      {/* Back Link Section */}
      {showBackLink && (
        <div className="py-8 sm:py-12 px-4 bg-slate-100 dark:bg-slate-800">
          <div className="max-w-4xl mx-auto text-center">
            <motion.a
              href="/"
              whileHover={prefersReducedMotion ? undefined : { x: -4 }}
              whileTap={prefersReducedMotion ? undefined : buttonTap}
              transition={{ duration: 0.2, ease: APPLE_EASE }}
              className="
                inline-flex items-center gap-2
                text-slate-500 dark:text-slate-400
                hover:text-blue-500
                transition-colors duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                rounded-lg px-4 py-2
              "
            >
              <ArrowLeft
                className="w-4 h-4"
                aria-hidden="true"
              />
              <span className="font-medium">Volver al inicio</span>
            </motion.a>
          </div>
        </div>
      )}
    </section>
  );
}
