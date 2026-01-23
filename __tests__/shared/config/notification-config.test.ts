// =====================================================
// TIS TIS PLATFORM - Notification Config Tests
// Tests for vertical-specific notification configuration
// =====================================================

import { describe, it, expect } from 'vitest';
import {
  getNotificationOptionsForVertical,
  getCommonNotificationOptions,
  getVerticalSpecificNotificationOptions,
  COMMON_NOTIFICATIONS,
  VERTICAL_SPECIFIC_NOTIFICATIONS,
} from '@/src/shared/config/notification-config';
import type { VerticalType } from '@/src/shared/config/verticals';

// ======================
// TESTS
// ======================

describe('Notification Config', () => {
  describe('getNotificationOptionsForVertical', () => {
    it('should return combined common + dental notifications for dental vertical', () => {
      const options = getNotificationOptionsForVertical('dental');

      // Should include all common notifications
      expect(options.some((o) => o.key === 'notify_lead_hot')).toBe(true);
      expect(options.some((o) => o.key === 'notify_conversation_escalated')).toBe(true);

      // Should include dental-specific notifications
      expect(options.some((o) => o.label === 'Nuevas Citas')).toBe(true);
      expect(options.some((o) => o.label === 'Cancelaciones')).toBe(true);

      // Should NOT include restaurant-specific labels
      expect(options.some((o) => o.label === 'Nuevas Reservaciones')).toBe(false);
    });

    it('should return combined common + restaurant notifications for restaurant vertical', () => {
      const options = getNotificationOptionsForVertical('restaurant');

      // Should include all common notifications
      expect(options.some((o) => o.key === 'notify_lead_hot')).toBe(true);
      expect(options.some((o) => o.key === 'notify_conversation_escalated')).toBe(true);

      // Should include restaurant-specific notifications
      expect(options.some((o) => o.label === 'Nuevas Reservaciones')).toBe(true);
      expect(options.some((o) => o.label === 'Cancelaciones')).toBe(true);

      // Should NOT include dental-specific labels
      expect(options.some((o) => o.label === 'Nuevas Citas')).toBe(false);
    });

    it('should return dental notifications as fallback for undefined vertical', () => {
      const options = getNotificationOptionsForVertical(undefined);

      expect(options.some((o) => o.label === 'Nuevas Citas')).toBe(true);
    });

    it('should return dental notifications as fallback for null vertical', () => {
      const options = getNotificationOptionsForVertical(null);

      expect(options.some((o) => o.label === 'Nuevas Citas')).toBe(true);
    });

    it('should return dental notifications as fallback for unknown vertical', () => {
      const options = getNotificationOptionsForVertical('unknown' as VerticalType);

      expect(options.some((o) => o.label === 'Nuevas Citas')).toBe(true);
    });

    it('should return correct notifications for clinic vertical', () => {
      const options = getNotificationOptionsForVertical('clinic');

      expect(options.some((o) => o.label === 'Nuevas Consultas')).toBe(true);
      expect(options.some((o) => o.label === 'Cancelaciones')).toBe(true);
    });

    it('should return correct notifications for gym vertical', () => {
      const options = getNotificationOptionsForVertical('gym');

      expect(options.some((o) => o.label === 'Nuevas Clases')).toBe(true);
      expect(options.some((o) => o.label === 'Cancelaciones')).toBe(true);
    });

    it('should return correct notifications for beauty vertical', () => {
      const options = getNotificationOptionsForVertical('beauty');

      expect(options.some((o) => o.label === 'Nuevas Citas')).toBe(true);
      expect(options.some((o) => o.label === 'Cancelaciones')).toBe(true);
    });

    it('should return correct notifications for veterinary vertical', () => {
      const options = getNotificationOptionsForVertical('veterinary');

      expect(options.some((o) => o.label === 'Nuevas Consultas')).toBe(true);
      expect(options.some((o) => o.label === 'Cancelaciones')).toBe(true);
    });
  });

  describe('getCommonNotificationOptions', () => {
    it('should return only common notifications', () => {
      const options = getCommonNotificationOptions();

      expect(options.length).toBe(COMMON_NOTIFICATIONS.length);
      expect(options).toEqual(COMMON_NOTIFICATIONS);

      // Verify keys are valid notification preference keys
      options.forEach((option) => {
        expect(['notify_lead_hot', 'notify_conversation_escalated']).toContain(option.key);
      });
    });
  });

  describe('getVerticalSpecificNotificationOptions', () => {
    it('should return only dental-specific notifications for dental', () => {
      const options = getVerticalSpecificNotificationOptions('dental');

      expect(options).toEqual(VERTICAL_SPECIFIC_NOTIFICATIONS.dental);

      // Should not include common notifications
      expect(options.some((o) => o.key === 'notify_lead_hot')).toBe(false);
      expect(options.some((o) => o.key === 'notify_conversation_escalated')).toBe(false);
    });

    it('should return only restaurant-specific notifications for restaurant', () => {
      const options = getVerticalSpecificNotificationOptions('restaurant');

      expect(options).toEqual(VERTICAL_SPECIFIC_NOTIFICATIONS.restaurant);

      // Should not include common notifications
      expect(options.some((o) => o.key === 'notify_lead_hot')).toBe(false);
    });

    it('should fallback to dental for undefined vertical', () => {
      const options = getVerticalSpecificNotificationOptions(undefined);

      expect(options).toEqual(VERTICAL_SPECIFIC_NOTIFICATIONS.dental);
    });
  });

  describe('Notification Keys Validity', () => {
    it('should use valid NotificationPreferences keys', () => {
      const validKeys = [
        'notify_lead_hot',
        'notify_appointment_created',
        'notify_appointment_cancelled',
        'notify_conversation_escalated',
      ];

      // Check all verticals
      const verticals: VerticalType[] = ['dental', 'clinic', 'restaurant', 'gym', 'beauty', 'veterinary'];

      verticals.forEach((vertical) => {
        const options = getNotificationOptionsForVertical(vertical);
        options.forEach((option) => {
          expect(validKeys).toContain(option.key);
        });
      });
    });
  });

  describe('Restaurant Vertical Specifics', () => {
    it('should have restaurant-appropriate labels', () => {
      const options = getNotificationOptionsForVertical('restaurant');

      // Find the appointment notification (reused for reservations)
      const reservationOption = options.find((o) => o.key === 'notify_appointment_created');

      expect(reservationOption).toBeDefined();
      expect(reservationOption?.label).toBe('Nuevas Reservaciones');
      expect(reservationOption?.desc).toContain('reservación');
    });

    it('should reuse appointment keys for restaurant reservations', () => {
      const restaurantOptions = getNotificationOptionsForVertical('restaurant');
      const dentalOptions = getNotificationOptionsForVertical('dental');

      // Both should have the same keys
      const restaurantKeys = restaurantOptions.map((o) => o.key).sort();
      const dentalKeys = dentalOptions.map((o) => o.key).sort();

      expect(restaurantKeys).toEqual(dentalKeys);
    });
  });
});
