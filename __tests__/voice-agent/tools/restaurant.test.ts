/**
 * TIS TIS Platform - Voice Agent v2.0
 * Restaurant Tools Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  checkAvailability as restaurantCheckAvailability,
  createReservation,
  modifyReservation,
  cancelReservation,
  getMenu,
  createOrder,
} from '@/lib/voice-agent/tools/restaurant';
import { createToolContext, type ToolContext } from '@/lib/voice-agent/tools';

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
    assistantType: 'rest_complete',
    channel: 'voice',
    locale: 'es',
    supabase,
    branchId: 'branch-456',
    vapiCallId: 'vapi-789',
  });

describe('Restaurant Tools', () => {
  describe('checkAvailability', () => {
    it('should have correct tool definition', () => {
      expect(restaurantCheckAvailability.name).toBe('check_availability');
      expect(restaurantCheckAvailability.category).toBe('booking');
      expect(restaurantCheckAvailability.requiresConfirmation).toBe(false);
    });

    it('should require date parameter', () => {
      expect(restaurantCheckAvailability.parameters.required).toContain('date');
    });

    it('should handle successful availability check via RPC', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          available: true,
          slots: ['18:00', '18:30', '19:00'],
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await restaurantCheckAvailability.handler(
        { date: '2030-01-15', time: '18:00', partySize: 4 },
        context
      );

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toBeDefined();
      expect(result.data?.available).toBe(true);
    });

    it('should reject past dates', async () => {
      const mockSupabase = createMockSupabase();
      const context = createTestContext(mockSupabase);

      // Use local date format to avoid timezone issues
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const year = pastDate.getFullYear();
      const month = String(pastDate.getMonth() + 1).padStart(2, '0');
      const day = String(pastDate.getDate()).padStart(2, '0');
      const pastDateStr = `${year}-${month}-${day}`;

      const result = await restaurantCheckAvailability.handler(
        { date: pastDateStr, partySize: 2 },
        context
      );

      expect(result.success).toBe(false);
      expect(result.voiceMessage).toContain('pasó');
    });

    it('should provide alternatives when not available', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          available: false,
          slots: [],
          alternatives: ['18:30', '19:00'],
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await restaurantCheckAvailability.handler(
        { date: '2030-01-15', time: '18:00', partySize: 4 },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data?.available).toBe(false);
    });
  });

  describe('createReservation', () => {
    it('should have correct tool definition', () => {
      expect(createReservation.name).toBe('create_reservation');
      expect(createReservation.category).toBe('booking');
      expect(createReservation.requiresConfirmation).toBe(true);
    });

    it('should require essential parameters', () => {
      const required = createReservation.parameters.required || [];
      expect(required).toContain('date');
      expect(required).toContain('time');
      expect(required).toContain('partySize');
      expect(required).toContain('customerName');
      expect(required).toContain('customerPhone');
    });

    it('should generate confirmation message', () => {
      const message = createReservation.confirmationMessage?.({
        date: '2030-01-15',
        time: '18:00',
        partySize: 4,
        customerName: 'Juan',
        customerPhone: '5551234567',
      });

      expect(message).toBeDefined();
      expect(message).toContain('Juan');
      expect(message).toContain('4');
    });

    it('should create reservation successfully', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          reservation_id: 'res-123',
          confirmation_code: 'ABC123',
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await createReservation.handler(
        {
          date: '2030-01-15',
          time: '18:00',
          partySize: 4,
          customerName: 'Juan García',
          customerPhone: '5551234567',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toContain('confirmada');
      expect(result.data?.confirmationCode).toBeDefined();
    });

    it('should handle unavailable slot', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Slot not available' },
      });

      (mockSupabase.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Conflict' },
      });

      const context = createTestContext(mockSupabase);
      const result = await createReservation.handler(
        {
          date: '2030-01-15',
          time: '18:00',
          partySize: 4,
          customerName: 'Juan',
          customerPhone: '5551234567',
        },
        context
      );

      expect(result.success).toBe(false);
    });
  });

  describe('modifyReservation', () => {
    it('should have correct tool definition', () => {
      expect(modifyReservation.name).toBe('modify_reservation');
      expect(modifyReservation.requiresConfirmation).toBe(true);
    });

    it('should have confirmationCode and customerPhone as optional parameters', () => {
      // Both are optional - user can provide either one to identify the reservation
      const required = modifyReservation.parameters.required || [];
      expect(required).toEqual([]);
      // But both properties should be defined
      expect(modifyReservation.parameters.properties.confirmationCode).toBeDefined();
      expect(modifyReservation.parameters.properties.customerPhone).toBeDefined();
    });

    it('should require at least one identifier (code or phone)', async () => {
      const mockSupabase = createMockSupabase();
      const context = createTestContext(mockSupabase);

      const result = await modifyReservation.handler(
        {
          // No confirmationCode or customerPhone provided
          newTime: '19:00',
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.voiceMessage).toContain('código de confirmación o número de teléfono');
    });

    it('should find reservation by confirmation code', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'res-123',
          confirmation_code: 'ABC123',
          date: '2030-01-15',
          time: '18:00',
          customer_phone: '5551234567',
          status: 'confirmed',
        },
        error: null,
      });

      const context = createTestContext(mockSupabase);
      const result = await modifyReservation.handler(
        {
          confirmationCode: 'ABC123',
          newTime: '19:00',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toContain('actualizada');
    });
  });

  describe('cancelReservation', () => {
    it('should have correct tool definition', () => {
      expect(cancelReservation.name).toBe('cancel_reservation');
      expect(cancelReservation.requiresConfirmation).toBe(true);
    });

    it('should have confirmation template with warning', () => {
      // cancelReservation uses confirmationTemplate (static string) instead of confirmationMessage (function)
      expect(cancelReservation.confirmationTemplate).toBeDefined();
      expect(cancelReservation.confirmationTemplate).toContain('cancelar');
    });

    it('should cancel reservation', async () => {
      const mockSupabase = createMockSupabase();
      (mockSupabase.single as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          data: {
            id: 'res-123',
            date: '2030-01-15',
            time: '18:00',
            customer_phone: '5551234567',
            status: 'confirmed',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const context = createTestContext(mockSupabase);
      const result = await cancelReservation.handler(
        {
          confirmationCode: 'ABC123',
          customerPhone: '5551234567',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toContain('cancelada');
    });
  });

  describe('getMenu', () => {
    it('should have correct tool definition', () => {
      expect(getMenu.name).toBe('get_menu');
      expect(getMenu.category).toBe('info');
      expect(getMenu.requiresConfirmation).toBe(false);
    });

    it('should return menu items', async () => {
      const mockSupabase = createMockSupabase();

      // Mock the select chain to return menu items
      const mockItems = [
        { id: '1', name: 'Tacos al pastor', description: 'Delicious tacos', price: 45, category: 'Tacos' },
        { id: '2', name: 'Burrito', description: 'Big burrito', price: 65, category: 'Burritos' },
      ];

      // Create a proper chain mock
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
      }));

      const context = createTestContext(mockSupabase);
      const result = await getMenu.handler({}, context);

      expect(result.success).toBe(true);
      expect(result.voiceMessage).toBeDefined();
    });

    it('should filter by category', async () => {
      const mockSupabase = createMockSupabase();

      const mockItems = [
        { id: '1', name: 'Tacos al pastor', description: 'Tacos', price: 45, category: 'Tacos' },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
      }));

      const context = createTestContext(mockSupabase);
      const result = await getMenu.handler({ category: 'Tacos' }, context);

      expect(result.success).toBe(true);
    });
  });

  describe('createOrder', () => {
    it('should have correct tool definition', () => {
      expect(createOrder.name).toBe('create_order');
      expect(createOrder.category).toBe('order');
      expect(createOrder.requiresConfirmation).toBe(true);
    });

    it('should require essential parameters', () => {
      const required = createOrder.parameters.required || [];
      expect(required).toContain('items');
      expect(required).toContain('deliveryType');
      expect(required).toContain('customerName');
      expect(required).toContain('customerPhone');
    });

    it('should require delivery address for delivery orders', async () => {
      const mockSupabase = createMockSupabase();
      const context = createTestContext(mockSupabase);

      const result = await createOrder.handler(
        {
          items: [{ menuItemId: 'item-1', quantity: 2 }],
          deliveryType: 'delivery',
          customerName: 'Juan',
          customerPhone: '5551234567',
          // Missing deliveryAddress
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.voiceMessage).toContain('dirección');
    });

    it('should create pickup order without address', async () => {
      const mockSupabase = createMockSupabase();

      // Mock menu items query
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'menu_items') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'item-1', name: 'Tacos', price: 45, is_available: true }],
              error: null,
            }),
          };
        }
        if (table === 'orders') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'order-123', order_number: 'ORD-ABC1' },
              error: null,
            }),
          };
        }
        return mockSupabase;
      });

      const context = createTestContext(mockSupabase);
      const result = await createOrder.handler(
        {
          items: [{ menuItemId: 'item-1', quantity: 2 }],
          deliveryType: 'pickup',
          customerName: 'Juan',
          customerPhone: '5551234567',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data?.orderNumber).toBeDefined();
    });

    it('should generate confirmation message with items', () => {
      const message = createOrder.confirmationMessage?.({
        items: [
          { menuItemId: 'Tacos', quantity: 2 },
          { menuItemId: 'Burrito', quantity: 1 },
        ],
        deliveryType: 'pickup',
        customerName: 'Juan',
        customerPhone: '5551234567',
      });

      expect(message).toContain('Tacos');
      expect(message).toContain('recoger');
    });
  });
});

describe('Restaurant Tool Integration', () => {
  it('should have all restaurant tools with consistent enabledFor', () => {
    const restaurantTools = [
      restaurantCheckAvailability,
      createReservation,
      modifyReservation,
      cancelReservation,
      getMenu,
      createOrder,
    ];

    for (const tool of restaurantTools) {
      expect(tool.enabledFor).toBeDefined();
      // All should be enabled for at least rest_complete
      expect(
        tool.enabledFor.includes('rest_complete') || tool.enabledFor.includes('*')
      ).toBe(true);
    }
  });

  it('should have all restaurant tools with valid categories', () => {
    const validCategories = ['booking', 'info', 'order', 'escalation', 'utility'];
    const restaurantTools = [
      restaurantCheckAvailability,
      createReservation,
      getMenu,
      createOrder,
    ];

    for (const tool of restaurantTools) {
      expect(validCategories).toContain(tool.category);
    }
  });
});
