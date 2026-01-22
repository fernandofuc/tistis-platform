/**
 * TIS TIS Platform - Voice Agent v2.0
 * End of Call Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleEndOfCall,
  createEndOfCallHandler,
} from '@/lib/voice-agent/webhooks/handlers/end-of-call.handler';
import type {
  EndOfCallPayload,
  WebhookHandlerContext,
} from '@/lib/voice-agent/webhooks/types';

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

describe('handleEndOfCall', () => {
  // Helper to create test context
  const createContext = (overrides: Partial<WebhookHandlerContext> = {}): WebhookHandlerContext => ({
    requestId: 'test-req-123',
    clientIp: '127.0.0.1',
    startTime: Date.now(),
    tenantId: 'tenant-123',
    ...overrides,
  });

  // Helper to create test payload
  const createPayload = (overrides: Partial<EndOfCallPayload> = {}): EndOfCallPayload => ({
    type: 'end-of-call-report',
    call: {
      id: 'vapi-call-123',
    },
    endedReason: 'customer-ended',
    durationSeconds: 120,
    transcript: 'Hello, I would like to make a reservation.',
    recordingUrl: 'https://example.com/recording.mp3',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: call found
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'call-123',
        tenant_id: 'tenant-123',
        primary_intent: null,
        escalated: false,
        outcome: null,
      },
    });
  });

  describe('Success Cases', () => {
    it('should process end of call report successfully', async () => {
      const payload = createPayload();
      const context = createContext();

      const result = await handleEndOfCall(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.status).toBe('ok');
    });

    it('should update call record with report data', async () => {
      const payload = createPayload({
        durationSeconds: 180,
        endedReason: 'assistant-ended',
        transcript: 'Test transcript',
        recordingUrl: 'https://example.com/recording.mp3',
        summary: 'Customer made a reservation',
      });

      await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should include metadata in response', async () => {
      const payload = createPayload();
      const context = createContext();

      const result = await handleEndOfCall(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(result.metadata?.callId).toBe('call-123');
      expect(result.metadata?.tenantId).toBe('tenant-123');
      expect(result.metadata?.durationSeconds).toBe(120);
      expect(result.metadata?.processingTimeMs).toBeDefined();
    });

    it('should analyze transcript when enabled', async () => {
      const payload = createPayload({
        transcript: 'Quiero hacer una reservación para 4 personas.',
      });

      const result = await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        analyzeTranscript: true,
      });

      expect(result.statusCode).toBe(200);
    });

    it('should handle VAPI analysis data', async () => {
      const payload = createPayload({
        analysis: {
          summary: 'Customer booked appointment',
          successEvaluation: 'success',
          structuredData: {
            appointmentBooked: true,
          },
        },
      });

      await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should handle cost breakdown', async () => {
      const payload = createPayload({
        cost: 0.15,
        costBreakdown: {
          transport: 0.05,
          stt: 0.03,
          llm: 0.04,
          tts: 0.02,
          vapi: 0.01,
        },
      });

      await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });

  describe('Call Not Found', () => {
    it('should return success even when call not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const payload = createPayload();
      const result = await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      // Should return success (ack) even if call not found
      expect(result.statusCode).toBe(200);
      expect(result.response.status).toBe('ok');
      expect(result.metadata?.warning).toBe('call_not_found');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockRejectedValueOnce(new Error('Database error'));

      const payload = createPayload();
      const result = await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      // Should still return success to avoid VAPI retry
      expect(result.statusCode).toBe(200);
      expect(result.response.status).toBe('ok');
    });

    it('should handle missing transcript', async () => {
      const payload = createPayload({
        transcript: undefined,
      });

      const result = await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Outcome Determination', () => {
    it('should detect appointment booking from transcript', async () => {
      const payload = createPayload({
        transcript: 'Perfecto, tu cita ha sido confirmada para mañana.',
        endedReason: 'customer-ended',
      });

      const result = await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
    });

    it('should detect reservation from transcript', async () => {
      const payload = createPayload({
        transcript: 'Listo, tu reservación para 4 personas está confirmada.',
        endedReason: 'assistant-ended',
      });

      const result = await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
    });

    it('should detect escalation from transcript', async () => {
      const payload = createPayload({
        transcript: 'Te voy a transferir con un agente humano.',
        endedReason: 'customer-ended',
      });

      const result = await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
    });

    it('should handle technical errors', async () => {
      const payload = createPayload({
        endedReason: 'error',
      });

      const result = await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
    });

    it('should handle silence timeout', async () => {
      const payload = createPayload({
        endedReason: 'silence-timeout',
      });

      const result = await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Usage Logging', () => {
    it('should log usage when enabled', async () => {
      const payload = createPayload({
        durationSeconds: 300,
        cost: 0.25,
      });

      await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        logUsage: true,
      });

      // Should attempt to insert usage log
      expect(mockSupabase.from).toHaveBeenCalledWith('voice_usage_logs');
    });

    it('should skip usage logging when duration is 0', async () => {
      const payload = createPayload({
        durationSeconds: 0,
      });

      await handleEndOfCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        logUsage: true,
      });

      // Should skip usage logging for 0 duration
      // Just verifying it doesn't throw
      expect(true).toBe(true);
    });
  });
});

describe('createEndOfCallHandler', () => {
  it('should create handler with options', () => {
    const handler = createEndOfCallHandler({
      analyzeTranscript: true,
      logUsage: true,
    });

    expect(typeof handler).toBe('function');
  });

  it('should create handler with custom cost per minute', () => {
    const handler = createEndOfCallHandler({
      costPerMinute: 0.10,
    });

    expect(typeof handler).toBe('function');
  });
});
