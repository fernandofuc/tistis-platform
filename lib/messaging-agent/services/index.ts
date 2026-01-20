/**
 * TIS TIS Platform - Messaging Agent Services
 *
 * Exports all messaging agent services for the hybrid prompt system.
 */

// Template Compiler
export {
  TemplateMessagingCompilerService,
  createMessagingTemplateCompiler,
} from './template-messaging-compiler.service';

// Types
export type {
  CompiledMessagingPrompt,
  MessagingTemplateVariables,
  MessagingAssistantConfig,
  MessagingAssistantTypeConfig,
  MessagingBusinessContext,
  MessagingCompilerConfig,
  Vertical,
} from './template-messaging-compiler.types';

// Note: HybridMessagingPromptResult is exported from
// src/features/ai/services/hybrid-messaging-prompt.service.ts

export {
  DEFAULT_MESSAGING_COMPILER_CONFIG,
  VERTICAL_TO_BUSINESS_TYPE,
  VERTICAL_TO_MAIN_TASK,
  getMessagingTemplateFileName,
  getMessagingPersonalityFileName,
} from './template-messaging-compiler.types';
