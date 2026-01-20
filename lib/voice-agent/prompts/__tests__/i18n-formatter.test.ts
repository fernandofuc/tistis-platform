/**
 * TIS TIS Platform - Voice Agent v2.0
 * I18n Formatter Tests
 */

// Using Jest for testing
import {
  numberToWords,
  formatPriceForVoice,
  formatPriceRangeForVoice,
  formatTimeForVoice,
  formatHourMinuteForVoice,
  formatDurationForVoice,
  getTimeOfDay,
  getGreetingForTimeOfDay,
  formatDateForVoice,
  formatRelativeDateForVoice,
  formatListForVoice,
  formatCountWithNoun,
  formatPhoneForVoice,
  formatScheduleRangeForVoice,
  formatDayRangeForVoice,
  createFormatter,
} from '../i18n-formatter';

// =====================================================
// NUMBER TO WORDS TESTS
// =====================================================

describe('numberToWords', () => {
  describe('Spanish (es-MX)', () => {
    it('should convert 0', () => {
      expect(numberToWords(0, 'es-MX')).toBe('cero');
    });

    it('should convert single digits', () => {
      expect(numberToWords(1, 'es-MX')).toBe('uno');
      expect(numberToWords(5, 'es-MX')).toBe('cinco');
      expect(numberToWords(9, 'es-MX')).toBe('nueve');
    });

    it('should convert teens', () => {
      expect(numberToWords(11, 'es-MX')).toBe('once');
      expect(numberToWords(15, 'es-MX')).toBe('quince');
      expect(numberToWords(19, 'es-MX')).toBe('diecinueve');
    });

    it('should convert twenties', () => {
      expect(numberToWords(20, 'es-MX')).toBe('veinte');
      expect(numberToWords(21, 'es-MX')).toBe('veintiuno');
      expect(numberToWords(25, 'es-MX')).toBe('veinticinco');
      expect(numberToWords(29, 'es-MX')).toBe('veintinueve');
    });

    it('should convert 30-99', () => {
      expect(numberToWords(30, 'es-MX')).toBe('treinta');
      expect(numberToWords(42, 'es-MX')).toBe('cuarenta y dos');
      expect(numberToWords(55, 'es-MX')).toBe('cincuenta y cinco');
      expect(numberToWords(99, 'es-MX')).toBe('noventa y nueve');
    });

    it('should convert hundreds', () => {
      expect(numberToWords(100, 'es-MX')).toBe('cien');
      expect(numberToWords(101, 'es-MX')).toBe('ciento uno');
      expect(numberToWords(150, 'es-MX')).toBe('ciento cincuenta');
      expect(numberToWords(200, 'es-MX')).toBe('doscientos');
      expect(numberToWords(500, 'es-MX')).toBe('quinientos');
      expect(numberToWords(999, 'es-MX')).toBe('novecientos noventa y nueve');
    });

    it('should convert thousands', () => {
      expect(numberToWords(1000, 'es-MX')).toBe('mil');
      expect(numberToWords(1001, 'es-MX')).toBe('mil uno');
      expect(numberToWords(1500, 'es-MX')).toBe('mil quinientos');
      expect(numberToWords(2000, 'es-MX')).toBe('dos mil');
      expect(numberToWords(2500, 'es-MX')).toBe('dos mil quinientos');
      expect(numberToWords(10000, 'es-MX')).toBe('diez mil');
    });

    it('should handle negative numbers', () => {
      expect(numberToWords(-5, 'es-MX')).toBe('menos cinco');
      expect(numberToWords(-100, 'es-MX')).toBe('menos cien');
    });
  });

  describe('English (en-US)', () => {
    it('should convert 0', () => {
      expect(numberToWords(0, 'en-US')).toBe('zero');
    });

    it('should convert single digits', () => {
      expect(numberToWords(1, 'en-US')).toBe('one');
      expect(numberToWords(5, 'en-US')).toBe('five');
      expect(numberToWords(9, 'en-US')).toBe('nine');
    });

    it('should convert teens', () => {
      expect(numberToWords(11, 'en-US')).toBe('eleven');
      expect(numberToWords(15, 'en-US')).toBe('fifteen');
      expect(numberToWords(19, 'en-US')).toBe('nineteen');
    });

    it('should convert 20-99', () => {
      expect(numberToWords(20, 'en-US')).toBe('twenty');
      expect(numberToWords(21, 'en-US')).toBe('twenty-one');
      expect(numberToWords(42, 'en-US')).toBe('forty-two');
      expect(numberToWords(99, 'en-US')).toBe('ninety-nine');
    });

    it('should convert hundreds', () => {
      expect(numberToWords(100, 'en-US')).toBe('one hundred');
      expect(numberToWords(101, 'en-US')).toBe('one hundred one');
      expect(numberToWords(150, 'en-US')).toBe('one hundred fifty');
      expect(numberToWords(999, 'en-US')).toBe('nine hundred ninety-nine');
    });

    it('should convert thousands', () => {
      expect(numberToWords(1000, 'en-US')).toBe('one thousand');
      expect(numberToWords(1500, 'en-US')).toBe('one thousand five hundred');
      expect(numberToWords(2000, 'en-US')).toBe('two thousand');
    });

    it('should handle negative numbers', () => {
      expect(numberToWords(-5, 'en-US')).toBe('minus five');
    });
  });
});

// =====================================================
// PRICE FORMATTING TESTS
// =====================================================

describe('formatPriceForVoice', () => {
  describe('Spanish (es-MX)', () => {
    it('should format whole MXN amounts', () => {
      expect(formatPriceForVoice(50, 'MXN', 'es-MX')).toBe('cincuenta pesos');
      expect(formatPriceForVoice(100, 'MXN', 'es-MX')).toBe('100 pesos');
      expect(formatPriceForVoice(150, 'MXN', 'es-MX')).toBe('150 pesos');
    });

    it('should format amounts with cents', () => {
      expect(formatPriceForVoice(50.5, 'MXN', 'es-MX')).toBe(
        '50 pesos con 50 centavos'
      );
      expect(formatPriceForVoice(99.99, 'MXN', 'es-MX')).toBe(
        '99 pesos con 99 centavos'
      );
    });

    it('should format USD amounts', () => {
      expect(formatPriceForVoice(25, 'USD', 'es-MX')).toBe('veinticinco dólares');
    });
  });

  describe('English (en-US)', () => {
    it('should format whole USD amounts', () => {
      expect(formatPriceForVoice(50, 'USD', 'en-US')).toBe('fifty dollars');
      expect(formatPriceForVoice(100, 'USD', 'en-US')).toBe('100 dollars');
    });

    it('should format amounts with cents', () => {
      expect(formatPriceForVoice(50.5, 'USD', 'en-US')).toBe(
        '50 dollars and 50 cents'
      );
    });
  });
});

describe('formatPriceRangeForVoice', () => {
  it('should format price range in Spanish', () => {
    expect(formatPriceRangeForVoice(100, 200, 'MXN', 'es-MX')).toBe(
      'de 100 a 200 pesos'
    );
  });

  it('should format price range in English', () => {
    expect(formatPriceRangeForVoice(100, 200, 'USD', 'en-US')).toBe(
      'from 100 to 200 dollars'
    );
  });
});

// =====================================================
// TIME FORMATTING TESTS
// =====================================================

describe('formatTimeForVoice', () => {
  it('should format time from string', () => {
    expect(formatTimeForVoice('09:00', 'es-MX')).toContain('9');
    expect(formatTimeForVoice('14:30', 'es-MX')).toContain('media');
  });

  it('should handle invalid time format', () => {
    expect(formatTimeForVoice('invalid', 'es-MX')).toBe('invalid');
  });
});

describe('formatHourMinuteForVoice', () => {
  describe('Spanish (es-MX)', () => {
    it('should format hour on the hour', () => {
      expect(formatHourMinuteForVoice(9, 0, 'es-MX')).toContain('las 9');
      expect(formatHourMinuteForVoice(13, 0, 'es-MX')).toContain('la una');
    });

    it('should format quarter past', () => {
      expect(formatHourMinuteForVoice(9, 15, 'es-MX')).toContain('y cuarto');
    });

    it('should format half past', () => {
      expect(formatHourMinuteForVoice(9, 30, 'es-MX')).toContain('y media');
    });

    it('should format quarter to', () => {
      expect(formatHourMinuteForVoice(9, 45, 'es-MX')).toContain(
        'un cuarto para las 10'
      );
    });

    it('should include period of day', () => {
      expect(formatHourMinuteForVoice(9, 0, 'es-MX')).toContain('mañana');
      expect(formatHourMinuteForVoice(14, 0, 'es-MX')).toContain('tarde');
    });
  });

  describe('English (en-US)', () => {
    it('should format hour on the hour', () => {
      expect(formatHourMinuteForVoice(9, 0, 'en-US')).toBe('9 AM');
      expect(formatHourMinuteForVoice(14, 0, 'en-US')).toBe('2 PM');
    });

    it('should format quarter past', () => {
      expect(formatHourMinuteForVoice(9, 15, 'en-US')).toContain('quarter past');
    });

    it('should format half past', () => {
      expect(formatHourMinuteForVoice(9, 30, 'en-US')).toContain('half past');
    });

    it('should format quarter to', () => {
      expect(formatHourMinuteForVoice(9, 45, 'en-US')).toContain('quarter to');
    });

    it('should format generic minutes', () => {
      expect(formatHourMinuteForVoice(9, 23, 'en-US')).toBe('9:23 AM');
    });
  });
});

describe('formatDurationForVoice', () => {
  describe('Spanish (es-MX)', () => {
    it('should format minutes only', () => {
      expect(formatDurationForVoice(1, 'es-MX')).toBe('un minuto');
      expect(formatDurationForVoice(30, 'es-MX')).toBe('30 minutos');
      expect(formatDurationForVoice(59, 'es-MX')).toBe('59 minutos');
    });

    it('should format hours only', () => {
      expect(formatDurationForVoice(60, 'es-MX')).toBe('una hora');
      expect(formatDurationForVoice(120, 'es-MX')).toBe('2 horas');
    });

    it('should format hours and minutes', () => {
      expect(formatDurationForVoice(90, 'es-MX')).toBe('una hora y 30 minutos');
      expect(formatDurationForVoice(75, 'es-MX')).toBe('una hora y 15 minutos');
      expect(formatDurationForVoice(121, 'es-MX')).toBe('2 horas y un minuto');
    });
  });

  describe('English (en-US)', () => {
    it('should format minutes only', () => {
      expect(formatDurationForVoice(1, 'en-US')).toBe('one minute');
      expect(formatDurationForVoice(30, 'en-US')).toBe('30 minutes');
    });

    it('should format hours only', () => {
      expect(formatDurationForVoice(60, 'en-US')).toBe('one hour');
      expect(formatDurationForVoice(120, 'en-US')).toBe('2 hours');
    });

    it('should format hours and minutes', () => {
      expect(formatDurationForVoice(90, 'en-US')).toBe('one hour and 30 minutes');
    });
  });
});

// =====================================================
// TIME OF DAY TESTS
// =====================================================

describe('getTimeOfDay', () => {
  it('should return morning for 5am-11:59am', () => {
    expect(getTimeOfDay(new Date('2024-01-01T05:00:00'))).toBe('morning');
    expect(getTimeOfDay(new Date('2024-01-01T09:00:00'))).toBe('morning');
    expect(getTimeOfDay(new Date('2024-01-01T11:59:00'))).toBe('morning');
  });

  it('should return afternoon for 12pm-5:59pm', () => {
    expect(getTimeOfDay(new Date('2024-01-01T12:00:00'))).toBe('afternoon');
    expect(getTimeOfDay(new Date('2024-01-01T15:00:00'))).toBe('afternoon');
    expect(getTimeOfDay(new Date('2024-01-01T17:59:00'))).toBe('afternoon');
  });

  it('should return evening for 6pm-8:59pm', () => {
    expect(getTimeOfDay(new Date('2024-01-01T18:00:00'))).toBe('evening');
    expect(getTimeOfDay(new Date('2024-01-01T20:59:00'))).toBe('evening');
  });

  it('should return night for 9pm-4:59am', () => {
    expect(getTimeOfDay(new Date('2024-01-01T21:00:00'))).toBe('night');
    expect(getTimeOfDay(new Date('2024-01-01T00:00:00'))).toBe('night');
    expect(getTimeOfDay(new Date('2024-01-01T04:59:00'))).toBe('night');
  });
});

describe('getGreetingForTimeOfDay', () => {
  it('should return Spanish greetings', () => {
    expect(getGreetingForTimeOfDay('morning', 'es-MX')).toBe('Buenos días');
    expect(getGreetingForTimeOfDay('afternoon', 'es-MX')).toBe('Buenas tardes');
    expect(getGreetingForTimeOfDay('evening', 'es-MX')).toBe('Buenas noches');
    expect(getGreetingForTimeOfDay('night', 'es-MX')).toBe('Buenas noches');
  });

  it('should return English greetings', () => {
    expect(getGreetingForTimeOfDay('morning', 'en-US')).toBe('Good morning');
    expect(getGreetingForTimeOfDay('afternoon', 'en-US')).toBe('Good afternoon');
    expect(getGreetingForTimeOfDay('evening', 'en-US')).toBe('Good evening');
  });
});

// =====================================================
// DATE FORMATTING TESTS
// =====================================================

describe('formatDateForVoice', () => {
  it('should format date in Spanish', () => {
    // Use explicit date with time to avoid timezone issues
    const date = new Date(2024, 2, 15, 12, 0, 0); // March 15, 2024, noon (Friday)
    const result = formatDateForVoice(date, 'es-MX');
    expect(result).toContain('viernes');
    expect(result).toContain('15');
    expect(result).toContain('marzo');
  });

  it('should format date in English', () => {
    const date = new Date(2024, 2, 15, 12, 0, 0); // March 15, 2024, noon (Friday)
    const result = formatDateForVoice(date, 'en-US');
    expect(result).toContain('Friday');
    expect(result).toContain('March');
    expect(result).toContain('15');
  });

  it('should include year when requested', () => {
    const date = new Date(2024, 2, 15, 12, 0, 0);
    const result = formatDateForVoice(date, 'es-MX', true);
    expect(result).toContain('2024');
  });
});

describe('formatRelativeDateForVoice', () => {
  it('should return "hoy" for today in Spanish', () => {
    const today = new Date();
    expect(formatRelativeDateForVoice(today, 'es-MX')).toBe('hoy');
  });

  it('should return "today" for today in English', () => {
    const today = new Date();
    expect(formatRelativeDateForVoice(today, 'en-US')).toBe('today');
  });

  it('should return "mañana" for tomorrow in Spanish', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatRelativeDateForVoice(tomorrow, 'es-MX')).toBe('mañana');
  });

  it('should return "tomorrow" for tomorrow in English', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatRelativeDateForVoice(tomorrow, 'en-US')).toBe('tomorrow');
  });

  it('should return "ayer" for yesterday in Spanish', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeDateForVoice(yesterday, 'es-MX')).toBe('ayer');
  });

  it('should return day name for dates within a week', () => {
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const result = formatRelativeDateForVoice(inThreeDays, 'es-MX');
    expect(result).toContain('el');
  });
});

// =====================================================
// LIST FORMATTING TESTS
// =====================================================

describe('formatListForVoice', () => {
  describe('Spanish (es-MX)', () => {
    it('should handle empty list', () => {
      expect(formatListForVoice([], 'es-MX')).toBe('');
    });

    it('should handle single item', () => {
      expect(formatListForVoice(['manzanas'], 'es-MX')).toBe('manzanas');
    });

    it('should join two items with "y"', () => {
      expect(formatListForVoice(['manzanas', 'peras'], 'es-MX')).toBe(
        'manzanas y peras'
      );
    });

    it('should join multiple items with commas and "y"', () => {
      expect(
        formatListForVoice(['manzanas', 'peras', 'naranjas'], 'es-MX')
      ).toBe('manzanas, peras y naranjas');
    });

    it('should use "o" for "or" conjunction', () => {
      expect(formatListForVoice(['opción 1', 'opción 2'], 'es-MX', 'or')).toBe(
        'opción 1 o opción 2'
      );
    });
  });

  describe('English (en-US)', () => {
    it('should join two items with "and"', () => {
      expect(formatListForVoice(['apples', 'pears'], 'en-US')).toBe(
        'apples and pears'
      );
    });

    it('should join multiple items with commas and "and"', () => {
      expect(
        formatListForVoice(['apples', 'pears', 'oranges'], 'en-US')
      ).toBe('apples, pears and oranges');
    });

    it('should use "or" for "or" conjunction', () => {
      expect(formatListForVoice(['option 1', 'option 2'], 'en-US', 'or')).toBe(
        'option 1 or option 2'
      );
    });
  });
});

describe('formatCountWithNoun', () => {
  describe('Spanish (es-MX)', () => {
    it('should format count of 1 with singular', () => {
      expect(formatCountWithNoun(1, 'persona', 'personas', 'es-MX')).toBe(
        'una persona'
      );
      expect(formatCountWithNoun(1, 'minuto', 'minutos', 'es-MX')).toBe(
        'un minuto'
      );
    });

    it('should format count > 1 with plural', () => {
      expect(formatCountWithNoun(5, 'persona', 'personas', 'es-MX')).toBe(
        '5 personas'
      );
    });
  });

  describe('English (en-US)', () => {
    it('should format count of 1 with singular', () => {
      expect(formatCountWithNoun(1, 'person', 'people', 'en-US')).toBe(
        'one person'
      );
    });

    it('should format count > 1 with plural', () => {
      expect(formatCountWithNoun(5, 'person', 'people', 'en-US')).toBe(
        '5 people'
      );
    });
  });
});

// =====================================================
// PHONE FORMATTING TESTS
// =====================================================

describe('formatPhoneForVoice', () => {
  it('should format Mexican phone number', () => {
    const result = formatPhoneForVoice('5512345678', 'es-MX');
    expect(result).toBe('551 234 56 78');
  });

  it('should format US phone number', () => {
    const result = formatPhoneForVoice('2025551234', 'en-US');
    expect(result).toBe('202-555-1234');
  });

  it('should handle phone with existing formatting', () => {
    // +52 55 1234 5678 has 12 digits, returns original since not 10 digits
    const result = formatPhoneForVoice('+52 55 1234 5678', 'es-MX');
    expect(result).toBe('+52 55 1234 5678');
  });

  it('should return original for non-standard length', () => {
    expect(formatPhoneForVoice('123456', 'es-MX')).toBe('123456');
  });
});

// =====================================================
// SCHEDULE FORMATTING TESTS
// =====================================================

describe('formatScheduleRangeForVoice', () => {
  it('should format schedule range in Spanish', () => {
    const result = formatScheduleRangeForVoice('09:00', '18:00', 'es-MX');
    expect(result).toContain('de');
    expect(result).toContain('a');
  });

  it('should format schedule range in English', () => {
    const result = formatScheduleRangeForVoice('09:00', '18:00', 'en-US');
    expect(result).toContain('from');
    expect(result).toContain('to');
  });
});

describe('formatDayRangeForVoice', () => {
  it('should format day range in Spanish', () => {
    // Monday (1) to Friday (5)
    expect(formatDayRangeForVoice(1, 5, 'es-MX')).toBe('lunes a viernes');
  });

  it('should format day range in English', () => {
    expect(formatDayRangeForVoice(1, 5, 'en-US')).toBe('Monday to Friday');
  });

  it('should handle single day', () => {
    expect(formatDayRangeForVoice(1, 1, 'es-MX')).toBe('lunes');
    expect(formatDayRangeForVoice(0, 0, 'en-US')).toBe('Sunday');
  });
});

// =====================================================
// FORMATTER FACTORY TESTS
// =====================================================

describe('createFormatter', () => {
  describe('Spanish formatter', () => {
    const formatter = createFormatter('es-MX');

    it('should have all formatting methods', () => {
      expect(formatter.number).toBeInstanceOf(Function);
      expect(formatter.price).toBeInstanceOf(Function);
      expect(formatter.priceRange).toBeInstanceOf(Function);
      expect(formatter.time).toBeInstanceOf(Function);
      expect(formatter.duration).toBeInstanceOf(Function);
      expect(formatter.date).toBeInstanceOf(Function);
      expect(formatter.relativeDate).toBeInstanceOf(Function);
      expect(formatter.list).toBeInstanceOf(Function);
      expect(formatter.count).toBeInstanceOf(Function);
      expect(formatter.phone).toBeInstanceOf(Function);
      expect(formatter.scheduleRange).toBeInstanceOf(Function);
      expect(formatter.greeting).toBeInstanceOf(Function);
    });

    it('should format with bound locale', () => {
      expect(formatter.number(5)).toBe('cinco');
      expect(formatter.duration(30)).toBe('30 minutos');
    });
  });

  describe('English formatter', () => {
    const formatter = createFormatter('en-US');

    it('should format with bound locale', () => {
      expect(formatter.number(5)).toBe('five');
      expect(formatter.duration(30)).toBe('30 minutes');
    });
  });
});
