/**
 * TIS TIS Platform - Voice Agent v2.0
 * Common Tools Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  transferToHuman,
  getBusinessHours,
  endCall,
} from '@/lib/voice-agent/tools';
import { createToolContext, type ToolContext } from '@/lib/voice-agent/tools';

// Mock Supabase client type for tests
interface MockSupabaseChain {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

const createMockSupabase = (overrides: Record<string, unknown> = {}): MockSupabaseChain & ToolContext['supabase'] => {
  const mockChain: MockSupabaseChain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };

  return mockChain as MockSupabaseChain & ToolContext['supabase'];
};

const createTestContext = (
  supabase: ToolContext['supabase'],
  overrides: Partial<ToolContext> = {}
): ToolContext =>
  createToolContext({
    tenantId: 'tenant-123',
    callId: 'call-123',
    assistantType: 'rest_complete',
    channel: 'voice',
    locale: 'es',
    supabase,
    ...overrides,
  });

describe('Common Tools', () => {
  describe('transferToHuman', () => {
    it('should have correct tool definition', () => {
      expect(transferToHuman.name).toBe('transfer_to_human');
      expect(transferToHuman.category).toBe('transfer');
      expect(transferToHuman.requiresConfirmation).toBe(true);
    });

    it('should require reason parameter', () => {
      expect(transferToHuman.parameters.required).toContain('reason');
    });

    it('should be enabled for all assistant types', () => {
      expect(transferToHuman.enabledFor).toContain('rest_basic');
      expect(transferToHuman.enabledFor).toContain('rest_complete');
      expect(transferToHuman.enabledFor).toContain('dental_basic');
      expect(transferToHuman.enabledFor).toContain('dental_complete');
    });

    it('should generate confirmation message', () => {
      const message = transferToHuman.confirmationMessage?.({
        reason: 'Customer wants to speak to manager',
        department: 'manager',
      });

      expect(message).toBeDefined();
      expect(message).toContain('supervisor');
    });

    it('should generate different messages for departments', () => {
      const salesMsg = transferToHuman.confirmationMessage?.({
        reason: 'Sales inquiry',
        department: 'sales',
      });

      const supportMsg = transferToHuman.confirmationMessage?.({
        reason: 'Technical issue',
        department: 'support',
      });

      expect(salesMsg).toContain('ventas');
      expect(supportMsg).toContain('soporte');
    });

    it('should handle transfer when enabled', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          transfer_config: {
            enabled: true,
            departments: {
              general: { phone: '+525551234567' },
            },
            fallback_phone: '+525551234567',
          },
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await transferToHuman.handler(
        { reason: 'Customer request' },
        context
      );

      expect(result.success).toBe(true);
      // Message should indicate transfer action (Spanish: transfiriendo)
      expect(result.voiceMessage?.toLowerCase()).toContain('transfiriendo');
      expect(result.data?.action).toBe('transfer');
    });

    it('should fail when transfers not enabled', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          transfer_config: {
            enabled: false,
          },
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await transferToHuman.handler(
        { reason: 'Customer request' },
        context
      );

      expect(result.success).toBe(false);
      expect(result.voiceMessage).toContain('no puedo transferir');
    });

    it('should handle priority levels', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          transfer_config: {
            enabled: true,
            departments: { general: { phone: '+525551234567' } },
          },
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await transferToHuman.handler(
        { reason: 'Emergency', priority: 'urgent' },
        context
      );

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toContain('urgente');
    });
  });

  describe('getBusinessHours', () => {
    it('should have correct tool definition', () => {
      expect(getBusinessHours.name).toBe('get_business_hours');
      expect(getBusinessHours.category).toBe('info');
      expect(getBusinessHours.requiresConfirmation).toBe(false);
    });

    it('should be enabled for all assistant types', () => {
      expect(getBusinessHours.enabledFor).toContain('rest_basic');
      expect(getBusinessHours.enabledFor).toContain('dental_basic');
    });

    it('should return business hours from branch', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                name: 'Sucursal Centro',
                hours: {
                  monday: { open: '09:00', close: '18:00' },
                  tuesday: { open: '09:00', close: '18:00' },
                  wednesday: { open: '09:00', close: '18:00' },
                  thursday: { open: '09:00', close: '18:00' },
                  friday: { open: '09:00', close: '18:00' },
                  saturday: { open: '10:00', close: '14:00' },
                  sunday: { closed: true },
                },
                timezone: 'America/Mexico_City',
              },
              error: null,
            }),
          };
        }
        return mockSupabase;
      });

      const context = createTestContext(mockSupabase);
      const result = await getBusinessHours.handler({}, context);

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toBeDefined();
      expect(result.data?.hours).toBeDefined();
    });

    it('should return specific day hours', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            hours: {
              monday: { open: '09:00', close: '18:00' },
              saturday: { open: '10:00', close: '14:00' },
            },
          },
          error: null,
        }),
      }));

      const context = createTestContext(mockSupabase);
      const result = await getBusinessHours.handler({ day: 'lunes' }, context);

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toContain('Lunes');
    });

    it('should handle today/tomorrow', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            hours: {
              monday: { open: '09:00', close: '18:00' },
              tuesday: { open: '09:00', close: '18:00' },
              wednesday: { open: '09:00', close: '18:00' },
              thursday: { open: '09:00', close: '18:00' },
              friday: { open: '09:00', close: '18:00' },
              saturday: { open: '10:00', close: '14:00' },
              sunday: { closed: true },
            },
          },
          error: null,
        }),
      }));

      const context = createTestContext(mockSupabase);
      const result = await getBusinessHours.handler({ day: 'hoy' }, context);

      expect(result.success).toBe(true);
    });

    it('should handle closed days', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            hours: {
              sunday: { closed: true },
            },
          },
          error: null,
        }),
      }));

      const context = createTestContext(mockSupabase);
      const result = await getBusinessHours.handler({ day: 'domingo' }, context);

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toContain('cerrado');
    });

    it('should fallback to voice_config', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          };
        }
        if (table === 'voice_configs') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                business_hours: {
                  monday: { open: '08:00', close: '20:00' },
                },
              },
              error: null,
            }),
          };
        }
        return mockSupabase;
      });

      const context = createTestContext(mockSupabase);
      const result = await getBusinessHours.handler({}, context);

      expect(result.success).toBe(true);
    });
  });

  describe('endCall', () => {
    it('should have correct tool definition', () => {
      expect(endCall.name).toBe('end_call');
      expect(endCall.category).toBe('call');
      expect(endCall.requiresConfirmation).toBe(false);
    });

    it('should be enabled for all assistant types', () => {
      expect(endCall.enabledFor).toContain('rest_basic');
      expect(endCall.enabledFor).toContain('dental_basic');
    });

    it('should end call with default message', async () => {
      const mockSupabase = createMockSupabase();
      const context = createTestContext(mockSupabase, { vapiCallId: 'vapi-123' });

      const result = await endCall.handler({}, context);

      expect(result.success).toBe(true);
      expect(result.endCall).toBe(true);
      // Message can contain "gracias" in different cases
      expect(result.voiceMessage?.toLowerCase()).toContain('gracias');
    });

    it('should end call with reason-specific message', async () => {
      const mockSupabase = createMockSupabase();
      const context = createTestContext(mockSupabase);

      const userRequestResult = await endCall.handler(
        { reason: 'user_request' },
        context
      );
      expect(userRequestResult.voiceMessage).toContain('Gracias por llamar');

      const errorResult = await endCall.handler({ reason: 'error' }, context);
      expect(errorResult.voiceMessage).toContain('Disculpe');
    });

    it('should include summary in message if provided', async () => {
      const mockSupabase = createMockSupabase();
      const context = createTestContext(mockSupabase);

      const result = await endCall.handler(
        {
          reason: 'completed',
          summary: 'Su reservación ha sido confirmada',
        },
        context
      );

      expect(result.voiceMessage).toContain('confirmada');
    });

    it('should log call completion', async () => {
      const mockSupabase = createMockSupabase();
      const context = createTestContext(mockSupabase, { vapiCallId: 'vapi-123' });

      await endCall.handler({ reason: 'completed' }, context);

      expect(mockSupabase.from).toHaveBeenCalledWith('call_logs');
    });
  });
});

describe('Common Tools Integration', () => {
  it('should have all common tools enabled for multiple assistant types', () => {
    const commonTools = [transferToHuman, getBusinessHours, endCall];

    for (const tool of commonTools) {
      // Should work with both restaurant and dental
      const hasRest = tool.enabledFor.some(t => t.includes('rest') || t === '*');
      const hasDental = tool.enabledFor.some(t => t.includes('dental') || t === '*');

      expect(hasRest || tool.enabledFor.includes('*')).toBe(true);
      expect(hasDental || tool.enabledFor.includes('*')).toBe(true);
    }
  });

  it('should have proper timeout values', () => {
    const commonTools = [transferToHuman, getBusinessHours, endCall];

    for (const tool of commonTools) {
      if (tool.timeout) {
        expect(tool.timeout).toBeGreaterThan(0);
        expect(tool.timeout).toBeLessThanOrEqual(10000);
      }
    }
  });

  it('should support both Spanish and English locales', async () => {
    const mockSupabase = createMockSupabase();
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          hours: { monday: { open: '09:00', close: '18:00' } },
        },
        error: null,
      }),
    }));

    const esContext = createTestContext(mockSupabase, { locale: 'es' });
    const enContext = createTestContext(mockSupabase, { locale: 'en' });

    const esResult = await getBusinessHours.handler({ day: 'monday' }, esContext);
    const enResult = await getBusinessHours.handler({ day: 'monday' }, enContext);

    // Both should succeed
    expect(esResult.success).toBe(true);
    expect(enResult.success).toBe(true);

    // Messages should be in appropriate language
    expect(esResult.voiceMessage).toMatch(/Lunes|abierto/i);
    expect(enResult.voiceMessage).toMatch(/Monday|open/i);
  });
});
