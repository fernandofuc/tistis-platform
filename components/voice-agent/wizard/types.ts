/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Type Definitions
 *
 * Types for the 5-step voice agent configuration wizard.
 */

import type {
  VoiceAgentConfig,
  VoicePersonality,
} from '@/src/features/voice-agent/types';
import type { AssistantTypeId } from '@/lib/voice-agent/types';

// =====================================================
// WIZARD STEP TYPES
// =====================================================

/**
 * Wizard step identifiers
 */
export type WizardStepId =
  | 'type'      // Step 1: Select assistant type
  | 'voice'     // Step 2: Select voice
  | 'customize' // Step 3: Customize assistant
  | 'test'      // Step 4: Test assistant
  | 'activate'; // Step 5: Activate & provision number

/**
 * Wizard step definition
 */
export interface WizardStep {
  /** Unique step identifier */
  id: WizardStepId;

  /** Display title for the step */
  title: string;

  /** Short description of the step */
  description: string;

  /** Whether this step is optional */
  optional?: boolean;
}

/**
 * All wizard steps
 */
export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'type',
    title: 'Tipo',
    description: 'Selecciona el tipo de asistente',
  },
  {
    id: 'voice',
    title: 'Voz',
    description: 'Elige la voz de tu asistente',
  },
  {
    id: 'customize',
    title: 'Personalizar',
    description: 'Configura el comportamiento',
  },
  {
    id: 'test',
    title: 'Probar',
    description: 'Prueba tu asistente',
    optional: true,
  },
  {
    id: 'activate',
    title: 'Activar',
    description: 'Activa tu número de teléfono',
  },
];

// =====================================================
// WIZARD STATE
// =====================================================

/**
 * Configuration data collected through the wizard
 */
export interface WizardConfigData {
  /** Selected assistant type ID */
  assistantType: AssistantTypeId | null;

  /** Selected voice ID */
  voiceId: string | null;

  /** Voice playback speed (0.8 - 1.3) */
  voiceSpeed: number;

  /** Assistant display name */
  assistantName: string;

  /** First message / greeting */
  firstMessage: string;

  /** Assistant personality */
  personality: VoicePersonality;

  /** Custom instructions */
  customInstructions: string;

  /** Enabled optional capabilities */
  enabledCapabilities: string[];

  /** Area code for phone number */
  areaCode: string | null;

  /** Whether the config has been tested */
  hasBeenTested: boolean;

  /** Test result if tested */
  testResult?: TestResult;
}

/**
 * Default wizard config values
 */
export const DEFAULT_WIZARD_CONFIG: WizardConfigData = {
  assistantType: null,
  voiceId: null,
  voiceSpeed: 1.0,
  assistantName: '',
  firstMessage: '',
  personality: 'professional_friendly',
  customInstructions: '',
  enabledCapabilities: [],
  areaCode: null,
  hasBeenTested: false,
};

/**
 * Wizard state
 */
export interface WizardState {
  /** Current step index (0-4) */
  currentStepIndex: number;

  /** Current step ID */
  currentStepId: WizardStepId;

  /** Configuration data */
  config: WizardConfigData;

  /** Whether wizard is loading */
  isLoading: boolean;

  /** Whether wizard is saving */
  isSaving: boolean;

  /** Error message if any */
  error: string | null;

  /** Whether wizard has unsaved changes */
  hasUnsavedChanges: boolean;
}

// =====================================================
// STEP PROPS
// =====================================================

/**
 * Common props for all step components
 */
export interface StepComponentProps {
  /** Current wizard config */
  config: WizardConfigData;

  /** Business vertical */
  vertical: 'restaurant' | 'dental';

  /** Update config values */
  onUpdateConfig: (updates: Partial<WizardConfigData>) => void;

  /** Proceed to next step */
  onNext: () => void;

  /** Go back to previous step */
  onBack: () => void;

  /** Whether this is the first step */
  isFirstStep: boolean;

  /** Whether this is the last step */
  isLastStep: boolean;

  /** Whether the step is currently loading */
  isLoading: boolean;

  /** Access token for API calls */
  accessToken?: string;
}

// =====================================================
// TEST TYPES
// =====================================================

/**
 * Test scenario
 */
export interface TestScenario {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Icon emoji */
  icon: string;

  /** Sample user message */
  sampleMessage: string;

  /** Expected intent */
  expectedIntent?: string;
}

/**
 * Test scenarios by vertical
 */
export const TEST_SCENARIOS: Record<'restaurant' | 'dental', TestScenario[]> = {
  restaurant: [
    {
      id: 'reservation',
      name: 'Hacer reservación',
      description: 'Simula un cliente haciendo una reservación',
      icon: '📅',
      sampleMessage: 'Hola, quisiera hacer una reservación para 4 personas el sábado',
      expectedIntent: 'make_reservation',
    },
    {
      id: 'hours',
      name: 'Preguntar horarios',
      description: 'Consulta de horarios de atención',
      icon: '🕐',
      sampleMessage: '¿A qué hora abren los domingos?',
      expectedIntent: 'query_hours',
    },
    {
      id: 'menu',
      name: 'Consultar menú',
      description: 'Pregunta sobre el menú o platillos',
      icon: '📋',
      sampleMessage: '¿Qué platillos vegetarianos tienen?',
      expectedIntent: 'query_menu',
    },
    {
      id: 'cancel',
      name: 'Cancelar reservación',
      description: 'Simula cancelación de reservación',
      icon: '❌',
      sampleMessage: 'Necesito cancelar mi reservación de mañana',
      expectedIntent: 'cancel_reservation',
    },
  ],
  dental: [
    {
      id: 'appointment',
      name: 'Agendar cita',
      description: 'Simula un paciente agendando una cita',
      icon: '📅',
      sampleMessage: 'Buenos días, quisiera agendar una cita para limpieza dental',
      expectedIntent: 'make_appointment',
    },
    {
      id: 'hours',
      name: 'Preguntar horarios',
      description: 'Consulta de horarios de atención',
      icon: '🕐',
      sampleMessage: '¿Cuál es su horario de atención?',
      expectedIntent: 'query_hours',
    },
    {
      id: 'services',
      name: 'Consultar servicios',
      description: 'Pregunta sobre servicios o precios',
      icon: '🦷',
      sampleMessage: '¿Cuánto cuesta una limpieza dental?',
      expectedIntent: 'query_services',
    },
    {
      id: 'emergency',
      name: 'Urgencia dental',
      description: 'Simula una urgencia dental',
      icon: '🚨',
      sampleMessage: 'Tengo un dolor muy fuerte en una muela, ¿pueden atenderme hoy?',
      expectedIntent: 'emergency',
    },
  ],
};

/**
 * Test result
 */
export interface TestResult {
  /** Whether the test was successful */
  success: boolean;

  /** Total test duration in seconds */
  durationSeconds: number;

  /** Number of message turns */
  messageCount: number;

  /** Average response latency in ms */
  averageLatencyMs: number;

  /** Intents detected */
  detectedIntents: string[];

  /** Overall test notes */
  notes?: string;
}

// =====================================================
// VALIDATION
// =====================================================

/**
 * Validation result for a step
 */
export interface StepValidation {
  /** Whether the step is valid */
  isValid: boolean;

  /** Error messages */
  errors: string[];

  /** Warning messages */
  warnings: string[];
}

/**
 * Validate step data
 */
export function validateStep(
  stepId: WizardStepId,
  config: WizardConfigData,
  vertical: 'restaurant' | 'dental'
): StepValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (stepId) {
    case 'type':
      if (!config.assistantType) {
        errors.push('Selecciona un tipo de asistente');
      }
      break;

    case 'voice':
      if (!config.voiceId) {
        errors.push('Selecciona una voz para tu asistente');
      }
      break;

    case 'customize':
      if (!config.assistantName.trim()) {
        errors.push('El nombre del asistente es requerido');
      } else if (config.assistantName.length < 2) {
        errors.push('El nombre debe tener al menos 2 caracteres');
      } else if (config.assistantName.length > 20) {
        errors.push('El nombre no puede exceder 20 caracteres');
      }

      if (!config.firstMessage.trim()) {
        errors.push('El mensaje de bienvenida es requerido');
      } else if (config.firstMessage.length < 20) {
        warnings.push('El mensaje de bienvenida es muy corto');
      } else if (config.firstMessage.length > 500) {
        errors.push('El mensaje de bienvenida no puede exceder 500 caracteres');
      }
      break;

    case 'test':
      // Test step is optional, no validation required
      if (!config.hasBeenTested) {
        warnings.push('Te recomendamos probar tu asistente antes de activarlo');
      }
      break;

    case 'activate':
      // Area code is required for activation
      if (!config.areaCode) {
        errors.push('Selecciona una lada para tu número de teléfono');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if step can be navigated to
 */
export function canNavigateToStep(
  targetStepIndex: number,
  currentStepIndex: number,
  config: WizardConfigData,
  vertical: 'restaurant' | 'dental'
): boolean {
  // Can always go back
  if (targetStepIndex < currentStepIndex) {
    return true;
  }

  // Can only go forward if all previous steps are valid
  const stepIds: WizardStepId[] = ['type', 'voice', 'customize', 'test', 'activate'];

  for (let i = 0; i < targetStepIndex; i++) {
    const validation = validateStep(stepIds[i], config, vertical);
    // Allow skipping test step (optional)
    if (!validation.isValid && stepIds[i] !== 'test') {
      return false;
    }
  }

  return true;
}

// =====================================================
// WIZARD PROPS
// =====================================================

/**
 * Main wizard component props
 */
export interface VoiceAgentWizardProps {
  /** Business ID */
  businessId: string;

  /** Business vertical */
  vertical: 'restaurant' | 'dental';

  /** Existing configuration if editing */
  existingConfig?: VoiceAgentConfig | null;

  /** Access token for API calls */
  accessToken: string;

  /** Callback when wizard completes */
  onComplete: () => void;

  /** Callback when wizard is closed/cancelled */
  onClose: () => void;

  /** Callback to save configuration */
  onSaveConfig: (config: Partial<VoiceAgentConfig>) => Promise<boolean>;

  /** Callback to request phone number */
  onRequestPhoneNumber: (areaCode: string) => Promise<boolean>;
}

// =====================================================
// LEGACY COMPATIBILITY
// =====================================================

/**
 * Legacy wizard props for backwards compatibility
 * with the existing ai-agent-voz page implementation.
 *
 * The old wizard used these props, so we support them
 * to enable gradual migration.
 */
export interface LegacyWizardProps {
  /** Existing config (maps to existingConfig) */
  config: VoiceAgentConfig | null;

  /** Business vertical */
  vertical: 'dental' | 'restaurant' | 'medical' | 'general';

  /** Access token for API calls */
  accessToken: string;

  /** Callback to save configuration */
  onSaveConfig: (config: Partial<VoiceAgentConfig>) => Promise<boolean>;

  /** Callback to request phone number */
  onRequestPhoneNumber: (areaCode: string) => Promise<boolean>;

  /** Callback when wizard completes */
  onComplete: () => void;

  /** Callback when wizard is closed */
  onClose: () => void;
}

/**
 * Type guard to check if props are legacy format
 */
export function isLegacyWizardProps(
  props: VoiceAgentWizardProps | LegacyWizardProps
): props is LegacyWizardProps {
  return 'config' in props && !('businessId' in props);
}

/**
 * Convert legacy props to new format
 */
export function convertLegacyProps(legacyProps: LegacyWizardProps): VoiceAgentWizardProps {
  // Map vertical - only support restaurant and dental
  const vertical: 'restaurant' | 'dental' =
    legacyProps.vertical === 'restaurant' ? 'restaurant' : 'dental';

  return {
    businessId: '', // Not available in legacy, will be fetched from session
    vertical,
    existingConfig: legacyProps.config,
    accessToken: legacyProps.accessToken,
    onComplete: legacyProps.onComplete,
    onClose: legacyProps.onClose,
    onSaveConfig: legacyProps.onSaveConfig,
    onRequestPhoneNumber: legacyProps.onRequestPhoneNumber,
  };
}
