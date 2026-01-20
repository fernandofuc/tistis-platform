/**
 * TIS TIS Platform - Voice Agent v2.0
 * Webhook Types Tests
 */

import {
  isValidVapiEventType,
  isAssistantRequestPayload,
  isConversationUpdatePayload,
  isFunctionCallPayload,
  isToolCallsPayload,
  isEndOfCallPayload,
  isTranscriptPayload,
  isStatusUpdatePayload,
  isSpeechUpdatePayload,
  isHangPayload,
  isTransferDestinationRequestPayload,
  WebhookError,
  VAPI_EVENT_TYPES,
} from '@/lib/voice-agent/webhooks/types';
import type {
  VapiWebhookPayload,
  AssistantRequestPayload,
  ConversationUpdatePayload,
  FunctionCallPayload,
  EndOfCallPayload,
  TranscriptPayload,
  StatusUpdatePayload,
} from '@/lib/voice-agent/webhooks/types';

describe('isValidVapiEventType', () => {
  it('should return true for valid event types', () => {
    expect(isValidVapiEventType('assistant-request')).toBe(true);
    expect(isValidVapiEventType('conversation-update')).toBe(true);
    expect(isValidVapiEventType('function-call')).toBe(true);
    expect(isValidVapiEventType('end-of-call-report')).toBe(true);
    expect(isValidVapiEventType('transcript')).toBe(true);
    expect(isValidVapiEventType('status-update')).toBe(true);
    expect(isValidVapiEventType('speech-update')).toBe(true);
  });

  it('should return false for invalid event types', () => {
    expect(isValidVapiEventType('invalid-type')).toBe(false);
    expect(isValidVapiEventType('')).toBe(false);
    expect(isValidVapiEventType('ASSISTANT-REQUEST')).toBe(false); // Case sensitive
  });
});

describe('VAPI_EVENT_TYPES', () => {
  it('should contain all expected event types', () => {
    expect(VAPI_EVENT_TYPES).toContain('assistant-request');
    expect(VAPI_EVENT_TYPES).toContain('conversation-update');
    expect(VAPI_EVENT_TYPES).toContain('function-call');
    expect(VAPI_EVENT_TYPES).toContain('tool-calls');
    expect(VAPI_EVENT_TYPES).toContain('end-of-call-report');
    expect(VAPI_EVENT_TYPES).toContain('transcript');
    expect(VAPI_EVENT_TYPES).toContain('status-update');
    expect(VAPI_EVENT_TYPES).toContain('speech-update');
    expect(VAPI_EVENT_TYPES).toContain('hang');
    expect(VAPI_EVENT_TYPES).toContain('transfer-destination-request');
  });

  it('should have correct number of event types', () => {
    expect(VAPI_EVENT_TYPES.length).toBe(10);
  });
});

describe('Type Guards', () => {
  describe('isAssistantRequestPayload', () => {
    it('should return true for assistant-request payload', () => {
      const payload: AssistantRequestPayload = {
        type: 'assistant-request',
        call: { id: 'call-123' },
      };

      expect(isAssistantRequestPayload(payload)).toBe(true);
    });

    it('should return false for other payloads', () => {
      const payload = {
        type: 'transcript',
        call: { id: 'call-123' },
      } as VapiWebhookPayload;

      expect(isAssistantRequestPayload(payload)).toBe(false);
    });
  });

  describe('isConversationUpdatePayload', () => {
    it('should return true for conversation-update payload', () => {
      const payload: ConversationUpdatePayload = {
        type: 'conversation-update',
        call: { id: 'call-123' },
        messages: [],
      };

      expect(isConversationUpdatePayload(payload)).toBe(true);
    });

    it('should return false for other payloads', () => {
      const payload = {
        type: 'assistant-request',
        call: { id: 'call-123' },
      } as VapiWebhookPayload;

      expect(isConversationUpdatePayload(payload)).toBe(false);
    });
  });

  describe('isFunctionCallPayload', () => {
    it('should return true for function-call payload', () => {
      const payload: FunctionCallPayload = {
        type: 'function-call',
        call: { id: 'call-123' },
        functionCall: {
          id: 'fc-123',
          name: 'get_menu',
          parameters: {},
        },
      };

      expect(isFunctionCallPayload(payload)).toBe(true);
    });
  });

  describe('isToolCallsPayload', () => {
    it('should return true for tool-calls payload', () => {
      const payload = {
        type: 'tool-calls',
        call: { id: 'call-123' },
        toolCallList: [],
      } as VapiWebhookPayload;

      expect(isToolCallsPayload(payload)).toBe(true);
    });
  });

  describe('isEndOfCallPayload', () => {
    it('should return true for end-of-call-report payload', () => {
      const payload: EndOfCallPayload = {
        type: 'end-of-call-report',
        call: { id: 'call-123' },
        endedReason: 'customer-ended',
      };

      expect(isEndOfCallPayload(payload)).toBe(true);
    });
  });

  describe('isTranscriptPayload', () => {
    it('should return true for transcript payload', () => {
      const payload: TranscriptPayload = {
        type: 'transcript',
        call: { id: 'call-123' },
        transcript: {
          text: 'Hello',
          role: 'user',
          isFinal: true,
        },
      };

      expect(isTranscriptPayload(payload)).toBe(true);
    });
  });

  describe('isStatusUpdatePayload', () => {
    it('should return true for status-update payload', () => {
      const payload: StatusUpdatePayload = {
        type: 'status-update',
        call: { id: 'call-123' },
        status: 'in-progress',
      };

      expect(isStatusUpdatePayload(payload)).toBe(true);
    });
  });

  describe('isSpeechUpdatePayload', () => {
    it('should return true for speech-update payload', () => {
      const payload = {
        type: 'speech-update',
        call: { id: 'call-123' },
        status: 'started',
        role: 'user',
      } as VapiWebhookPayload;

      expect(isSpeechUpdatePayload(payload)).toBe(true);
    });
  });

  describe('isHangPayload', () => {
    it('should return true for hang payload', () => {
      const payload = {
        type: 'hang',
        call: { id: 'call-123' },
      } as VapiWebhookPayload;

      expect(isHangPayload(payload)).toBe(true);
    });
  });

  describe('isTransferDestinationRequestPayload', () => {
    it('should return true for transfer-destination-request payload', () => {
      const payload = {
        type: 'transfer-destination-request',
        call: { id: 'call-123' },
      } as VapiWebhookPayload;

      expect(isTransferDestinationRequestPayload(payload)).toBe(true);
    });
  });
});

describe('WebhookError', () => {
  it('should create error with correct properties', () => {
    const error = new WebhookError(
      'INVALID_PAYLOAD',
      'Test message',
      400,
      { field: 'test' }
    );

    expect(error.code).toBe('INVALID_PAYLOAD');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ field: 'test' });
    expect(error.name).toBe('WebhookError');
  });

  it('should use default status code of 500', () => {
    const error = new WebhookError('INTERNAL_ERROR', 'Error');

    expect(error.statusCode).toBe(500);
  });

  it('should be instanceof Error', () => {
    const error = new WebhookError('INTERNAL_ERROR', 'Error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WebhookError);
  });

  it('should convert to response correctly', () => {
    const error = new WebhookError(
      'INVALID_PAYLOAD',
      'Invalid data',
      400,
      { field: 'name' }
    );

    const response = error.toResponse();

    expect(response.error).toBe('Invalid data');
    expect(response.code).toBe('INVALID_PAYLOAD');
    expect(response.details).toEqual({ field: 'name' });
  });

  it('should be throwable', () => {
    expect(() => {
      throw new WebhookError('INTERNAL_ERROR', 'Test error');
    }).toThrow(WebhookError);
  });

  it('should be catchable with error checking', () => {
    try {
      throw new WebhookError('INVALID_PAYLOAD', 'Bad request', 400);
    } catch (e) {
      expect(e).toBeInstanceOf(WebhookError);
      if (e instanceof WebhookError) {
        expect(e.code).toBe('INVALID_PAYLOAD');
        expect(e.statusCode).toBe(400);
      }
    }
  });
});
