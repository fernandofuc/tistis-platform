// =====================================================
// TIS TIS PLATFORM - Confirmation Templates Tests
// FASE 5: Secure Booking System
// =====================================================

import { describe, it, expect } from 'vitest';
import {
  buildAppointmentConfirmationTemplate,
  buildReservationConfirmationTemplate,
  buildOrderConfirmationTemplate,
  buildReminder24hTemplate,
  buildReminder2hTemplate,
  buildDepositRequiredTemplate,
  formatDateSpanish,
  formatTimeSpanish,
  generateConfirmationCode,
  getTemplateBuilder,
  type ConfirmationTemplateData,
} from '../../templates/confirmation-templates';

describe('Confirmation Templates', () => {
  const createMockTemplateData = (
    overrides: Partial<ConfirmationTemplateData> = {}
  ): ConfirmationTemplateData => ({
    customerName: 'Juan Perez',
    customerPhone: '+521234567890',
    businessName: 'Clinica Dental ABC',
    businessPhone: '+529876543210',
    branchName: 'Sucursal Centro',
    branchAddress: 'Av. Reforma 123',
    referenceType: 'appointment',
    referenceId: 'appt-123',
    confirmationCode: 'ABC123',
    date: 'lunes 27 de enero',
    time: '10:30',
    dateTimeRaw: '2026-01-27T10:30:00',
    expiresAt: '2026-01-27T14:30:00',
    expiresInHours: 4,
    ...overrides,
  });

  // ======================
  // formatDateSpanish Tests
  // ======================

  describe('formatDateSpanish', () => {
    it('should format date in Spanish correctly', () => {
      const date = new Date('2026-01-27T10:30:00');
      const result = formatDateSpanish(date);

      expect(result).toContain('27');
      // Month name case may vary - check lowercase
      expect(result.toLowerCase()).toContain('enero');
    });

    it('should handle different months', () => {
      const december = new Date('2025-12-25T10:00:00');
      const result = formatDateSpanish(december);

      expect(result).toContain('25');
      expect(result.toLowerCase()).toContain('diciembre');
    });
  });

  // ======================
  // formatTimeSpanish Tests
  // ======================

  describe('formatTimeSpanish', () => {
    it('should format time in 12-hour format', () => {
      const morning = new Date('2026-01-27T10:30:00');
      const result = formatTimeSpanish(morning);

      expect(result).toMatch(/10:30|AM/i);
    });

    it('should handle PM times', () => {
      const afternoon = new Date('2026-01-27T15:45:00');
      const result = formatTimeSpanish(afternoon);

      expect(result).toMatch(/3:45|PM/i);
    });
  });

  // ======================
  // generateConfirmationCode Tests
  // ======================

  describe('generateConfirmationCode', () => {
    it('should generate 6 character code', () => {
      const code = generateConfirmationCode();

      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateConfirmationCode());
      }

      // At least 90 unique codes out of 100 (allowing for rare collisions)
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  // ======================
  // buildAppointmentConfirmationTemplate Tests
  // ======================

  describe('buildAppointmentConfirmationTemplate', () => {
    it('should include all required information', () => {
      const data = createMockTemplateData({
        serviceName: 'Limpieza Dental',
        staffName: 'Dr. Garcia',
      });

      const result = buildAppointmentConfirmationTemplate(data);

      expect(result.text).toContain('Juan Perez');
      expect(result.text).toContain('Clinica Dental ABC');
      // Date is pre-formatted in data
      expect(result.text).toContain('lunes 27 de enero');
      expect(result.text).toContain('10:30');
      // Confirmation code is in footer, not text
      expect(result.footer).toContain('ABC123');
    });

    it('should include service and staff when provided', () => {
      const data = createMockTemplateData({
        serviceName: 'Limpieza Dental',
        staffName: 'Dr. Garcia',
      });

      const result = buildAppointmentConfirmationTemplate(data);

      expect(result.text).toContain('Limpieza Dental');
      expect(result.text).toContain('Dr. Garcia');
    });

    it('should include confirmation buttons', () => {
      const data = createMockTemplateData();
      const result = buildAppointmentConfirmationTemplate(data);

      expect(result.buttons).toBeDefined();
      expect(result.buttons?.length).toBeGreaterThanOrEqual(2);
      // Buttons have Spanish text
      expect(result.buttons?.some(b =>
        b.title.toLowerCase().includes('confirm') ||
        b.title.toLowerCase().includes('sí')
      )).toBe(true);
    });

    it('should include footer with confirmation code', () => {
      const data = createMockTemplateData();
      const result = buildAppointmentConfirmationTemplate(data);

      expect(result.footer).toBeDefined();
      expect(result.footer).toContain('ABC123');
    });
  });

  // ======================
  // buildReservationConfirmationTemplate Tests
  // ======================

  describe('buildReservationConfirmationTemplate', () => {
    it('should include party size for reservations', () => {
      const data = createMockTemplateData({
        referenceType: 'reservation',
        partySize: 4,
        businessName: 'Restaurante La Parilla',
      });

      const result = buildReservationConfirmationTemplate(data);

      expect(result.text).toContain('4');
      expect(result.text).toContain('Restaurante La Parilla');
    });

    it('should work without party size', () => {
      const data = createMockTemplateData({
        referenceType: 'reservation',
      });

      const result = buildReservationConfirmationTemplate(data);

      expect(result.text).toBeDefined();
    });
  });

  // ======================
  // buildOrderConfirmationTemplate Tests
  // ======================

  describe('buildOrderConfirmationTemplate', () => {
    it('should include order items', () => {
      const data = createMockTemplateData({
        referenceType: 'order',
        orderItems: ['2x Tacos al Pastor', '1x Agua de Jamaica'],
        totalAmount: 15000, // Amount in cents
        currency: 'MXN',
      });

      const result = buildOrderConfirmationTemplate(data);

      expect(result.text).toContain('Tacos al Pastor');
      expect(result.text).toContain('Agua de Jamaica');
      // Amount is formatted from cents to dollars
      expect(result.text).toContain('150');
    });

    it('should include total amount', () => {
      const data = createMockTemplateData({
        referenceType: 'order',
        totalAmount: 25050, // Amount in cents (250.50)
      });

      const result = buildOrderConfirmationTemplate(data);

      expect(result.text).toContain('250');
    });
  });

  // ======================
  // buildReminder24hTemplate Tests
  // ======================

  describe('buildReminder24hTemplate', () => {
    it('should create 24-hour reminder message', () => {
      const data = createMockTemplateData();
      const result = buildReminder24hTemplate(data);

      // The 24h reminder says "mañana" (tomorrow) not "24"
      expect(result.text).toContain('mañana');
      expect(result.text).toContain('Juan Perez');
    });

    it('should include confirmation options', () => {
      const data = createMockTemplateData();
      const result = buildReminder24hTemplate(data);

      expect(result.buttons).toBeDefined();
    });
  });

  // ======================
  // buildReminder2hTemplate Tests
  // ======================

  describe('buildReminder2hTemplate', () => {
    it('should create 2-hour reminder message', () => {
      const data = createMockTemplateData();
      const result = buildReminder2hTemplate(data);

      expect(result.text).toContain('2');
    });

    it('should be more urgent in tone', () => {
      const data = createMockTemplateData();
      const result = buildReminder2hTemplate(data);

      // Check for urgency indicators
      expect(result.text.length).toBeLessThan(
        buildReminder24hTemplate(data).text.length
      ); // Shorter, more direct
    });
  });

  // ======================
  // buildDepositRequiredTemplate Tests
  // ======================

  describe('buildDepositRequiredTemplate', () => {
    it('should include deposit amount', () => {
      const data = createMockTemplateData({
        depositRequired: true,
        depositAmount: 50000, // Amount in cents (500.00)
        depositPaymentUrl: 'https://pay.tistis.com/abc123',
      });

      const result = buildDepositRequiredTemplate(data);

      // Amount is formatted from cents
      expect(result.text).toContain('500');
      expect(result.text).toContain('pay.tistis.com');
    });

    it('should include payment URL', () => {
      const data = createMockTemplateData({
        depositRequired: true,
        depositAmount: 30000, // Amount in cents (300.00)
        depositPaymentUrl: 'https://stripe.com/pay/xyz',
      });

      const result = buildDepositRequiredTemplate(data);

      expect(result.text).toContain('stripe.com');
    });
  });

  // ======================
  // getTemplateBuilder Tests
  // ======================

  describe('getTemplateBuilder', () => {
    it('should return correct builder for voice_to_message appointment', () => {
      const builder = getTemplateBuilder('voice_to_message', 'appointment');
      expect(builder).toBeDefined();
      expect(typeof builder).toBe('function');
    });

    it('should return correct builder for reminder_24h', () => {
      const builder = getTemplateBuilder('reminder_24h', 'appointment');
      expect(builder).toBeDefined();
    });

    it('should return correct builder for reminder_2h', () => {
      const builder = getTemplateBuilder('reminder_2h', 'appointment');
      expect(builder).toBeDefined();
    });

    it('should return correct builder for deposit_required', () => {
      const builder = getTemplateBuilder('deposit_required', 'appointment');
      expect(builder).toBeDefined();
    });

    it('should return correct builder for reservations', () => {
      const builder = getTemplateBuilder('voice_to_message', 'reservation');
      expect(builder).toBeDefined();
    });

    it('should return correct builder for orders', () => {
      const builder = getTemplateBuilder('voice_to_message', 'order');
      expect(builder).toBeDefined();
    });

    it('should return a working builder that produces valid templates', () => {
      const builder = getTemplateBuilder('voice_to_message', 'appointment');
      const data = createMockTemplateData();
      const result = builder(data);

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
    });
  });
});
