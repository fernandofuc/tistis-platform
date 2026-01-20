/**
 * TIS TIS Platform - Voice Agent v2.0
 * Voice Formatters
 *
 * Utility functions for formatting data for voice output.
 * Converts dates, times, prices, and lists into natural speech patterns.
 */

// =====================================================
// NUMBER FORMATTERS
// =====================================================

/**
 * Spanish number words
 */
const SPANISH_NUMBERS: Record<number, string> = {
  0: 'cero',
  1: 'uno',
  2: 'dos',
  3: 'tres',
  4: 'cuatro',
  5: 'cinco',
  6: 'seis',
  7: 'siete',
  8: 'ocho',
  9: 'nueve',
  10: 'diez',
  11: 'once',
  12: 'doce',
  13: 'trece',
  14: 'catorce',
  15: 'quince',
  16: 'dieciséis',
  17: 'diecisiete',
  18: 'dieciocho',
  19: 'diecinueve',
  20: 'veinte',
  21: 'veintiuno',
  22: 'veintidós',
  23: 'veintitrés',
  24: 'veinticuatro',
  25: 'veinticinco',
  26: 'veintiséis',
  27: 'veintisiete',
  28: 'veintiocho',
  29: 'veintinueve',
  30: 'treinta',
  40: 'cuarenta',
  50: 'cincuenta',
  60: 'sesenta',
  70: 'setenta',
  80: 'ochenta',
  90: 'noventa',
  100: 'cien',
};

/**
 * English number words
 */
const ENGLISH_NUMBERS: Record<number, string> = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
  13: 'thirteen',
  14: 'fourteen',
  15: 'fifteen',
  16: 'sixteen',
  17: 'seventeen',
  18: 'eighteen',
  19: 'nineteen',
  20: 'twenty',
  30: 'thirty',
  40: 'forty',
  50: 'fifty',
  60: 'sixty',
  70: 'seventy',
  80: 'eighty',
  90: 'ninety',
  100: 'one hundred',
};

/**
 * Format a small number as words
 */
export function formatSmallNumberForVoice(num: number, locale: string = 'es'): string {
  const numbers = locale === 'en' ? ENGLISH_NUMBERS : SPANISH_NUMBERS;

  if (num < 0) {
    const absWord = formatSmallNumberForVoice(Math.abs(num), locale);
    return locale === 'en' ? `negative ${absWord}` : `menos ${absWord}`;
  }

  if (numbers[num] !== undefined) {
    return numbers[num];
  }

  if (num < 100) {
    const tens = Math.floor(num / 10) * 10;
    const ones = num % 10;
    const tensWord = numbers[tens];
    const onesWord = numbers[ones];

    if (locale === 'en') {
      return `${tensWord}-${onesWord}`;
    } else {
      return `${tensWord} y ${onesWord}`;
    }
  }

  // For numbers >= 100, just return as string
  return num.toString();
}

// =====================================================
// DATE FORMATTERS
// =====================================================

/**
 * Spanish day names
 */
const SPANISH_DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Spanish month names
 */
const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * English day names
 */
const ENGLISH_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * English month names
 */
const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Format date for voice output
 * "2024-01-20" → "lunes veinte de enero"
 */
export function formatDateForVoice(date: string | Date, locale: string = 'es'): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;

  if (isNaN(d.getTime())) {
    return date.toString();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const inputDate = new Date(d);
  inputDate.setHours(0, 0, 0, 0);

  // Check for special dates
  if (inputDate.getTime() === today.getTime()) {
    return locale === 'en' ? 'today' : 'hoy';
  }

  if (inputDate.getTime() === tomorrow.getTime()) {
    return locale === 'en' ? 'tomorrow' : 'mañana';
  }

  const dayOfWeek = d.getDay();
  const dayOfMonth = d.getDate();
  const month = d.getMonth();

  if (locale === 'en') {
    const dayName = ENGLISH_DAYS[dayOfWeek];
    const monthName = ENGLISH_MONTHS[month];
    return `${dayName}, ${monthName} ${dayOfMonth}`;
  }

  const dayName = SPANISH_DAYS[dayOfWeek];
  const monthName = SPANISH_MONTHS[month];
  const dayWord = dayOfMonth <= 30 ? formatSmallNumberForVoice(dayOfMonth, 'es') : dayOfMonth.toString();

  return `${dayName} ${dayWord} de ${monthName}`;
}

/**
 * Format date in short form for confirmation
 */
export function formatDateShort(date: string | Date, locale: string = 'es'): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;

  if (isNaN(d.getTime())) {
    return date.toString();
  }

  const dayOfMonth = d.getDate();
  const month = d.getMonth();

  if (locale === 'en') {
    return `${ENGLISH_MONTHS[month]} ${dayOfMonth}`;
  }

  return `${dayOfMonth} de ${SPANISH_MONTHS[month]}`;
}

// =====================================================
// TIME FORMATTERS
// =====================================================

/**
 * Format time for voice output
 * "19:30" → "siete y media de la noche"
 */
export function formatTimeForVoice(time: string, locale: string = 'es'): string {
  const parts = time.split(':');
  if (parts.length < 2) {
    return time;
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) {
    return time;
  }

  if (locale === 'en') {
    return formatTimeEnglish(hours, minutes);
  }

  return formatTimeSpanish(hours, minutes);
}

/**
 * Format time in Spanish
 */
function formatTimeSpanish(hours: number, minutes: number): string {
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  let period: string;
  if (hours < 12) {
    period = 'de la mañana';
  } else if (hours < 18) {
    period = 'de la tarde';
  } else {
    period = 'de la noche';
  }

  const hourWord = formatSmallNumberForVoice(hour12, 'es');

  if (minutes === 0) {
    return `${hourWord} ${period}`;
  } else if (minutes === 15) {
    return `${hourWord} y cuarto ${period}`;
  } else if (minutes === 30) {
    return `${hourWord} y media ${period}`;
  } else if (minutes === 45) {
    const nextHour = hour12 === 12 ? 1 : hour12 + 1;
    const nextHourWord = formatSmallNumberForVoice(nextHour, 'es');
    return `cuarto para las ${nextHourWord} ${period}`;
  } else {
    const minuteWord = formatSmallNumberForVoice(minutes, 'es');
    return `${hourWord} con ${minuteWord} ${period}`;
  }
}

/**
 * Format time in English
 */
function formatTimeEnglish(hours: number, minutes: number): string {
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours < 12 ? 'AM' : 'PM';

  if (minutes === 0) {
    return `${hour12} ${period}`;
  } else if (minutes === 15) {
    return `quarter past ${hour12} ${period}`;
  } else if (minutes === 30) {
    return `half past ${hour12} ${period}`;
  } else if (minutes === 45) {
    const nextHour = hour12 === 12 ? 1 : hour12 + 1;
    return `quarter to ${nextHour} ${period}`;
  } else {
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
}

/**
 * Format time in short form
 */
export function formatTimeShort(time: string, locale: string = 'es'): string {
  const parts = time.split(':');
  if (parts.length < 2) {
    return time;
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) {
    return time;
  }

  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = locale === 'en'
    ? (hours < 12 ? 'AM' : 'PM')
    : (hours < 12 ? 'am' : 'pm');

  if (minutes === 0) {
    return `${hour12} ${period}`;
  }

  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// =====================================================
// PRICE FORMATTERS
// =====================================================

/**
 * Format price for voice output
 * 150.50 → "ciento cincuenta pesos con cincuenta centavos"
 */
export function formatPriceForVoice(
  price: number,
  currency: string = 'MXN',
  locale: string = 'es'
): string {
  const pesos = Math.floor(price);
  const centavos = Math.round((price - pesos) * 100);

  const currencyWord = getCurrencyWord(currency, pesos, locale);
  const centavosWord = locale === 'en' ? 'cents' : 'centavos';

  if (locale === 'en') {
    if (centavos === 0) {
      return `${pesos} ${currencyWord}`;
    }
    return `${pesos} ${currencyWord} and ${centavos} ${centavosWord}`;
  }

  // Spanish
  if (centavos === 0) {
    return `${pesos} ${currencyWord}`;
  }

  return `${pesos} ${currencyWord} con ${centavos} ${centavosWord}`;
}

/**
 * Get currency word based on currency code
 */
function getCurrencyWord(currency: string, amount: number, locale: string): string {
  const plural = amount !== 1;

  const currencies: Record<string, { es: [string, string]; en: [string, string] }> = {
    MXN: { es: ['peso', 'pesos'], en: ['peso', 'pesos'] },
    USD: { es: ['dólar', 'dólares'], en: ['dollar', 'dollars'] },
    EUR: { es: ['euro', 'euros'], en: ['euro', 'euros'] },
  };

  const curr = currencies[currency] || currencies.MXN;
  const words = locale === 'en' ? curr.en : curr.es;

  return plural ? words[1] : words[0];
}

/**
 * Format price as simple string
 */
export function formatPriceSimple(price: number, currency: string = 'MXN'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '$';
  return `${symbol}${price.toFixed(2)}`;
}

// =====================================================
// LIST FORMATTERS
// =====================================================

/**
 * Format list for voice output with proper conjunctions
 * ["a", "b", "c"] → "a, b y c"
 */
export function formatListForVoice(items: string[], locale: string = 'es'): string {
  if (items.length === 0) {
    return '';
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    const conjunction = locale === 'en' ? 'and' : 'y';
    return `${items[0]} ${conjunction} ${items[1]}`;
  }

  const conjunction = locale === 'en' ? 'and' : 'y';
  const allButLast = items.slice(0, -1).join(', ');
  const last = items[items.length - 1];

  return `${allButLast} ${conjunction} ${last}`;
}

/**
 * Format list with "or" conjunction for alternatives
 * ["a", "b", "c"] → "a, b o c"
 */
export function formatAlternativesForVoice(items: string[], locale: string = 'es'): string {
  if (items.length === 0) {
    return '';
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    const conjunction = locale === 'en' ? 'or' : 'o';
    return `${items[0]} ${conjunction} ${items[1]}`;
  }

  const conjunction = locale === 'en' ? 'or' : 'o';
  const allButLast = items.slice(0, -1).join(', ');
  const last = items[items.length - 1];

  return `${allButLast} ${conjunction} ${last}`;
}

// =====================================================
// MENU FORMATTERS
// =====================================================

/**
 * Menu item for formatting
 */
export interface MenuItem {
  name: string;
  price?: number;
  description?: string;
  category?: string;
}

/**
 * Format menu items for voice output
 */
export function formatMenuForVoice(
  items: MenuItem[],
  options: { includePrices?: boolean; maxItems?: number; locale?: string } = {}
): string {
  const { includePrices = true, maxItems = 5, locale = 'es' } = options;

  if (items.length === 0) {
    return locale === 'en' ? 'No items available' : 'No hay artículos disponibles';
  }

  const limited = items.slice(0, maxItems);

  const formatted = limited.map(item => {
    if (includePrices && item.price !== undefined) {
      return locale === 'en'
        ? `${item.name} for ${item.price} pesos`
        : `${item.name} a ${item.price} pesos`;
    }
    return item.name;
  });

  let result = formatListForVoice(formatted, locale);

  if (items.length > maxItems) {
    const remaining = items.length - maxItems;
    result += locale === 'en'
      ? `, and ${remaining} more options`
      : `, y ${remaining} opciones más`;
  }

  return result;
}

/**
 * Format menu grouped by category
 */
export function formatMenuByCategoryForVoice(
  items: MenuItem[],
  options: { includePrices?: boolean; maxPerCategory?: number; locale?: string } = {}
): string {
  const { includePrices = true, maxPerCategory = 3, locale = 'es' } = options;

  // Group by category
  const byCategory: Record<string, MenuItem[]> = {};
  for (const item of items) {
    const cat = item.category || (locale === 'en' ? 'Other' : 'Otros');
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat].push(item);
  }

  const parts: string[] = [];

  for (const [category, categoryItems] of Object.entries(byCategory)) {
    const limited = categoryItems.slice(0, maxPerCategory);
    const itemNames = limited.map(item => {
      if (includePrices && item.price !== undefined) {
        return locale === 'en'
          ? `${item.name} for ${item.price} pesos`
          : `${item.name} a ${item.price} pesos`;
      }
      return item.name;
    });

    const intro = locale === 'en' ? `In ${category}: ` : `En ${category}: `;
    parts.push(intro + formatListForVoice(itemNames, locale));
  }

  return parts.join('. ');
}

// =====================================================
// TIME SLOTS FORMATTERS
// =====================================================

/**
 * Format available time slots for voice
 */
export function formatSlotsForVoice(
  slots: string[],
  options: { maxSlots?: number; locale?: string } = {}
): string {
  const { maxSlots = 4, locale = 'es' } = options;

  if (slots.length === 0) {
    return locale === 'en' ? 'No available times' : 'No hay horarios disponibles';
  }

  const limited = slots.slice(0, maxSlots);
  const formatted = limited.map(slot => formatTimeShort(slot, locale));

  let result = formatAlternativesForVoice(formatted, locale);

  if (slots.length > maxSlots) {
    const remaining = slots.length - maxSlots;
    result += locale === 'en'
      ? `, and ${remaining} more options`
      : `, y ${remaining} opciones más`;
  }

  return result;
}

// =====================================================
// DURATION FORMATTERS
// =====================================================

/**
 * Format duration in minutes for voice
 * 90 → "una hora y media"
 */
export function formatDurationForVoice(minutes: number, locale: string = 'es'): string {
  if (minutes < 60) {
    if (locale === 'en') {
      return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    }
    return minutes === 1 ? 'un minuto' : `${minutes} minutos`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (locale === 'en') {
    if (remainingMinutes === 0) {
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    if (remainingMinutes === 30) {
      return hours === 1 ? '1 and a half hours' : `${hours} and a half hours`;
    }
    return `${hours} hours and ${remainingMinutes} minutes`;
  }

  // Spanish
  if (remainingMinutes === 0) {
    return hours === 1 ? 'una hora' : `${hours} horas`;
  }
  if (remainingMinutes === 30) {
    return hours === 1 ? 'una hora y media' : `${hours} horas y media`;
  }
  return hours === 1
    ? `una hora y ${remainingMinutes} minutos`
    : `${hours} horas y ${remainingMinutes} minutos`;
}

// =====================================================
// PHONE FORMATTERS
// =====================================================

/**
 * Format phone number for voice (spell out)
 */
export function formatPhoneForVoice(phone: string, locale: string = 'es'): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  // Format in groups for easier listening
  const groups: string[] = [];

  // Mexican format: 55 1234 5678
  if (digits.length === 10) {
    groups.push(digits.slice(0, 2));
    groups.push(digits.slice(2, 6));
    groups.push(digits.slice(6));
  } else {
    // Generic: groups of 3-4
    for (let i = 0; i < digits.length; i += 4) {
      groups.push(digits.slice(i, i + 4));
    }
  }

  // Spell each group
  return groups
    .map(group => {
      return group
        .split('')
        .map(d => formatSmallNumberForVoice(parseInt(d, 10), locale))
        .join(' ');
    })
    .join(', ');
}

// =====================================================
// CONFIRMATION CODE FORMATTERS
// =====================================================

/**
 * Format confirmation code for voice (spell out letters)
 */
export function formatConfirmationCodeForVoice(code: string, locale: string = 'es'): string {
  // Spell each character
  return code
    .toUpperCase()
    .split('')
    .map(char => {
      if (/[0-9]/.test(char)) {
        return formatSmallNumberForVoice(parseInt(char, 10), locale);
      }
      // For letters, just return as-is (TTS will spell it)
      return char;
    })
    .join(', ');
}

// =====================================================
// PARTY SIZE FORMATTERS
// =====================================================

/**
 * Format party size for voice
 */
export function formatPartySizeForVoice(size: number, locale: string = 'es'): string {
  if (locale === 'en') {
    if (size === 1) return 'one person';
    if (size === 2) return 'two people';
    return `${size} people`;
  }

  if (size === 1) return 'una persona';
  if (size === 2) return 'dos personas';
  return `${size} personas`;
}

// =====================================================
// BUSINESS HOURS FORMATTERS
// =====================================================

/**
 * Business hours entry
 */
export interface BusinessHoursEntry {
  day: string;
  open: string;
  close: string;
  isClosed?: boolean;
}

/**
 * Format business hours for voice
 */
export function formatBusinessHoursForVoice(
  hours: BusinessHoursEntry[],
  options: { forToday?: boolean; locale?: string } = {}
): string {
  const { forToday = false, locale = 'es' } = options;

  if (hours.length === 0) {
    return locale === 'en' ? 'Hours not available' : 'Horarios no disponibles';
  }

  if (forToday) {
    const today = hours[0];
    if (today.isClosed) {
      return locale === 'en' ? "We're closed today" : 'Hoy estamos cerrados';
    }
    const openTime = formatTimeShort(today.open, locale);
    const closeTime = formatTimeShort(today.close, locale);
    return locale === 'en'
      ? `Today we're open from ${openTime} to ${closeTime}`
      : `Hoy abrimos de ${openTime} a ${closeTime}`;
  }

  // Format multiple days
  const parts = hours.slice(0, 3).map(entry => {
    if (entry.isClosed) {
      return locale === 'en'
        ? `${entry.day}: closed`
        : `${entry.day}: cerrado`;
    }
    const openTime = formatTimeShort(entry.open, locale);
    const closeTime = formatTimeShort(entry.close, locale);
    return locale === 'en'
      ? `${entry.day}: ${openTime} to ${closeTime}`
      : `${entry.day}: de ${openTime} a ${closeTime}`;
  });

  return parts.join('. ');
}
