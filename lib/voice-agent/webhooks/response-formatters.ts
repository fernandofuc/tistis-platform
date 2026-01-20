/**
 * TIS TIS Platform - Voice Agent v2.0
 * Webhook Response Formatters
 *
 * Functions to format responses in VAPI-compatible formats.
 * Ensures all responses meet VAPI's expected structure.
 */

import type {
  VapiAssistantConfig,
  VapiVoiceConfig,
  VapiTranscriberConfig,
  VapiModelConfig,
  VapiToolDefinition,
  VapiFunctionDefinition,
  VapiStartSpeakingPlan,
  AssistantRequestResponse,
  ConversationUpdateResponse,
  FunctionCallResponse,
  ToolCallsResponse,
  AckResponse,
  ErrorResponse,
} from './types';
import type { Tool } from '../types/types';

// =====================================================
// VOICE CONFIGURATION FORMATTERS
// =====================================================

/**
 * Voice configuration from database/config
 */
export interface VoiceConfigInput {
  voiceId?: string;
  voiceProvider?: string;
  voiceModel?: string;
  voiceStability?: number;
  voiceSimilarityBoost?: number;
  voiceSpeed?: number;
}

/**
 * Format voice configuration for VAPI
 */
export function formatVoiceConfig(config: VoiceConfigInput): VapiVoiceConfig {
  return {
    provider: (config.voiceProvider as VapiVoiceConfig['provider']) || 'elevenlabs',
    voiceId: config.voiceId || 'LegCbmbXKbT5PUp3QFWv', // Default: Javier
    model: config.voiceModel || 'eleven_multilingual_v2',
    stability: config.voiceStability ?? 0.5,
    similarityBoost: config.voiceSimilarityBoost ?? 0.75,
    speed: config.voiceSpeed ?? 1.0,
  };
}

// =====================================================
// TRANSCRIBER CONFIGURATION FORMATTERS
// =====================================================

/**
 * Transcriber configuration from database/config
 */
export interface TranscriberConfigInput {
  transcriptionProvider?: string;
  transcriptionModel?: string;
  transcriptionLanguage?: string;
}

/**
 * Format transcriber configuration for VAPI
 */
export function formatTranscriberConfig(
  config: TranscriberConfigInput
): VapiTranscriberConfig {
  return {
    provider: (config.transcriptionProvider as VapiTranscriberConfig['provider']) || 'deepgram',
    model: config.transcriptionModel || 'nova-2',
    language: config.transcriptionLanguage || 'es',
  };
}

// =====================================================
// MODEL CONFIGURATION FORMATTERS
// =====================================================

/**
 * Model configuration from database/config
 */
export interface ModelConfigInput {
  modelProvider?: string;
  modelName?: string;
  modelTemperature?: number;
  modelMaxTokens?: number;
  systemPrompt?: string;
}

/**
 * Format model configuration for VAPI
 * Note: In server-side response mode, model is typically not sent
 */
export function formatModelConfig(
  config: ModelConfigInput,
  tools?: VapiToolDefinition[]
): VapiModelConfig {
  return {
    provider: (config.modelProvider as VapiModelConfig['provider']) || 'openai',
    model: config.modelName || 'gpt-4o-mini',
    temperature: config.modelTemperature ?? 0.7,
    maxTokens: config.modelMaxTokens ?? 1000,
    systemPrompt: config.systemPrompt,
    tools,
  };
}

// =====================================================
// SPEAKING PLAN FORMATTERS
// =====================================================

/**
 * Speaking plan configuration from database/config
 */
export interface SpeakingPlanInput {
  waitSeconds?: number;
  onPunctuationSeconds?: number;
  onNoPunctuationSeconds?: number;
}

/**
 * Format start speaking plan for VAPI
 */
export function formatStartSpeakingPlan(
  config: SpeakingPlanInput
): VapiStartSpeakingPlan {
  return {
    waitSeconds: config.waitSeconds ?? 0.6,
    smartEndpointingEnabled: true,
    transcriptionEndpointingPlan: {
      onPunctuationSeconds: config.onPunctuationSeconds ?? 0.2,
      onNoPunctuationSeconds: config.onNoPunctuationSeconds ?? 1.2,
    },
  };
}

// =====================================================
// TOOL/FUNCTION FORMATTERS
// =====================================================

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

/**
 * Tool definition from our system
 */
export interface ToolDefinitionInput {
  name: Tool | string;
  description: string;
  parameters?: ToolParameter[];
  isAsync?: boolean;
}

/**
 * Format a single function definition for VAPI
 */
export function formatFunctionDefinition(
  tool: ToolDefinitionInput
): VapiFunctionDefinition {
  const properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
  }> = {};

  const required: string[] = [];

  if (tool.parameters) {
    for (const param of tool.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };

      if (param.enum) {
        properties[param.name].enum = param.enum;
      }

      if (param.required) {
        required.push(param.name);
      }
    }
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    },
    async: tool.isAsync ?? false,
  };
}

/**
 * Format a tool definition for VAPI (with function wrapper)
 */
export function formatToolDefinition(
  tool: ToolDefinitionInput,
  serverUrl?: string,
  serverSecret?: string
): VapiToolDefinition {
  const toolDef: VapiToolDefinition = {
    type: 'function',
    function: formatFunctionDefinition(tool),
    async: tool.isAsync ?? false,
  };

  if (serverUrl) {
    toolDef.server = {
      url: serverUrl,
      secret: serverSecret,
      timeoutSeconds: 30,
    };
  }

  return toolDef;
}

/**
 * Format multiple tool definitions
 */
export function formatToolDefinitions(
  tools: ToolDefinitionInput[],
  serverUrl?: string,
  serverSecret?: string
): VapiToolDefinition[] {
  return tools.map(tool => formatToolDefinition(tool, serverUrl, serverSecret));
}

// =====================================================
// ASSISTANT CONFIGURATION FORMATTERS
// =====================================================

/**
 * Complete voice agent configuration from database
 */
export interface VoiceAgentConfigInput {
  // Basic info
  assistantName?: string;
  firstMessage?: string;
  firstMessageMode?: string;

  // Voice settings
  voiceId?: string;
  voiceProvider?: string;
  voiceModel?: string;
  voiceStability?: number;
  voiceSimilarityBoost?: number;

  // Transcription settings
  transcriptionProvider?: string;
  transcriptionModel?: string;
  transcriptionLanguage?: string;

  // Speaking plan
  waitSeconds?: number;
  onPunctuationSeconds?: number;
  onNoPunctuationSeconds?: number;

  // Call settings
  endCallPhrases?: string[];
  endCallMessage?: string;
  recordingEnabled?: boolean;
  hipaaEnabled?: boolean;
  silenceTimeoutSeconds?: number;
  maxDurationSeconds?: number;
}

/**
 * Format complete assistant configuration for VAPI assistant-request response
 */
export function formatAssistantConfig(
  config: VoiceAgentConfigInput,
  options: {
    serverUrl?: string;
    serverUrlSecret?: string;
    tools?: VapiToolDefinition[];
    metadata?: Record<string, unknown>;
    useServerSideResponse?: boolean;
  } = {}
): VapiAssistantConfig {
  const assistant: VapiAssistantConfig = {
    name: config.assistantName,
    firstMessage: config.firstMessage,
    firstMessageMode: mapFirstMessageMode(config.firstMessageMode),
    voice: formatVoiceConfig(config),
    transcriber: formatTranscriberConfig(config),
    startSpeakingPlan: formatStartSpeakingPlan(config),
    endCallPhrases: config.endCallPhrases || getDefaultEndCallPhrases(config.transcriptionLanguage),
    endCallMessage: config.endCallMessage,
    recordingEnabled: config.recordingEnabled ?? true,
    hipaaEnabled: config.hipaaEnabled ?? false,
    silenceTimeoutSeconds: config.silenceTimeoutSeconds ?? 30,
    maxDurationSeconds: config.maxDurationSeconds ?? 600,
    metadata: options.metadata,
  };

  // Add server URL for server-side response mode
  if (options.serverUrl) {
    assistant.serverUrl = options.serverUrl;
    assistant.serverUrlSecret = options.serverUrlSecret;
  }

  // Add tools if not using server-side response mode
  if (options.tools && !options.useServerSideResponse) {
    assistant.model = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      tools: options.tools,
    };
  }

  return assistant;
}

/**
 * Map first message mode to VAPI format
 */
function mapFirstMessageMode(
  mode?: string
): VapiAssistantConfig['firstMessageMode'] {
  switch (mode) {
    case 'assistant_speaks_first':
    case 'assistant-speaks-first':
      return 'assistant-speaks-first';
    case 'assistant_waits_for_user':
    case 'assistant-waits-for-user':
      return 'assistant-waits-for-user';
    default:
      return 'assistant-speaks-first';
  }
}

/**
 * Get default end call phrases for language
 */
function getDefaultEndCallPhrases(language?: string): string[] {
  if (language === 'en') {
    return ['goodbye', 'bye', 'see you', 'that\'s all', 'thanks that\'s all'];
  }

  // Spanish (default)
  return ['adiós', 'hasta luego', 'bye', 'chao', 'eso es todo', 'gracias, eso es todo'];
}

// =====================================================
// RESPONSE FORMATTERS
// =====================================================

/**
 * Format assistant-request response
 */
export function formatAssistantRequestResponse(
  assistantConfig: VapiAssistantConfig,
  metadata?: Record<string, unknown>
): AssistantRequestResponse {
  return {
    assistant: assistantConfig,
    metadata,
  };
}

/**
 * Format assistant-request error response
 */
export function formatAssistantRequestError(
  errorMessage: string
): AssistantRequestResponse {
  return {
    error: errorMessage,
  };
}

/**
 * Format conversation-update response (server-side response mode)
 */
export function formatConversationUpdateResponse(
  assistantResponse: string,
  endCall: boolean = false
): ConversationUpdateResponse {
  return {
    assistantResponse,
    endCall,
  };
}

/**
 * Format conversation-update error response
 */
export function formatConversationUpdateError(
  errorMessage: string
): ConversationUpdateResponse {
  return {
    error: errorMessage,
  };
}

/**
 * Format function-call response
 */
export function formatFunctionCallResponse(
  result: unknown,
  forwardToClient: boolean = false
): FunctionCallResponse {
  return {
    result,
    forwardToClientEnabled: forwardToClient,
  };
}

/**
 * Format function-call error response
 */
export function formatFunctionCallError(
  errorMessage: string
): FunctionCallResponse {
  return {
    error: errorMessage,
  };
}

/**
 * Format tool-calls response
 */
export function formatToolCallsResponse(
  results: Array<{
    toolCallId: string;
    result?: unknown;
    error?: string;
  }>
): ToolCallsResponse {
  return { results };
}

/**
 * Format acknowledgment response
 */
export function formatAckResponse(): AckResponse {
  return { status: 'ok' };
}

/**
 * Format error response
 */
export function formatErrorResponse(
  error: string,
  code?: string,
  details?: Record<string, unknown>
): ErrorResponse {
  const response: ErrorResponse = { error };

  if (code) {
    response.code = code;
  }

  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }

  return response;
}

// =====================================================
// RESULT FORMATTERS FOR VOICE
// =====================================================

/**
 * Format function result for voice output
 * Makes the result speakable by the assistant
 */
export function formatResultForVoice(
  functionName: string,
  result: unknown,
  locale: string = 'es'
): string {
  // Handle common result types
  if (result === null || result === undefined) {
    return locale === 'en'
      ? 'The operation completed but returned no data.'
      : 'La operación se completó pero no retornó datos.';
  }

  if (typeof result === 'string') {
    return result;
  }

  if (typeof result === 'boolean') {
    if (locale === 'en') {
      return result ? 'The operation was successful.' : 'The operation failed.';
    }
    return result ? 'La operación fue exitosa.' : 'La operación falló.';
  }

  if (typeof result === 'number') {
    return String(result);
  }

  // For objects, try to extract a message or description
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;

    // Look for common response fields
    if (typeof obj.message === 'string') {
      return obj.message;
    }

    if (typeof obj.description === 'string') {
      return obj.description;
    }

    if (typeof obj.result === 'string') {
      return obj.result;
    }

    // For arrays, format as list
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return locale === 'en'
          ? 'No results found.'
          : 'No se encontraron resultados.';
      }

      // Try to extract names or descriptions from array items
      const items = result.slice(0, 5).map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          const i = item as Record<string, unknown>;
          return i.name || i.title || i.description || JSON.stringify(item);
        }
        return String(item);
      });

      if (locale === 'en') {
        return `Found ${result.length} results: ${items.join(', ')}${result.length > 5 ? ', and more' : ''}.`;
      }
      return `Se encontraron ${result.length} resultados: ${items.join(', ')}${result.length > 5 ? ', y más' : ''}.`;
    }

    // Generic object - try to stringify nicely
    try {
      const simplified = simplifyObjectForVoice(obj);
      return simplified || JSON.stringify(result);
    } catch {
      return locale === 'en'
        ? 'The operation completed successfully.'
        : 'La operación se completó exitosamente.';
    }
  }

  return String(result);
}

/**
 * Simplify an object for voice output
 */
function simplifyObjectForVoice(obj: Record<string, unknown>): string | null {
  const parts: string[] = [];

  // Extract key-value pairs that make sense for voice
  const voiceFriendlyKeys = ['name', 'date', 'time', 'status', 'total', 'price', 'amount'];

  for (const key of voiceFriendlyKeys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      const value = obj[key];
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      parts.push(`${label}: ${String(value)}`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Format error for voice output
 */
export function formatErrorForVoice(
  error: Error | string,
  locale: string = 'es'
): string {
  // User-friendly error messages
  const userFriendlyMessages: Record<string, Record<string, string>> = {
    es: {
      timeout: 'Disculpa, la operación tardó demasiado. Por favor intenta de nuevo.',
      network: 'Disculpa, hubo un problema de conexión. Por favor intenta de nuevo.',
      not_found: 'No encontré lo que buscas. ¿Podrías darme más detalles?',
      invalid: 'Parece que hay un problema con los datos. ¿Podrías repetir?',
      default: 'Disculpa, hubo un problema técnico. ¿Podrías repetir lo que dijiste?',
    },
    en: {
      timeout: 'Sorry, the operation took too long. Please try again.',
      network: 'Sorry, there was a connection problem. Please try again.',
      not_found: 'I couldn\'t find what you\'re looking for. Could you give me more details?',
      invalid: 'There seems to be an issue with the data. Could you repeat that?',
      default: 'Sorry, there was a technical issue. Could you repeat what you said?',
    },
  };

  const messages = userFriendlyMessages[locale] || userFriendlyMessages['es'];
  const errorMsg = typeof error === 'string' ? error : error.message;

  // Match error to user-friendly message
  if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
    return messages.timeout;
  }

  if (errorMsg.includes('network') || errorMsg.includes('ECONNREFUSED')) {
    return messages.network;
  }

  if (errorMsg.includes('not found') || errorMsg.includes('404')) {
    return messages.not_found;
  }

  if (errorMsg.includes('invalid') || errorMsg.includes('validation')) {
    return messages.invalid;
  }

  return messages.default;
}
