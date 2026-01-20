/**
 * TIS TIS Platform - Voice Agent v2.0
 * LangGraph Integration Handler
 *
 * Integrates the LangGraph voice agent graph with VAPI webhooks.
 * This handler routes incoming events through the LangGraph processing
 * pipeline for intelligent conversation handling.
 *
 * Key Features:
 * - Intent-based routing
 * - RAG integration for knowledge retrieval
 * - Tool execution with confirmation
 * - Voice-optimized responses
 *
 * @see ./function-call.handler.ts for the base handler
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  FunctionCallPayload,
  FunctionCallResponse,
  WebhookHandlerContext,
  HandlerResult,
  ToolCallsPayload,
  ToolCallsResponse,
  AssistantRequestPayload,
  AssistantRequestResponse,
  TranscriptPayload,
  AckResponse,
} from '../types';
import {
  formatFunctionCallResponse,
  formatFunctionCallError,
  formatToolCallsResponse,
  formatAssistantRequestResponse,
  formatAckResponse,
} from '../response-formatters';

// LangGraph imports
import {
  getVoiceAgentGraph,
  executeVoiceAgentGraph,
  executeToolCall,
  createInitialState,
  type VoiceAgentGraph,
  type VoiceAgentGraphConfig,
  type GraphExecutionResult,
  type ToolRegistry,
} from '../../langgraph';

// =====================================================
// TYPES
// =====================================================

/**
 * LangGraph handler options
 */
export interface LangGraphHandlerOptions {
  /** LangGraph configuration */
  graphConfig?: VoiceAgentGraphConfig;

  /** Custom tool registry */
  toolRegistry?: ToolRegistry;

  /** Supabase client */
  supabaseClient?: SupabaseClient;

  /** Default locale */
  defaultLocale?: string;

  /** Enable debug logging */
  debug?: boolean;

  /** Maximum latency warning threshold (ms) */
  latencyWarningThreshold?: number;

  /** Enable conversation state persistence */
  persistState?: boolean;
}

/**
 * Conversation state for multi-turn support
 */
interface ConversationState {
  messages: Array<{ role: string; content: string }>;
  turnCount: number;
  lastIntent?: string;
  pendingConfirmation?: boolean;
}

// =====================================================
// CONVERSATION STATE MANAGEMENT
// =====================================================

// In-memory state cache (would use Redis in production)
const conversationStates = new Map<string, ConversationState & { lastAccessTime: number }>();

// Maximum age for conversation states (30 minutes)
const MAX_STATE_AGE_MS = 30 * 60 * 1000;

// Maximum number of cached states
const MAX_CACHED_STATES = 1000;

/**
 * Clean up stale conversation states to prevent memory leaks
 */
function cleanupStaleStates(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, state] of conversationStates.entries()) {
    if (now - state.lastAccessTime > MAX_STATE_AGE_MS) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    conversationStates.delete(key);
  }

  // If still over limit, remove oldest entries
  if (conversationStates.size > MAX_CACHED_STATES) {
    const sortedEntries = Array.from(conversationStates.entries())
      .sort((a, b) => a[1].lastAccessTime - b[1].lastAccessTime);

    const toRemove = sortedEntries.slice(0, conversationStates.size - MAX_CACHED_STATES);
    for (const [key] of toRemove) {
      conversationStates.delete(key);
    }
  }
}

/**
 * Get or create conversation state
 */
function getConversationState(vapiCallId: string): ConversationState {
  // Periodically clean up stale states (roughly every 100 calls)
  if (Math.random() < 0.01) {
    cleanupStaleStates();
  }

  let state = conversationStates.get(vapiCallId);
  if (!state) {
    state = {
      messages: [],
      turnCount: 0,
      lastAccessTime: Date.now(),
    };
    conversationStates.set(vapiCallId, state);
  } else {
    state.lastAccessTime = Date.now();
  }
  return state;
}

/**
 * Update conversation state after processing
 */
function updateConversationState(
  vapiCallId: string,
  userInput: string,
  assistantResponse: string,
  result: GraphExecutionResult
): void {
  const state = getConversationState(vapiCallId);

  state.messages.push({ role: 'user', content: userInput });
  state.messages.push({ role: 'assistant', content: assistantResponse });
  state.turnCount++;
  state.lastIntent = result.state.intent;
  state.pendingConfirmation = result.state.confirmationStatus === 'pending';
  (state as ConversationState & { lastAccessTime: number }).lastAccessTime = Date.now();

  // Keep only last 20 messages to manage memory
  if (state.messages.length > 20) {
    state.messages = state.messages.slice(-20);
  }

  conversationStates.set(vapiCallId, state as ConversationState & { lastAccessTime: number });
}

/**
 * Clear conversation state (on call end)
 */
export function clearConversationState(vapiCallId: string): void {
  conversationStates.delete(vapiCallId);
}

// =====================================================
// LANGGRAPH FUNCTION CALL HANDLER
// =====================================================

/**
 * Handle function-call events using LangGraph
 */
export async function handleFunctionCallWithLangGraph(
  payload: FunctionCallPayload,
  context: WebhookHandlerContext,
  options: LangGraphHandlerOptions = {}
): Promise<HandlerResult<FunctionCallResponse>> {
  const startTime = Date.now();
  const supabase = options.supabaseClient || createServiceClient();
  const locale = options.defaultLocale || 'es';

  const functionName = payload.functionCall?.name || '';
  const parameters = payload.functionCall?.parameters || {};
  const vapiCallId = payload.call?.id || '';

  console.log(
    `[LangGraph FunctionCall] Processing: ${functionName}`,
    options.debug ? { parameters, vapiCallId } : {}
  );

  try {
    // Validate function name
    if (!functionName) {
      return {
        response: formatFunctionCallError('Function name is required'),
        statusCode: 400,
        shouldLog: true,
        metadata: { error: 'missing_function_name' },
      };
    }

    // Get call info
    const callInfo = await getCallInfo(supabase, vapiCallId);

    // Get or create graph instance
    const graph = getVoiceAgentGraph({
      ...options.graphConfig,
      supabaseClient: supabase,
      toolRegistry: options.toolRegistry,
      defaultLocale: locale,
      debug: options.debug,
    });

    // Execute tool call through LangGraph
    const result = await executeToolCall(graph, {
      callId: callInfo?.id || `temp-${vapiCallId}`,
      vapiCallId,
      tenantId: context.tenantId || callInfo?.tenant_id || '',
      voiceConfigId: context.voiceConfigId || callInfo?.voice_config_id || '',
      assistantType: callInfo?.assistant_type || 'rest_basic',
      toolName: functionName,
      toolParameters: parameters,
      locale,
    });

    // Log latency warning
    if (
      options.latencyWarningThreshold &&
      result.metrics.totalLatencyMs > options.latencyWarningThreshold
    ) {
      console.warn(
        `[LangGraph FunctionCall] High latency: ${result.metrics.totalLatencyMs}ms`,
        { threshold: options.latencyWarningThreshold, nodes: result.metrics.nodesVisited }
      );
    }

    // Format response for VAPI
    const voiceMessage = result.response.text || 'Procesado correctamente.';

    console.log(
      `[LangGraph FunctionCall] Complete: ${functionName}`,
      {
        success: result.state.toolResult?.success,
        latencyMs: result.metrics.totalLatencyMs,
        nodes: result.metrics.nodesVisited,
      }
    );

    return {
      response: formatFunctionCallResponse(voiceMessage, result.state.toolResult?.forwardToClient),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        functionName,
        success: result.state.toolResult?.success,
        processingTimeMs: result.metrics.totalLatencyMs,
        nodesVisited: result.metrics.nodesVisited,
      },
    };
  } catch (error) {
    console.error(`[LangGraph FunctionCall] Error:`, error);

    const errorMessage = locale === 'en'
      ? 'Sorry, I had trouble processing that request. Please try again.'
      : 'Lo siento, tuve problemas procesando esa solicitud. Por favor intente de nuevo.';

    return {
      response: formatFunctionCallError(errorMessage),
      statusCode: 200, // VAPI expects 200
      shouldLog: true,
      metadata: {
        functionName,
        error: error instanceof Error ? error.message : 'unknown',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}

// =====================================================
// LANGGRAPH TOOL CALLS HANDLER
// =====================================================

/**
 * Handle tool-calls events (multiple tools) using LangGraph
 */
export async function handleToolCallsWithLangGraph(
  payload: ToolCallsPayload,
  context: WebhookHandlerContext,
  options: LangGraphHandlerOptions = {}
): Promise<HandlerResult<ToolCallsResponse>> {
  const startTime = Date.now();
  const supabase = options.supabaseClient || createServiceClient();
  const locale = options.defaultLocale || 'es';

  const toolCallList = payload.toolCallList || [];
  const vapiCallId = payload.call?.id || '';

  console.log(
    `[LangGraph ToolCalls] Processing ${toolCallList.length} tools`,
    options.debug ? { tools: toolCallList.map(t => t.function.name) } : {}
  );

  try {
    // Get call info
    const callInfo = await getCallInfo(supabase, vapiCallId);

    // Get graph instance
    const graph = getVoiceAgentGraph({
      ...options.graphConfig,
      supabaseClient: supabase,
      toolRegistry: options.toolRegistry,
      defaultLocale: locale,
      debug: options.debug,
    });

    // Execute each tool call
    const results = await Promise.all(
      toolCallList.map(async (toolCall) => {
        const functionName = toolCall.function.name;

        try {
          let parameters: Record<string, unknown> = {};
          try {
            parameters = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            console.warn(`[LangGraph ToolCalls] Failed to parse arguments for ${functionName}`);
          }

          const result = await executeToolCall(graph, {
            callId: callInfo?.id || `temp-${vapiCallId}`,
            vapiCallId,
            tenantId: context.tenantId || callInfo?.tenant_id || '',
            voiceConfigId: context.voiceConfigId || callInfo?.voice_config_id || '',
            assistantType: callInfo?.assistant_type || 'rest_basic',
            toolName: functionName,
            toolParameters: parameters,
            locale,
          });

          return {
            toolCallId: toolCall.id,
            result: result.response.text || 'Procesado.',
          };
        } catch (error) {
          console.error(`[LangGraph ToolCalls] Error executing ${functionName}:`, error);
          return {
            toolCallId: toolCall.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return {
      response: formatToolCallsResponse(results),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        toolCount: toolCallList.length,
        successCount: results.filter(r => !r.error).length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error('[LangGraph ToolCalls] Error:', error);

    return {
      response: formatToolCallsResponse([]),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        error: error instanceof Error ? error.message : 'unknown',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}

// =====================================================
// LANGGRAPH ASSISTANT REQUEST HANDLER
// =====================================================

/**
 * Handle assistant-request events using LangGraph
 * This processes user transcripts through the full intent pipeline
 */
export async function handleAssistantRequestWithLangGraph(
  payload: AssistantRequestPayload,
  context: WebhookHandlerContext,
  options: LangGraphHandlerOptions = {}
): Promise<HandlerResult<AssistantRequestResponse>> {
  const startTime = Date.now();
  const supabase = options.supabaseClient || createServiceClient();
  const locale = options.defaultLocale || 'es';

  const vapiCallId = payload.call?.id || '';

  console.log(
    `[LangGraph AssistantRequest] Processing`,
    options.debug ? { vapiCallId } : {}
  );

  try {
    // Get call info
    const callInfo = await getCallInfo(supabase, vapiCallId);

    // Initialize conversation state for this call
    if (options.persistState !== false) {
      getConversationState(vapiCallId); // Creates initial state
    }

    // Log completion
    console.log(
      `[LangGraph AssistantRequest] Complete`,
      {
        callId: callInfo?.id,
        assistantType: callInfo?.assistant_type,
        processingTimeMs: Date.now() - startTime,
      }
    );

    // Return standard assistant configuration
    // The actual LangGraph processing happens in function-call/tool-calls webhooks
    return {
      response: formatAssistantRequestResponse({
        firstMessage: locale === 'en'
          ? 'Hello! How can I help you today?'
          : '¡Hola! ¿En qué puedo ayudarle hoy?',
        firstMessageMode: 'assistant-speaks-first',
      }),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        callId: callInfo?.id,
        processingTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error('[LangGraph AssistantRequest] Error:', error);

    return {
      response: formatAssistantRequestResponse({
        firstMessage: locale === 'en'
          ? 'Hello! How can I help you today?'
          : '¡Hola! ¿En qué puedo ayudarle hoy?',
      }),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        error: error instanceof Error ? error.message : 'unknown',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}

// =====================================================
// LANGGRAPH TRANSCRIPT HANDLER
// =====================================================

/**
 * Handle transcript events using LangGraph
 * This can be used for real-time processing as the user speaks
 */
export async function handleTranscriptWithLangGraph(
  payload: TranscriptPayload,
  context: WebhookHandlerContext,
  options: LangGraphHandlerOptions = {}
): Promise<HandlerResult<AckResponse>> {
  const startTime = Date.now();
  const supabase = options.supabaseClient || createServiceClient();
  const locale = options.defaultLocale || 'es';

  const vapiCallId = payload.call?.id || '';
  const transcript = payload.transcript?.text || '';
  const role = payload.transcript?.role || 'user';

  // Only process user transcripts
  if (role !== 'user' || !transcript) {
    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: false,
    };
  }

  console.log(
    `[LangGraph Transcript] Processing`,
    options.debug ? { transcript: transcript.substring(0, 50) } : {}
  );

  try {
    // Get call info
    const callInfo = await getCallInfo(supabase, vapiCallId);

    // Get graph instance
    const graph = getVoiceAgentGraph({
      ...options.graphConfig,
      supabaseClient: supabase,
      defaultLocale: locale,
      debug: options.debug,
    });

    // Execute through LangGraph
    const result = await executeVoiceAgentGraph(graph, {
      callId: callInfo?.id || `temp-${vapiCallId}`,
      vapiCallId,
      tenantId: context.tenantId || callInfo?.tenant_id || '',
      voiceConfigId: context.voiceConfigId || callInfo?.voice_config_id || '',
      assistantType: callInfo?.assistant_type || 'rest_basic',
      currentInput: transcript,
      locale,
    });

    // Update conversation state
    if (options.persistState !== false) {
      updateConversationState(
        vapiCallId,
        transcript,
        result.response.text || '',
        result
      );
    }

    console.log(
      `[LangGraph Transcript] Complete`,
      {
        intent: result.state.intent,
        latencyMs: result.metrics.totalLatencyMs,
      }
    );

    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        intent: result.state.intent,
        processingTimeMs: result.metrics.totalLatencyMs,
        responseText: result.response.text,
      },
    };
  } catch (error) {
    console.error('[LangGraph Transcript] Error:', error);

    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: false,
      metadata: {
        error: error instanceof Error ? error.message : 'unknown',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Create Supabase service client
 */
function createServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Get call info from database
 */
async function getCallInfo(
  supabase: SupabaseClient,
  vapiCallId: string
): Promise<{
  id: string;
  tenant_id: string;
  voice_config_id: string;
  assistant_type: string;
} | null> {
  try {
    const { data } = await supabase
      .from('voice_calls')
      .select('id, tenant_id, voice_config_id, assistant_type')
      .eq('vapi_call_id', vapiCallId)
      .single();

    return data;
  } catch {
    return null;
  }
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a LangGraph-enabled function call handler
 */
export function createLangGraphFunctionCallHandler(
  options: LangGraphHandlerOptions = {}
) {
  return (payload: FunctionCallPayload, context: WebhookHandlerContext) =>
    handleFunctionCallWithLangGraph(payload, context, options);
}

/**
 * Create a LangGraph-enabled tool calls handler
 */
export function createLangGraphToolCallsHandler(
  options: LangGraphHandlerOptions = {}
) {
  return (payload: ToolCallsPayload, context: WebhookHandlerContext) =>
    handleToolCallsWithLangGraph(payload, context, options);
}

/**
 * Create a LangGraph-enabled assistant request handler
 */
export function createLangGraphAssistantRequestHandler(
  options: LangGraphHandlerOptions = {}
) {
  return (payload: AssistantRequestPayload, context: WebhookHandlerContext) =>
    handleAssistantRequestWithLangGraph(payload, context, options);
}

/**
 * Create a LangGraph-enabled transcript handler
 */
export function createLangGraphTranscriptHandler(
  options: LangGraphHandlerOptions = {}
) {
  return (payload: TranscriptPayload, context: WebhookHandlerContext) =>
    handleTranscriptWithLangGraph(payload, context, options);
}
