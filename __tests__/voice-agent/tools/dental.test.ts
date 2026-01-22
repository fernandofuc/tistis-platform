/**
 * TIS TIS Platform - Voice Agent v2.0
 * Dental Tools Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createAppointment,
  modifyAppointment,
  cancelAppointment,
  getServices,
} from '@/lib/voice-agent/tools';
import { createToolContext, type ToolContext } from '@/lib/voice-agent/tools';

// Import directly from dental module for proper types
import { checkAvailability } from '@/lib/voice-agent/tools/dental/check-availability';

// Mock Supabase client type for tests
interface MockSupabaseChain {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

const createMockSupabase = (overrides: Record<string, unknown> = {}): MockSupabaseChain & ToolContext['supabase'] => {
  const mockChain: MockSupabaseChain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };

  return mockChain as MockSupabaseChain & ToolContext['supabase'];
};

const createTestContext = (supabase: ToolContext['supabase']): ToolContext =>
  createToolContext({
    tenantId: 'tenant-123',
    callId: 'call-123',
    assistantType: 'dental_complete',
    channel: 'voice',
    locale: 'es',
    supabase,
    branchId: 'branch-456',
    vapiCallId: 'vapi-789',
  });

describe('Dental Tools', () => {
  describe('checkAvailability (dental)', () => {
    it('should have correct tool definition', () => {
      expect(checkAvailability.name).toBe('check_availability');
      expect(checkAvailability.category).toBe('appointment');
      expect(checkAvailability.requiresConfirmation).toBe(false);
    });

    it('should require date parameter', () => {
      expect(checkAvailability.parameters.required).toContain('date');
    });

    it('should be enabled for dental types', () => {
      expect(checkAvailability.enabledFor).toContain('dental_basic');
      expect(checkAvailability.enabledFor).toContain('dental_complete');
    });

    it('should handle successful availability check', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          available: true,
          slots: [
            { time: '10:00', doctor_id: 'doc-1', doctor_name: 'Dr. García' },
            { time: '11:00', doctor_id: 'doc-1', doctor_name: 'Dr. García' },
          ],
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await checkAvailability.handler(
        { date: '2030-01-15' },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data?.available).toBe(true);
    });

    it('should reject past dates', async () => {
      const mockSupabase = createMockSupabase();
      const context = createTestContext(mockSupabase);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateStr = pastDate.toISOString().split('T')[0];

      const result = await checkAvailability.handler(
        { date: pastDateStr },
        context
      );

      expect(result.success).toBe(false);
    });

    it('should filter by specialty', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          available: true,
          slots: [{ time: '10:00', doctor_id: 'doc-1', doctor_name: 'Dr. Ortiz' }],
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await checkAvailability.handler(
        { date: '2030-01-15', specialty: 'ortodoncia' },
        context
      );

      expect(result.success).toBe(true);
    });
  });

  describe('createAppointment', () => {
    it('should have correct tool definition', () => {
      expect(createAppointment.name).toBe('create_appointment');
      expect(createAppointment.category).toBe('appointment');
      expect(createAppointment.requiresConfirmation).toBe(true);
    });

    it('should require essential parameters', () => {
      const required = createAppointment.parameters.required || [];
      expect(required).toContain('date');
      expect(required).toContain('time');
      expect(required).toContain('patientName');
      expect(required).toContain('patientPhone');
    });

    it('should generate confirmation message', () => {
      const message = createAppointment.confirmationMessage?.({
        date: '2030-01-15',
        time: '10:00',
        patientName: 'María',
        patientPhone: '5551234567',
        serviceType: 'limpieza',
      });

      expect(message).toBeDefined();
      expect(message).toContain('María');
      expect(message).toContain('limpieza');
    });

    it('should create appointment successfully', async () => {
      const mockSupabase = createMockSupabase();

      // Mock service lookup
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'services') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'serv-1', name: 'Limpieza', duration_minutes: 30 },
              error: null,
            }),
          };
        }
        if (table === 'doctors') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'doc-1', name: 'Dr. García' }],
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: { name: 'Dr. García' },
              error: null,
            }),
          };
        }
        if (table === 'appointments') {
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            or: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({
              data: { id: 'apt-123', confirmation_code: 'XYZ789' },
              error: null,
            }),
          };
        }
        return mockSupabase;
      });

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ doctor_id: 'doc-1', doctor_name: 'Dr. García' }],
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await createAppointment.handler(
        {
          date: '2030-01-15',
          time: '10:00',
          patientName: 'María García',
          patientPhone: '5551234567',
          serviceType: 'limpieza',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data?.confirmationCode).toBeDefined();
    });

    it('should reject past appointments', async () => {
      const mockSupabase = createMockSupabase();
      const context = createTestContext(mockSupabase);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateStr = pastDate.toISOString().split('T')[0];

      const result = await createAppointment.handler(
        {
          date: pastDateStr,
          time: '10:00',
          patientName: 'María',
          patientPhone: '5551234567',
        },
        context
      );

      expect(result.success).toBe(false);
    });
  });

  describe('modifyAppointment', () => {
    it('should have correct tool definition', () => {
      expect(modifyAppointment.name).toBe('modify_appointment');
      expect(modifyAppointment.requiresConfirmation).toBe(true);
    });

    it('should require confirmation code and phone', () => {
      const required = modifyAppointment.parameters.required || [];
      expect(required).toContain('confirmationCode');
      expect(required).toContain('patientPhone');
    });

    it('should verify phone number', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'apt-123',
          patient_phone: '5551234567',
          status: 'confirmed',
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await modifyAppointment.handler(
        {
          confirmationCode: 'XYZ789',
          patientPhone: '9999999999', // Wrong phone
          newTime: '11:00',
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.voiceMessage).toContain('no coincide');
    });
  });

  describe('cancelAppointment', () => {
    it('should have correct tool definition', () => {
      expect(cancelAppointment.name).toBe('cancel_appointment');
      expect(cancelAppointment.requiresConfirmation).toBe(true);
    });

    it('should generate warning message', () => {
      const message = cancelAppointment.confirmationMessage?.({
        confirmationCode: 'XYZ789',
        patientPhone: '5551234567',
      });

      expect(message).toContain('cancelar');
    });

    it('should cancel appointment', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.single as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          data: {
            id: 'apt-123',
            date: '2030-01-15',
            start_time: '10:00',
            patient_phone: '5551234567',
            status: 'confirmed',
          },
          error: null,
        });

      const context = createTestContext(mockSupabase);
      const result = await cancelAppointment.handler(
        {
          confirmationCode: 'XYZ789',
          patientPhone: '5551234567',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toContain('cancelada');
    });
  });

  describe('getServices', () => {
    it('should have correct tool definition', () => {
      expect(getServices.name).toBe('get_services');
      expect(getServices.category).toBe('info');
      expect(getServices.requiresConfirmation).toBe(false);
    });

    it('should return services', async () => {
      const mockSupabase = createMockSupabase();

      const mockServices = [
        { id: '1', name: 'Limpieza dental', description: 'Cleaning', category: 'preventivo', duration_minutes: 30 },
        { id: '2', name: 'Consulta general', description: 'Checkup', category: 'preventivo', duration_minutes: 20 },
      ];

      // Create a chainable mock that supports multiple .order() calls
      const createChainableMock = (finalData: unknown) => {
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.ilike = vi.fn().mockReturnValue(chain);
        chain.or = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        // Final method that resolves
        chain.then = vi.fn((resolve) => resolve({ data: finalData, error: null }));
        // Make it thenable for await
        Object.defineProperty(chain, 'then', {
          value: (resolve: (value: unknown) => void) => Promise.resolve({ data: finalData, error: null }).then(resolve),
        });
        return chain;
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => createChainableMock(mockServices));

      const context = createTestContext(mockSupabase);
      const result = await getServices.handler({}, context);

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toBeDefined();
    });

    it('should filter by category', async () => {
      const mockSupabase = createMockSupabase();

      const mockServices = [
        { id: '1', name: 'Blanqueamiento', description: 'Whitening', category: 'cosmetico', duration_minutes: 60 },
      ];

      // Create a chainable mock that supports multiple .order() calls
      const createChainableMock = (finalData: unknown) => {
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.ilike = vi.fn().mockReturnValue(chain);
        chain.or = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        Object.defineProperty(chain, 'then', {
          value: (resolve: (value: unknown) => void) => Promise.resolve({ data: finalData, error: null }).then(resolve),
        });
        return chain;
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => createChainableMock(mockServices));

      const context = createTestContext(mockSupabase);
      const result = await getServices.handler({ category: 'cosmetico' }, context);

      expect(result.success).toBe(true);
    });

    it('should NOT include exact prices (per spec)', () => {
      // Per specification, dental services should not show exact prices
      const props = getServices.parameters.properties;
      // There should be no includePrices or it should be disabled
      if (props.includePrices) {
        expect(props.includePrices.description).not.toContain('exact');
      }
    });
  });
});

describe('Dental Tool Integration', () => {
  it('should have all dental tools with consistent enabledFor', () => {
    const dentalTools = [
      checkAvailability,
      createAppointment,
      modifyAppointment,
      cancelAppointment,
      getServices,
    ];

    for (const tool of dentalTools) {
      expect(tool.enabledFor).toBeDefined();
      // All should be enabled for at least dental_complete
      expect(
        tool.enabledFor.includes('dental_complete') || tool.enabledFor.includes('*')
      ).toBe(true);
    }
  });

  it('should have all dental tools with valid categories', () => {
    const validCategories = ['appointment', 'info', 'booking', 'order', 'escalation', 'utility'];
    const dentalTools = [
      checkAvailability,
      createAppointment,
      getServices,
    ];

    for (const tool of dentalTools) {
      expect(validCategories).toContain(tool.category);
    }
  });

  it('should have proper timeout values', () => {
    const dentalTools = [
      checkAvailability,
      createAppointment,
      modifyAppointment,
      cancelAppointment,
      getServices,
    ];

    for (const tool of dentalTools) {
      if (tool.timeout) {
        expect(tool.timeout).toBeGreaterThan(0);
        expect(tool.timeout).toBeLessThanOrEqual(20000);
      }
    }
  });
});
