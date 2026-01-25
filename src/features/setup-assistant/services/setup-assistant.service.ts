// =====================================================
// TIS TIS PLATFORM - Setup Assistant Service
// High-level service for processing messages
// Now with checkpointing for session recovery
// =====================================================

import { setupAssistantGraph } from '../graph';
import { createInitialSetupState } from '../state/setup-state';
import type { SetupContext, SetupStateMessage, SetupAssistantStateType } from '../state/setup-state';
import type { MessageAction, VisionAnalysis } from '../types';

// =====================================================
// SERVICE TYPES
// =====================================================

export interface ProcessMessageInput {
  conversationId: string;
  context: SetupContext;
  messages: SetupStateMessage[];
  currentMessage: string;
  attachments?: string[];
  visionAnalysis?: VisionAnalysis;
  /** If true, will try to resume from last checkpoint */
  resumeFromCheckpoint?: boolean;
}

export interface ProcessMessageOutput {
  response: string;
  executedActions: MessageAction[];
  inputTokens: number;
  outputTokens: number;
  errors: string[];
  /** Extracted data accumulated across messages */
  extractedData?: Record<string, unknown>;
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class SetupAssistantService {
  private static instance: SetupAssistantService;

  private constructor() {}

  static getInstance(): SetupAssistantService {
    if (!SetupAssistantService.instance) {
      SetupAssistantService.instance = new SetupAssistantService();
    }
    return SetupAssistantService.instance;
  }

  /**
   * Process a user message through the LangGraph agent
   * Uses checkpointing to persist state between messages
   */
  async processMessage(input: ProcessMessageInput): Promise<ProcessMessageOutput> {
    const {
      conversationId,
      context,
      messages,
      currentMessage,
      attachments,
      visionAnalysis,
      resumeFromCheckpoint = true,
    } = input;

    // Try to get previous state from checkpoint
    let previousExtractedData: Record<string, unknown> = {};
    if (resumeFromCheckpoint) {
      try {
        const previousState = await setupAssistantGraph.getState(conversationId);
        if (previousState?.values) {
          const values = previousState.values as Partial<SetupAssistantStateType>;
          previousExtractedData = values.extractedData || {};
          console.log('[SetupAssistantService] Resumed from checkpoint with extracted data:',
            Object.keys(previousExtractedData));
        }
      } catch (error) {
        console.debug('[SetupAssistantService] No previous checkpoint found:', error);
      }
    }

    // Create initial state, merging previous extracted data
    const initialState = createInitialSetupState(
      conversationId,
      context,
      messages,
      currentMessage,
      attachments,
      visionAnalysis
    );

    // Merge previous extracted data into initial state
    if (Object.keys(previousExtractedData).length > 0) {
      initialState.extractedData = {
        ...previousExtractedData,
        ...(initialState.extractedData || {}),
      };
    }

    try {
      // Invoke with checkpointing configuration
      const result = await setupAssistantGraph.invoke(initialState, {
        conversationId,
      });

      return {
        response: result.response || 'Lo siento, no pude procesar tu mensaje.',
        executedActions: result.executedActions || [],
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        errors: result.errors || [],
        extractedData: result.extractedData || {},
      };
    } catch (error) {
      console.error('[SetupAssistantService] Error processing message:', error);

      return {
        response: 'Hubo un error procesando tu mensaje. Por favor intenta de nuevo.',
        executedActions: [],
        inputTokens: 0,
        outputTokens: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Get the current accumulated state for a conversation
   * Useful for showing progress to the user
   */
  async getConversationState(conversationId: string): Promise<{
    extractedData: Record<string, unknown>;
    executedActions: MessageAction[];
  } | null> {
    try {
      const state = await setupAssistantGraph.getState(conversationId);
      if (!state?.values) return null;

      const values = state.values as Partial<SetupAssistantStateType>;
      return {
        extractedData: values.extractedData || {},
        executedActions: values.executedActions || [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Get state history for debugging or review
   */
  async *getStateHistory(conversationId: string, limit = 10) {
    yield* setupAssistantGraph.getStateHistory(conversationId, limit);
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

export const setupAssistantService = SetupAssistantService.getInstance();
