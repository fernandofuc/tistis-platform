/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Wizard Progress Component
 *
 * Visual progress indicator for the 5-step wizard.
 * Follows TIS TIS design system with coral/pink gradients.
 */

'use client';

import { motion } from 'framer-motion';
import { CheckIcon } from '@/src/features/voice-agent/components/VoiceAgentIcons';
import { WIZARD_STEPS } from './types';

// =====================================================
// TYPES
// =====================================================

interface WizardProgressProps {
  /** Current step index (0-4) */
  currentStepIndex: number;

  /** Completed steps (array of step indices) */
  completedSteps?: number[];

  /** Callback when a step is clicked */
  onStepClick?: (stepIndex: number) => void;

  /** Whether clicking on steps is allowed */
  allowStepNavigation?: boolean;

  /** Variant for different layouts */
  variant?: 'horizontal' | 'vertical' | 'compact';

  /** Custom class name */
  className?: string;
}

// =====================================================
// COMPONENT
// =====================================================

export function WizardProgress({
  currentStepIndex,
  completedSteps = [],
  onStepClick,
  allowStepNavigation = false,
  variant = 'horizontal',
  className = '',
}: WizardProgressProps) {
  const isStepCompleted = (index: number) =>
    completedSteps.includes(index) || index < currentStepIndex;

  const isStepActive = (index: number) => index === currentStepIndex;

  const isStepClickable = (index: number) =>
    allowStepNavigation && (isStepCompleted(index) || index <= currentStepIndex + 1);

  const handleStepClick = (index: number) => {
    if (isStepClickable(index) && onStepClick) {
      onStepClick(index);
    }
  };

  // =====================================================
  // COMPACT VARIANT (dots only)
  // =====================================================
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {WIZARD_STEPS.map((step, index) => (
          <motion.button
            key={step.id}
            type="button"
            disabled={!isStepClickable(index)}
            onClick={() => handleStepClick(index)}
            className={`
              w-2.5 h-2.5 rounded-full transition-all duration-300
              ${isStepActive(index)
                ? 'bg-tis-coral scale-125'
                : isStepCompleted(index)
                  ? 'bg-tis-green'
                  : 'bg-slate-200'
              }
              ${isStepClickable(index) ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
            `}
            whileHover={isStepClickable(index) ? { scale: 1.2 } : undefined}
            whileTap={isStepClickable(index) ? { scale: 0.9 } : undefined}
            aria-label={`Paso ${index + 1}: ${step.title}`}
            aria-current={isStepActive(index) ? 'step' : undefined}
          />
        ))}
        <span className="ml-2 text-sm text-slate-500">
          Paso {currentStepIndex + 1} de {WIZARD_STEPS.length}
        </span>
      </div>
    );
  }

  // =====================================================
  // VERTICAL VARIANT
  // =====================================================
  if (variant === 'vertical') {
    return (
      <nav className={`flex flex-col gap-0 ${className}`} aria-label="Progreso del wizard">
        {WIZARD_STEPS.map((step, index) => (
          <div key={step.id} className="flex items-start gap-3">
            {/* Step indicator column */}
            <div className="flex flex-col items-center">
              {/* Circle */}
              <motion.button
                type="button"
                disabled={!isStepClickable(index)}
                onClick={() => handleStepClick(index)}
                className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center
                  border-2 transition-all duration-300 font-medium text-sm
                  ${isStepActive(index)
                    ? 'border-tis-coral bg-tis-coral text-white shadow-lg shadow-tis-coral/30'
                    : isStepCompleted(index)
                      ? 'border-tis-green bg-tis-green text-white'
                      : 'border-slate-200 bg-white text-slate-400'
                  }
                  ${isStepClickable(index) ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
                `}
                whileHover={isStepClickable(index) ? { scale: 1.05 } : undefined}
                whileTap={isStepClickable(index) ? { scale: 0.95 } : undefined}
                aria-label={`Paso ${index + 1}: ${step.title}`}
                aria-current={isStepActive(index) ? 'step' : undefined}
              >
                {isStepCompleted(index) ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </motion.button>

              {/* Connector line */}
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={`
                    w-0.5 h-12 transition-colors duration-300
                    ${isStepCompleted(index) ? 'bg-tis-green' : 'bg-slate-200'}
                  `}
                />
              )}
            </div>

            {/* Step content */}
            <div className="pt-2 pb-10">
              <p
                className={`
                  font-semibold text-sm
                  ${isStepActive(index)
                    ? 'text-slate-900'
                    : isStepCompleted(index)
                      ? 'text-tis-green-600'
                      : 'text-slate-400'
                  }
                `}
              >
                {step.title}
              </p>
              <p
                className={`
                  text-xs mt-0.5
                  ${isStepActive(index) ? 'text-slate-600' : 'text-slate-400'}
                `}
              >
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </nav>
    );
  }

  // =====================================================
  // HORIZONTAL VARIANT (default)
  // =====================================================
  return (
    <nav className={`w-full ${className}`} aria-label="Progreso del wizard">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-3">
        {WIZARD_STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step circle with number or check */}
            <motion.button
              type="button"
              disabled={!isStepClickable(index)}
              onClick={() => handleStepClick(index)}
              className={`
                relative w-10 h-10 sm:w-9 sm:h-9 rounded-full flex items-center justify-center
                border-2 transition-all duration-300 font-medium text-sm
                ${isStepActive(index)
                  ? 'border-tis-coral bg-tis-coral text-white shadow-lg shadow-tis-coral/30'
                  : isStepCompleted(index)
                    ? 'border-tis-green bg-tis-green text-white'
                    : 'border-slate-200 bg-white text-slate-400'
                }
                ${isStepClickable(index) ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
              `}
              whileHover={isStepClickable(index) ? { scale: 1.05 } : undefined}
              whileTap={isStepClickable(index) ? { scale: 0.95 } : undefined}
              aria-label={`Paso ${index + 1}: ${step.title}`}
              aria-current={isStepActive(index) ? 'step' : undefined}
            >
              {isStepCompleted(index) ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                <span>{index + 1}</span>
              )}
            </motion.button>

            {/* Step title (hidden on mobile) */}
            <span
              className={`
                hidden sm:inline ml-2 text-sm font-medium
                ${isStepActive(index)
                  ? 'text-slate-900'
                  : isStepCompleted(index)
                    ? 'text-tis-green-600'
                    : 'text-slate-400'
                }
              `}
            >
              {step.title}
            </span>

            {/* Connector line */}
            {index < WIZARD_STEPS.length - 1 && (
              <div className="flex-1 mx-2 sm:mx-4">
                <div className="h-0.5 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${isStepCompleted(index) ? 'bg-tis-green' : 'bg-slate-200'}`}
                    initial={{ width: 0 }}
                    animate={{ width: isStepCompleted(index) ? '100%' : '0%' }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-tis-coral to-tis-pink rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>
    </nav>
  );
}

export default WizardProgress;
