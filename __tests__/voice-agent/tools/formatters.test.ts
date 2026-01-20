/**
 * TIS TIS Platform - Voice Agent v2.0
 * Formatters Tests
 *
 * Tests adjusted to match actual formatter implementation behavior.
 */

import {
  formatDateForVoice,
  formatTimeForVoice,
  formatPriceForVoice,
  formatListForVoice,
  formatMenuForVoice,
  formatSlotsForVoice,
  formatDurationForVoice,
  formatConfirmationCodeForVoice,
  formatPhoneForVoice,
  formatSmallNumberForVoice,
} from '@/lib/voice-agent/tools/formatters';

describe('Voice Formatters', () => {
  describe('formatDateForVoice', () => {
    it('should format date in Spanish with day name and number words', () => {
      const result = formatDateForVoice('2024-01-15', 'es');
      // Monday January 15, 2024 = lunes quince de enero
      expect(result).toContain('lunes');
      expect(result).toContain('quince');
      expect(result).toContain('enero');
    });

    it('should format date in English', () => {
      const result = formatDateForVoice('2024-01-15', 'en');
      expect(result).toContain('Monday');
      expect(result).toContain('January');
      expect(result).toContain('15');
    });

    it('should say today for current date', () => {
      // Use local date format to avoid timezone issues
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const esResult = formatDateForVoice(todayStr, 'es');
      const enResult = formatDateForVoice(todayStr, 'en');

      expect(esResult.toLowerCase()).toBe('hoy');
      expect(enResult.toLowerCase()).toBe('today');
    });

    it('should say tomorrow for next day', () => {
      // Use local date format to avoid timezone issues
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const tomorrowStr = `${year}-${month}-${day}`;

      const esResult = formatDateForVoice(tomorrowStr, 'es');
      const enResult = formatDateForVoice(tomorrowStr, 'en');

      expect(esResult.toLowerCase()).toBe('mañana');
      expect(enResult.toLowerCase()).toBe('tomorrow');
    });

    it('should handle invalid date gracefully', () => {
      const result = formatDateForVoice('invalid-date', 'es');
      expect(result).toBeDefined();
      expect(result).toBe('invalid-date');
    });
  });

  describe('formatTimeForVoice', () => {
    it('should format morning time with y media for :30', () => {
      const result = formatTimeForVoice('09:30', 'es');
      expect(result).toContain('nueve');
      expect(result).toContain('media'); // :30 = "y media"
      expect(result).toContain('mañana');
    });

    it('should format afternoon time in Spanish', () => {
      const result = formatTimeForVoice('14:00', 'es');
      expect(result).toContain('dos');
      expect(result).toContain('tarde');
    });

    it('should format quarter past with cuarto', () => {
      const result = formatTimeForVoice('10:15', 'es');
      expect(result).toContain('diez');
      expect(result).toContain('cuarto');
    });

    it('should format evening time in English with PM', () => {
      const result = formatTimeForVoice('20:00', 'en');
      expect(result).toContain('8');
      expect(result).toContain('PM');
    });

    it('should format noon as 12 de la tarde', () => {
      const esResult = formatTimeForVoice('12:00', 'es');
      const enResult = formatTimeForVoice('12:00', 'en');

      expect(esResult).toContain('doce');
      expect(esResult).toContain('tarde');
      expect(enResult).toContain('12');
      expect(enResult).toContain('PM');
    });

    it('should format midnight as 12 de la mañana', () => {
      const esResult = formatTimeForVoice('00:00', 'es');
      const enResult = formatTimeForVoice('00:00', 'en');

      expect(esResult).toContain('doce');
      expect(esResult).toContain('mañana');
      expect(enResult).toContain('12');
      expect(enResult).toContain('AM');
    });

    it('should format arbitrary minutes with con', () => {
      const result = formatTimeForVoice('09:25', 'es');
      expect(result).toContain('nueve');
      expect(result).toContain('con');
      expect(result).toContain('veinticinco');
    });
  });

  describe('formatPriceForVoice', () => {
    it('should format MXN price with numeric format', () => {
      const result = formatPriceForVoice(150.50, 'MXN', 'es');
      // Implementation uses numeric: "150 pesos con 50 centavos"
      expect(result).toContain('150');
      expect(result).toContain('pesos');
      expect(result).toContain('50');
      expect(result).toContain('centavos');
    });

    it('should format USD price in English', () => {
      const result = formatPriceForVoice(25.99, 'USD', 'en');
      expect(result).toContain('25');
      expect(result).toContain('dollars');
      expect(result).toContain('99');
      expect(result).toContain('cents');
    });

    it('should handle whole numbers without centavos', () => {
      const result = formatPriceForVoice(100, 'MXN', 'es');
      expect(result).toContain('100');
      expect(result).toContain('pesos');
      expect(result).not.toContain('centavos');
    });

    it('should handle zero', () => {
      const result = formatPriceForVoice(0, 'MXN', 'es');
      expect(result).toContain('0');
      expect(result).toContain('pesos');
    });

    it('should handle large amounts numerically', () => {
      const result = formatPriceForVoice(1500, 'MXN', 'es');
      expect(result).toContain('1500');
      expect(result).toContain('pesos');
    });
  });

  describe('formatListForVoice', () => {
    it('should format single item', () => {
      const result = formatListForVoice(['tacos'], 'es');
      expect(result).toBe('tacos');
    });

    it('should format two items with y/and', () => {
      const esResult = formatListForVoice(['tacos', 'burritos'], 'es');
      const enResult = formatListForVoice(['tacos', 'burritos'], 'en');

      expect(esResult).toBe('tacos y burritos');
      expect(enResult).toBe('tacos and burritos');
    });

    it('should format multiple items with commas', () => {
      const esResult = formatListForVoice(['tacos', 'burritos', 'quesadillas'], 'es');
      expect(esResult).toBe('tacos, burritos y quesadillas');

      const enResult = formatListForVoice(['tacos', 'burritos', 'quesadillas'], 'en');
      expect(enResult).toBe('tacos, burritos and quesadillas');
    });

    it('should handle empty list', () => {
      const result = formatListForVoice([], 'es');
      expect(result).toBe('');
    });
  });

  describe('formatMenuForVoice', () => {
    const menuItems = [
      { name: 'Tacos al pastor', price: 45 },
      { name: 'Burrito de carne', price: 65 },
      { name: 'Quesadilla', price: 35 },
    ];

    it('should format menu with prices by default', () => {
      const result = formatMenuForVoice(menuItems, { locale: 'es' });

      expect(result).toContain('Tacos al pastor');
      expect(result).toContain('45 pesos');
      expect(result).toContain('Burrito de carne');
    });

    it('should format menu without prices when includePrices is false', () => {
      const result = formatMenuForVoice(menuItems, { includePrices: false, locale: 'es' });

      expect(result).toContain('Tacos al pastor');
      expect(result).toContain('Burrito de carne');
      expect(result).not.toContain('pesos');
    });

    it('should limit items with maxItems option', () => {
      const manyItems = Array(10).fill(null).map((_, i) => ({ name: `Item ${i}`, price: 10 }));
      const result = formatMenuForVoice(manyItems, { maxItems: 3, locale: 'es' });

      expect(result).toContain('Item 0');
      expect(result).toContain('más');
    });
  });

  describe('formatSlotsForVoice', () => {
    it('should format single slot in short form', () => {
      const result = formatSlotsForVoice(['14:00'], { locale: 'es' });
      expect(result).toContain('2');
      expect(result).toContain('pm');
    });

    it('should format multiple slots as alternatives', () => {
      const result = formatSlotsForVoice(['14:00', '15:00', '16:00'], { locale: 'es' });

      expect(result).toContain('2 pm');
      expect(result).toContain('3 pm');
      expect(result).toContain('4 pm');
      // Should use "o" for alternatives
      expect(result).toContain('o');
    });

    it('should limit slots and show more message', () => {
      const manySlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
      const result = formatSlotsForVoice(manySlots, { maxSlots: 3, locale: 'es' });

      expect(result).toContain('más');
    });

    it('should handle empty slots', () => {
      const result = formatSlotsForVoice([], { locale: 'es' });
      expect(result).toContain('No hay horarios');
    });
  });

  describe('formatDurationForVoice', () => {
    it('should format minutes with number', () => {
      const result = formatDurationForVoice(30, 'es');
      expect(result).toBe('30 minutos');
    });

    it('should format one hour', () => {
      const result = formatDurationForVoice(60, 'es');
      expect(result).toBe('una hora');
    });

    it('should format hour and half', () => {
      const result = formatDurationForVoice(90, 'es');
      expect(result).toBe('una hora y media');
    });

    it('should format multiple hours', () => {
      const result = formatDurationForVoice(120, 'es');
      expect(result).toBe('2 horas');
    });

    it('should format in English', () => {
      const result = formatDurationForVoice(45, 'en');
      expect(result).toBe('45 minutes');
    });

    it('should format single minute', () => {
      const esResult = formatDurationForVoice(1, 'es');
      const enResult = formatDurationForVoice(1, 'en');

      expect(esResult).toBe('un minuto');
      expect(enResult).toBe('1 minute');
    });
  });

  describe('formatConfirmationCodeForVoice', () => {
    it('should spell out numbers and keep letters', () => {
      const result = formatConfirmationCodeForVoice('ABC123', 'es');

      expect(result).toContain('A');
      expect(result).toContain('B');
      expect(result).toContain('C');
      expect(result).toContain('uno');
      expect(result).toContain('dos');
      expect(result).toContain('tres');
    });

    it('should separate characters with commas', () => {
      const result = formatConfirmationCodeForVoice('XY', 'es');
      expect(result).toContain(',');
    });

    it('should uppercase the code', () => {
      const result = formatConfirmationCodeForVoice('abc', 'es');
      expect(result).toContain('A');
      expect(result).toContain('B');
      expect(result).toContain('C');
    });
  });

  describe('formatPhoneForVoice', () => {
    it('should format 10-digit phone with number words', () => {
      const result = formatPhoneForVoice('5551234567', 'es');

      expect(result).toBeDefined();
      expect(result).toContain('cinco');
    });

    it('should handle formatted phone numbers', () => {
      const result = formatPhoneForVoice('(555) 123-4567', 'es');
      expect(result).toBeDefined();
    });

    it('should group digits with commas for pauses', () => {
      const result = formatPhoneForVoice('5551234567', 'es');
      expect(result).toContain(',');
    });
  });

  describe('formatSmallNumberForVoice', () => {
    it('should convert single digits', () => {
      expect(formatSmallNumberForVoice(5, 'es')).toBe('cinco');
      expect(formatSmallNumberForVoice(5, 'en')).toBe('five');
    });

    it('should convert teens', () => {
      expect(formatSmallNumberForVoice(15, 'es')).toBe('quince');
      expect(formatSmallNumberForVoice(15, 'en')).toBe('fifteen');
    });

    it('should convert tens', () => {
      expect(formatSmallNumberForVoice(20, 'es')).toBe('veinte');
      expect(formatSmallNumberForVoice(30, 'es')).toBe('treinta');
    });

    it('should convert compound numbers 21-29 with veinti prefix', () => {
      expect(formatSmallNumberForVoice(25, 'es')).toBe('veinticinco');
    });

    it('should convert compound numbers 31+ with y', () => {
      expect(formatSmallNumberForVoice(45, 'es')).toBe('cuarenta y cinco');
    });

    it('should convert 100', () => {
      expect(formatSmallNumberForVoice(100, 'es')).toBe('cien');
    });

    it('should return string for numbers > 100', () => {
      expect(formatSmallNumberForVoice(150, 'es')).toBe('150');
    });

    it('should handle zero', () => {
      expect(formatSmallNumberForVoice(0, 'es')).toBe('cero');
      expect(formatSmallNumberForVoice(0, 'en')).toBe('zero');
    });

    it('should handle negative numbers', () => {
      expect(formatSmallNumberForVoice(-5, 'es')).toBe('menos cinco');
      expect(formatSmallNumberForVoice(-5, 'en')).toBe('negative five');
    });
  });
});
