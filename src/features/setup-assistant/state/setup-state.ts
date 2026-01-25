// =====================================================
// TIS TIS PLATFORM - Setup Assistant State
// LangGraph state definition for the setup assistant agent
// =====================================================

import { Annotation } from '@langchain/langgraph';
import type {
  SetupModule,
  MessageAction,
  VisionAnalysis,
  SetupContext as TypesSetupContext,
  SetupIntent as TypesSetupIntent,
} from '../types';

// =====================================================
// RE-EXPORT TYPES FOR CONVENIENCE
// =====================================================

export type SetupContext = TypesSetupContext;
export type SetupIntent = TypesSetupIntent;

// =====================================================
// STATE MESSAGE TYPE
// =====================================================

export interface SetupStateMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Array<{
    type: string;
    url: string;
    analysis?: VisionAnalysis;
  }>;
}

// =====================================================
// LANGGRAPH STATE ANNOTATION
// =====================================================

export const SetupAssistantState = Annotation.Root({
  // =====================================================
  // CONVERSATION CONTEXT
  // =====================================================

  /** Unique conversation ID */
  conversationId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  /** Business context loaded from tenant */
  context: Annotation<SetupContext | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Message history for context */
  messages: Annotation<SetupStateMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // =====================================================
  // CURRENT MESSAGE PROCESSING
  // =====================================================

  /** Current user message being processed */
  currentMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  /** Attachment URLs from current message */
  currentAttachments: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // =====================================================
  // INTENT DETECTION
  // =====================================================

  /** Detected setup intent */
  detectedIntent: Annotation<SetupIntent>({
    reducer: (_, next) => next,
    default: () => 'unknown',
  }),

  /** Confidence score for intent detection (0-1) */
  intentConfidence: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  /** Extracted data from user message */
  extractedData: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // =====================================================
  // VISION ANALYSIS
  // =====================================================

  /** Vision analysis results for image attachments */
  visionAnalysis: Annotation<VisionAnalysis | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // =====================================================
  // ACTIONS
  // =====================================================

  /** Actions pending execution (replace semantics - executor clears after execution) */
  pendingActions: Annotation<MessageAction[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  /** Actions that have been executed */
  executedActions: Annotation<MessageAction[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // =====================================================
  // RESPONSE
  // =====================================================

  /** Generated response for the user */
  response: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // =====================================================
  // FLOW CONTROL
  // =====================================================

  /** Current node in the graph */
  currentNode: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'supervisor',
  }),

  /** Whether the graph should end */
  shouldEnd: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // =====================================================
  // TOKEN TRACKING
  // =====================================================

  /** Input tokens consumed */
  inputTokens: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),

  /** Output tokens consumed */
  outputTokens: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),

  // =====================================================
  // ERROR HANDLING
  // =====================================================

  /** Errors encountered during processing */
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

// Inferred state type
export type SetupAssistantStateType = typeof SetupAssistantState.State;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Create initial state for a new message processing
 */
export function createInitialSetupState(
  conversationId: string,
  context: SetupContext,
  messages: SetupStateMessage[],
  currentMessage: string,
  attachments?: string[],
  visionAnalysis?: VisionAnalysis
): Partial<SetupAssistantStateType> {
  return {
    conversationId,
    context,
    messages,
    currentMessage,
    currentAttachments: attachments || [],
    visionAnalysis: visionAnalysis || null,
    detectedIntent: 'unknown',
    intentConfidence: 0,
    extractedData: {},
    pendingActions: [],
    executedActions: [],
    response: '',
    currentNode: 'supervisor',
    shouldEnd: false,
    inputTokens: 0,
    outputTokens: 0,
    errors: [],
  };
}

/**
 * Get configured modules list from context
 */
export function getConfiguredModules(context: SetupContext | null): SetupModule[] {
  if (!context) return [];

  const modules: SetupModule[] = [];
  if (context.loyaltyConfigured) modules.push('loyalty');
  if (context.agentsConfigured) modules.push('agents');
  if (context.knowledgeBaseConfigured) modules.push('knowledge_base');
  if (context.servicesConfigured) modules.push('services');
  if (context.promotionsConfigured) modules.push('promotions');

  return modules;
}
