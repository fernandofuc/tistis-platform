/**
 * TIS TIS Platform - Voice Agent v2.0
 * Tool System Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ToolRegistry,
  createToolContext,
  initializeTools,
  getToolsForAssistant,
  executeTool,
  toolRequiresConfirmation,
  getToolConfirmationMessage,
  type ToolContext,
} from '@/lib/voice-agent/tools';

// Mock Supabase
const createMockSupabase = () => {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  } as unknown as ToolContext['supabase'];
};

describe('Tool System Integration', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('Tool Registration Flow', () => {
    it('should register multiple tools without errors', () => {
      // Register restaurant tools
      registry.register({
        name: 'check_availability',
        description: 'Check table availability',
        category: 'booking',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date' },
            partySize: { type: 'integer', description: 'Party size' },
          },
          required: ['date'],
        },
        requiredCapabilities: ['reservations'],
        requiresConfirmation: false,
        enabledFor: ['rest_complete'],
        handler: async () => ({ success: true, voiceMessage: 'Available' }),
      });

      registry.register({
        name: 'create_reservation',
        description: 'Create a reservation',
        category: 'booking',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            time: { type: 'string' },
            partySize: { type: 'integer' },
          },
          required: ['date', 'time', 'partySize'],
        },
        requiredCapabilities: ['reservations'],
        requiresConfirmation: true,
        enabledFor: ['rest_complete'],
        confirmationMessage: (p) => `Reserve for ${(p as { partySize: number }).partySize}?`,
        handler: async () => ({ success: true, voiceMessage: 'Reserved' }),
      });

      expect(registry.getToolNames()).toHaveLength(2);
      expect(registry.has('check_availability')).toBe(true);
      expect(registry.has('create_reservation')).toBe(true);
    });
  });

  describe('Tool Execution Flow', () => {
    const mockSupabase = createMockSupabase();
    const context = createToolContext({
      tenantId: 'test-tenant',
      callId: 'test-call',
      assistantType: 'rest_complete',
      channel: 'voice',
      locale: 'es',
      supabase: mockSupabase,
    });

    beforeEach(() => {
      registry.register({
        name: 'test_tool',
        description: 'Test tool',
        category: 'info',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message' },
          },
          required: [],
        },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async (params) => ({
          success: true,
          voiceMessage: `Got: ${(params as { message?: string }).message || 'nothing'}`,
          data: params,
        }),
      });
    });

    it('should execute tool and return result', async () => {
      const result = await registry.execute(
        'test_tool',
        { message: 'Hello' },
        context
      );

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toBe('Got: Hello');
      expect(result.data).toEqual({ message: 'Hello' });
    });

    it('should validate parameters before execution', async () => {
      registry.register({
        name: 'required_params_tool',
        description: 'Test',
        category: 'info',
        parameters: {
          type: 'object',
          properties: {
            required_field: { type: 'string' },
          },
          required: ['required_field'],
        },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      const result = await registry.execute(
        'required_params_tool',
        {}, // Missing required field
        context
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAMS');
    });

    it('should check assistant type enablement', async () => {
      registry.register({
        name: 'dental_only_tool',
        description: 'Dental only',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['dental_complete'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      // Context has assistantType: 'rest_complete', not dental
      const result = await registry.execute('dental_only_tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TOOL_NOT_ENABLED');
    });
  });

  describe('Confirmation Workflow', () => {
    it('should identify tools requiring confirmation', () => {
      registry.register({
        name: 'booking_tool',
        description: 'Booking tool',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: true,
        enabledFor: ['*'],
        confirmationMessage: () => 'Are you sure?',
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'info_tool',
        description: 'Info tool',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      expect(registry.requiresConfirmation('booking_tool')).toBe(true);
      expect(registry.requiresConfirmation('info_tool')).toBe(false);
    });

    it('should generate dynamic confirmation messages', () => {
      registry.register({
        name: 'dynamic_confirm',
        description: 'Test',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: true,
        enabledFor: ['*'],
        confirmationMessage: (params) => {
          const p = params as { date?: string; time?: string };
          return `Confirm for ${p.date} at ${p.time}?`;
        },
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      const message = registry.getConfirmationMessage('dynamic_confirm', {
        date: '2024-01-15',
        time: '18:00',
      });

      expect(message).toBe('Confirm for 2024-01-15 at 18:00?');
    });
  });

  describe('VAPI Function Export', () => {
    beforeEach(() => {
      registry.register({
        name: 'rest_tool_1',
        description: 'Restaurant tool 1',
        category: 'booking',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'Param 1' },
          },
        },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['rest_complete'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'rest_tool_2',
        description: 'Restaurant tool 2',
        category: 'info',
        parameters: {
          type: 'object',
          properties: {},
        },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['rest_basic', 'rest_complete'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'dental_tool',
        description: 'Dental tool',
        category: 'booking',
        parameters: {
          type: 'object',
          properties: {},
        },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['dental_complete'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'common_tool',
        description: 'Common tool',
        category: 'utility',
        parameters: {
          type: 'object',
          properties: {},
        },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });
    });

    it('should export correct tools for restaurant complete type', () => {
      const functions = registry.getVAPIFunctions('rest_complete');
      const names = functions.map(f => f.name);

      expect(names).toContain('rest_tool_1');
      expect(names).toContain('rest_tool_2');
      expect(names).toContain('common_tool');
      expect(names).not.toContain('dental_tool');
    });

    it('should export correct tools for restaurant basic type', () => {
      const functions = registry.getVAPIFunctions('rest_basic');
      const names = functions.map(f => f.name);

      expect(names).toContain('rest_tool_2');
      expect(names).toContain('common_tool');
      expect(names).not.toContain('rest_tool_1');
      expect(names).not.toContain('dental_tool');
    });

    it('should export correct tools for dental type', () => {
      const functions = registry.getVAPIFunctions('dental_complete');
      const names = functions.map(f => f.name);

      expect(names).toContain('dental_tool');
      expect(names).toContain('common_tool');
      expect(names).not.toContain('rest_tool_1');
      expect(names).not.toContain('rest_tool_2');
    });

    it('should return VAPI-compatible function format', () => {
      const functions = registry.getVAPIFunctions('rest_complete');

      for (const func of functions) {
        expect(func).toHaveProperty('name');
        expect(func).toHaveProperty('description');
        expect(func).toHaveProperty('parameters');
        expect(func.parameters).toHaveProperty('type', 'object');
        expect(func.parameters).toHaveProperty('properties');
      }
    });
  });

  describe('Error Handling', () => {
    const mockSupabase = createMockSupabase();
    const context = createToolContext({
      tenantId: 'test-tenant',
      callId: 'test-call',
      assistantType: 'rest_complete',
      channel: 'voice',
      locale: 'es',
      supabase: mockSupabase,
    });

    it('should handle tool handler errors', async () => {
      registry.register({
        name: 'error_tool',
        description: 'Tool that throws',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => {
          throw new Error('Something went wrong');
        },
      });

      const result = await registry.execute('error_tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
      expect(result.errorCode).toBe('EXECUTION_ERROR');
      expect(result.voiceMessage).toBeDefined();
    });

    it('should handle non-existent tools gracefully', async () => {
      const result = await registry.execute('nonexistent', {}, context);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TOOL_NOT_FOUND');
    });
  });

  describe('Registry Statistics', () => {
    beforeEach(() => {
      registry.register({
        name: 'booking1',
        description: 'Booking',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: true,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'booking2',
        description: 'Booking',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: true,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'info1',
        description: 'Info',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });
    });

    it('should provide accurate statistics', () => {
      const stats = registry.getStats();

      expect(stats.totalTools).toBe(3);
      expect(stats.toolsByCategory.booking).toBe(2);
      expect(stats.toolsByCategory.info).toBe(1);
      expect(stats.toolsRequiringConfirmation).toBe(2);
    });
  });
});

describe('Tool System Context', () => {
  it('should create context with defaults', () => {
    const mockSupabase = createMockSupabase();
    const context = createToolContext({
      tenantId: 'tenant-1',
      callId: 'call-1',
      assistantType: 'rest_basic',
      supabase: mockSupabase,
    });

    expect(context.tenantId).toBe('tenant-1');
    expect(context.callId).toBe('call-1');
    expect(context.assistantType).toBe('rest_basic');
    expect(context.locale).toBe('es'); // Default
    expect(context.channel).toBe('voice'); // Default
    expect(context.entities).toEqual({}); // Default
  });

  it('should override defaults when provided', () => {
    const mockSupabase = createMockSupabase();
    const context = createToolContext({
      tenantId: 'tenant-1',
      callId: 'call-1',
      assistantType: 'dental_complete',
      locale: 'en',
      channel: 'whatsapp',
      entities: { date: '2024-01-15' },
      supabase: mockSupabase,
    });

    expect(context.locale).toBe('en');
    expect(context.channel).toBe('whatsapp');
    expect(context.entities).toEqual({ date: '2024-01-15' });
  });
});
