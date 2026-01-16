// =====================================================
// TIS TIS PLATFORM - Getting Started Card Component
// Onboarding visual guide for prompt configuration
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================
interface GettingStartedCardProps {
  instructionsCount: number;
  templatesCount: number;
  isProfileActive: boolean;
  colorScheme?: 'purple' | 'orange';
  onDismiss?: () => void;
  className?: string;
}

interface Step {
  id: number;
  title: string;
  description: string;
  isComplete: boolean;
  icon: React.ReactNode;
}

// ======================
// ICONS
// ======================
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const BrainIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.5 18.75l-.259 1.035a3.375 3.375 0 01-2.456 2.456L12.75 22.5l-1.035-.259a3.375 3.375 0 01-2.456-2.456L9 18.75l.259-1.035a3.375 3.375 0 012.456-2.456L12.75 15l1.035.259a3.375 3.375 0 012.456 2.456z" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const RocketIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.39 14.39 0 006.16-12.12L21.75 3 17.5 4.82a14.39 14.39 0 00-12.12 6.16m12.12-6.16L17.5 4.82m0 0a14.39 14.39 0 00-6.16 12.12M7.5 14.25v4.5a2.25 2.25 0 002.25 2.25h4.5M3.75 3.75L21 21" />
  </svg>
);

// ======================
// COMPONENT
// ======================
export function GettingStartedCard({
  instructionsCount,
  templatesCount,
  isProfileActive,
  colorScheme = 'purple',
  onDismiss,
  className,
}: GettingStartedCardProps) {
  // Define steps
  const steps: Step[] = [
    {
      id: 1,
      title: 'Define el comportamiento',
      description: 'Crea instrucciones para personalizar cómo responde tu asistente',
      isComplete: instructionsCount >= 1,
      icon: <BrainIcon />,
    },
    {
      id: 2,
      title: 'Agrega plantillas',
      description: 'Respuestas predefinidas para situaciones comunes',
      isComplete: templatesCount >= 1,
      icon: <ChatIcon />,
    },
    {
      id: 3,
      title: 'Activa tu asistente',
      description: 'Revisa la configuración y activa el perfil',
      isComplete: isProfileActive && instructionsCount >= 1,
      icon: <RocketIcon />,
    },
  ];

  const completedSteps = steps.filter(s => s.isComplete).length;
  const progressPercent = (completedSteps / steps.length) * 100;
  const allComplete = completedSteps === steps.length;

  // Colors
  const colors = colorScheme === 'purple'
    ? {
        gradient: 'from-purple-500 via-indigo-500 to-blue-500',
        bgLight: 'bg-purple-50',
        bgMedium: 'bg-purple-100',
        text: 'text-purple-700',
        border: 'border-purple-200',
        progressBg: 'bg-purple-200',
        progressFill: 'bg-purple-600',
        stepComplete: 'bg-purple-600 text-white',
        stepPending: 'bg-purple-100 text-purple-600',
      }
    : {
        gradient: 'from-orange-500 via-pink-500 to-rose-500',
        bgLight: 'bg-orange-50',
        bgMedium: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-200',
        progressBg: 'bg-orange-200',
        progressFill: 'bg-orange-600',
        stepComplete: 'bg-orange-600 text-white',
        stepPending: 'bg-orange-100 text-orange-600',
      };

  // Note: The parent component should control visibility via conditional rendering
  // when onDismiss is called. This component always renders when mounted.

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border shadow-sm',
        colors.bgLight,
        colors.border,
        className
      )}
    >
      {/* Decorative gradient bar */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r',
        colors.gradient
      )} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              colors.bgMedium,
              colors.text
            )}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                {allComplete ? '¡Configuración completa!' : 'Primeros pasos'}
              </h3>
              <p className="text-sm text-slate-500">
                {allComplete
                  ? 'Tu asistente está listo para responder'
                  : 'Configura tu asistente en 3 pasos'
                }
              </p>
            </div>
          </div>

          {/* Dismiss button (only show when complete) */}
          {allComplete && onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
              title="Ocultar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">
              Progreso
            </span>
            <span className={cn('text-xs font-bold', colors.text)}>
              {completedSteps}/{steps.length} completados
            </span>
          </div>
          <div className={cn('h-2 rounded-full overflow-hidden', colors.progressBg)}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={cn('h-full rounded-full', colors.progressFill)}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl transition-all',
                step.isComplete
                  ? 'bg-white/80'
                  : index === completedSteps
                    ? 'bg-white shadow-sm border border-slate-200'
                    : 'bg-white/40'
              )}
            >
              {/* Step Number/Check */}
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold transition-all',
                step.isComplete
                  ? colors.stepComplete
                  : colors.stepPending
              )}>
                {step.isComplete ? <CheckIcon /> : step.id}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'font-medium',
                    step.isComplete ? 'text-slate-600' : 'text-slate-900'
                  )}>
                    {step.title}
                  </span>
                  {index === completedSteps && !step.isComplete && (
                    <span className={cn(
                      'px-2 py-0.5 text-xs font-medium rounded-full',
                      colors.bgMedium,
                      colors.text
                    )}>
                      Siguiente
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {step.description}
                </p>
              </div>

              {/* Step Icon */}
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                step.isComplete ? 'bg-slate-100 text-slate-400' : colors.bgMedium + ' ' + colors.text
              )}>
                {step.icon}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Success Message */}
        {allComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <CheckIcon />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  ¡Excelente! Tu asistente está configurado
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Puedes seguir personalizando las instrucciones y plantillas
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default GettingStartedCard;
