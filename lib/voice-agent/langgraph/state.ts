/**
 * TIS TIS Platform - Voice Agent v2.0
 * LangGraph State Definition
 *
 * Defines the state that flows through the voice agent graph.
 * The state contains all information needed for conversation processing:
 * - Call context (IDs, business info)
 * - Message history
 * - Intent routing
 * - Tool execution
 * - RAG context
 * - Response generation
 */

import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation, messagesStateReducer } from '@langchain/langgraph';

// =====================================================
// TYPES
// =====================================================

/**
 * Intent types the router can classify
 */
export type VoiceIntent =
  | 'tool'      // User wants to execute an action (book, cancel, etc.)
  | 'rag'       // User is asking about business info (menu, hours, etc.)
  | 'direct'    // Simple response (greeting, farewell, small talk)
  | 'transfer'  // User wants to speak with a human
  | 'confirm'   // User is confirming/denying a previous action
  | 'unknown';  // Intent could not be determined

/**
 * Tool that is pending execution or confirmation
 */
export interface PendingTool {
  /** Tool/function name */
  name: string;

  /** Parameters for the tool */
  parameters: Record<string, unknown>;

  /** Whether this tool requires user confirmation */
  requiresConfirmation: boolean;

  /** If confirmation required, the message to show user */
  confirmationMessage?: string;

  /** When the tool was queued */
  queuedAt: number;
}

/**
 * Result from tool execution
 */
export interface ToolExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data if successful */
  data?: unknown;

  /** Error message if failed */
  error?: string;

  /** Voice-optimized message for the result */
  voiceMessage?: string;

  /** Whether to forward result to client */
  forwardToClient?: boolean;
}

/**
 * RAG retrieval result
 */
export interface RAGResult {
  /** Retrieved context text */
  context: string;

  /** Source documents/chunks */
  sources: Array<{
    id: string;
    text: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;

  /** Whether retrieval was successful */
  success: boolean;

  /** Retrieval latency in ms */
  latencyMs: number;
}

/**
 * Response type
 */
export type ResponseType = 'text' | 'audio_url' | 'action';

/**
 * Confirmation status
 */
export type ConfirmationStatus = 'pending' | 'confirmed' | 'denied' | 'none';

/**
 * Error entry for tracking
 */
export interface GraphError {
  node: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
}

// =====================================================
// VOICE AGENT STATE
// =====================================================

/**
 * Complete state for the voice agent graph
 */
export interface VoiceAgentState {
  // ==================
  // Call Context
  // ==================

  /** Internal call ID */
  callId: string;

  /** VAPI call ID */
  vapiCallId: string;

  /** Tenant/business ID */
  tenantId: string;

  /** Voice config ID */
  voiceConfigId: string;

  /** Assistant type (rest_basic, dental_standard, etc.) */
  assistantType: string;

  /** Locale for responses */
  locale: string;

  // ==================
  // Message History
  // ==================

  /** Conversation messages */
  messages: BaseMessage[];

  /** Current user input being processed */
  currentInput: string;

  /** Processed/normalized input */
  normalizedInput?: string;

  // ==================
  // Intent Routing
  // ==================

  /** Detected intent */
  intent: VoiceIntent;

  /** Confidence score (0-1) */
  confidence: number;

  /** Sub-intent for more specific routing */
  subIntent?: string;

  /** Entities extracted from input */
  entities: Record<string, unknown>;

  // ==================
  // Tool Execution
  // ==================

  /** Tool pending execution */
  pendingTool?: PendingTool;

  /** Result from tool execution */
  toolResult?: ToolExecutionResult;

  /** Confirmation status */
  confirmationStatus: ConfirmationStatus;

  // ==================
  // RAG Context
  // ==================

  /** RAG retrieval result */
  ragResult?: RAGResult;

  /** Whether RAG was used this turn */
  usedRag: boolean;

  // ==================
  // Response
  // ==================

  /** Generated response */
  response?: string;

  /** Type of response */
  responseType: ResponseType;

  /** Whether to end the call after this response */
  endCall: boolean;

  /** If ending, the reason */
  endCallReason?: string;

  // ==================
  // Metadata & Metrics
  // ==================

  /** When this turn started */
  turnStartTime: number;

  /** Total conversation turns */
  turnCount: number;

  /** Errors encountered */
  errors: GraphError[];

  /** Current node being executed */
  currentNode: string;

  /** Node execution times for metrics */
  nodeLatencies: Record<string, number>;

  /** Whether processing is complete */
  isComplete: boolean;
}

// =====================================================
// STATE ANNOTATION FOR LANGGRAPH
// =====================================================

/**
 * Last value reducer - takes the newest value
 */
const lastValue = <T>(current: T, update: T): T => update ?? current;

/**
 * LangGraph state annotation with reducers
 */
export const VoiceAgentStateAnnotation = Annotation.Root({
  // Call context
  callId: Annotation<string>(),
  vapiCallId: Annotation<string>(),
  tenantId: Annotation<string>(),
  voiceConfigId: Annotation<string>(),
  assistantType: Annotation<string>(),
  locale: Annotation<string>(),

  // Messages - use built-in reducer for message history
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  currentInput: Annotation<string>(),
  normalizedInput: Annotation<string | undefined>(),

  // Intent routing
  intent: Annotation<VoiceIntent>({
    reducer: lastValue,
    default: () => 'unknown' as VoiceIntent,
  }),
  confidence: Annotation<number>({
    reducer: lastValue,
    default: () => 0,
  }),
  subIntent: Annotation<string | undefined>(),
  entities: Annotation<Record<string, unknown>>({
    reducer: lastValue,
    default: () => ({}),
  }),

  // Tool execution
  pendingTool: Annotation<PendingTool | undefined>(),
  toolResult: Annotation<ToolExecutionResult | undefined>(),
  confirmationStatus: Annotation<ConfirmationStatus>({
    reducer: lastValue,
    default: () => 'none' as ConfirmationStatus,
  }),

  // RAG
  ragResult: Annotation<RAGResult | undefined>(),
  usedRag: Annotation<boolean>({
    reducer: lastValue,
    default: () => false,
  }),

  // Response
  response: Annotation<string | undefined>(),
  responseType: Annotation<ResponseType>({
    reducer: lastValue,
    default: () => 'text' as ResponseType,
  }),
  endCall: Annotation<boolean>({
    reducer: lastValue,
    default: () => false,
  }),
  endCallReason: Annotation<string | undefined>(),

  // Metadata
  turnStartTime: Annotation<number>({
    reducer: lastValue,
    default: () => Date.now(),
  }),
  turnCount: Annotation<number>({
    reducer: lastValue,
    default: () => 0,
  }),
  errors: Annotation<GraphError[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  currentNode: Annotation<string>({
    reducer: lastValue,
    default: () => 'start',
  }),
  nodeLatencies: Annotation<Record<string, number>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),
  isComplete: Annotation<boolean>({
    reducer: lastValue,
    default: () => false,
  }),
});

/**
 * Type derived from annotation
 */
export type VoiceAgentGraphState = typeof VoiceAgentStateAnnotation.State;

// =====================================================
// STATE FACTORY
// =====================================================

/**
 * Create initial state for a new conversation turn
 */
export function createInitialState(params: {
  callId: string;
  vapiCallId: string;
  tenantId: string;
  voiceConfigId: string;
  assistantType: string;
  currentInput: string;
  locale?: string;
  existingMessages?: BaseMessage[];
  turnCount?: number;
}): VoiceAgentState {
  return {
    // Call context
    callId: params.callId,
    vapiCallId: params.vapiCallId,
    tenantId: params.tenantId,
    voiceConfigId: params.voiceConfigId,
    assistantType: params.assistantType,
    locale: params.locale || 'es',

    // Messages
    messages: params.existingMessages || [],
    currentInput: params.currentInput,
    normalizedInput: undefined,

    // Intent - will be set by router
    intent: 'unknown',
    confidence: 0,
    subIntent: undefined,
    entities: {},

    // Tool execution
    pendingTool: undefined,
    toolResult: undefined,
    confirmationStatus: 'none',

    // RAG
    ragResult: undefined,
    usedRag: false,

    // Response
    response: undefined,
    responseType: 'text',
    endCall: false,
    endCallReason: undefined,

    // Metadata
    turnStartTime: Date.now(),
    turnCount: params.turnCount || 0,
    errors: [],
    currentNode: 'start',
    nodeLatencies: {},
    isComplete: false,
  };
}

/**
 * Create state for tool execution (from function-call webhook)
 */
export function createToolExecutionState(params: {
  callId: string;
  vapiCallId: string;
  tenantId: string;
  voiceConfigId: string;
  assistantType: string;
  toolName: string;
  toolParameters: Record<string, unknown>;
  locale?: string;
  existingMessages?: BaseMessage[];
}): VoiceAgentState {
  const state = createInitialState({
    callId: params.callId,
    vapiCallId: params.vapiCallId,
    tenantId: params.tenantId,
    voiceConfigId: params.voiceConfigId,
    assistantType: params.assistantType,
    currentInput: `Execute tool: ${params.toolName}`,
    locale: params.locale,
    existingMessages: params.existingMessages,
  });

  // Pre-set intent and pending tool
  state.intent = 'tool';
  state.confidence = 1.0;
  state.pendingTool = {
    name: params.toolName,
    parameters: params.toolParameters,
    requiresConfirmation: requiresConfirmation(params.toolName),
    queuedAt: Date.now(),
  };

  return state;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Determine if a tool requires user confirmation
 */
export function requiresConfirmation(toolName: string): boolean {
  const confirmationRequired = [
    'create_reservation',
    'modify_reservation',
    'cancel_reservation',
    'create_appointment',
    'modify_appointment',
    'cancel_appointment',
    'create_order',
    'modify_order',
    'cancel_order',
    'transfer_to_human',
  ];

  return confirmationRequired.includes(toolName);
}

/**
 * Add error to state
 */
export function addError(
  state: VoiceAgentState,
  node: string,
  message: string,
  recoverable: boolean = true
): VoiceAgentState {
  return {
    ...state,
    errors: [
      ...state.errors,
      {
        node,
        message,
        timestamp: Date.now(),
        recoverable,
      },
    ],
  };
}

/**
 * Record node latency
 */
export function recordLatency(
  state: VoiceAgentState,
  node: string,
  startTime: number
): VoiceAgentState {
  return {
    ...state,
    nodeLatencies: {
      ...state.nodeLatencies,
      [node]: Date.now() - startTime,
    },
  };
}

/**
 * Get total processing time for current turn
 */
export function getTotalLatency(state: VoiceAgentState): number {
  return Date.now() - state.turnStartTime;
}

/**
 * Check if state has any non-recoverable errors
 */
export function hasCriticalError(state: VoiceAgentState): boolean {
  return state.errors.some(e => !e.recoverable);
}

/**
 * Convert state messages to conversation history string
 */
export function getConversationHistory(state: VoiceAgentState): string {
  return state.messages
    .map(msg => {
      if (msg instanceof HumanMessage) {
        return `Usuario: ${msg.content}`;
      } else if (msg instanceof AIMessage) {
        return `Asistente: ${msg.content}`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Add user message to state
 */
export function addUserMessage(
  state: VoiceAgentState,
  content: string
): VoiceAgentState {
  return {
    ...state,
    messages: [...state.messages, new HumanMessage(content)],
  };
}

/**
 * Add assistant message to state
 */
export function addAssistantMessage(
  state: VoiceAgentState,
  content: string
): VoiceAgentState {
  return {
    ...state,
    messages: [...state.messages, new AIMessage(content)],
  };
}
