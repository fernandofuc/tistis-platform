/**
 * TIS TIS Platform - Voice Agent v2.0
 * Prompts Module
 *
 * Exports for the prompt template engine, context injection,
 * and i18n formatting utilities.
 */

// =====================================================
// TYPES
// =====================================================

export type {
  // Supported languages
  SupportedLocale,

  // Business context types
  DaySchedule,
  WeeklySchedule,
  MenuItem,
  ServiceItem,
  DoctorInfo,
  PromotionInfo,
  InsuranceInfo,
  BookingPolicy,
  FAQItem,
  BusinessContext,

  // Dynamic context
  DynamicContext,

  // Configuration types
  VoiceAssistantConfig,
  RenderOptions,

  // Rendered output types
  RenderedPrompt,
  PromptValidationResult,
  PromptValidationError,
  PromptValidationErrorCode,

  // I18n types
  TimeOfDay,
  I18nTranslations,

  // Helper context
  TemplateHelperContext,

  // Engine configuration
  TemplateEngineConfig,

  // Voice format types
  VoiceScheduleFormat,
  VoicePriceFormat,
  VoiceListFormat,
} from './types';

export {
  // Constants
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  DEFAULT_TEMPLATE_ENGINE_CONFIG,
} from './types';

// =====================================================
// TEMPLATE ENGINE
// =====================================================

export {
  // Main class
  VoiceTemplateEngine,

  // Factory functions
  createTemplateEngine,
  createInitializedTemplateEngine,

  // Utility functions
  formatTimeForVoice,
  getTimeOfDay,
} from './template-engine';

// =====================================================
// CONTEXT INJECTOR
// =====================================================

export type {
  ContextInjectionOptions,
  InjectedContext,
} from './context-injector';

export {
  // Main class
  DynamicContextInjector,

  // Factory functions
  createContextInjector,
  generateContextBlock,
  injectContextIntoPrompt,

  // Constants
  DEFAULT_INJECTION_OPTIONS,
} from './context-injector';

// =====================================================
// I18N FORMATTER
// =====================================================

export {
  // Number formatting
  numberToWords,

  // Price formatting
  formatPriceForVoice,
  formatPriceRangeForVoice,

  // Time formatting
  formatTimeForVoice as formatTimeString,
  formatHourMinuteForVoice,
  formatDurationForVoice,
  getTimeOfDay as getTimeOfDayFromDate,
  getGreetingForTimeOfDay,

  // Date formatting
  formatDateForVoice,
  formatRelativeDateForVoice,

  // List formatting
  formatListForVoice,
  formatCountWithNoun,

  // Phone formatting
  formatPhoneForVoice,

  // Schedule formatting
  formatScheduleRangeForVoice,
  formatDayRangeForVoice,

  // Factory
  createFormatter,
} from './i18n-formatter';

// =====================================================
// CONVENIENCE RE-EXPORTS
// =====================================================

/**
 * Quick start: Create and initialize a template engine
 *
 * @example
 * ```typescript
 * import { initPromptEngine, generateContextBlock } from '@/lib/voice-agent/prompts';
 *
 * const engine = await initPromptEngine();
 * const prompt = await engine.renderPrompt(config, businessContext);
 * ```
 */
export { createInitializedTemplateEngine as initPromptEngine } from './template-engine';
