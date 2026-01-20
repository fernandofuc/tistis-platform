/**
 * TIS TIS Platform - Voice Agent v2.0
 * I18n Formatter
 *
 * Provides voice-optimized formatting functions for dates, times,
 * numbers, prices, and other values with internationalization support.
 */

import type { SupportedLocale, I18nTranslations, TimeOfDay } from './types';

// =====================================================
// NUMBER TO WORDS CONVERSION
// =====================================================

const SPANISH_ONES = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];

const SPANISH_TENS = [
  '',
  '',
  '',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];

const SPANISH_HUNDREDS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

const ENGLISH_ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const ENGLISH_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

/**
 * Convert a number to Spanish words
 */
function numberToSpanishWords(n: number): string {
  if (n === 0) return 'cero';
  if (n < 0) return 'menos ' + numberToSpanishWords(-n);

  if (n < 30) {
    return SPANISH_ONES[n];
  }

  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    if (ones === 0) {
      return SPANISH_TENS[tens];
    }
    return SPANISH_TENS[tens] + ' y ' + SPANISH_ONES[ones];
  }

  if (n === 100) return 'cien';

  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    if (remainder === 0) {
      return hundreds === 1 ? 'cien' : SPANISH_HUNDREDS[hundreds];
    }
    return SPANISH_HUNDREDS[hundreds] + ' ' + numberToSpanishWords(remainder);
  }

  if (n < 2000) {
    const remainder = n % 1000;
    if (remainder === 0) return 'mil';
    return 'mil ' + numberToSpanishWords(remainder);
  }

  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const remainder = n % 1000;
    const thousandWord = numberToSpanishWords(thousands) + ' mil';
    if (remainder === 0) return thousandWord;
    return thousandWord + ' ' + numberToSpanishWords(remainder);
  }

  // For very large numbers, just use digits
  return n.toLocaleString('es-MX');
}

/**
 * Convert a number to English words
 */
function numberToEnglishWords(n: number): string {
  if (n === 0) return 'zero';
  if (n < 0) return 'minus ' + numberToEnglishWords(-n);

  if (n < 20) {
    return ENGLISH_ONES[n];
  }

  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    if (ones === 0) {
      return ENGLISH_TENS[tens];
    }
    return ENGLISH_TENS[tens] + '-' + ENGLISH_ONES[ones];
  }

  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    if (remainder === 0) {
      return ENGLISH_ONES[hundreds] + ' hundred';
    }
    return (
      ENGLISH_ONES[hundreds] + ' hundred ' + numberToEnglishWords(remainder)
    );
  }

  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const remainder = n % 1000;
    const thousandWord = numberToEnglishWords(thousands) + ' thousand';
    if (remainder === 0) return thousandWord;
    return thousandWord + ' ' + numberToEnglishWords(remainder);
  }

  // For very large numbers, just use digits
  return n.toLocaleString('en-US');
}

/**
 * Convert number to words based on locale
 */
export function numberToWords(n: number, locale: SupportedLocale): string {
  if (locale === 'es-MX') {
    return numberToSpanishWords(Math.floor(n));
  }
  return numberToEnglishWords(Math.floor(n));
}

// =====================================================
// PRICE FORMATTING
// =====================================================

/**
 * Format price for voice output
 */
export function formatPriceForVoice(
  amount: number,
  currency: string,
  locale: SupportedLocale,
  i18n?: I18nTranslations
): string {
  const wholePart = Math.floor(amount);
  const decimalPart = Math.round((amount - wholePart) * 100);

  if (locale === 'es-MX') {
    const currencyName = currency === 'MXN' ? 'pesos' : currency === 'USD' ? 'dólares' : currency;

    if (decimalPart === 0) {
      // Whole amount
      if (wholePart < 100) {
        return `${numberToSpanishWords(wholePart)} ${currencyName}`;
      }
      // For larger amounts, use hybrid format for clarity
      return `${wholePart} ${currencyName}`;
    }

    // With cents
    return `${wholePart} ${currencyName} con ${decimalPart} centavos`;
  } else {
    const currencyName = currency === 'USD' ? 'dollars' : currency === 'MXN' ? 'pesos' : currency;

    if (decimalPart === 0) {
      if (wholePart < 100) {
        return `${numberToEnglishWords(wholePart)} ${currencyName}`;
      }
      return `${wholePart} ${currencyName}`;
    }

    return `${wholePart} ${currencyName} and ${decimalPart} cents`;
  }
}

/**
 * Format price range for voice output
 */
export function formatPriceRangeForVoice(
  from: number,
  to: number,
  currency: string,
  locale: SupportedLocale
): string {
  if (locale === 'es-MX') {
    const currencyName = currency === 'MXN' ? 'pesos' : currency === 'USD' ? 'dólares' : currency;
    return `de ${Math.floor(from)} a ${Math.floor(to)} ${currencyName}`;
  } else {
    const currencyName = currency === 'USD' ? 'dollars' : currency === 'MXN' ? 'pesos' : currency;
    return `from ${Math.floor(from)} to ${Math.floor(to)} ${currencyName}`;
  }
}

// =====================================================
// TIME FORMATTING
// =====================================================

/**
 * Format time for voice output (HH:mm string)
 */
export function formatTimeForVoice(
  time: string,
  locale: SupportedLocale
): string {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  return formatHourMinuteForVoice(hour, minute, locale);
}

/**
 * Format hour and minute for voice output
 */
export function formatHourMinuteForVoice(
  hour: number,
  minute: number,
  locale: SupportedLocale
): string {
  if (locale === 'es-MX') {
    const hour12 = hour % 12 || 12;
    const period = hour >= 12 ? 'de la tarde' : 'de la mañana';
    if (hour >= 21 || hour < 6) {
      // Night
    }

    if (minute === 0) {
      if (hour12 === 1) {
        return `la una ${period}`;
      }
      return `las ${hour12} ${period}`;
    }

    if (minute === 15) {
      if (hour12 === 1) {
        return `la una y cuarto ${period}`;
      }
      return `las ${hour12} y cuarto ${period}`;
    }

    if (minute === 30) {
      if (hour12 === 1) {
        return `la una y media ${period}`;
      }
      return `las ${hour12} y media ${period}`;
    }

    if (minute === 45) {
      const nextHour = (hour12 % 12) + 1;
      if (nextHour === 1) {
        return `un cuarto para la una ${period}`;
      }
      return `un cuarto para las ${nextHour} ${period}`;
    }

    // Generic minute
    if (hour12 === 1) {
      return `la una con ${minute} minutos ${period}`;
    }
    return `las ${hour12} con ${minute} minutos ${period}`;
  } else {
    // English format
    const hour12 = hour % 12 || 12;
    const period = hour >= 12 ? 'PM' : 'AM';

    if (minute === 0) {
      return `${hour12} ${period}`;
    }

    if (minute === 15) {
      return `quarter past ${hour12} ${period}`;
    }

    if (minute === 30) {
      return `half past ${hour12} ${period}`;
    }

    if (minute === 45) {
      const nextHour = (hour12 % 12) + 1;
      return `quarter to ${nextHour} ${period}`;
    }

    return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
  }
}

/**
 * Format duration in minutes for voice output
 */
export function formatDurationForVoice(
  minutes: number,
  locale: SupportedLocale
): string {
  if (minutes < 60) {
    if (locale === 'es-MX') {
      return minutes === 1 ? 'un minuto' : `${minutes} minutos`;
    }
    return minutes === 1 ? 'one minute' : `${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    if (locale === 'es-MX') {
      return hours === 1 ? 'una hora' : `${hours} horas`;
    }
    return hours === 1 ? 'one hour' : `${hours} hours`;
  }

  if (locale === 'es-MX') {
    const hourPart = hours === 1 ? 'una hora' : `${hours} horas`;
    const minutePart =
      remainingMinutes === 1 ? 'un minuto' : `${remainingMinutes} minutos`;
    return `${hourPart} y ${minutePart}`;
  }

  const hourPart = hours === 1 ? 'one hour' : `${hours} hours`;
  const minutePart =
    remainingMinutes === 1 ? 'one minute' : `${remainingMinutes} minutes`;
  return `${hourPart} and ${minutePart}`;
}

/**
 * Get time of day classification
 */
export function getTimeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Get greeting for time of day
 */
export function getGreetingForTimeOfDay(
  timeOfDay: TimeOfDay,
  locale: SupportedLocale,
  i18n?: I18nTranslations
): string {
  if (i18n?.greetings) {
    return i18n.greetings[timeOfDay];
  }

  const greetings = {
    'es-MX': {
      morning: 'Buenos días',
      afternoon: 'Buenas tardes',
      evening: 'Buenas noches',
      night: 'Buenas noches',
    },
    'en-US': {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      night: 'Good evening',
    },
  };

  return greetings[locale][timeOfDay];
}

// =====================================================
// DATE FORMATTING
// =====================================================

const DAY_NAMES = {
  'es-MX': [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ],
  'en-US': [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ],
};

const MONTH_NAMES = {
  'es-MX': [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  'en-US': [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

/**
 * Format date for voice output
 */
export function formatDateForVoice(
  date: Date,
  locale: SupportedLocale,
  includeYear: boolean = false
): string {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const dayOfWeek = date.getDay();

  const dayName = DAY_NAMES[locale][dayOfWeek];
  const monthName = MONTH_NAMES[locale][month];

  if (locale === 'es-MX') {
    const datePart = `${dayName} ${day} de ${monthName}`;
    return includeYear ? `${datePart} de ${year}` : datePart;
  } else {
    const ordinal = getOrdinalSuffix(day);
    const datePart = `${dayName}, ${monthName} ${day}${ordinal}`;
    return includeYear ? `${datePart}, ${year}` : datePart;
  }
}

/**
 * Format relative date for voice output
 */
export function formatRelativeDateForVoice(
  date: Date,
  locale: SupportedLocale,
  i18n?: I18nTranslations
): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return i18n?.time?.today || (locale === 'es-MX' ? 'hoy' : 'today');
  }

  if (diffDays === 1) {
    return i18n?.time?.tomorrow || (locale === 'es-MX' ? 'mañana' : 'tomorrow');
  }

  if (diffDays === -1) {
    return (
      i18n?.time?.yesterday || (locale === 'es-MX' ? 'ayer' : 'yesterday')
    );
  }

  if (diffDays > 1 && diffDays <= 7) {
    // Within a week
    const dayName = DAY_NAMES[locale][date.getDay()];
    if (locale === 'es-MX') {
      return `el ${dayName}`;
    }
    return `on ${dayName}`;
  }

  // More than a week, use full date
  return formatDateForVoice(date, locale);
}

/**
 * Get ordinal suffix for a number (English)
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// =====================================================
// LIST FORMATTING
// =====================================================

/**
 * Format a list for voice output with natural conjunction
 */
export function formatListForVoice(
  items: string[],
  locale: SupportedLocale,
  conjunction: 'and' | 'or' = 'and'
): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) {
    const conjWord =
      locale === 'es-MX'
        ? conjunction === 'and'
          ? 'y'
          : 'o'
        : conjunction;
    return `${items[0]} ${conjWord} ${items[1]}`;
  }

  const lastItem = items[items.length - 1];
  const otherItems = items.slice(0, -1);
  const conjWord =
    locale === 'es-MX'
      ? conjunction === 'and'
        ? 'y'
        : 'o'
      : conjunction;

  return `${otherItems.join(', ')} ${conjWord} ${lastItem}`;
}

/**
 * Format count with noun
 */
export function formatCountWithNoun(
  count: number,
  singular: string,
  plural: string,
  locale: SupportedLocale
): string {
  if (count === 1) {
    if (locale === 'es-MX') {
      // Handle Spanish gender agreement
      if (singular.endsWith('a')) {
        return `una ${singular}`;
      }
      return `un ${singular}`;
    }
    return `one ${singular}`;
  }

  return `${count} ${plural}`;
}

// =====================================================
// PHONE NUMBER FORMATTING
// =====================================================

/**
 * Format phone number for voice output
 */
export function formatPhoneForVoice(
  phone: string,
  locale: SupportedLocale
): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  if (locale === 'es-MX') {
    // Mexican phone format: read in pairs or groups
    if (digits.length === 10) {
      // Format: XXX XXX XX XX
      const parts = [
        digits.slice(0, 3),
        digits.slice(3, 6),
        digits.slice(6, 8),
        digits.slice(8, 10),
      ];
      return parts.join(' ');
    }
  } else {
    // US format: read in groups
    if (digits.length === 10) {
      // Format: XXX-XXX-XXXX
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }

  // Return as-is if doesn't match expected format
  return phone;
}

// =====================================================
// SCHEDULE FORMATTING
// =====================================================

/**
 * Format schedule range for voice output
 */
export function formatScheduleRangeForVoice(
  openTime: string,
  closeTime: string,
  locale: SupportedLocale
): string {
  const formattedOpen = formatTimeForVoice(openTime, locale);
  const formattedClose = formatTimeForVoice(closeTime, locale);

  if (locale === 'es-MX') {
    return `de ${formattedOpen} a ${formattedClose}`;
  }
  return `from ${formattedOpen} to ${formattedClose}`;
}

/**
 * Format day range for voice output (e.g., "Monday to Friday")
 */
export function formatDayRangeForVoice(
  startDay: number,
  endDay: number,
  locale: SupportedLocale
): string {
  const startName = DAY_NAMES[locale][startDay];
  const endName = DAY_NAMES[locale][endDay];

  if (startDay === endDay) {
    return startName;
  }

  if (locale === 'es-MX') {
    return `${startName} a ${endName}`;
  }
  return `${startName} to ${endName}`;
}

// =====================================================
// FACTORY / UTILITY
// =====================================================

/**
 * Create a locale-bound formatter
 */
export function createFormatter(
  locale: SupportedLocale,
  i18n?: I18nTranslations
) {
  return {
    number: (n: number) => numberToWords(n, locale),
    price: (amount: number, currency: string) =>
      formatPriceForVoice(amount, currency, locale, i18n),
    priceRange: (from: number, to: number, currency: string) =>
      formatPriceRangeForVoice(from, to, currency, locale),
    time: (time: string) => formatTimeForVoice(time, locale),
    duration: (minutes: number) => formatDurationForVoice(minutes, locale),
    date: (date: Date, includeYear?: boolean) =>
      formatDateForVoice(date, locale, includeYear),
    relativeDate: (date: Date) => formatRelativeDateForVoice(date, locale, i18n),
    list: (items: string[], conjunction?: 'and' | 'or') =>
      formatListForVoice(items, locale, conjunction),
    count: (count: number, singular: string, plural: string) =>
      formatCountWithNoun(count, singular, plural, locale),
    phone: (phone: string) => formatPhoneForVoice(phone, locale),
    scheduleRange: (open: string, close: string) =>
      formatScheduleRangeForVoice(open, close, locale),
    greeting: () => getGreetingForTimeOfDay(getTimeOfDay(new Date()), locale, i18n),
  };
}
