/**
 * TIS TIS Platform - Voice Agent v2.0
 * Response Generator Node
 *
 * Generates voice-optimized responses based on:
 * - Current intent
 * - RAG context (if available)
 * - Tool results (if available)
 * - Conversation history
 *
 * Optimizations for voice:
 * - Short, natural sentences
 * - No abbreviations or special characters
 * - Numbers spelled out when appropriate
 * - Clear pronunciation guidance
 * - Appropriate pauses
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { VoiceAgentState } from '../state';
import { recordLatency, addError, addAssistantMessage } from '../state';

// =====================================================
// TYPES
// =====================================================

/**
 * Response generator configuration
 */
export interface ResponseGeneratorConfig {
  /** LLM model to use */
  model?: string;

  /** Temperature for generation */
  temperature?: number;

  /** Maximum tokens in response */
  maxTokens?: number;

  /** Default locale */
  locale?: string;

  /** Custom system prompt override */
  systemPrompt?: string;

  /** Whether to use streaming (for future) */
  streaming?: boolean;

  /** Maximum conversation history to include */
  maxHistoryTurns?: number;
}

/**
 * Response type for VAPI
 */
export interface VoiceResponse {
  /** The text response */
  text: string;

  /** Whether to end the call */
  endCall?: boolean;

  /** Reason for ending call */
  endCallReason?: string;

  /** Actions to forward to client */
  forwardToClient?: Record<string, unknown>;
}

// =====================================================
// RESPONSE TEMPLATES
// =====================================================

/**
 * Direct response templates for common intents
 */
const DIRECT_TEMPLATES: Record<string, Record<string, string[]>> = {
  greeting: {
    es: [
      '¡Hola! ¿En qué puedo ayudarle hoy?',
      'Buenos días, ¿cómo puedo asistirle?',
      'Buenas tardes, ¿en qué le puedo servir?',
    ],
    en: [
      'Hello! How can I help you today?',
      'Hi there! What can I do for you?',
      'Good day! How may I assist you?',
    ],
  },
  farewell: {
    es: [
      '¡Gracias por llamar! Que tenga un excelente día.',
      'Fue un placer atenderle. ¡Hasta pronto!',
      'Gracias por comunicarse. ¡Que le vaya muy bien!',
    ],
    en: [
      'Thank you for calling! Have a great day!',
      'It was a pleasure helping you. Goodbye!',
      'Thanks for reaching out. Take care!',
    ],
  },
  acknowledgment: {
    es: [
      'Entendido.',
      'Perfecto.',
      'De acuerdo.',
      'Muy bien.',
    ],
    en: [
      'Got it.',
      'Perfect.',
      'Understood.',
      'Alright.',
    ],
  },
  not_understood: {
    es: [
      'Lo siento, no entendí bien. ¿Podría repetir por favor?',
      'Disculpe, no comprendí. ¿Me lo puede decir de otra forma?',
      'Perdón, no escuché bien. ¿Puede repetirlo?',
    ],
    en: [
      'Sorry, I didn\'t quite catch that. Could you please repeat?',
      'I\'m sorry, I didn\'t understand. Could you say that differently?',
      'Pardon me, I missed that. Could you repeat please?',
    ],
  },
  fallback: {
    es: [
      '¿Hay algo más en lo que pueda ayudarle?',
      '¿Necesita algo más?',
      '¿Puedo asistirle con algo adicional?',
    ],
    en: [
      'Is there anything else I can help you with?',
      'Do you need anything else?',
      'Can I assist you with anything additional?',
    ],
  },
};

/**
 * System prompt for LLM-based response generation
 */
const VOICE_RESPONSE_SYSTEM_PROMPT = `You are a helpful voice assistant for a business. Generate natural, conversational responses optimized for voice.

Guidelines:
1. Keep responses SHORT (2-3 sentences max unless explaining something complex)
2. Use natural speech patterns - how people actually talk
3. Avoid abbreviations (say "information" not "info", spell out numbers when small)
4. Don't use special characters, emojis, or formatting
5. Be warm and professional
6. If you don't know something, say so clearly
7. Always acknowledge what the user asked before responding
8. End with a question or offer to help further when appropriate

IMPORTANT:
- Respond in the same language as the user (Spanish or English)
- Do NOT include any markup, asterisks, or formatting
- The response will be read aloud by text-to-speech`;

// =====================================================
// RESPONSE GENERATOR NODE
// =====================================================

/**
 * Response Generator node - generates voice-optimized responses
 */
export async function responseGeneratorNode(
  state: VoiceAgentState,
  config?: ResponseGeneratorConfig
): Promise<Partial<VoiceAgentState>> {
  const startTime = Date.now();
  const nodeConfig = {
    model: config?.model ?? 'gpt-4o-mini',
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.maxTokens ?? 200,
    locale: config?.locale ?? state.locale ?? 'es',
    maxHistoryTurns: config?.maxHistoryTurns ?? 5,
  };

  try {
    // Check if we already have a response (from tool or confirmation)
    if (state.response) {
      console.log('[ResponseGenerator] Using existing response from previous node');
      return {
        ...addAssistantMessage(state, state.response),
        ...recordLatency(state, 'response_generator', startTime),
        currentNode: 'response_generator',
        isComplete: true,
      };
    }

    // Handle based on intent
    let response: string;

    switch (state.intent) {
      case 'direct':
        response = await generateDirectResponse(state, nodeConfig);
        break;

      case 'rag':
        response = await generateRAGResponse(state, nodeConfig);
        break;

      case 'tool':
        response = await generateToolResponse(state, nodeConfig);
        break;

      case 'transfer':
        response = generateTransferResponse(nodeConfig.locale);
        break;

      case 'confirm':
        response = await generateConfirmResponse(state, nodeConfig);
        break;

      default:
        response = await generateFallbackResponse(state, nodeConfig);
    }

    // Post-process for voice
    response = optimizeForVoice(response, nodeConfig.locale);

    console.log(
      `[ResponseGenerator] Generated response for intent: ${state.intent}`,
      { responseLength: response.length, latencyMs: Date.now() - startTime }
    );

    // Determine if we should end the call
    const shouldEndCall = shouldEndCallAfterResponse(state, response);

    return {
      ...addAssistantMessage(state, response),
      ...recordLatency(state, 'response_generator', startTime),
      currentNode: 'response_generator',
      response,
      responseType: 'text',
      endCall: shouldEndCall.endCall,
      endCallReason: shouldEndCall.reason,
      isComplete: true,
    };
  } catch (error) {
    console.error('[ResponseGenerator] Error:', error);

    const errorMessage = nodeConfig.locale === 'en'
      ? 'I\'m sorry, I\'m having trouble responding right now. Please try again.'
      : 'Lo siento, tengo problemas para responder en este momento. Por favor intente de nuevo.';

    return {
      ...addError(state, 'response_generator', error instanceof Error ? error.message : 'Unknown error', true),
      ...addAssistantMessage(state, errorMessage),
      ...recordLatency(state, 'response_generator', startTime),
      currentNode: 'response_generator',
      response: errorMessage,
      isComplete: true,
    };
  }
}

// =====================================================
// RESPONSE GENERATION FUNCTIONS
// =====================================================

/**
 * Generate response for direct intents (greetings, farewells, etc.)
 */
async function generateDirectResponse(
  state: VoiceAgentState,
  config: ResponseGeneratorConfig & { locale: string }
): Promise<string> {
  const subIntent = state.subIntent || detectDirectSubIntent(state.currentInput);

  // Use templates for common cases
  const templates = DIRECT_TEMPLATES[subIntent]?.[config.locale] ||
                   DIRECT_TEMPLATES[subIntent]?.['es'];

  if (templates && templates.length > 0) {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // Fallback to LLM for complex direct responses
  const fullConfig = {
    ...config,
    model: config.model || 'gpt-4o-mini',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 150,
    maxHistoryTurns: config.maxHistoryTurns ?? 3,
  };
  return await generateLLMResponse(state, fullConfig, 'Generate a brief, friendly response to the user\'s message.');
}

/**
 * Generate response using RAG context
 */
async function generateRAGResponse(
  state: VoiceAgentState,
  config: ResponseGeneratorConfig & { locale: string; model: string; temperature: number; maxTokens: number }
): Promise<string> {
  const ragResult = state.ragResult;

  if (!ragResult?.success || !ragResult.context) {
    // No RAG context - generate apologetic response
    return config.locale === 'en'
      ? 'I\'m sorry, I don\'t have that information available right now. Is there something else I can help you with?'
      : 'Lo siento, no tengo esa información disponible en este momento. ¿Hay algo más en lo que pueda ayudarle?';
  }

  // Use LLM to generate response based on RAG context
  const llm = new ChatOpenAI({
    modelName: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });

  const systemPrompt = `${VOICE_RESPONSE_SYSTEM_PROMPT}

You have the following business information to answer the user's question:
---
${ragResult.context}
---

Use ONLY the information provided above to answer. If the information doesn't fully answer the question, say so.
Respond in ${config.locale === 'en' ? 'English' : 'Spanish'}.`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(state.currentInput),
  ]);

  return (response.content as string).trim();
}

/**
 * Generate response for tool execution results
 */
async function generateToolResponse(
  state: VoiceAgentState,
  config: ResponseGeneratorConfig & { locale: string }
): Promise<string> {
  const toolResult = state.toolResult;

  // If tool already has a voice message, use it
  if (toolResult?.voiceMessage) {
    return toolResult.voiceMessage;
  }

  // If tool failed
  if (toolResult && !toolResult.success) {
    return config.locale === 'en'
      ? 'I\'m sorry, I wasn\'t able to complete that action. Would you like to try again?'
      : 'Lo siento, no pude completar esa acción. ¿Desea intentar de nuevo?';
  }

  // If pending confirmation
  if (state.confirmationStatus === 'pending' && state.pendingTool?.confirmationMessage) {
    return state.pendingTool.confirmationMessage;
  }

  // Default response
  return config.locale === 'en'
    ? 'Is there anything else I can help you with?'
    : '¿Hay algo más en lo que pueda ayudarle?';
}

/**
 * Generate response for transfer intent
 */
function generateTransferResponse(locale: string): string {
  return locale === 'en'
    ? 'I\'ll transfer you to a human agent. Please hold while I connect you.'
    : 'Lo voy a transferir con un agente humano. Por favor espere mientras lo conecto.';
}

/**
 * Generate response for confirmation results
 */
async function generateConfirmResponse(
  state: VoiceAgentState,
  config: ResponseGeneratorConfig & { locale: string }
): Promise<string> {
  // If denied, the confirmation node already set a response
  if (state.confirmationStatus === 'denied') {
    return state.response || (config.locale === 'en'
      ? 'Alright, I\'ve cancelled that. Is there anything else I can help with?'
      : 'Entendido, lo he cancelado. ¿Hay algo más en lo que pueda ayudarle?');
  }

  // If confirmed, tool executor should have set result
  if (state.toolResult?.voiceMessage) {
    return state.toolResult.voiceMessage;
  }

  return config.locale === 'en'
    ? 'Is there anything else I can help you with?'
    : '¿Hay algo más en lo que pueda ayudarle?';
}

/**
 * Generate fallback response when intent is unclear
 */
async function generateFallbackResponse(
  state: VoiceAgentState,
  config: ResponseGeneratorConfig & { locale: string; model: string; temperature: number; maxTokens: number }
): Promise<string> {
  // Try to understand via LLM
  const fullConfig = {
    ...config,
    maxHistoryTurns: config.maxHistoryTurns ?? 3,
  };
  return await generateLLMResponse(
    state,
    fullConfig,
    'The user\'s intent is unclear. Generate a helpful response that either answers their question if you can understand it, or politely asks for clarification.'
  );
}

/**
 * Generate response using LLM
 */
async function generateLLMResponse(
  state: VoiceAgentState,
  config: ResponseGeneratorConfig & { locale: string; model: string; temperature: number; maxTokens: number; maxHistoryTurns: number },
  additionalInstructions?: string
): Promise<string> {
  const llm = new ChatOpenAI({
    modelName: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });

  let systemPrompt = VOICE_RESPONSE_SYSTEM_PROMPT;
  if (additionalInstructions) {
    systemPrompt += `\n\nAdditional instructions: ${additionalInstructions}`;
  }
  systemPrompt += `\n\nRespond in ${config.locale === 'en' ? 'English' : 'Spanish'}.`;

  // Build conversation history
  const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage(systemPrompt),
  ];

  // Add recent history
  const recentMessages = state.messages.slice(-config.maxHistoryTurns * 2);
  for (const msg of recentMessages) {
    if (msg._getType() === 'human') {
      messages.push(new HumanMessage(msg.content as string));
    } else if (msg._getType() === 'ai') {
      messages.push(new AIMessage(msg.content as string));
    }
  }

  // Add current input
  messages.push(new HumanMessage(state.currentInput));

  const response = await llm.invoke(messages);
  return (response.content as string).trim();
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Detect sub-intent for direct responses
 */
function detectDirectSubIntent(input: string): string {
  const normalized = input.toLowerCase();

  // Greetings
  if (/\b(hola|buenos|hi|hello|hey)\b/.test(normalized)) {
    return 'greeting';
  }

  // Farewells
  if (/\b(adios|bye|chao|hasta\s+luego|gracias.*adios)\b/.test(normalized)) {
    return 'farewell';
  }

  // Acknowledgments
  if (/^(ok|okay|vale|bien|entiendo|claro|perfecto|gracias)$/i.test(normalized)) {
    return 'acknowledgment';
  }

  // Thanks (but not farewell)
  if (/^gracias$/i.test(normalized)) {
    return 'acknowledgment';
  }

  return 'fallback';
}

/**
 * Optimize response for voice output
 */
function optimizeForVoice(text: string, locale: string): string {
  let optimized = text;

  // Remove markdown formatting
  optimized = optimized.replace(/\*\*(.*?)\*\*/g, '$1');
  optimized = optimized.replace(/\*(.*?)\*/g, '$1');
  optimized = optimized.replace(/`(.*?)`/g, '$1');

  // Remove bullet points and numbered lists
  optimized = optimized.replace(/^[\s]*[-•]\s*/gm, '');
  optimized = optimized.replace(/^[\s]*\d+\.\s*/gm, '');

  // Remove URLs
  optimized = optimized.replace(/https?:\/\/[^\s]+/g, '');

  // Remove special characters that don't read well
  optimized = optimized.replace(/[#@*_~`]/g, '');

  // Spell out small numbers for voice (optional, locale-aware)
  if (locale === 'es') {
    optimized = optimized.replace(/\b1\b/g, 'uno');
    optimized = optimized.replace(/\b2\b/g, 'dos');
    optimized = optimized.replace(/\b3\b/g, 'tres');
    optimized = optimized.replace(/\b4\b/g, 'cuatro');
    optimized = optimized.replace(/\b5\b/g, 'cinco');
  }

  // Clean up extra whitespace
  optimized = optimized.replace(/\s+/g, ' ').trim();

  // Ensure it doesn't end abruptly
  if (optimized.length > 0 && !/[.!?]$/.test(optimized)) {
    optimized += '.';
  }

  return optimized;
}

/**
 * Determine if call should end after response
 */
function shouldEndCallAfterResponse(
  state: VoiceAgentState,
  response: string
): { endCall: boolean; reason?: string } {
  // Check if state already marked for end
  if (state.endCall) {
    return { endCall: true, reason: state.endCallReason };
  }

  // Check for farewell responses
  const farewellPatterns = [
    /hasta\s+(luego|pronto)/i,
    /que\s+(le\s+)?vaya\s+bien/i,
    /goodbye/i,
    /take\s+care/i,
    /have\s+a\s+great\s+day/i,
  ];

  for (const pattern of farewellPatterns) {
    if (pattern.test(response)) {
      return { endCall: true, reason: 'farewell' };
    }
  }

  // Check for transfer
  if (state.intent === 'transfer' && state.toolResult?.success) {
    return { endCall: false }; // Transfer handles call ending
  }

  return { endCall: false };
}

/**
 * Format response for VAPI webhook
 */
export function formatVoiceResponse(state: VoiceAgentState): VoiceResponse {
  return {
    text: state.response || '',
    endCall: state.endCall,
    endCallReason: state.endCallReason,
    forwardToClient: state.toolResult?.forwardToClient
      ? { action: state.toolResult.data }
      : undefined,
  };
}

/**
 * Get appropriate response template
 */
export function getResponseTemplate(
  type: string,
  locale: string = 'es'
): string | undefined {
  const templates = DIRECT_TEMPLATES[type]?.[locale] ||
                   DIRECT_TEMPLATES[type]?.['es'];

  if (templates && templates.length > 0) {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  return undefined;
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create response generator node with configuration
 */
export function createResponseGeneratorNode(config?: ResponseGeneratorConfig) {
  return (state: VoiceAgentState) => responseGeneratorNode(state, config);
}
