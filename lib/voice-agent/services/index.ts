/**
 * TIS TIS Platform - Voice Agent v2.0
 * Services Module
 *
 * Exports for voice agent services including template compilation
 * and prompt generation.
 */

// =====================================================
// TEMPLATE PROMPT COMPILER
// =====================================================

export {
  TemplatePromptCompilerService,
  createTemplateCompiler,
} from './template-prompt-compiler.service';

export type {
  CompiledBasePrompt,
  HybridPromptResult,
  TemplateVariables,
  VoiceAssistantDbConfig,
  AssistantTypeDbConfig,
  TemplateBusinessContext,
  TemplateCompilerConfig,
  Vertical,
} from './template-prompt-compiler.types';

export {
  DEFAULT_COMPILER_CONFIG,
  VERTICAL_TO_BUSINESS_TYPE,
  VERTICAL_TO_MAIN_TASK,
  getTemplateFileName,
  getPersonalityFileName,
} from './template-prompt-compiler.types';

// =====================================================
// VOICE SECURE BOOKING SERVICE (v2.2)
// =====================================================

export {
  VoiceSecureBookingService,
  createVoiceSecureBookingService,
} from './voice-secure-booking.service';

export type {
  SecureBookingContext,
  TrustVerificationResult,
  HoldCreationResult,
  BookingConversionResult,
} from './voice-secure-booking.service';
