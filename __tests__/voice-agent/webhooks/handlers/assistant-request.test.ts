/**
 * TIS TIS Platform - Voice Agent v2.0
 * Assistant Request Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleAssistantRequest,
  createAssistantRequestHandler,
} from '@/lib/voice-agent/webhooks/handlers/assistant-request.handler';
import type {
  AssistantRequestPayload,
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

describe('handleAssistantRequest', () => {
  // Helper to create test context
  const createContext = (overrides: Partial<WebhookHandlerContext> = {}): WebhookHandlerContext => ({
    requestId: 'test-req-123',
    clientIp: '127.0.0.1',
    startTime: Date.now(),
    ...overrides,
  });

  // Helper to create test payload
  const createPayload = (overrides: Partial<AssistantRequestPayload> = {}): AssistantRequestPayload => ({
    type: 'assistant-request',
    call: {
      id: 'vapi-call-123',
      phoneNumber: {
        number: '+1234567890',
      },
      customer: {
        number: '+0987654321',
      },
      ...overrides.call,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should return assistant configuration for valid request', async () => {
      // Mock tenant lookup
      mockSupabase.single
        .mockResolvedValueOnce({ data: { tenant_id: 'tenant-123' } }) // Phone number lookup
        .mockResolvedValueOnce({
          data: {
            id: 'config-123',
            tenant_id: 'tenant-123',
            assistant_name: 'Test Assistant',
            first_message: 'Hello!',
            first_message_mode: 'assistant_speaks_first',
            voice_enabled: true,
            voice_id: 'voice-123',
            voice_provider: 'elevenlabs',
            voice_model: 'eleven_multilingual_v2',
            voice_stability: 0.5,
            voice_similarity_boost: 0.75,
            transcription_provider: 'deepgram',
            transcription_model: 'nova-2',
            transcription_language: 'es',
            wait_seconds: 0.6,
            on_punctuation_seconds: 0.2,
            on_no_punctuation_seconds: 1.2,
            recording_enabled: true,
            hipaa_enabled: false,
            silence_timeout_seconds: 30,
            max_duration_seconds: 600,
          },
        }) // Voice config lookup
        .mockResolvedValueOnce({ data: null }) // Existing call check
        .mockResolvedValueOnce({ data: { id: 'phone-id-123' } }) // Phone number ID lookup
        .mockResolvedValueOnce({ data: { id: 'call-id-123' } }); // Call insert

      const payload = createPayload();
      const context = createContext();

      const result = await handleAssistantRequest(payload, context, {
        supabaseClient: mockSupabase as any,
        serverUrl: 'https://api.example.com/webhook',
        serverUrlSecret: 'secret123',
        useServerSideResponse: true,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.assistant).toBeDefined();
      expect(result.response.assistant?.name).toBe('Test Assistant');
      expect(result.response.assistant?.firstMessage).toBe('Hello!');
      expect(result.response.assistant?.voice?.voiceId).toBe('voice-123');
      expect(result.response.assistant?.serverUrl).toBe('https://api.example.com/webhook');
      expect(result.response.metadata?.tenant_id).toBe('tenant-123');
    });

    it('should use existing call if found', async () => {
      // Mock tenant and config lookup
      mockSupabase.single
        .mockResolvedValueOnce({ data: { tenant_id: 'tenant-123' } })
        .mockResolvedValueOnce({
          data: {
            id: 'config-123',
            tenant_id: 'tenant-123',
            assistant_name: 'Test',
            voice_enabled: true,
            first_message: 'Hi',
          },
        })
        .mockResolvedValueOnce({ data: { id: 'existing-call-123' } }); // Existing call found

      const payload = createPayload();
      const context = createContext();

      const result = await handleAssistantRequest(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.metadata?.call_id).toBe('existing-call-123');
    });
  });

  describe('Error Cases', () => {
    it('should return 404 when tenant not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // Not found
      });

      const payload = createPayload();
      const context = createContext();

      const result = await handleAssistantRequest(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(404);
      expect(result.response.error).toContain('No assistant configured');
    });

    it('should return 404 when voice config not found', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { tenant_id: 'tenant-123' } })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const payload = createPayload();
      const context = createContext();

      const result = await handleAssistantRequest(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(404);
      expect(result.response.error).toContain('Voice agent not enabled');
    });

    it('should return 500 on database error', async () => {
      mockSupabase.single.mockRejectedValueOnce(new Error('Database connection failed'));

      const payload = createPayload();
      const context = createContext();

      const result = await handleAssistantRequest(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(500);
      expect(result.response.error).toBeDefined();
    });
  });

  describe('Phone Number Extraction', () => {
    it('should extract phone numbers from call object', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { tenant_id: 'tenant-123' } })
        .mockResolvedValueOnce({
          data: {
            id: 'config-123',
            tenant_id: 'tenant-123',
            assistant_name: 'Test',
            voice_enabled: true,
          },
        })
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: { id: 'call-123' } });

      const payload = createPayload({
        call: {
          id: 'call-123',
          phoneNumber: { number: '+1111111111' },
          customer: { number: '+2222222222' },
        },
      });

      await handleAssistantRequest(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      // Verify phone number was used for tenant lookup
      expect(mockSupabase.eq).toHaveBeenCalledWith('phone_number', '+1111111111');
    });

    it('should handle missing phone numbers gracefully', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      const payload = createPayload({
        call: {
          id: 'call-123',
        },
      });

      const result = await handleAssistantRequest(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(404);
    });
  });

  describe('Context Updates', () => {
    it('should update context with tenant ID', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { tenant_id: 'tenant-123' } })
        .mockResolvedValueOnce({
          data: {
            id: 'config-123',
            tenant_id: 'tenant-123',
            assistant_name: 'Test',
            voice_enabled: true,
          },
        })
        .mockResolvedValueOnce({ data: { id: 'call-123' } });

      const context = createContext();
      const payload = createPayload();

      await handleAssistantRequest(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(context.tenantId).toBe('tenant-123');
    });

    it('should update context with voice config ID', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { tenant_id: 'tenant-123' } })
        .mockResolvedValueOnce({
          data: {
            id: 'config-456',
            tenant_id: 'tenant-123',
            assistant_name: 'Test',
            voice_enabled: true,
          },
        })
        .mockResolvedValueOnce({ data: { id: 'call-123' } });

      const context = createContext();
      const payload = createPayload();

      await handleAssistantRequest(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(context.voiceConfigId).toBe('config-456');
    });
  });
});

describe('createAssistantRequestHandler', () => {
  it('should create handler with options', () => {
    const handler = createAssistantRequestHandler({
      serverUrl: 'https://example.com',
      useServerSideResponse: true,
    });

    expect(typeof handler).toBe('function');
  });
});
