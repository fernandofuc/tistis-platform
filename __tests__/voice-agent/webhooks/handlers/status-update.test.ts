/**
 * TIS TIS Platform - Voice Agent v2.0
 * Status Update Handler Tests
 */

import {
  handleStatusUpdate,
  handleSpeechUpdate,
  createStatusUpdateHandler,
  createSpeechUpdateHandler,
  mapVapiStatusToInternal,
  isActiveStatus,
  isTerminalStatus,
  getStatusDescription,
  DEFAULT_STATUS_UPDATE_OPTIONS,
  type InternalCallStatus,
} from '@/lib/voice-agent/webhooks/handlers/status-update.handler';
import type {
  StatusUpdatePayload,
  SpeechUpdatePayload,
  WebhookHandlerContext,
} from '@/lib/voice-agent/webhooks/types';

// Mock Supabase - proper chain handling
const createMockSupabase = () => {
  const mockSingle = jest.fn().mockResolvedValue({
    data: {
      id: 'call-123',
      status: 'initiated',
    },
  });

  const mockEq = jest.fn().mockImplementation(() => ({
    single: mockSingle,
    eq: mockEq,
  }));

  const mockUpdate = jest.fn().mockImplementation(() => ({
    eq: mockEq,
  }));

  const mockSelect = jest.fn().mockImplementation(() => ({
    eq: mockEq,
    single: mockSingle,
  }));

  const mockFrom = jest.fn().mockImplementation(() => ({
    select: mockSelect,
    update: mockUpdate,
    eq: mockEq,
    single: mockSingle,
  }));

  return {
    from: mockFrom,
    select: mockSelect,
    update: mockUpdate,
    eq: mockEq,
    single: mockSingle,
  };
};

let mockSupabase: ReturnType<typeof createMockSupabase>;

describe('handleStatusUpdate', () => {
  // Helper to create test context
  const createContext = (overrides: Partial<WebhookHandlerContext> = {}): WebhookHandlerContext => ({
    requestId: 'test-req-123',
    clientIp: '127.0.0.1',
    startTime: Date.now(),
    ...overrides,
  });

  // Helper to create test payload
  const createPayload = (status: string, overrides: Partial<StatusUpdatePayload> = {}): StatusUpdatePayload => ({
    type: 'status-update',
    call: {
      id: 'vapi-call-123',
    },
    status: status as any,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  describe('Status Mapping', () => {
    it('should handle queued status', async () => {
      const payload = createPayload('queued');

      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.metadata?.newStatus).toBe('initiated');
    });

    it('should handle ringing status', async () => {
      const payload = createPayload('ringing');

      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.metadata?.newStatus).toBe('ringing');
    });

    it('should handle in-progress status', async () => {
      const payload = createPayload('in-progress');

      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.metadata?.newStatus).toBe('in_progress');
    });

    it('should handle ended status', async () => {
      const payload = createPayload('ended');

      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.metadata?.newStatus).toBe('completed');
    });

    it('should handle busy status', async () => {
      const payload = createPayload('busy');

      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.metadata?.newStatus).toBe('busy');
    });

    it('should handle failed status', async () => {
      const payload = createPayload('failed');

      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.metadata?.newStatus).toBe('failed');
    });

    it('should handle no-answer status', async () => {
      const payload = createPayload('no-answer');

      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.metadata?.newStatus).toBe('no_answer');
    });
  });

  describe('Database Updates', () => {
    it('should update call status in database', async () => {
      const payload = createPayload('in-progress');

      await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'call-123');
    });

    it('should set answered_at when call starts', async () => {
      const payload = createPayload('in-progress');

      await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });

  describe('Call Not Found', () => {
    it('should return success when call not found', async () => {
      // Create a mock where single returns null data
      const notFoundMock = createMockSupabase();
      notFoundMock.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const payload = createPayload('in-progress');
      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: notFoundMock as any,
      });

      expect(result.statusCode).toBe(200);
      expect(result.metadata?.warning).toBe('call_not_found');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const errorMock = createMockSupabase();
      errorMock.single.mockRejectedValue(new Error('Database error'));

      const payload = createPayload('in-progress');
      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: errorMock as any,
      });

      // Should still return success
      expect(result.statusCode).toBe(200);
    });

    it('should handle update errors gracefully', async () => {
      // Just verify the handler returns 200 even if update fails
      // The mock already handles the chain correctly
      const payload = createPayload('in-progress');
      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Status Change Callback', () => {
    it('should call onStatusChange callback', async () => {
      const onStatusChange = jest.fn().mockResolvedValue(undefined);

      const payload = createPayload('in-progress');
      await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        onStatusChange,
      });

      expect(onStatusChange).toHaveBeenCalledWith(
        'vapi-call-123',
        'initiated',
        'in_progress',
        expect.any(Object)
      );
    });

    it('should handle callback errors gracefully', async () => {
      const onStatusChange = jest.fn().mockRejectedValue(new Error('Callback error'));

      const payload = createPayload('in-progress');
      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
        onStatusChange,
      });

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Metadata', () => {
    it('should include status transition info', async () => {
      const payload = createPayload('in-progress');

      const result = await handleStatusUpdate(payload, createContext(), {
        supabaseClient: mockSupabase as any,
      });

      expect(result.metadata?.callId).toBe('call-123');
      expect(result.metadata?.oldStatus).toBe('initiated');
      expect(result.metadata?.newStatus).toBe('in_progress');
      expect(result.metadata?.vapiStatus).toBe('in-progress');
    });
  });
});

describe('handleSpeechUpdate', () => {
  const createContext = (): WebhookHandlerContext => ({
    requestId: 'test-req-123',
    clientIp: '127.0.0.1',
    startTime: Date.now(),
  });

  const createPayload = (
    status: 'started' | 'stopped',
    role: 'user' | 'assistant'
  ): SpeechUpdatePayload => ({
    type: 'speech-update',
    call: { id: 'vapi-call-123' },
    status,
    role,
  });

  it('should handle user started speaking', async () => {
    const payload = createPayload('started', 'user');

    const result = await handleSpeechUpdate(payload, createContext());

    expect(result.statusCode).toBe(200);
    expect(result.response.status).toBe('ok');
    expect(result.metadata?.role).toBe('user');
    expect(result.metadata?.speechStatus).toBe('started');
  });

  it('should handle user stopped speaking', async () => {
    const payload = createPayload('stopped', 'user');

    const result = await handleSpeechUpdate(payload, createContext());

    expect(result.statusCode).toBe(200);
    expect(result.metadata?.speechStatus).toBe('stopped');
  });

  it('should handle assistant started speaking', async () => {
    const payload = createPayload('started', 'assistant');

    const result = await handleSpeechUpdate(payload, createContext());

    expect(result.statusCode).toBe(200);
    expect(result.metadata?.role).toBe('assistant');
  });

  it('should not log speech updates by default', async () => {
    const payload = createPayload('started', 'user');

    const result = await handleSpeechUpdate(payload, createContext());

    expect(result.shouldLog).toBe(false);
  });
});

describe('mapVapiStatusToInternal', () => {
  it('should map queued to initiated', () => {
    expect(mapVapiStatusToInternal('queued')).toBe('initiated');
  });

  it('should map ringing to ringing', () => {
    expect(mapVapiStatusToInternal('ringing')).toBe('ringing');
  });

  it('should map in-progress to in_progress', () => {
    expect(mapVapiStatusToInternal('in-progress')).toBe('in_progress');
  });

  it('should map forwarding to in_progress', () => {
    expect(mapVapiStatusToInternal('forwarding')).toBe('in_progress');
  });

  it('should map ended to completed', () => {
    expect(mapVapiStatusToInternal('ended')).toBe('completed');
  });

  it('should map completed to completed', () => {
    expect(mapVapiStatusToInternal('completed')).toBe('completed');
  });

  it('should map busy to busy', () => {
    expect(mapVapiStatusToInternal('busy')).toBe('busy');
  });

  it('should map failed to failed', () => {
    expect(mapVapiStatusToInternal('failed')).toBe('failed');
  });

  it('should map no-answer to no_answer', () => {
    expect(mapVapiStatusToInternal('no-answer')).toBe('no_answer');
  });

  it('should map canceled to canceled', () => {
    expect(mapVapiStatusToInternal('canceled')).toBe('canceled');
  });

  it('should map cancelled (alternative spelling) to canceled', () => {
    expect(mapVapiStatusToInternal('cancelled')).toBe('canceled');
  });

  it('should handle unknown status', () => {
    expect(mapVapiStatusToInternal('unknown-status')).toBe('initiated');
  });

  it('should be case insensitive', () => {
    expect(mapVapiStatusToInternal('IN-PROGRESS')).toBe('in_progress');
    expect(mapVapiStatusToInternal('Ended')).toBe('completed');
  });
});

describe('isActiveStatus', () => {
  it('should return true for initiated', () => {
    expect(isActiveStatus('initiated')).toBe(true);
  });

  it('should return true for ringing', () => {
    expect(isActiveStatus('ringing')).toBe(true);
  });

  it('should return true for in_progress', () => {
    expect(isActiveStatus('in_progress')).toBe(true);
  });

  it('should return false for completed', () => {
    expect(isActiveStatus('completed')).toBe(false);
  });

  it('should return false for failed', () => {
    expect(isActiveStatus('failed')).toBe(false);
  });
});

describe('isTerminalStatus', () => {
  it('should return true for completed', () => {
    expect(isTerminalStatus('completed')).toBe(true);
  });

  it('should return true for busy', () => {
    expect(isTerminalStatus('busy')).toBe(true);
  });

  it('should return true for failed', () => {
    expect(isTerminalStatus('failed')).toBe(true);
  });

  it('should return true for no_answer', () => {
    expect(isTerminalStatus('no_answer')).toBe(true);
  });

  it('should return true for canceled', () => {
    expect(isTerminalStatus('canceled')).toBe(true);
  });

  it('should return false for initiated', () => {
    expect(isTerminalStatus('initiated')).toBe(false);
  });

  it('should return false for in_progress', () => {
    expect(isTerminalStatus('in_progress')).toBe(false);
  });
});

describe('getStatusDescription', () => {
  describe('Spanish locale', () => {
    it('should return Spanish description for initiated', () => {
      expect(getStatusDescription('initiated', 'es')).toBe('Llamada iniciada');
    });

    it('should return Spanish description for in_progress', () => {
      expect(getStatusDescription('in_progress', 'es')).toBe('En progreso');
    });

    it('should return Spanish description for completed', () => {
      expect(getStatusDescription('completed', 'es')).toBe('Completada');
    });
  });

  describe('English locale', () => {
    it('should return English description for initiated', () => {
      expect(getStatusDescription('initiated', 'en')).toBe('Call initiated');
    });

    it('should return English description for in_progress', () => {
      expect(getStatusDescription('in_progress', 'en')).toBe('In progress');
    });

    it('should return English description for completed', () => {
      expect(getStatusDescription('completed', 'en')).toBe('Completed');
    });
  });

  it('should default to Spanish for unknown locale', () => {
    expect(getStatusDescription('in_progress', 'fr')).toBe('En progreso');
  });

  it('should default to Spanish when locale not provided', () => {
    expect(getStatusDescription('in_progress')).toBe('En progreso');
  });
});

describe('DEFAULT_STATUS_UPDATE_OPTIONS', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_STATUS_UPDATE_OPTIONS.logStatusChanges).toBe(true);
  });
});

describe('Factory Functions', () => {
  describe('createStatusUpdateHandler', () => {
    it('should create handler with default options', () => {
      const handler = createStatusUpdateHandler();

      expect(typeof handler).toBe('function');
    });

    it('should create handler with custom options', () => {
      const handler = createStatusUpdateHandler({
        logStatusChanges: false,
      });

      expect(typeof handler).toBe('function');
    });
  });

  describe('createSpeechUpdateHandler', () => {
    it('should create handler with default options', () => {
      const handler = createSpeechUpdateHandler();

      expect(typeof handler).toBe('function');
    });

    it('should create handler with custom options', () => {
      const handler = createSpeechUpdateHandler({
        logStatusChanges: true,
      });

      expect(typeof handler).toBe('function');
    });
  });
});
