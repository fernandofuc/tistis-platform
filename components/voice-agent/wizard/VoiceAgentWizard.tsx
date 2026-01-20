/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Main Wizard Container Component
 *
 * Orchestrates the 5-step wizard flow for voice agent configuration.
 * Manages state, navigation, and persistence.
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import { WizardProgress } from './WizardProgress';
import { WizardNavigation, WizardCloseButton } from './WizardNavigation';
import {
  StepSelectType,
  StepSelectVoice,
  StepCustomize,
  StepTest,
  StepActivate,
} from './steps';

// Types
import type {
  VoiceAgentWizardProps,
  WizardStepId,
  WizardConfigData,
  StepComponentProps,
  LegacyWizardProps,
} from './types';
import {
  WIZARD_STEPS,
  DEFAULT_WIZARD_CONFIG,
  validateStep,
  canNavigateToStep,
  isLegacyWizardProps,
  convertLegacyProps,
} from './types';
import type { VoiceAgentConfig } from '@/src/features/voice-agent/types';

// =====================================================
// STEP COMPONENTS MAP
// =====================================================

const STEP_COMPONENTS: Record<WizardStepId, React.ComponentType<StepComponentProps>> = {
  type: StepSelectType,
  voice: StepSelectVoice,
  customize: StepCustomize,
  test: StepTest,
  activate: StepActivate,
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function VoiceAgentWizard({
  businessId,
  vertical,
  existingConfig,
  accessToken,
  onComplete,
  onClose,
  onSaveConfig,
  onRequestPhoneNumber,
}: VoiceAgentWizardProps) {
  // =====================================================
  // STATE
  // =====================================================

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [config, setConfig] = useState<WizardConfigData>(() => {
    // Initialize from existing config if available
    if (existingConfig) {
      return {
        ...DEFAULT_WIZARD_CONFIG,
        // Start fresh for assistant type selection (user needs to choose)
        assistantType: null,
        voiceId: existingConfig.voice_id || null,
        voiceSpeed: 1.0,
        assistantName: existingConfig.assistant_name || '',
        firstMessage: existingConfig.first_message || '',
        personality: existingConfig.assistant_personality || 'professional_friendly',
        customInstructions: existingConfig.custom_instructions || '',
        enabledCapabilities: [],
        areaCode: null,
        hasBeenTested: false,
      };
    }
    return DEFAULT_WIZARD_CONFIG;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // =====================================================
  // DERIVED STATE
  // =====================================================

  const currentStepId = WIZARD_STEPS[currentStepIndex].id;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  // Current step validation
  const currentValidation = useMemo(
    () => validateStep(currentStepId, config, vertical),
    [currentStepId, config, vertical]
  );

  // Can proceed to next step
  const canProceed = useMemo(() => {
    // Test step is optional
    if (currentStepId === 'test') {
      return true;
    }
    // Activate step requires area code
    if (currentStepId === 'activate') {
      return currentValidation.isValid && !!config.areaCode;
    }
    return currentValidation.isValid;
  }, [currentStepId, currentValidation.isValid, config.areaCode]);

  // Get current step component
  const CurrentStepComponent = STEP_COMPONENTS[currentStepId];

  // =====================================================
  // HANDLERS
  // =====================================================

  /**
   * Update configuration
   */
  const handleUpdateConfig = useCallback((updates: Partial<WizardConfigData>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  /**
   * Navigate to next step
   */
  const handleNext = useCallback(async () => {
    setError(null);

    // Validate current step
    const validation = validateStep(currentStepId, config, vertical);
    if (!validation.isValid && currentStepId !== 'test') {
      setError(validation.errors[0] || 'Por favor completa este paso');
      return;
    }

    // Save progress at certain steps
    if (currentStepId === 'customize') {
      setIsSaving(true);
      try {
        const success = await onSaveConfig({
          assistant_name: config.assistantName.trim(),
          first_message: config.firstMessage.trim(),
          assistant_personality: config.personality,
          custom_instructions: config.customInstructions.trim() || undefined,
          voice_id: config.voiceId || undefined,
        });

        if (!success) {
          setError('Error al guardar la configuración. Intenta de nuevo.');
          setIsSaving(false);
          return;
        }
      } catch (err) {
        setError('Error al guardar la configuración. Intenta de nuevo.');
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    // Handle last step (activation)
    if (isLastStep) {
      if (!config.areaCode) {
        setError('Selecciona una lada para tu número de teléfono');
        return;
      }

      setIsLoading(true);
      try {
        // First save all config
        await onSaveConfig({
          assistant_name: config.assistantName.trim(),
          first_message: config.firstMessage.trim(),
          assistant_personality: config.personality,
          custom_instructions: config.customInstructions.trim() || undefined,
          voice_id: config.voiceId || undefined,
          voice_status: 'configuring',
        });

        // Then request phone number
        const success = await onRequestPhoneNumber(config.areaCode);

        if (success) {
          onComplete();
        } else {
          setError('Error al activar el número. Intenta de nuevo.');
        }
      } catch (err) {
        setError('Error al activar el asistente. Intenta de nuevo.');
      }
      setIsLoading(false);
      return;
    }

    // Mark current step as completed and go to next
    setCompletedSteps((prev) => {
      if (!prev.includes(currentStepIndex)) {
        return [...prev, currentStepIndex];
      }
      return prev;
    });
    setCurrentStepIndex((prev) => prev + 1);
  }, [
    currentStepId,
    currentStepIndex,
    config,
    vertical,
    isLastStep,
    onSaveConfig,
    onRequestPhoneNumber,
    onComplete,
  ]);

  /**
   * Navigate to previous step
   */
  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setError(null);
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [isFirstStep]);

  /**
   * Skip current step (for optional steps like test)
   */
  const handleSkip = useCallback(() => {
    if (currentStepId === 'test') {
      setCompletedSteps((prev) => {
        if (!prev.includes(currentStepIndex)) {
          return [...prev, currentStepIndex];
        }
        return prev;
      });
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepId, currentStepIndex]);

  /**
   * Navigate to specific step (via progress indicator)
   */
  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (canNavigateToStep(stepIndex, currentStepIndex, config, vertical)) {
        setError(null);
        setCurrentStepIndex(stepIndex);
      }
    },
    [currentStepIndex, config, vertical]
  );

  /**
   * Close wizard
   */
  const handleClose = useCallback(() => {
    // Could add confirmation dialog here if there are unsaved changes
    onClose();
  }, [onClose]);

  // =====================================================
  // ANIMATION VARIANTS
  // =====================================================

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { scale: 0.95, opacity: 0 },
    visible: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
  };

  const stepVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 20 : -20,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 20 : -20,
      opacity: 0,
    }),
  };

  // Track direction for animations
  const [direction, setDirection] = useState(0);
  const [prevStepIndex, setPrevStepIndex] = useState(0);

  // Update direction when step changes
  useEffect(() => {
    if (currentStepIndex > prevStepIndex) {
      setDirection(1);
    } else if (currentStepIndex < prevStepIndex) {
      setDirection(-1);
    }
    setPrevStepIndex(currentStepIndex);
  }, [currentStepIndex, prevStepIndex]);

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={overlayVariants}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100">
          <WizardProgress
            currentStepIndex={currentStepIndex}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
            allowStepNavigation={true}
            variant="compact"
          />
          <WizardCloseButton onClose={handleClose} disabled={isLoading || isSaving} />
        </div>

        {/* Progress bar (horizontal) */}
        <div className="px-4 sm:px-6 pt-4">
          <WizardProgress
            currentStepIndex={currentStepIndex}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
            allowStepNavigation={true}
            variant="horizontal"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStepId}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <CurrentStepComponent
                config={config}
                vertical={vertical}
                onUpdateConfig={handleUpdateConfig}
                onNext={handleNext}
                onBack={handleBack}
                isFirstStep={isFirstStep}
                isLastStep={isLastStep}
                isLoading={isLoading || isSaving}
                accessToken={accessToken}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="px-4 sm:px-6"
            >
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer / Navigation */}
        <WizardNavigation
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          canProceed={canProceed}
          isLoading={isLoading || isSaving}
          showSkip={currentStepId === 'test'}
          onNext={handleNext}
          onBack={handleBack}
          onSkip={handleSkip}
          nextButtonText={currentStepId === 'customize' ? 'Guardar y continuar' : 'Continuar'}
          finishButtonText="Activar mi número"
        />
      </motion.div>
    </motion.div>
  );
}

export default VoiceAgentWizard;

// =====================================================
// LEGACY WRAPPER
// =====================================================

/**
 * Wrapper component that supports both new and legacy props.
 * This enables gradual migration from the old wizard API.
 *
 * Usage in existing pages:
 * ```tsx
 * import { VoiceAgentWizardLegacy } from '@/components/voice-agent/wizard';
 *
 * <VoiceAgentWizardLegacy
 *   config={config}
 *   vertical={vertical}
 *   accessToken={accessToken}
 *   onSaveConfig={handleSaveConfig}
 *   onRequestPhoneNumber={handleRequestPhone}
 *   onComplete={() => setShowWizard(false)}
 *   onClose={() => setShowWizard(false)}
 * />
 * ```
 */
export function VoiceAgentWizardLegacy(
  props: VoiceAgentWizardProps | LegacyWizardProps
) {
  // Convert legacy props if needed
  const normalizedProps = isLegacyWizardProps(props)
    ? convertLegacyProps(props)
    : props;

  return <VoiceAgentWizard {...normalizedProps} />;
}
