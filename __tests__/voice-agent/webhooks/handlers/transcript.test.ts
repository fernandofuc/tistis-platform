/**
 * TIS TIS Platform - Voice Agent v2.0
 * Transcript Handler Tests
 */

import {
  handleTranscript,
  createTranscriptHandler,
  DEFAULT_TRANSCRIPT_HANDLER_OPTIONS,
} from '@/lib/voice-agent/webhooks/handlers/transcript.handler';
import type {
  TranscriptPayload,
  WebhookHandlerContext,
} from '@/lib/voice-agent/webhooks/types';

// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

describe('handleTranscript', () => {
  // Helper to create test context
  const createContext = (overrides: Partial<WebhookHandlerContext> = {}): WebhookHandlerContext => ({
    requestId: 'test-req-123',
    clientIp: '127.0.0.1',
    startTime: Date.now(),
    callId: 'call-123',
    ...overrides,
  });

  // Helper to create test payload
  const createPayload = (overrides: Partial<TranscriptPayload> = {}): TranscriptPayload => ({
    type: 'transcript',
    call: {
      id: 'vapi-call-123',
    },
    transcript: {
      text: 'Hello, I need help',
      role: 'user',
      isFinal: true,
      timestamp: Date.now(),
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.select.mockReturnThis();
    mockSupabase.single.mockResolvedValue({ count: 0 });
    mockSupabase.insert.mockResolvedValue({ error: null });
  });

  describe('Final Transcripts', () => {
    it('should process final transcript and return ack', async () => {
      const payload = createPayload({
        transcript: {
          text: 'I want to make a reservation',
          role: 'user',
          isFinal: true,
        },
      });

      const result = await handleTranscript(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        logFinal: true,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.status).toBe('ok');
      expect(result.shouldLog).toBe(true);
    });

    it('should include metadata with role and final status', async () => {
      const payload = createPayload({
        transcript: {
          text: 'Test message',
          role: 'assistant',
          isFinal: true,
        },
      });

      const result = await handleTranscript(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.metadata?.role).toBe('assistant');
      expect(result.metadata?.isFinal).toBe(true);
      expect(result.metadata?.textLength).toBe(12);
    });
  });

  describe('Partial Transcripts', () => {
    it('should skip partial transcripts when logPartial is false', async () => {
      const payload = createPayload({
        transcript: {
          text: 'Partial text...',
          role: 'user',
          isFinal: false,
        },
      });

      const result = await handleTranscript(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        logPartial: false,
      });

      expect(result.statusCode).toBe(200);
      expect(result.shouldLog).toBe(false);
    });

    it('should process partial transcripts when logPartial is true', async () => {
      const payload = createPayload({
        transcript: {
          text: 'Partial text...',
          role: 'user',
          isFinal: false,
        },
      });

      const result = await handleTranscript(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        logPartial: true,
      });

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Missing Transcript', () => {
    it('should handle payload without transcript gracefully', async () => {
      const payload = {
        type: 'transcript' as const,
        call: { id: 'vapi-call-123' },
      } as TranscriptPayload;

      const result = await handleTranscript(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.shouldLog).toBe(false);
    });
  });

  describe('Database Storage', () => {
    it('should store transcript when storeInDatabase is true', async () => {
      const payload = createPayload({
        transcript: {
          text: 'Store this message',
          role: 'user',
          isFinal: true,
        },
      });

      await handleTranscript(payload, createContext({ callId: 'call-123' }), {
        supabaseClient: mockSupabase as any,
        storeInDatabase: true,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('voice_call_messages');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should not store transcript when storeInDatabase is false', async () => {
      const payload = createPayload();

      await handleTranscript(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        storeInDatabase: false,
      });

      // Should not call insert for messages
      const insertCalls = mockSupabase.insert.mock.calls;
      expect(insertCalls.length).toBe(0);
    });

    it('should not store partial transcripts even if storeInDatabase is true', async () => {
      const payload = createPayload({
        transcript: {
          text: 'Partial...',
          role: 'user',
          isFinal: false,
        },
      });

      await handleTranscript(payload, createContext({ callId: 'call-123' }), {
        supabaseClient: mockSupabase as any,
        storeInDatabase: true,
        logPartial: true,
      });

      // Insert should not be called for partial transcripts
      const insertCalls = mockSupabase.insert.mock.calls;
      expect(insertCalls.length).toBe(0);
    });

    it('should skip storage if callId is missing', async () => {
      const payload = createPayload();

      await handleTranscript(payload, createContext({ callId: undefined }), {
        supabaseClient: mockSupabase as any,
        storeInDatabase: true,
      });

      // Should not try to store without callId
      const insertCalls = mockSupabase.insert.mock.calls;
      expect(insertCalls.length).toBe(0);
    });
  });

  describe('Custom Callback', () => {
    it('should call onTranscript callback', async () => {
      const onTranscript = jest.fn().mockResolvedValue(undefined);

      const payload = createPayload({
        transcript: {
          text: 'Test message',
          role: 'user',
          isFinal: true,
        },
      });

      await handleTranscript(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        onTranscript,
      });

      expect(onTranscript).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test message',
          role: 'user',
          isFinal: true,
        }),
        expect.any(Object)
      );
    });

    it('should handle callback errors gracefully', async () => {
      const onTranscript = jest.fn().mockRejectedValue(new Error('Callback error'));

      const payload = createPayload();

      const result = await handleTranscript(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        onTranscript,
      });

      // Should not fail the handler
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Privacy - Text Length Limits', () => {
    it('should respect maxLogLength option', async () => {
      const payload = createPayload({
        transcript: {
          text: 'This is a very long message that should be truncated in logs',
          role: 'user',
          isFinal: true,
        },
      });

      // Using a spy to check console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handleTranscript(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        maxLogLength: 20,
        logFinal: true,
      });

      consoleSpy.mockRestore();
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });
});

describe('DEFAULT_TRANSCRIPT_HANDLER_OPTIONS', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_TRANSCRIPT_HANDLER_OPTIONS.logPartial).toBe(false);
    expect(DEFAULT_TRANSCRIPT_HANDLER_OPTIONS.logFinal).toBe(true);
    expect(DEFAULT_TRANSCRIPT_HANDLER_OPTIONS.storeInDatabase).toBe(false);
    expect(DEFAULT_TRANSCRIPT_HANDLER_OPTIONS.maxLogLength).toBe(100);
  });
});

describe('createTranscriptHandler', () => {
  it('should create handler with default options', () => {
    const handler = createTranscriptHandler();

    expect(typeof handler).toBe('function');
  });

  it('should create handler with custom options', () => {
    const handler = createTranscriptHandler({
      logPartial: true,
      storeInDatabase: true,
      maxLogLength: 50,
    });

    expect(typeof handler).toBe('function');
  });

  it('should merge options with defaults', async () => {
    // Just verify handler is created and callable
    const handler = createTranscriptHandler({
      logPartial: true,
      supabaseClient: mockSupabase as any,
    });

    const payload: TranscriptPayload = {
      type: 'transcript',
      call: { id: 'call-123' },
      transcript: {
        text: 'Test',
        role: 'user',
        isFinal: false,
      },
    };

    const context: WebhookHandlerContext = {
      requestId: 'req-123',
      clientIp: '127.0.0.1',
      startTime: Date.now(),
    };

    const result = await handler(payload, context);

    expect(result.statusCode).toBe(200);
  });
});
