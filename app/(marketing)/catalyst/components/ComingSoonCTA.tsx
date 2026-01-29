// =====================================================
// TIS TIS Catalyst - Coming Soon CTA Section
// CTA final con waitlist y diseño impactante
// Estilo Apple Keynote - gradient hero + form
// =====================================================

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Bell,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import {
  fadeInUp,
  staggerContainer,
  type BaseSectionProps,
  GRADIENTS,
  SECTION_SPACING,
  VIEWPORT_CONFIG,
  APPLE_EASE,
  buttonHover,
  buttonTap,
} from './types';

// =====================================================
// Types
// =====================================================

interface ComingSoonCTAProps extends BaseSectionProps {
  /** Whether to show back to home link */
  showBackLink?: boolean;
}

// =====================================================
// Sub-Components
// =====================================================

interface WaitlistFormProps {
  prefersReducedMotion: boolean | null;
}

function WaitlistForm({ prefersReducedMotion }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);

    // Simulate API call - in production, connect to actual waitlist endpoint
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: APPLE_EASE }}
        className="
          flex flex-col items-center gap-4
          p-6 sm:p-8
          bg-white/10 backdrop-blur-sm
          rounded-2xl border border-white/20
        "
      >
        <div className="
          w-16 h-16 rounded-full
          bg-gradient-to-br from-green-400 to-emerald-500
          flex items-center justify-center
          shadow-lg shadow-green-500/30
        ">
          <CheckCircle2 className="w-8 h-8 text-white" aria-hidden="true" />
        </div>

        <div className="text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
            ¡Estás en la lista!
          </h3>
          <p className="text-white/80 text-sm sm:text-base">
            Te notificaremos cuando Catalyst esté disponible.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Email input */}
        <div className="flex-1 relative">
          <Mail
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            disabled={isSubmitting}
            className="
              w-full pl-12 pr-4 py-3.5 sm:py-4
              bg-white/10 backdrop-blur-sm
              border border-white/20
              rounded-xl sm:rounded-2xl
              text-white placeholder-white/50
              focus:outline-none focus:ring-2 focus:ring-white/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
            aria-label="Correo electrónico"
          />
        </div>

        {/* Submit button */}
        <motion.button
          type="submit"
          disabled={isSubmitting || !email}
          whileHover={prefersReducedMotion || isSubmitting || !email ? undefined : buttonHover}
          whileTap={prefersReducedMotion || isSubmitting || !email ? undefined : buttonTap}
          className="
            inline-flex items-center justify-center gap-2
            px-6 sm:px-8 py-3.5 sm:py-4
            bg-white text-slate-900
            rounded-xl sm:rounded-2xl
            font-semibold text-base
            shadow-lg hover:shadow-xl
            transition-shadow duration-300
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {isSubmitting ? (
            <>
              <span className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
              <span>Registrando...</span>
            </>
          ) : (
            <>
              <Bell className="w-5 h-5" aria-hidden="true" />
              <span>Notificarme</span>
            </>
          )}
        </motion.button>
      </div>

      <p className="mt-3 text-xs sm:text-sm text-white/60 text-center sm:text-left">
        Sin spam. Solo te contactaremos cuando lancemos.
      </p>
    </form>
  );
}

function FeatureHighlights() {
  const features = [
    'Acceso anticipado',
    'Condiciones preferenciales',
    'Soporte prioritario',
  ];

  return (
    <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
      {features.map((feature) => (
        <div
          key={feature}
          className="flex items-center gap-2 text-white/80"
        >
          <CheckCircle2 className="w-4 h-4 text-tis-coral" aria-hidden="true" />
          <span className="text-sm font-medium">{feature}</span>
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
        {/* Decorative elements */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/4 w-96 h-96 bg-tis-coral/10 rounded-full blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 right-1/4 w-80 h-80 bg-tis-pink/10 rounded-full blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-tis-purple/5 rounded-full blur-3xl pointer-events-none"
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
              <Sparkles className="w-4 h-4 text-tis-coral" aria-hidden="true" />
              <span className="text-sm font-semibold text-white/90 uppercase tracking-wide">
                Próximamente 2027
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h2
              id="coming-soon-heading"
              variants={fadeInUp}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 tracking-tight"
            >
              ¿Listo para{' '}
              <span className={`bg-gradient-to-r ${GRADIENTS.coralPink} bg-clip-text text-transparent`}>
                crecer
              </span>
              ?
            </motion.h2>

            {/* Description */}
            <motion.p
              variants={fadeInUp}
              className="text-base sm:text-lg lg:text-xl text-white/70 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed"
            >
              Sé de los primeros en acceder a Catalyst.
              Regístrate ahora y obtén condiciones exclusivas
              cuando lancemos.
            </motion.p>

            {/* Feature highlights */}
            <motion.div variants={fadeInUp}>
              <FeatureHighlights />
            </motion.div>
          </motion.div>

          {/* Waitlist Form */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={VIEWPORT_CONFIG.standard}
            transition={{ duration: 0.6, delay: 0.3, ease: APPLE_EASE }}
            className="flex justify-center mb-12 sm:mb-16"
          >
            <WaitlistForm prefersReducedMotion={prefersReducedMotion} />
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1 }}
            viewport={VIEWPORT_CONFIG.standard}
            transition={{ duration: 0.5, delay: 0.5, ease: APPLE_EASE }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-white/50 text-sm"
          >
            <span>✓ 100% seguro</span>
            <span className="hidden sm:inline">•</span>
            <span>✓ Sin compromisos</span>
            <span className="hidden sm:inline">•</span>
            <span>✓ Cancela cuando quieras</span>
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
                hover:text-tis-coral
                transition-colors duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tis-coral focus-visible:ring-offset-2
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
