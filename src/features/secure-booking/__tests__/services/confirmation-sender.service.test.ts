// =====================================================
// TIS TIS PLATFORM - Confirmation Sender Service Tests
// FASE 5: Secure Booking System
// =====================================================

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock dependencies before imports
vi.mock('@/src/shared/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(),
            })),
          })),
          in: vi.fn(),
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(),
          })),
          single: vi.fn(),
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(),
              })),
            })),
            lt: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(),
              })),
            })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  })),
}));

vi.mock('@/src/shared/lib/whatsapp', () => ({
  whatsappClient: {
    sendTextMessage: vi.fn(),
    sendButtonMessage: vi.fn(),
    sendTemplateMessage: vi.fn(),
  },
}));

vi.mock('../templates/confirmation-templates', () => ({
  getTemplateBuilder: vi.fn(() => () => ({
    text: 'Test confirmation message',
    buttons: [
      { id: 'confirm', title: 'Confirmar' },
      { id: 'cancel', title: 'Cancelar' },
    ],
    footer: 'TIS TIS Platform',
  })),
  generateConfirmationCode: vi.fn(() => 'ABC123'),
  formatDateSpanish: vi.fn(() => 'lunes 27 de enero'),
  formatTimeSpanish: vi.fn(() => '10:30'),
  calculateHoursUntilExpiration: vi.fn(() => 4),
}));

// Import after mocks
import { createServerClient } from '@/src/shared/lib/supabase';
import { whatsappClient } from '@/src/shared/lib/whatsapp';
import {
  confirmationSenderService,
  type SendConfirmationInput,
} from '../../services/confirmation-sender.service';

describe('ConfirmationSenderService', () => {
  const mockSupabase = createServerClient as Mock;
  const mockWhatsApp = whatsappClient as unknown as {
    sendTextMessage: Mock;
    sendButtonMessage: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================
  // getInstance Tests
  // ======================

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      // The exported confirmationSenderService is already the singleton
      expect(confirmationSenderService).toBeDefined();
    });
  });

  // ======================
  // sendConfirmation Tests
  // ======================

  describe('sendConfirmation', () => {
    const createMockInput = (overrides: Partial<SendConfirmationInput> = {}): SendConfirmationInput => ({
      tenantId: 'tenant-123',
      referenceType: 'appointment',
      referenceId: 'appt-123',
      confirmationType: 'voice_to_message',
      recipientPhone: '+521234567890',
      recipientName: 'Juan Perez',
      businessName: 'Clinica Dental',
      bookingDatetime: new Date('2026-01-27T10:30:00'),
      ...overrides,
    });

    it('should create confirmation and send message successfully', async () => {
      const mockConfirmation = {
        id: 'conf-123',
        tenant_id: 'tenant-123',
        status: 'pending',
      };

      // Mock insert
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockConfirmation,
            error: null,
          }),
        }),
      });

      // Mock update
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
          update: mockUpdate,
        }),
      });

      // Mock WhatsApp send
      mockWhatsApp.sendButtonMessage.mockResolvedValue({
        messages: [{ id: 'wamid.123' }],
      });

      const input = createMockInput();
      const result = await confirmationSenderService.sendConfirmation(input);

      expect(result.success).toBe(true);
      expect(result.confirmationId).toBe('conf-123');
      expect(result.messageId).toBe('wamid.123');
    });

    it('should handle database insert failure', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const input = createMockInput();
      const result = await confirmationSenderService.sendConfirmation(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle WhatsApp send failure with retries', async () => {
      const mockConfirmation = {
        id: 'conf-123',
        tenant_id: 'tenant-123',
        status: 'pending',
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockConfirmation,
            error: null,
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
          update: mockUpdate,
        }),
      });

      // Mock WhatsApp failure
      mockWhatsApp.sendButtonMessage.mockRejectedValue(new Error('Network error'));

      const input = createMockInput();
      const result = await confirmationSenderService.sendConfirmation(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      // Should have retried (3 attempts)
      expect(mockWhatsApp.sendButtonMessage).toHaveBeenCalledTimes(3);
    });

    // Note: Testing fallback to text message is complex due to module mocking.
    // The main functionality (button message sending) is tested above.

    it('should not retry non-retryable errors', async () => {
      const mockConfirmation = {
        id: 'conf-123',
        tenant_id: 'tenant-123',
        status: 'pending',
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockConfirmation,
            error: null,
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
          update: mockUpdate,
        }),
      });

      // Non-retryable error
      mockWhatsApp.sendButtonMessage.mockRejectedValue(
        new Error('invalid phone number')
      );

      const input = createMockInput();
      const result = await confirmationSenderService.sendConfirmation(input);

      expect(result.success).toBe(false);
      // Should only try once for non-retryable errors
      expect(mockWhatsApp.sendButtonMessage).toHaveBeenCalledTimes(1);
    });
  });

  // ======================
  // markAsDelivered Tests
  // ======================

  describe('markAsDelivered', () => {
    it('should update confirmation to delivered status', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null, count: 1 }),
          }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          update: mockUpdate,
        }),
      });

      const result = await confirmationSenderService.markAsDelivered('tenant-123', 'wamid.123');

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
        })
      );
    });

    it('should return false on error', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: { message: 'Update failed' }, count: 0 }),
          }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          update: mockUpdate,
        }),
      });

      const result = await confirmationSenderService.markAsDelivered('tenant-123', 'wamid.123');

      expect(result).toBe(false);
    });

    it('should return false when missing parameters', async () => {
      const result = await confirmationSenderService.markAsDelivered('', 'wamid.123');
      expect(result).toBe(false);
    });
  });

  // ======================
  // markAsRead Tests
  // ======================

  describe('markAsRead', () => {
    it('should update confirmation to read status', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null, count: 1 }),
          }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          update: mockUpdate,
        }),
      });

      const result = await confirmationSenderService.markAsRead('tenant-123', 'wamid.123');

      expect(result).toBe(true);
    });

    it('should return false when missing parameters', async () => {
      const result = await confirmationSenderService.markAsRead('', '');
      expect(result).toBe(false);
    });
  });

  // ======================
  // processResponse Tests
  // ======================

  describe('processResponse', () => {
    // Note: Full processResponse testing requires complex mock setup
    // as it makes multiple sequential database calls.
    // These tests verify the validation logic.

    it('should reject already responded confirmations', async () => {
      const mockConfirmation = {
        id: 'conf-123',
        status: 'responded',
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockConfirmation,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      });

      const result = await confirmationSenderService.processResponse({
        tenantId: 'tenant-123',
        confirmationId: 'conf-123',
        response: 'confirmed',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already responded');
    });

    it('should reject expired confirmations', async () => {
      const mockConfirmation = {
        id: 'conf-123',
        status: 'expired',
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockConfirmation,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      });

      const result = await confirmationSenderService.processResponse({
        tenantId: 'tenant-123',
        confirmationId: 'conf-123',
        response: 'confirmed',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  // ======================
  // processExpired Tests
  // ======================

  describe('processExpired', () => {
    it('should process expired confirmations', async () => {
      const mockExpired = [
        {
          id: 'conf-1',
          tenant_id: 'tenant-123',
          reference_type: 'appointment',
          reference_id: 'appt-1',
          auto_action_on_expire: 'cancel',
        },
        {
          id: 'conf-2',
          tenant_id: 'tenant-123',
          reference_type: 'appointment',
          reference_id: 'appt-2',
          auto_action_on_expire: 'keep',
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockExpired,
                error: null,
              }),
            }),
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
          update: mockUpdate,
        }),
      });

      const result = await confirmationSenderService.processExpired();

      expect(result.processed).toBe(2);
      expect(result.cancelled).toBe(1);
    });
  });
});
