/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Module Index
 *
 * Central export point for the Voice Agent Setup Wizard.
 */

// Main wizard component
export { VoiceAgentWizard, VoiceAgentWizardLegacy } from './VoiceAgentWizard';
export { default as VoiceAgentWizardDefault } from './VoiceAgentWizard';

// Sub-components
export { WizardProgress } from './WizardProgress';
export { WizardNavigation, WizardCloseButton } from './WizardNavigation';

// Steps (for potential standalone usage)
export {
  StepSelectType,
  StepSelectVoice,
  StepCustomize,
  StepTest,
  StepActivate,
} from './steps';

// Types
export * from './types';
