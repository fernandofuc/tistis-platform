// =====================================================
// TIS TIS PLATFORM - Booking Confirmation Service Tests
// FASE 5: Secure Booking System
// =====================================================

import { describe, it, expect } from 'vitest';
import {
  detectResponseFromText,
  isConfirmationActive,
  getTimeUntilExpiration,
  formatExpirationTime,
} from '../../services/booking-confirmation.service';
import type { BookingConfirmation } from '../../types';

describe('Booking Confirmation Service - Utility Functions', () => {
  // ======================
  // detectResponseFromText Tests
  // ======================

  describe('detectResponseFromText', () => {
    describe('confirmed responses', () => {
      const confirmedPatterns = [
        'si',
        'sí',
        'SI',
        'confirmo',
        'Confirmo',
        'confirmado',
        'ok',
        'OK',
        'listo',
        'correcto',
        'perfecto',
        'de acuerdo',
        'va',
        'sale',
        'ahi estare',
        'ahí estaré',
        '1',
        'confirmar',
      ];

      confirmedPatterns.forEach((pattern) => {
        it(`should detect "${pattern}" as confirmed`, () => {
          expect(detectResponseFromText(pattern)).toBe('confirmed');
        });
      });

      it('should detect "si" in a sentence', () => {
        expect(detectResponseFromText('si, confirmo mi cita')).toBe('confirmed');
      });

      it('should handle extra whitespace', () => {
        expect(detectResponseFromText('   si   ')).toBe('confirmed');
      });
    });

    describe('cancelled responses', () => {
      const cancelledPatterns = [
        'no',
        'No',
        'NO',
        'cancelar',
        'cancelo',
        'cancela',
        'no puedo',
        'no podre',
        'no podré',
        '2',
        'eliminar',
        'quitar',
      ];

      cancelledPatterns.forEach((pattern) => {
        it(`should detect "${pattern}" as cancelled`, () => {
          expect(detectResponseFromText(pattern)).toBe('cancelled');
        });
      });

      it('should detect cancellation in context', () => {
        expect(detectResponseFromText('no puedo ir a mi cita')).toBe('cancelled');
      });
    });

    describe('need_change responses', () => {
      const changePatterns = [
        'cambiar',
        'reagendar',
        'mover',
        'cambio',
        'otra fecha',
        'otro dia',
        'otro día',
        '3',
        'modificar',
      ];

      changePatterns.forEach((pattern) => {
        it(`should detect "${pattern}" as need_change`, () => {
          expect(detectResponseFromText(pattern)).toBe('need_change');
        });
      });

      it('should detect change request in context', () => {
        expect(
          detectResponseFromText('puedo cambiar mi cita para el jueves?')
        ).toBe('need_change');
      });
    });

    describe('unrecognized responses', () => {
      it('should return null for unrelated messages', () => {
        expect(detectResponseFromText('hola como estan')).toBe(null);
      });

      it('should return null for empty string', () => {
        expect(detectResponseFromText('')).toBe(null);
      });

      it('should return null for random text', () => {
        // "xyz" doesn't contain any confirmation patterns
        // Note: can't use digits 1, 2, 3 as they are valid responses
        expect(detectResponseFromText('xyz')).toBe(null);
      });
    });
  });

  // ======================
  // isConfirmationActive Tests
  // ======================

  describe('isConfirmationActive', () => {
    const createMockConfirmation = (
      overrides: Partial<BookingConfirmation>
    ): BookingConfirmation => ({
      id: 'conf-123',
      tenant_id: 'tenant-123',
      reference_type: 'appointment',
      reference_id: 'appt-123',
      confirmation_type: 'voice_to_message',
      sent_via: 'whatsapp',
      status: 'sent',
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      auto_action_on_expire: 'cancel',
      auto_action_executed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    } as BookingConfirmation);

    it('should return true for pending confirmation', () => {
      const confirmation = createMockConfirmation({ status: 'pending' });
      expect(isConfirmationActive(confirmation)).toBe(true);
    });

    it('should return true for sent confirmation', () => {
      const confirmation = createMockConfirmation({ status: 'sent' });
      expect(isConfirmationActive(confirmation)).toBe(true);
    });

    it('should return true for delivered confirmation', () => {
      const confirmation = createMockConfirmation({ status: 'delivered' });
      expect(isConfirmationActive(confirmation)).toBe(true);
    });

    it('should return true for read confirmation', () => {
      const confirmation = createMockConfirmation({ status: 'read' });
      expect(isConfirmationActive(confirmation)).toBe(true);
    });

    it('should return false for responded confirmation', () => {
      const confirmation = createMockConfirmation({ status: 'responded' });
      expect(isConfirmationActive(confirmation)).toBe(false);
    });

    it('should return false for expired confirmation', () => {
      const confirmation = createMockConfirmation({ status: 'expired' });
      expect(isConfirmationActive(confirmation)).toBe(false);
    });

    it('should return false for failed confirmation', () => {
      const confirmation = createMockConfirmation({ status: 'failed' });
      expect(isConfirmationActive(confirmation)).toBe(false);
    });

    it('should return false if expires_at is in the past', () => {
      const confirmation = createMockConfirmation({
        status: 'sent',
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });
      expect(isConfirmationActive(confirmation)).toBe(false);
    });
  });

  // ======================
  // getTimeUntilExpiration Tests
  // ======================

  describe('getTimeUntilExpiration', () => {
    const createMockConfirmation = (
      expiresAt: string
    ): BookingConfirmation => ({
      id: 'conf-123',
      tenant_id: 'tenant-123',
      reference_type: 'appointment',
      reference_id: 'appt-123',
      confirmation_type: 'voice_to_message',
      sent_via: 'whatsapp',
      status: 'sent',
      expires_at: expiresAt,
      auto_action_on_expire: 'cancel',
      auto_action_executed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as BookingConfirmation);

    it('should calculate hours and minutes correctly', () => {
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000); // 2h 30m
      const confirmation = createMockConfirmation(twoHoursFromNow.toISOString());

      const result = getTimeUntilExpiration(confirmation);

      expect(result.hours).toBe(2);
      expect(result.minutes).toBeGreaterThanOrEqual(29);
      expect(result.minutes).toBeLessThanOrEqual(31);
      expect(result.expired).toBe(false);
    });

    it('should return expired=true for past dates', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const confirmation = createMockConfirmation(oneHourAgo.toISOString());

      const result = getTimeUntilExpiration(confirmation);

      expect(result.expired).toBe(true);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
    });

    it('should handle exactly now as expired', () => {
      const now = new Date();
      const confirmation = createMockConfirmation(now.toISOString());

      const result = getTimeUntilExpiration(confirmation);

      // Could be expired or have 0 time left
      expect(result.expired || (result.hours === 0 && result.minutes === 0)).toBe(true);
    });
  });

  // ======================
  // formatExpirationTime Tests
  // ======================

  describe('formatExpirationTime', () => {
    const createMockConfirmation = (
      expiresAt: string
    ): BookingConfirmation => ({
      id: 'conf-123',
      tenant_id: 'tenant-123',
      reference_type: 'appointment',
      reference_id: 'appt-123',
      confirmation_type: 'voice_to_message',
      sent_via: 'whatsapp',
      status: 'sent',
      expires_at: expiresAt,
      auto_action_on_expire: 'cancel',
      auto_action_executed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as BookingConfirmation);

    it('should return "Expirado" for past dates', () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      const confirmation = createMockConfirmation(pastDate.toISOString());

      expect(formatExpirationTime(confirmation)).toBe('Expirado');
    });

    it('should format hours and minutes', () => {
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000);
      const confirmation = createMockConfirmation(twoHoursFromNow.toISOString());

      const result = formatExpirationTime(confirmation);

      expect(result).toContain('h');
      expect(result).toContain('m');
    });

    it('should format days for long periods', () => {
      const twoDaysFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const confirmation = createMockConfirmation(twoDaysFromNow.toISOString());

      const result = formatExpirationTime(confirmation);

      expect(result).toContain('d');
    });

    it('should format minutes only when less than an hour', () => {
      const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000);
      const confirmation = createMockConfirmation(thirtyMinutesFromNow.toISOString());

      const result = formatExpirationTime(confirmation);

      expect(result).toContain('m');
      expect(result).not.toContain('h');
    });
  });
});
