/**
 * TIS TIS Platform - Voice Agent v2.0
 * State Tests
 */

import {
  createInitialState,
  createToolExecutionState,
  requiresConfirmation,
  addError,
  recordLatency,
  getTotalLatency,
  hasCriticalError,
  getConversationHistory,
  addUserMessage,
  addAssistantMessage,
  type VoiceAgentState,
} from '@/lib/voice-agent/langgraph/state';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('State Factory Functions', () => {
  describe('createInitialState', () => {
    it('should create state with all required fields', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      expect(state.callId).toBe('call-123');
      expect(state.vapiCallId).toBe('vapi-123');
      expect(state.tenantId).toBe('tenant-123');
      expect(state.voiceConfigId).toBe('config-123');
      expect(state.assistantType).toBe('rest_basic');
      expect(state.currentInput).toBe('Hola');
    });

    it('should use default locale of es', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      expect(state.locale).toBe('es');
    });

    it('should accept custom locale', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hello',
        locale: 'en',
      });

      expect(state.locale).toBe('en');
    });

    it('should initialize with default values', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      expect(state.intent).toBe('unknown');
      expect(state.confidence).toBe(0);
      expect(state.messages).toEqual([]);
      expect(state.errors).toEqual([]);
      expect(state.isComplete).toBe(false);
      expect(state.confirmationStatus).toBe('none');
    });

    it('should accept existing messages', () => {
      const existingMessages = [
        new HumanMessage('Hola'),
        new AIMessage('¡Hola! ¿En qué puedo ayudarte?'),
      ];

      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Quiero reservar',
        existingMessages,
      });

      expect(state.messages).toHaveLength(2);
    });

    it('should accept turn count', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
        turnCount: 5,
      });

      expect(state.turnCount).toBe(5);
    });
  });

  describe('createToolExecutionState', () => {
    it('should create state for tool execution', () => {
      const state = createToolExecutionState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        toolName: 'create_reservation',
        toolParameters: { date: '2024-01-15', time: '18:00' },
      });

      expect(state.intent).toBe('tool');
      expect(state.confidence).toBe(1.0);
      expect(state.pendingTool).toBeDefined();
      expect(state.pendingTool?.name).toBe('create_reservation');
      expect(state.pendingTool?.parameters).toEqual({ date: '2024-01-15', time: '18:00' });
    });

    it('should mark confirmation required for reservation tools', () => {
      const state = createToolExecutionState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        toolName: 'create_reservation',
        toolParameters: {},
      });

      expect(state.pendingTool?.requiresConfirmation).toBe(true);
    });

    it('should not mark confirmation required for info tools', () => {
      const state = createToolExecutionState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        toolName: 'get_business_hours',
        toolParameters: {},
      });

      expect(state.pendingTool?.requiresConfirmation).toBe(false);
    });
  });
});

describe('Helper Functions', () => {
  describe('requiresConfirmation', () => {
    it('should return true for reservation tools', () => {
      expect(requiresConfirmation('create_reservation')).toBe(true);
      expect(requiresConfirmation('modify_reservation')).toBe(true);
      expect(requiresConfirmation('cancel_reservation')).toBe(true);
    });

    it('should return true for appointment tools', () => {
      expect(requiresConfirmation('create_appointment')).toBe(true);
      expect(requiresConfirmation('modify_appointment')).toBe(true);
      expect(requiresConfirmation('cancel_appointment')).toBe(true);
    });

    it('should return true for transfer tool', () => {
      expect(requiresConfirmation('transfer_to_human')).toBe(true);
    });

    it('should return false for info tools', () => {
      expect(requiresConfirmation('get_business_hours')).toBe(false);
      expect(requiresConfirmation('get_menu')).toBe(false);
      expect(requiresConfirmation('check_availability')).toBe(false);
    });
  });

  describe('addError', () => {
    it('should add error to state', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      const newState = addError(state, 'router', 'Test error', true);

      expect(newState.errors).toHaveLength(1);
      expect(newState.errors[0].node).toBe('router');
      expect(newState.errors[0].message).toBe('Test error');
      expect(newState.errors[0].recoverable).toBe(true);
    });

    it('should append errors without mutating original', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      const state1 = addError(state, 'router', 'Error 1', true);
      const state2 = addError(state1, 'rag', 'Error 2', false);

      expect(state.errors).toHaveLength(0);
      expect(state1.errors).toHaveLength(1);
      expect(state2.errors).toHaveLength(2);
    });
  });

  describe('recordLatency', () => {
    it('should record node latency', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      const startTime = Date.now() - 100;
      const newState = recordLatency(state, 'router', startTime);

      expect(newState.nodeLatencies.router).toBeGreaterThanOrEqual(100);
    });
  });

  describe('getTotalLatency', () => {
    it('should calculate total latency', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      // turnStartTime is set to Date.now() in createInitialState
      const latency = getTotalLatency(state);
      expect(latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hasCriticalError', () => {
    it('should return false when no errors', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      expect(hasCriticalError(state)).toBe(false);
    });

    it('should return false for recoverable errors', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      const withError = addError(state, 'router', 'Minor error', true);
      expect(hasCriticalError(withError)).toBe(false);
    });

    it('should return true for non-recoverable errors', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      const withError = addError(state, 'router', 'Critical error', false);
      expect(hasCriticalError(withError)).toBe(true);
    });
  });

  describe('getConversationHistory', () => {
    it('should format messages as history string', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
        existingMessages: [
          new HumanMessage('Hola'),
          new AIMessage('¡Hola! ¿En qué puedo ayudarte?'),
        ],
      });

      const history = getConversationHistory(state);

      expect(history).toContain('Usuario: Hola');
      expect(history).toContain('Asistente: ¡Hola! ¿En qué puedo ayudarte?');
    });

    it('should return empty string for no messages', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      const history = getConversationHistory(state);
      expect(history).toBe('');
    });
  });

  describe('addUserMessage', () => {
    it('should add user message to state', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      const newState = addUserMessage(state, 'Quiero reservar');

      expect(newState.messages).toHaveLength(1);
      expect(newState.messages[0]).toBeInstanceOf(HumanMessage);
      expect(newState.messages[0].content).toBe('Quiero reservar');
    });
  });

  describe('addAssistantMessage', () => {
    it('should add assistant message to state', () => {
      const state = createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput: 'Hola',
      });

      const newState = addAssistantMessage(state, '¡Claro! ¿Para cuándo?');

      expect(newState.messages).toHaveLength(1);
      expect(newState.messages[0]).toBeInstanceOf(AIMessage);
      expect(newState.messages[0].content).toBe('¡Claro! ¿Para cuándo?');
    });
  });
});
