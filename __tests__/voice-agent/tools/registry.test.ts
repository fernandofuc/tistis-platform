/**
 * TIS TIS Platform - Voice Agent v2.0
 * Tool Registry Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ToolRegistry,
  createToolContext,
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
} from '@/lib/voice-agent/tools';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
} as unknown as ToolContext['supabase'];

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        category: 'info',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'Test param' },
          },
          required: ['param1'],
        },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      };

      registry.register(tool);
      expect(registry.has('test_tool')).toBe(true);
    });

    it('should warn but allow overwriting duplicate tool names', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const tool: ToolDefinition = {
        name: 'duplicate_tool',
        description: 'Test',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      };

      registry.register(tool);
      registry.register(tool); // Should warn but not throw

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('already registered')
      );
      expect(registry.has('duplicate_tool')).toBe(true);

      warnSpy.mockRestore();
    });
  });

  describe('get', () => {
    it('should return tool by name', () => {
      const tool: ToolDefinition = {
        name: 'get_test',
        description: 'Test',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      };

      registry.register(tool);
      const result = registry.get('get_test');

      expect(result).toBeDefined();
      expect(result?.name).toBe('get_test');
    });

    it('should return undefined for non-existent tool', () => {
      expect(registry.get('non_existent')).toBeUndefined();
    });
  });

  describe('getForType', () => {
    beforeEach(() => {
      registry.register({
        name: 'rest_tool',
        description: 'Restaurant tool',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['rest_basic', 'rest_complete'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'dental_tool',
        description: 'Dental tool',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['dental_basic', 'dental_complete'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'common_tool',
        description: 'Common tool',
        category: 'utility',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });
    });

    it('should return tools for restaurant type', () => {
      const tools = registry.getForType('rest_basic');
      const names = tools.map(t => t.name);

      expect(names).toContain('rest_tool');
      expect(names).toContain('common_tool');
      expect(names).not.toContain('dental_tool');
    });

    it('should return tools for dental type', () => {
      const tools = registry.getForType('dental_basic');
      const names = tools.map(t => t.name);

      expect(names).toContain('dental_tool');
      expect(names).toContain('common_tool');
      expect(names).not.toContain('rest_tool');
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      registry.register({
        name: 'booking_tool',
        description: 'Booking tool',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
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
    });

    it('should return tools by category', () => {
      const bookingTools = registry.getByCategory('booking');
      expect(bookingTools).toHaveLength(1);
      expect(bookingTools[0].name).toBe('booking_tool');

      const infoTools = registry.getByCategory('info');
      expect(infoTools).toHaveLength(1);
      expect(infoTools[0].name).toBe('info_tool');
    });
  });

  describe('requiresConfirmation', () => {
    beforeEach(() => {
      registry.register({
        name: 'confirm_tool',
        description: 'Needs confirmation',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: true,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'no_confirm_tool',
        description: 'No confirmation',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });
    });

    it('should return true for tools requiring confirmation', () => {
      expect(registry.requiresConfirmation('confirm_tool')).toBe(true);
    });

    it('should return false for tools not requiring confirmation', () => {
      expect(registry.requiresConfirmation('no_confirm_tool')).toBe(false);
    });

    it('should return false for non-existent tools', () => {
      expect(registry.requiresConfirmation('non_existent')).toBe(false);
    });
  });

  describe('getConfirmationMessage', () => {
    it('should return confirmation message from function', () => {
      registry.register({
        name: 'func_confirm',
        description: 'Test',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: true,
        enabledFor: ['*'],
        confirmationMessage: (params) => `Confirm for ${(params as { name: string }).name}?`,
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      const message = registry.getConfirmationMessage('func_confirm', { name: 'John' });
      expect(message).toBe('Confirm for John?');
    });

    it('should return confirmation message from template', () => {
      registry.register({
        name: 'template_confirm',
        description: 'Test',
        category: 'booking',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: true,
        enabledFor: ['*'],
        confirmationTemplate: 'Confirm reservation for {date} at {time}?',
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      const message = registry.getConfirmationMessage('template_confirm', {
        date: '2024-01-15',
        time: '18:00',
      });
      expect(message).toBe('Confirm reservation for 2024-01-15 at 18:00?');
    });

    it('should return null for tools without confirmation', () => {
      registry.register({
        name: 'no_confirm',
        description: 'Test',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      expect(registry.getConfirmationMessage('no_confirm', {})).toBeNull();
    });
  });

  describe('validateParameters', () => {
    beforeEach(() => {
      registry.register({
        name: 'validate_test',
        description: 'Test',
        category: 'info',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name' },
            age: { type: 'integer', description: 'Age', minimum: 0 },
            email: { type: 'string', description: 'Email' },
          },
          required: ['name', 'email'],
        },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });
    });

    it('should validate required parameters', () => {
      const result = registry.validateParameters('validate_test', { name: 'John' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'email')).toBe(true);
    });

    it('should validate parameter types', () => {
      const result = registry.validateParameters('validate_test', {
        name: 'John',
        email: 'john@test.com',
        age: 'not a number',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'age' && e.code === 'type')).toBe(true);
    });

    it('should pass valid parameters', () => {
      const result = registry.validateParameters('validate_test', {
        name: 'John',
        email: 'john@test.com',
        age: 30,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('execute', () => {
    const mockContext = createToolContext({
      tenantId: 'tenant-123',
      callId: 'call-123',
      assistantType: 'rest_basic',
      channel: 'voice',
      locale: 'es',
      supabase: mockSupabase,
    });

    it('should execute tool handler', async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        success: true,
        voiceMessage: 'Tool executed',
        data: { result: 'test' },
      });

      registry.register({
        name: 'exec_test',
        description: 'Test',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: mockHandler,
      });

      const result = await registry.execute('exec_test', { param: 'value' }, mockContext);

      expect(mockHandler).toHaveBeenCalledWith({ param: 'value' }, mockContext);
      expect(result.success).toBe(true);
      expect(result.voiceMessage).toBe('Tool executed');
    });

    it('should return error result for non-existent tool', async () => {
      const result = await registry.execute('non_existent', {}, mockContext);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TOOL_NOT_FOUND');
    });

    it('should handle handler errors gracefully', async () => {
      registry.register({
        name: 'error_test',
        description: 'Test',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => {
          throw new Error('Handler failed');
        },
      });

      const result = await registry.execute('error_test', {}, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Handler failed');
    });

    it('should handle timeout', async () => {
      vi.useFakeTimers();

      registry.register({
        name: 'timeout_test',
        description: 'Test',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        timeout: 100,
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 5000));
          return { success: true, voiceMessage: 'Done' };
        },
      });

      const promise = registry.execute('timeout_test', {}, mockContext);
      vi.advanceTimersByTime(200);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');

      vi.useRealTimers();
    });
  });

  describe('getVAPIFunctions', () => {
    beforeEach(() => {
      registry.register({
        name: 'vapi_test',
        description: 'Test tool for VAPI',
        category: 'info',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['rest_basic'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });
    });

    it('should return VAPI-compatible function definitions', () => {
      const functions = registry.getVAPIFunctions('rest_basic');

      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe('vapi_test');
      expect(functions[0].description).toBe('Test tool for VAPI');
      expect(functions[0].parameters).toBeDefined();
    });

    it('should filter by assistant type', () => {
      const restFunctions = registry.getVAPIFunctions('rest_basic');
      const dentalFunctions = registry.getVAPIFunctions('dental_basic');

      expect(restFunctions).toHaveLength(1);
      expect(dentalFunctions).toHaveLength(0);
    });
  });

  describe('getToolNames', () => {
    it('should return all registered tool names', () => {
      registry.register({
        name: 'tool1',
        description: 'Test',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      registry.register({
        name: 'tool2',
        description: 'Test',
        category: 'info',
        parameters: { type: 'object', properties: {} },
        requiredCapabilities: [],
        requiresConfirmation: false,
        enabledFor: ['*'],
        handler: async () => ({ success: true, voiceMessage: 'Done' }),
      });

      const names = registry.getToolNames();
      expect(names).toContain('tool1');
      expect(names).toContain('tool2');
      expect(names).toHaveLength(2);
    });
  });
});

describe('createToolContext', () => {
  it('should create context with required fields', () => {
    const context = createToolContext({
      tenantId: 'tenant-123',
      callId: 'call-123',
      assistantType: 'rest_basic',
      channel: 'voice',
      locale: 'es',
      supabase: mockSupabase,
    });

    expect(context.tenantId).toBe('tenant-123');
    expect(context.callId).toBe('call-123');
    expect(context.assistantType).toBe('rest_basic');
    expect(context.channel).toBe('voice');
    expect(context.locale).toBe('es');
  });

  it('should include optional fields', () => {
    const context = createToolContext({
      tenantId: 'tenant-123',
      callId: 'call-123',
      assistantType: 'rest_basic',
      channel: 'voice',
      locale: 'es',
      supabase: mockSupabase,
      branchId: 'branch-456',
      vapiCallId: 'vapi-789',
      voiceConfigId: 'config-123',
    });

    expect(context.branchId).toBe('branch-456');
    expect(context.vapiCallId).toBe('vapi-789');
    expect(context.voiceConfigId).toBe('config-123');
  });

  it('should initialize entities as empty object', () => {
    const context = createToolContext({
      tenantId: 'tenant-123',
      callId: 'call-123',
      assistantType: 'rest_basic',
      channel: 'voice',
      locale: 'es',
      supabase: mockSupabase,
    });

    expect(context.entities).toEqual({});
  });
});
