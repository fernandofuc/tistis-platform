// =====================================================
// TIS TIS PLATFORM - Setup Assistant Service
// High-level service for processing messages
// =====================================================

import { setupAssistantGraph } from '../graph';
import { createInitialSetupState } from '../state/setup-state';
import type { SetupContext, SetupStateMessage } from '../state/setup-state';
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
}

export interface ProcessMessageOutput {
  response: string;
  executedActions: MessageAction[];
  inputTokens: number;
  outputTokens: number;
  errors: string[];
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
   */
  async processMessage(input: ProcessMessageInput): Promise<ProcessMessageOutput> {
    const initialState = createInitialSetupState(
      input.conversationId,
      input.context,
      input.messages,
      input.currentMessage,
      input.attachments,
      input.visionAnalysis
    );

    try {
      const result = await setupAssistantGraph.invoke(initialState);

      return {
        response: result.response || 'Lo siento, no pude procesar tu mensaje.',
        executedActions: result.executedActions || [],
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        errors: result.errors || [],
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
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

export const setupAssistantService = SetupAssistantService.getInstance();
