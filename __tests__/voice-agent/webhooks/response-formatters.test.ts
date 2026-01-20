/**
 * TIS TIS Platform - Voice Agent v2.0
 * Response Formatters Tests
 */

import {
  formatVoiceConfig,
  formatTranscriberConfig,
  formatStartSpeakingPlan,
  formatFunctionDefinition,
  formatToolDefinition,
  formatToolDefinitions,
  formatAssistantConfig,
  formatAssistantRequestResponse,
  formatAssistantRequestError,
  formatConversationUpdateResponse,
  formatConversationUpdateError,
  formatFunctionCallResponse,
  formatFunctionCallError,
  formatToolCallsResponse,
  formatAckResponse,
  formatErrorResponse,
  formatResultForVoice,
  formatErrorForVoice,
} from '@/lib/voice-agent/webhooks/response-formatters';

describe('Voice Configuration Formatters', () => {
  describe('formatVoiceConfig()', () => {
    it('should format voice config with defaults', () => {
      const result = formatVoiceConfig({});

      expect(result.provider).toBe('elevenlabs');
      expect(result.voiceId).toBe('LegCbmbXKbT5PUp3QFWv');
      expect(result.model).toBe('eleven_multilingual_v2');
      expect(result.stability).toBe(0.5);
      expect(result.similarityBoost).toBe(0.75);
    });

    it('should use provided values', () => {
      const result = formatVoiceConfig({
        voiceId: 'custom-voice',
        voiceProvider: 'deepgram',
        voiceStability: 0.8,
      });

      expect(result.voiceId).toBe('custom-voice');
      expect(result.provider).toBe('deepgram');
      expect(result.stability).toBe(0.8);
    });
  });

  describe('formatTranscriberConfig()', () => {
    it('should format transcriber config with defaults', () => {
      const result = formatTranscriberConfig({});

      expect(result.provider).toBe('deepgram');
      expect(result.model).toBe('nova-2');
      expect(result.language).toBe('es');
    });

    it('should use provided values', () => {
      const result = formatTranscriberConfig({
        transcriptionProvider: 'assembly',
        transcriptionLanguage: 'en',
      });

      expect(result.provider).toBe('assembly');
      expect(result.language).toBe('en');
    });
  });

  describe('formatStartSpeakingPlan()', () => {
    it('should format speaking plan with defaults', () => {
      const result = formatStartSpeakingPlan({});

      expect(result.waitSeconds).toBe(0.6);
      expect(result.smartEndpointingEnabled).toBe(true);
      expect(result.transcriptionEndpointingPlan?.onPunctuationSeconds).toBe(0.2);
      expect(result.transcriptionEndpointingPlan?.onNoPunctuationSeconds).toBe(1.2);
    });

    it('should use provided values', () => {
      const result = formatStartSpeakingPlan({
        waitSeconds: 1.0,
        onPunctuationSeconds: 0.5,
      });

      expect(result.waitSeconds).toBe(1.0);
      expect(result.transcriptionEndpointingPlan?.onPunctuationSeconds).toBe(0.5);
    });
  });
});

describe('Tool/Function Formatters', () => {
  describe('formatFunctionDefinition()', () => {
    it('should format function definition', () => {
      const result = formatFunctionDefinition({
        name: 'get_menu',
        description: 'Get restaurant menu',
        parameters: [
          {
            name: 'category',
            type: 'string',
            description: 'Menu category',
            required: true,
          },
        ],
      });

      expect(result.name).toBe('get_menu');
      expect(result.description).toBe('Get restaurant menu');
      expect(result.parameters.type).toBe('object');
      expect(result.parameters.properties.category.type).toBe('string');
      expect(result.parameters.required).toContain('category');
    });

    it('should handle functions without parameters', () => {
      const result = formatFunctionDefinition({
        name: 'get_hours',
        description: 'Get business hours',
      });

      expect(result.name).toBe('get_hours');
      expect(result.parameters.properties).toEqual({});
      expect(result.parameters.required).toBeUndefined();
    });

    it('should handle enum parameters', () => {
      const result = formatFunctionDefinition({
        name: 'get_info',
        description: 'Get info',
        parameters: [
          {
            name: 'type',
            type: 'string',
            description: 'Info type',
            enum: ['hours', 'location', 'menu'],
          },
        ],
      });

      expect(result.parameters.properties.type.enum).toEqual(['hours', 'location', 'menu']);
    });
  });

  describe('formatToolDefinition()', () => {
    it('should wrap function in tool definition', () => {
      const result = formatToolDefinition({
        name: 'get_menu',
        description: 'Get menu',
      });

      expect(result.type).toBe('function');
      expect(result.function.name).toBe('get_menu');
    });

    it('should include server config when provided', () => {
      const result = formatToolDefinition(
        {
          name: 'get_menu',
          description: 'Get menu',
        },
        'https://api.example.com/webhook',
        'secret123'
      );

      expect(result.server?.url).toBe('https://api.example.com/webhook');
      expect(result.server?.secret).toBe('secret123');
      expect(result.server?.timeoutSeconds).toBe(30);
    });
  });

  describe('formatToolDefinitions()', () => {
    it('should format multiple tools', () => {
      const tools = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' },
      ];

      const result = formatToolDefinitions(tools);

      expect(result).toHaveLength(2);
      expect(result[0].function.name).toBe('tool1');
      expect(result[1].function.name).toBe('tool2');
    });
  });
});

describe('Assistant Configuration Formatter', () => {
  describe('formatAssistantConfig()', () => {
    it('should format complete assistant config', () => {
      const result = formatAssistantConfig({
        assistantName: 'Test Assistant',
        firstMessage: 'Hello!',
        voiceId: 'test-voice',
        recordingEnabled: true,
      });

      expect(result.name).toBe('Test Assistant');
      expect(result.firstMessage).toBe('Hello!');
      expect(result.voice?.voiceId).toBe('test-voice');
      expect(result.recordingEnabled).toBe(true);
    });

    it('should include server URL when provided', () => {
      const result = formatAssistantConfig(
        {},
        {
          serverUrl: 'https://api.example.com/webhook',
          serverUrlSecret: 'secret',
        }
      );

      expect(result.serverUrl).toBe('https://api.example.com/webhook');
      expect(result.serverUrlSecret).toBe('secret');
    });

    it('should set default end call phrases for Spanish', () => {
      const result = formatAssistantConfig({
        transcriptionLanguage: 'es',
      });

      expect(result.endCallPhrases).toContain('adiós');
      expect(result.endCallPhrases).toContain('hasta luego');
    });

    it('should set default end call phrases for English', () => {
      const result = formatAssistantConfig({
        transcriptionLanguage: 'en',
      });

      expect(result.endCallPhrases).toContain('goodbye');
      expect(result.endCallPhrases).toContain('bye');
    });

    it('should map first message mode correctly', () => {
      const result1 = formatAssistantConfig({
        firstMessageMode: 'assistant_speaks_first',
      });
      expect(result1.firstMessageMode).toBe('assistant-speaks-first');

      const result2 = formatAssistantConfig({
        firstMessageMode: 'assistant_waits_for_user',
      });
      expect(result2.firstMessageMode).toBe('assistant-waits-for-user');
    });
  });
});

describe('Response Formatters', () => {
  describe('formatAssistantRequestResponse()', () => {
    it('should format assistant request response', () => {
      const assistantConfig = formatAssistantConfig({
        assistantName: 'Test',
      });

      const result = formatAssistantRequestResponse(assistantConfig, {
        tenantId: 'tenant-123',
      });

      expect(result.assistant).toBeDefined();
      expect(result.metadata?.tenantId).toBe('tenant-123');
    });
  });

  describe('formatAssistantRequestError()', () => {
    it('should format error response', () => {
      const result = formatAssistantRequestError('Test error');

      expect(result.error).toBe('Test error');
      expect(result.assistant).toBeUndefined();
    });
  });

  describe('formatConversationUpdateResponse()', () => {
    it('should format response with assistant message', () => {
      const result = formatConversationUpdateResponse('Hello there!');

      expect(result.assistantResponse).toBe('Hello there!');
      expect(result.endCall).toBe(false);
    });

    it('should include endCall flag when true', () => {
      const result = formatConversationUpdateResponse('Goodbye!', true);

      expect(result.endCall).toBe(true);
    });
  });

  describe('formatConversationUpdateError()', () => {
    it('should format error response', () => {
      const result = formatConversationUpdateError('Error message');

      expect(result.error).toBe('Error message');
    });
  });

  describe('formatFunctionCallResponse()', () => {
    it('should format function result', () => {
      const result = formatFunctionCallResponse({ data: 'test' });

      expect(result.result).toEqual({ data: 'test' });
      expect(result.forwardToClientEnabled).toBe(false);
    });

    it('should include forward flag', () => {
      const result = formatFunctionCallResponse({ data: 'test' }, true);

      expect(result.forwardToClientEnabled).toBe(true);
    });
  });

  describe('formatFunctionCallError()', () => {
    it('should format function error', () => {
      const result = formatFunctionCallError('Function failed');

      expect(result.error).toBe('Function failed');
    });
  });

  describe('formatToolCallsResponse()', () => {
    it('should format multiple tool results', () => {
      const results = [
        { toolCallId: 'call-1', result: 'Result 1' },
        { toolCallId: 'call-2', error: 'Error 2' },
      ];

      const response = formatToolCallsResponse(results);

      expect(response.results).toHaveLength(2);
      expect(response.results[0].result).toBe('Result 1');
      expect(response.results[1].error).toBe('Error 2');
    });
  });

  describe('formatAckResponse()', () => {
    it('should return status ok', () => {
      const result = formatAckResponse();

      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('formatErrorResponse()', () => {
    it('should format basic error', () => {
      const result = formatErrorResponse('Something went wrong');

      expect(result.error).toBe('Something went wrong');
    });

    it('should include code when provided', () => {
      const result = formatErrorResponse('Error', 'INVALID_INPUT');

      expect(result.code).toBe('INVALID_INPUT');
    });
  });
});

describe('Voice Result Formatters', () => {
  describe('formatResultForVoice()', () => {
    it('should handle null result', () => {
      const result = formatResultForVoice('test', null, 'es');

      expect(result).toContain('no retornó datos');
    });

    it('should handle string result', () => {
      const result = formatResultForVoice('test', 'Hello', 'es');

      expect(result).toBe('Hello');
    });

    it('should handle boolean result', () => {
      const resultTrue = formatResultForVoice('test', true, 'es');
      expect(resultTrue).toContain('exitosa');

      const resultFalse = formatResultForVoice('test', false, 'es');
      expect(resultFalse).toContain('falló');
    });

    it('should handle number result', () => {
      const result = formatResultForVoice('test', 42, 'es');

      expect(result).toBe('42');
    });

    it('should extract message from object', () => {
      const result = formatResultForVoice('test', { message: 'Custom message' }, 'es');

      expect(result).toBe('Custom message');
    });

    it('should handle arrays', () => {
      const result = formatResultForVoice('test', ['item1', 'item2'], 'es');

      expect(result).toContain('2 resultados');
      expect(result).toContain('item1');
      expect(result).toContain('item2');
    });

    it('should handle empty arrays', () => {
      const result = formatResultForVoice('test', [], 'es');

      expect(result).toContain('No se encontraron');
    });

    it('should handle English locale', () => {
      const result = formatResultForVoice('test', null, 'en');

      expect(result).toContain('returned no data');
    });
  });

  describe('formatErrorForVoice()', () => {
    it('should return user-friendly message for timeout', () => {
      const result = formatErrorForVoice('ETIMEDOUT', 'es');

      expect(result).toContain('tardó demasiado');
    });

    it('should return user-friendly message for network error', () => {
      const result = formatErrorForVoice('ECONNREFUSED', 'es');

      expect(result).toContain('conexión');
    });

    it('should return user-friendly message for not found', () => {
      const result = formatErrorForVoice('not found', 'es');

      expect(result).toContain('No encontré');
    });

    it('should return default message for unknown errors', () => {
      const result = formatErrorForVoice('Unknown error', 'es');

      expect(result).toContain('problema técnico');
    });

    it('should handle Error objects', () => {
      const error = new Error('timeout exceeded');
      const result = formatErrorForVoice(error, 'es');

      expect(result).toContain('tardó demasiado');
    });

    it('should handle English locale', () => {
      const result = formatErrorForVoice('timeout', 'en');

      expect(result).toContain('took too long');
    });
  });
});
