/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Wizard Navigation Component
 *
 * Navigation buttons for the wizard (Back, Next, Skip, Finish).
 * Follows TIS TIS design system with gradient buttons.
 */

'use client';

import { motion } from 'framer-motion';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  LoaderIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';

// =====================================================
// TYPES
// =====================================================

interface WizardNavigationProps {
  /** Whether this is the first step */
  isFirstStep: boolean;

  /** Whether this is the last step */
  isLastStep: boolean;

  /** Whether the current step is valid for proceeding */
  canProceed: boolean;

  /** Whether navigation is currently loading */
  isLoading: boolean;

  /** Whether there's a skip option for this step */
  showSkip?: boolean;

  /** Custom text for the next button */
  nextButtonText?: string;

  /** Custom text for the back button */
  backButtonText?: string;

  /** Custom text for the skip button */
  skipButtonText?: string;

  /** Custom text for the finish button */
  finishButtonText?: string;

  /** Callback for next button */
  onNext: () => void;

  /** Callback for back button */
  onBack: () => void;

  /** Callback for skip button */
  onSkip?: () => void;

  /** Custom class name */
  className?: string;
}

// =====================================================
// COMPONENT
// =====================================================

export function WizardNavigation({
  isFirstStep,
  isLastStep,
  canProceed,
  isLoading,
  showSkip = false,
  nextButtonText = 'Continuar',
  backButtonText = 'Atrás',
  skipButtonText = 'Omitir',
  finishButtonText = 'Activar',
  onNext,
  onBack,
  onSkip,
  className = '',
}: WizardNavigationProps) {
  return (
    <div
      className={`
        flex items-center justify-between p-4 sm:p-6
        border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm
        ${className}
      `}
    >
      {/* Left side - Back button */}
      <div className="min-w-[100px]">
        {!isFirstStep && (
          <motion.button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className={`
              flex items-center gap-2 px-4 py-2.5
              text-slate-600 font-medium text-sm
              hover:text-slate-900 hover:bg-slate-200/80
              rounded-xl transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
              min-h-[44px] sm:min-h-0
            `}
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{backButtonText}</span>
          </motion.button>
        )}
      </div>

      {/* Right side - Skip and Next/Finish buttons */}
      <div className="flex items-center gap-3">
        {/* Skip button (optional) */}
        {showSkip && onSkip && (
          <motion.button
            type="button"
            onClick={onSkip}
            disabled={isLoading}
            className={`
              px-4 py-2.5 text-sm font-medium
              text-slate-500 hover:text-slate-700
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              min-h-[44px] sm:min-h-0
            `}
            whileTap={{ scale: 0.98 }}
          >
            {skipButtonText}
          </motion.button>
        )}

        {/* Next/Finish button */}
        {isLastStep ? (
          <motion.button
            type="button"
            onClick={onNext}
            disabled={!canProceed || isLoading}
            className={`
              flex items-center gap-2 px-6 py-3
              text-white font-medium text-sm
              bg-gradient-to-r from-tis-green to-emerald-500
              rounded-xl shadow-lg shadow-tis-green/30
              hover:shadow-xl hover:shadow-tis-green/40
              transition-all
              disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
              min-h-[48px] sm:min-h-0
            `}
            whileHover={{ scale: canProceed && !isLoading ? 1.02 : 1 }}
            whileTap={{ scale: canProceed && !isLoading ? 0.98 : 1 }}
          >
            {isLoading ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                <span>Activando...</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                <span>{finishButtonText}</span>
              </>
            )}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={onNext}
            disabled={!canProceed || isLoading}
            className={`
              flex items-center gap-2 px-6 py-3
              text-white font-medium text-sm
              bg-gradient-to-r from-tis-coral to-tis-pink
              rounded-xl shadow-lg shadow-tis-coral/30
              hover:shadow-xl hover:shadow-tis-coral/40
              transition-all
              disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
              min-h-[48px] sm:min-h-0
            `}
            whileHover={{ scale: canProceed && !isLoading ? 1.02 : 1 }}
            whileTap={{ scale: canProceed && !isLoading ? 0.98 : 1 }}
          >
            {isLoading ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span>{nextButtonText}</span>
                <ChevronRightIcon className="w-4 h-4" />
              </>
            )}
          </motion.button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// WIZARD CLOSE BUTTON
// =====================================================

interface WizardCloseButtonProps {
  onClose: () => void;
  disabled?: boolean;
  className?: string;
}

export function WizardCloseButton({
  onClose,
  disabled = false,
  className = '',
}: WizardCloseButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClose}
      disabled={disabled}
      className={`
        p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0
        flex items-center justify-center
        text-slate-400 hover:text-slate-600
        hover:bg-slate-100 rounded-xl
        transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Cerrar wizard"
    >
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </motion.button>
  );
}

export default WizardNavigation;
