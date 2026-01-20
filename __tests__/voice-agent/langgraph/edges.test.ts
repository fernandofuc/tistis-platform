/**
 * TIS TIS Platform - Voice Agent v2.0
 * Edges Tests
 */

import {
  routerEdge,
  toolExecutorEdge,
  confirmationEdge,
  ragEdge,
  responseGeneratorEdge,
  getPossibleNextNodes,
  isValidPath,
  shouldRouteToRAG,
  shouldRouteToToolExecutor,
  shouldRouteToConfirmation,
  isProcessingComplete,
  validateGraphStructure,
  GRAPH_STRUCTURE,
} from '@/lib/voice-agent/langgraph/edges';
import { createInitialState } from '@/lib/voice-agent/langgraph/state';
import type { VoiceAgentState } from '@/lib/voice-agent/langgraph/state';

describe('Edge Functions', () => {
  // Helper to create test state
  const createTestState = (overrides: Partial<VoiceAgentState> = {}): VoiceAgentState => ({
    ...createInitialState({
      callId: 'call-123',
      vapiCallId: 'vapi-123',
      tenantId: 'tenant-123',
      voiceConfigId: 'config-123',
      assistantType: 'rest_basic',
      currentInput: 'test',
    }),
    ...overrides,
  });

  describe('routerEdge', () => {
    it('should route tool intent to tool_executor', () => {
      const state = createTestState({ intent: 'tool', confidence: 0.9 });
      expect(routerEdge(state)).toBe('tool_executor');
    });

    it('should route rag intent to rag', () => {
      const state = createTestState({ intent: 'rag', confidence: 0.9 });
      expect(routerEdge(state)).toBe('rag');
    });

    it('should route transfer intent to tool_executor', () => {
      const state = createTestState({ intent: 'transfer', confidence: 0.9 });
      expect(routerEdge(state)).toBe('tool_executor');
    });

    it('should route direct intent to response_generator', () => {
      const state = createTestState({ intent: 'direct', confidence: 0.9 });
      expect(routerEdge(state)).toBe('response_generator');
    });

    it('should route unknown intent to response_generator', () => {
      const state = createTestState({ intent: 'unknown', confidence: 0.5 });
      expect(routerEdge(state)).toBe('response_generator');
    });

    it('should route confirm intent to confirmation when pending', () => {
      const state = createTestState({
        intent: 'confirm',
        confidence: 0.9,
        confirmationStatus: 'pending',
      });
      expect(routerEdge(state)).toBe('confirmation');
    });

    it('should route confirm intent to response_generator when no pending confirmation', () => {
      const state = createTestState({
        intent: 'confirm',
        confidence: 0.9,
        confirmationStatus: 'none',
      });
      expect(routerEdge(state)).toBe('response_generator');
    });
  });

  describe('toolExecutorEdge', () => {
    it('should route to response_generator when confirmation pending', () => {
      const state = createTestState({
        confirmationStatus: 'pending',
        pendingTool: {
          name: 'create_reservation',
          parameters: {},
          requiresConfirmation: true,
          queuedAt: Date.now(),
        },
      });
      expect(toolExecutorEdge(state)).toBe('response_generator');
    });

    it('should route to response_generator after tool execution', () => {
      const state = createTestState({
        confirmationStatus: 'none',
        toolResult: { success: true, data: { message: 'Done' } },
      });
      expect(toolExecutorEdge(state)).toBe('response_generator');
    });

    it('should route to response_generator when no pending tool', () => {
      const state = createTestState({
        confirmationStatus: 'none',
      });
      expect(toolExecutorEdge(state)).toBe('response_generator');
    });
  });

  describe('confirmationEdge', () => {
    it('should route to tool_executor when confirmed', () => {
      const state = createTestState({
        confirmationStatus: 'confirmed',
        pendingTool: {
          name: 'create_reservation',
          parameters: {},
          requiresConfirmation: true,
          queuedAt: Date.now(),
        },
      });
      expect(confirmationEdge(state)).toBe('tool_executor');
    });

    it('should route to response_generator when denied', () => {
      const state = createTestState({
        confirmationStatus: 'denied',
      });
      expect(confirmationEdge(state)).toBe('response_generator');
    });

    it('should route to response_generator when still pending (unclear response)', () => {
      const state = createTestState({
        confirmationStatus: 'pending',
      });
      expect(confirmationEdge(state)).toBe('response_generator');
    });
  });

  describe('ragEdge', () => {
    it('should always route to response_generator', () => {
      const state = createTestState({});
      expect(ragEdge(state)).toBe('response_generator');
    });
  });

  describe('responseGeneratorEdge', () => {
    it('should always route to __end__', () => {
      const state = createTestState({});
      expect(responseGeneratorEdge(state)).toBe('__end__');
    });
  });
});

describe('Routing Utilities', () => {
  describe('getPossibleNextNodes', () => {
    it('should return correct nodes from router', () => {
      const nodes = getPossibleNextNodes('router');
      expect(nodes).toContain('rag');
      expect(nodes).toContain('tool_executor');
      expect(nodes).toContain('confirmation');
      expect(nodes).toContain('response_generator');
    });

    it('should return correct nodes from rag', () => {
      const nodes = getPossibleNextNodes('rag');
      expect(nodes).toEqual(['response_generator']);
    });

    it('should return correct nodes from tool_executor', () => {
      const nodes = getPossibleNextNodes('tool_executor');
      expect(nodes).toContain('confirmation');
      expect(nodes).toContain('response_generator');
    });

    it('should return correct nodes from confirmation', () => {
      const nodes = getPossibleNextNodes('confirmation');
      expect(nodes).toContain('tool_executor');
      expect(nodes).toContain('response_generator');
    });

    it('should return __end__ from response_generator', () => {
      const nodes = getPossibleNextNodes('response_generator');
      expect(nodes).toEqual(['__end__']);
    });
  });

  describe('isValidPath', () => {
    it('should validate correct paths', () => {
      expect(isValidPath('router', 'rag')).toBe(true);
      expect(isValidPath('router', 'tool_executor')).toBe(true);
      expect(isValidPath('rag', 'response_generator')).toBe(true);
      expect(isValidPath('response_generator', '__end__')).toBe(true);
    });

    it('should invalidate incorrect paths', () => {
      expect(isValidPath('router', '__end__')).toBe(false);
      expect(isValidPath('rag', 'tool_executor')).toBe(false);
      expect(isValidPath('response_generator', 'router')).toBe(false);
    });
  });
});

describe('Decision Helpers', () => {
  const createTestState = (overrides: Partial<VoiceAgentState> = {}): VoiceAgentState => ({
    ...createInitialState({
      callId: 'call-123',
      vapiCallId: 'vapi-123',
      tenantId: 'tenant-123',
      voiceConfigId: 'config-123',
      assistantType: 'rest_basic',
      currentInput: 'test',
    }),
    ...overrides,
  });

  describe('shouldRouteToRAG', () => {
    it('should return true for rag intent without result', () => {
      const state = createTestState({ intent: 'rag' });
      expect(shouldRouteToRAG(state)).toBe(true);
    });

    it('should return false when rag result exists', () => {
      const state = createTestState({
        intent: 'rag',
        ragResult: { context: 'test', sources: [], success: true, latencyMs: 100 },
      });
      expect(shouldRouteToRAG(state)).toBe(false);
    });

    it('should return false for non-rag intent', () => {
      const state = createTestState({ intent: 'tool' });
      expect(shouldRouteToRAG(state)).toBe(false);
    });
  });

  describe('shouldRouteToToolExecutor', () => {
    it('should return true for tool intent without result', () => {
      const state = createTestState({ intent: 'tool' });
      expect(shouldRouteToToolExecutor(state)).toBe(true);
    });

    it('should return true for transfer intent', () => {
      const state = createTestState({ intent: 'transfer' });
      expect(shouldRouteToToolExecutor(state)).toBe(true);
    });

    it('should return false when tool result exists', () => {
      const state = createTestState({
        intent: 'tool',
        toolResult: { success: true },
      });
      expect(shouldRouteToToolExecutor(state)).toBe(false);
    });
  });

  describe('shouldRouteToConfirmation', () => {
    it('should return true when confirmation pending and intent is confirm', () => {
      const state = createTestState({
        confirmationStatus: 'pending',
        intent: 'confirm',
      });
      expect(shouldRouteToConfirmation(state)).toBe(true);
    });

    it('should return false when no pending confirmation', () => {
      const state = createTestState({
        confirmationStatus: 'none',
        intent: 'confirm',
      });
      expect(shouldRouteToConfirmation(state)).toBe(false);
    });
  });

  describe('isProcessingComplete', () => {
    it('should return true when isComplete flag set', () => {
      const state = createTestState({ isComplete: true });
      expect(isProcessingComplete(state)).toBe(true);
    });

    it('should return true when response exists', () => {
      const state = createTestState({ response: 'Hello!' });
      expect(isProcessingComplete(state)).toBe(true);
    });

    it('should return false when processing incomplete', () => {
      const state = createTestState({ isComplete: false, response: undefined });
      expect(isProcessingComplete(state)).toBe(false);
    });
  });
});

describe('Graph Structure', () => {
  describe('GRAPH_STRUCTURE', () => {
    it('should have all required nodes', () => {
      expect(GRAPH_STRUCTURE.nodes).toContain('router');
      expect(GRAPH_STRUCTURE.nodes).toContain('rag');
      expect(GRAPH_STRUCTURE.nodes).toContain('tool_executor');
      expect(GRAPH_STRUCTURE.nodes).toContain('confirmation');
      expect(GRAPH_STRUCTURE.nodes).toContain('response_generator');
    });

    it('should have router as entry point', () => {
      expect(GRAPH_STRUCTURE.entryPoint).toBe('router');
    });

    it('should have edges defined for all nodes', () => {
      for (const node of GRAPH_STRUCTURE.nodes) {
        expect(GRAPH_STRUCTURE.edges[node]).toBeDefined();
      }
    });
  });

  describe('validateGraphStructure', () => {
    it('should validate the current graph structure', () => {
      const result = validateGraphStructure();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
