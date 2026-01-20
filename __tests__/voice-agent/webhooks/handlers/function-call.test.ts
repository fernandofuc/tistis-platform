/**
 * TIS TIS Platform - Voice Agent v2.0
 * Function Call Handler Tests
 */

import {
  handleFunctionCall,
  handleToolCalls,
  createFunctionCallHandler,
  createToolCallsHandler,
  type FunctionExecutor,
  type FunctionExecutionContext,
} from '@/lib/voice-agent/webhooks/handlers/function-call.handler';
import type {
  FunctionCallPayload,
  ToolCallsPayload,
  WebhookHandlerContext,
} from '@/lib/voice-agent/webhooks/types';

// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

describe('handleFunctionCall', () => {
  // Helper to create test context
  const createContext = (overrides: Partial<WebhookHandlerContext> = {}): WebhookHandlerContext => ({
    requestId: 'test-req-123',
    clientIp: '127.0.0.1',
    startTime: Date.now(),
    tenantId: 'tenant-123',
    ...overrides,
  });

  // Helper to create test payload
  const createPayload = (overrides: Partial<FunctionCallPayload> = {}): FunctionCallPayload => ({
    type: 'function-call',
    call: {
      id: 'vapi-call-123',
    },
    functionCall: {
      id: 'fc-123',
      name: 'get_business_hours',
      parameters: {},
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.single.mockResolvedValue({ data: { id: 'call-123', tenant_id: 'tenant-123' } });
  });

  describe('Success Cases', () => {
    it('should execute function and return result', async () => {
      const payload = createPayload();
      const context = createContext();

      const result = await handleFunctionCall(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.result).toBeDefined();
    });

    it('should use custom function executor', async () => {
      const customExecutor: FunctionExecutor = jest.fn().mockResolvedValue({
        success: true,
        result: { message: 'Custom result' },
        voiceMessage: 'Custom voice message',
      });

      const payload = createPayload();
      const context = createContext();

      const result = await handleFunctionCall(payload, context, {
        supabaseClient: mockSupabase as any,
        functionExecutor: customExecutor,
      });

      expect(customExecutor).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
      expect(result.response.result).toBe('Custom voice message');
    });

    it('should handle get_business_hours function', async () => {
      const payload = createPayload({
        functionCall: {
          id: 'fc-123',
          name: 'get_business_hours',
          parameters: {},
        },
      });

      const result = await handleFunctionCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.result).toContain('horario');
    });

    it('should handle check_availability function', async () => {
      const payload = createPayload({
        functionCall: {
          id: 'fc-123',
          name: 'check_availability',
          parameters: { date: '2024-01-15', time: '14:00' },
        },
      });

      const result = await handleFunctionCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.result).toContain('disponibilidad');
    });

    it('should handle create_reservation function', async () => {
      const payload = createPayload({
        functionCall: {
          id: 'fc-123',
          name: 'create_reservation',
          parameters: { date: '2024-01-15', guests: 4 },
        },
      });

      const result = await handleFunctionCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.result).toContain('confirmada');
    });

    it('should handle transfer_to_human function', async () => {
      const payload = createPayload({
        functionCall: {
          id: 'fc-123',
          name: 'transfer_to_human',
          parameters: {},
        },
      });

      const result = await handleFunctionCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.result).toContain('transferir');
    });

    it('should handle unknown function with generic response', async () => {
      const payload = createPayload({
        functionCall: {
          id: 'fc-123',
          name: 'unknown_function',
          parameters: {},
        },
      });

      const result = await handleFunctionCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      // Should return a voice message even for unknown functions
      expect(result.response.result).toBeDefined();
    });
  });

  describe('Error Cases', () => {
    it('should return error when function name is missing', async () => {
      const payload = createPayload({
        functionCall: {
          id: 'fc-123',
          name: '',
          parameters: {},
        },
      });

      const result = await handleFunctionCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(400);
      expect(result.response.error).toContain('required');
    });

    it('should return error when function is not allowed', async () => {
      const payload = createPayload({
        functionCall: {
          id: 'fc-123',
          name: 'restricted_function',
          parameters: {},
        },
      });

      const result = await handleFunctionCall(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        allowedFunctions: ['get_business_hours', 'check_availability'],
      });

      expect(result.statusCode).toBe(403);
      expect(result.response.error).toContain('not available');
    });

    it('should handle executor errors gracefully', async () => {
      const failingExecutor: FunctionExecutor = jest.fn().mockRejectedValue(
        new Error('Execution failed')
      );

      const payload = createPayload();
      const context = createContext();

      const result = await handleFunctionCall(payload, context, {
        supabaseClient: mockSupabase as any,
        functionExecutor: failingExecutor,
      });

      // Should return 200 with error message (VAPI expects 200)
      expect(result.statusCode).toBe(200);
      expect(result.response.error).toBeDefined();
    });

    it('should handle executor returning failure', async () => {
      const failingExecutor: FunctionExecutor = jest.fn().mockResolvedValue({
        success: false,
        error: 'Function failed',
      });

      const payload = createPayload();
      const context = createContext();

      const result = await handleFunctionCall(payload, context, {
        supabaseClient: mockSupabase as any,
        functionExecutor: failingExecutor,
      });

      expect(result.statusCode).toBe(200);
      expect(result.response.error).toBeDefined();
    });
  });

  describe('Metadata', () => {
    it('should include processing time in metadata', async () => {
      const payload = createPayload();
      const context = createContext();

      const result = await handleFunctionCall(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(result.metadata?.processingTimeMs).toBeDefined();
      expect(typeof result.metadata?.processingTimeMs).toBe('number');
    });

    it('should include function name in metadata', async () => {
      const payload = createPayload();
      const context = createContext();

      const result = await handleFunctionCall(payload, context, {
        supabaseClient: mockSupabase as any,
      });

      expect(result.metadata?.functionName).toBe('get_business_hours');
    });
  });
});

describe('handleToolCalls', () => {
  const createContext = (): WebhookHandlerContext => ({
    requestId: 'test-req-123',
    clientIp: '127.0.0.1',
    startTime: Date.now(),
    tenantId: 'tenant-123',
  });

  const createPayload = (toolCalls: Array<{ name: string; arguments: string }>): ToolCallsPayload => ({
    type: 'tool-calls',
    call: { id: 'vapi-call-123' },
    toolCallList: toolCalls.map((tc, i) => ({
      id: `tool-call-${i}`,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: tc.arguments,
      },
    })),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.single.mockResolvedValue({ data: { id: 'call-123', tenant_id: 'tenant-123' } });
  });

  it('should execute multiple tool calls', async () => {
    const payload = createPayload([
      { name: 'get_business_hours', arguments: '{}' },
      { name: 'get_business_info', arguments: '{}' },
    ]);

    const result = await handleToolCalls(payload, createContext(), {
      supabaseClient: mockSupabase as any,
    });

    expect(result.statusCode).toBe(200);
    expect(result.response.results).toHaveLength(2);
    expect(result.response.results[0].toolCallId).toBe('tool-call-0');
    expect(result.response.results[1].toolCallId).toBe('tool-call-1');
  });

  it('should handle partial failures', async () => {
    const customExecutor: FunctionExecutor = jest.fn()
      .mockResolvedValueOnce({ success: true, result: { message: 'Success' } })
      .mockResolvedValueOnce({ success: false, error: 'Failed' });

    const payload = createPayload([
      { name: 'func1', arguments: '{}' },
      { name: 'func2', arguments: '{}' },
    ]);

    const result = await handleToolCalls(payload, createContext(), {
      supabaseClient: mockSupabase as any,
      functionExecutor: customExecutor,
    });

    expect(result.statusCode).toBe(200);
    expect(result.response.results[0].result).toBeDefined();
    expect(result.response.results[1].error).toBeDefined();
  });

  it('should include metadata with counts', async () => {
    const payload = createPayload([
      { name: 'get_business_hours', arguments: '{}' },
      { name: 'get_menu', arguments: '{}' },
    ]);

    const result = await handleToolCalls(payload, createContext(), {
      supabaseClient: mockSupabase as any,
    });

    expect(result.metadata?.toolCount).toBe(2);
    expect(result.metadata?.successCount).toBe(2);
    expect(result.metadata?.processingTimeMs).toBeDefined();
  });

  it('should handle invalid JSON in arguments', async () => {
    const payload = createPayload([
      { name: 'get_business_hours', arguments: 'invalid-json' },
    ]);

    const result = await handleToolCalls(payload, createContext(), {
      supabaseClient: mockSupabase as any,
    });

    // Should not fail, just use empty params
    expect(result.statusCode).toBe(200);
    expect(result.response.results).toHaveLength(1);
  });
});

describe('Factory Functions', () => {
  describe('createFunctionCallHandler', () => {
    it('should create handler with options', () => {
      const handler = createFunctionCallHandler({
        defaultLocale: 'en',
      });

      expect(typeof handler).toBe('function');
    });
  });

  describe('createToolCallsHandler', () => {
    it('should create handler with options', () => {
      const handler = createToolCallsHandler({
        defaultLocale: 'en',
      });

      expect(typeof handler).toBe('function');
    });
  });
});
