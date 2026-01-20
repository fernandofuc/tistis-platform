/**
 * TIS TIS Platform - Voice Agent v2.0
 * Event Router Tests
 */

import {
  WebhookEventRouter,
  createEventRouter,
  createLoggingRouter,
  getEventPriority,
  requiresSyncProcessing,
  isInformationalEvent,
  DEFAULT_ROUTER_CONFIG,
} from '@/lib/voice-agent/webhooks/event-router';
import {
  formatAckResponse,
} from '@/lib/voice-agent/webhooks/response-formatters';
import type {
  AssistantRequestPayload,
  WebhookHandlerContext,
  HandlerResult,
  AckResponse,
} from '@/lib/voice-agent/webhooks/types';
import { WebhookError } from '@/lib/voice-agent/webhooks/types';

describe('WebhookEventRouter', () => {
  // Helper to create test context
  const createContext = (overrides: Partial<WebhookHandlerContext> = {}): WebhookHandlerContext => ({
    requestId: 'test-req-123',
    clientIp: '127.0.0.1',
    startTime: Date.now(),
    ...overrides,
  });

  describe('Constructor', () => {
    it('should create router with default config', () => {
      const router = new WebhookEventRouter();

      expect(router.getRegisteredEventTypes()).toEqual([]);
    });

    it('should create router with handlers', () => {
      const mockHandler = jest.fn();
      const router = new WebhookEventRouter({
        'assistant-request': mockHandler,
      });

      expect(router.hasHandler('assistant-request')).toBe(true);
      expect(router.hasHandler('transcript')).toBe(false);
    });

    it('should merge config with defaults', () => {
      const router = new WebhookEventRouter({}, {
        logEvents: false,
      });

      expect(router).toBeDefined();
    });
  });

  describe('route()', () => {
    it('should route event to registered handler', async () => {
      const mockResponse: HandlerResult<AckResponse> = {
        response: formatAckResponse(),
        statusCode: 200,
        shouldLog: true,
      };

      const mockHandler = jest.fn().mockResolvedValue(mockResponse);

      const router = new WebhookEventRouter({
        'assistant-request': mockHandler,
      });

      const payload: AssistantRequestPayload = {
        type: 'assistant-request',
        call: {
          id: 'call-123',
        },
      };

      const context = createContext();

      const result = await router.route(payload, context);

      expect(mockHandler).toHaveBeenCalledWith(payload, context);
      expect(result.response).toEqual({ status: 'ok' });
      expect(result.statusCode).toBe(200);
    });

    it('should return ack for unknown event when allowUnknownEvents is true', async () => {
      const router = new WebhookEventRouter({}, {
        allowUnknownEvents: true,
      });

      const payload = {
        type: 'unknown-event-type' as any,
        call: { id: 'call-123' },
      };

      const context = createContext();

      const result = await router.route(payload, context);

      expect(result.response).toEqual({ status: 'ok' });
      expect(result.statusCode).toBe(200);
    });

    it('should throw error for unknown event when allowUnknownEvents is false', async () => {
      const router = new WebhookEventRouter({}, {
        allowUnknownEvents: false,
      });

      const payload = {
        type: 'totally-unknown' as any,
        call: { id: 'call-123' },
      };

      const context = createContext();

      await expect(router.route(payload, context)).rejects.toThrow(WebhookError);
    });

    it('should use default handler when no specific handler registered', async () => {
      const defaultResponse: HandlerResult<AckResponse> = {
        response: { status: 'ok' },
        statusCode: 200,
      };

      const defaultHandler = jest.fn().mockResolvedValue(defaultResponse);

      const router = new WebhookEventRouter({}, {
        defaultHandler,
        allowUnknownEvents: false,
      });

      const payload = {
        type: 'transcript' as const,
        call: { id: 'call-123' },
        transcript: {
          text: 'Hello',
          role: 'user' as const,
          isFinal: true,
        },
      };

      const context = createContext();

      const result = await router.route(payload, context);

      expect(defaultHandler).toHaveBeenCalled();
      expect(result.response).toEqual({ status: 'ok' });
    });

    it('should handle handler errors gracefully', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));

      const router = new WebhookEventRouter({
        'assistant-request': mockHandler,
      });

      const payload: AssistantRequestPayload = {
        type: 'assistant-request',
        call: { id: 'call-123' },
      };

      const context = createContext();

      await expect(router.route(payload, context)).rejects.toThrow();
    });

    it('should call onEventProcessed callback', async () => {
      const onEventProcessed = jest.fn();

      const mockHandler = jest.fn().mockResolvedValue({
        response: formatAckResponse(),
        statusCode: 200,
      });

      const router = new WebhookEventRouter(
        { 'transcript': mockHandler },
        { onEventProcessed }
      );

      const payload = {
        type: 'transcript' as const,
        call: { id: 'call-123' },
        transcript: {
          text: 'Hello',
          role: 'user' as const,
          isFinal: true,
        },
      };

      await router.route(payload, createContext());

      expect(onEventProcessed).toHaveBeenCalledWith(
        'transcript',
        expect.any(Number),
        true
      );
    });
  });

  describe('registerHandler()', () => {
    it('should register a new handler', () => {
      const router = new WebhookEventRouter();

      expect(router.hasHandler('transcript')).toBe(false);

      router.registerHandler('transcript', jest.fn());

      expect(router.hasHandler('transcript')).toBe(true);
    });

    it('should override existing handler', async () => {
      const handler1 = jest.fn().mockResolvedValue({
        response: { status: 'ok' },
        statusCode: 200,
      });

      const handler2 = jest.fn().mockResolvedValue({
        response: { status: 'ok' },
        statusCode: 200,
      });

      const router = new WebhookEventRouter({
        'transcript': handler1,
      });

      router.registerHandler('transcript', handler2);

      const payload = {
        type: 'transcript' as const,
        call: { id: 'call-123' },
        transcript: {
          text: 'Hello',
          role: 'user' as const,
          isFinal: true,
        },
      };

      await router.route(payload, createContext());

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('unregisterHandler()', () => {
    it('should unregister a handler', () => {
      const router = new WebhookEventRouter({
        'transcript': jest.fn(),
      });

      expect(router.hasHandler('transcript')).toBe(true);

      router.unregisterHandler('transcript');

      expect(router.hasHandler('transcript')).toBe(false);
    });
  });

  describe('getRegisteredEventTypes()', () => {
    it('should return all registered event types', () => {
      const router = new WebhookEventRouter({
        'assistant-request': jest.fn(),
        'transcript': jest.fn(),
        'status-update': jest.fn(),
      });

      const types = router.getRegisteredEventTypes();

      expect(types).toContain('assistant-request');
      expect(types).toContain('transcript');
      expect(types).toContain('status-update');
      expect(types).toHaveLength(3);
    });
  });
});

describe('Factory Functions', () => {
  describe('createEventRouter()', () => {
    it('should create router with provided handlers', () => {
      const handlers = {
        'transcript': jest.fn(),
      };

      const router = createEventRouter(handlers);

      expect(router.hasHandler('transcript')).toBe(true);
    });
  });

  describe('createLoggingRouter()', () => {
    it('should create router with logging handlers', () => {
      const router = createLoggingRouter();

      expect(router.hasHandler('assistant-request')).toBe(true);
      expect(router.hasHandler('transcript')).toBe(true);
      expect(router.hasHandler('status-update')).toBe(true);
    });
  });
});

describe('Helper Functions', () => {
  describe('getEventPriority()', () => {
    it('should return highest priority for assistant-request', () => {
      expect(getEventPriority('assistant-request')).toBe(100);
    });

    it('should return high priority for conversation-update', () => {
      expect(getEventPriority('conversation-update')).toBe(90);
    });

    it('should return low priority for end-of-call-report', () => {
      expect(getEventPriority('end-of-call-report')).toBe(20);
    });
  });

  describe('requiresSyncProcessing()', () => {
    it('should return true for assistant-request', () => {
      expect(requiresSyncProcessing('assistant-request')).toBe(true);
    });

    it('should return true for conversation-update', () => {
      expect(requiresSyncProcessing('conversation-update')).toBe(true);
    });

    it('should return true for function-call', () => {
      expect(requiresSyncProcessing('function-call')).toBe(true);
    });

    it('should return false for transcript', () => {
      expect(requiresSyncProcessing('transcript')).toBe(false);
    });

    it('should return false for end-of-call-report', () => {
      expect(requiresSyncProcessing('end-of-call-report')).toBe(false);
    });
  });

  describe('isInformationalEvent()', () => {
    it('should return true for transcript', () => {
      expect(isInformationalEvent('transcript')).toBe(true);
    });

    it('should return true for status-update', () => {
      expect(isInformationalEvent('status-update')).toBe(true);
    });

    it('should return true for end-of-call-report', () => {
      expect(isInformationalEvent('end-of-call-report')).toBe(true);
    });

    it('should return false for assistant-request', () => {
      expect(isInformationalEvent('assistant-request')).toBe(false);
    });

    it('should return false for function-call', () => {
      expect(isInformationalEvent('function-call')).toBe(false);
    });
  });
});
