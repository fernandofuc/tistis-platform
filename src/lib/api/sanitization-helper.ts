// =====================================================
// TIS TIS PLATFORM - API Sanitization Helper
// Centralized input sanitization for API routes
// =====================================================

// ======================
// TEXT SANITIZATION
// ======================

/**
 * Sanitize text to prevent XSS - strips HTML tags and limits length
 */
export function sanitizeText(text: unknown, maxLength = 1000): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;

  const sanitized = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '')    // Remove any remaining angle brackets
    .trim();

  return sanitized.slice(0, maxLength) || null;
}

// ======================
// NUMBER SANITIZATION
// ======================

/**
 * Validate and sanitize numeric values within a range
 */
export function sanitizeNumber(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

/**
 * Validate positive price (prevents negative prices and overflow)
 */
export function sanitizePrice(value: unknown, maxValue = 999999.99): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.max(0, Math.min(maxValue, Math.round(num * 100) / 100));
}

/**
 * Validate integer within range
 */
export function sanitizeInteger(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

// ======================
// SPECIAL VALUE SANITIZATION
// ======================

/**
 * Validate hex color format
 */
export function sanitizeColor(color: unknown, defaultColor = '#3B82F6'): string {
  if (typeof color !== 'string') return defaultColor;
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexRegex.test(color) ? color : defaultColor;
}

/**
 * Validate IPv4 address format
 */
export function sanitizeIP(ip: unknown): string | null {
  if (typeof ip !== 'string' || !ip) return null;
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip) ? ip : null;
}

/**
 * Validate latitude (-90 to 90)
 */
export function sanitizeLatitude(lat: unknown): number | null {
  if (typeof lat !== 'number' || !isFinite(lat)) return null;
  return Math.max(-90, Math.min(90, lat));
}

/**
 * Validate longitude (-180 to 180)
 */
export function sanitizeLongitude(lng: unknown): number | null {
  if (typeof lng !== 'number' || !isFinite(lng)) return null;
  return Math.max(-180, Math.min(180, lng));
}

// ======================
// OBJECT SANITIZATION
// ======================

/**
 * Sanitize delivery address JSONB
 */
export function sanitizeDeliveryAddress(
  address: unknown
): Record<string, unknown> | null {
  if (!address || typeof address !== 'object') return null;
  const addr = address as Record<string, unknown>;

  return {
    street: sanitizeText(addr.street, 255) || '',
    number: sanitizeText(addr.number, 50) || '',
    apartment: sanitizeText(addr.apartment, 50) || null,
    city: sanitizeText(addr.city, 100) || '',
    state: sanitizeText(addr.state, 100) || null,
    postal_code: sanitizeText(addr.postal_code, 20) || '',
    country: sanitizeText(addr.country, 100) || null,
    lat: sanitizeLatitude(addr.lat),
    lng: sanitizeLongitude(addr.lng),
    reference: sanitizeText(addr.reference, 255) || null,
  };
}

/**
 * Sanitize add-on object for restaurant orders
 */
export function sanitizeAddOn(
  addon: unknown
): { name: string; price: number; quantity?: number } | null {
  if (!addon || typeof addon !== 'object') return null;
  const a = addon as Record<string, unknown>;
  const name = sanitizeText(a.name, 100);
  if (!name) return null;
  return {
    name,
    price: sanitizePrice(a.price),
    quantity: a.quantity !== undefined ? sanitizeInteger(a.quantity, 1, 10, 1) : undefined,
  };
}

/**
 * Sanitize modifier object for restaurant orders
 */
export function sanitizeModifier(
  mod: unknown
): { type: string; item: string; notes?: string } | null {
  if (!mod || typeof mod !== 'object') return null;
  const m = mod as Record<string, unknown>;
  const validTypes = ['remove', 'extra', 'substitute', 'no', 'light', 'heavy'];
  const type = typeof m.type === 'string' && validTypes.includes(m.type) ? m.type : null;
  const item = sanitizeText(m.item, 100);
  if (!type || !item) return null;
  return {
    type,
    item,
    notes: sanitizeText(m.notes, 200) || undefined,
  };
}

// ======================
// ARRAY SANITIZATION
// ======================

/**
 * Sanitize array of add-ons with limit
 */
export function sanitizeAddOns(
  addons: unknown,
  maxItems = 20
): { name: string; price: number; quantity?: number }[] {
  if (!Array.isArray(addons)) return [];
  return addons
    .slice(0, maxItems)
    .map(sanitizeAddOn)
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

/**
 * Sanitize array of modifiers with limit
 */
export function sanitizeModifiers(
  modifiers: unknown,
  maxItems = 20
): { type: string; item: string; notes?: string }[] {
  if (!Array.isArray(modifiers)) return [];
  return modifiers
    .slice(0, maxItems)
    .map(sanitizeModifier)
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

/**
 * Sanitize array of UUIDs (for IDs)
 */
export function sanitizeUUIDs(
  ids: unknown,
  maxItems = 50,
  isValidUUID: (str: string) => boolean
): string[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .slice(0, maxItems)
    .filter((id): id is string => typeof id === 'string' && isValidUUID(id));
}

// ======================
// VALIDATION CONSTANTS
// ======================

export const LIMITS = {
  MAX_ITEMS_PER_ORDER: 50,
  MAX_QUERY_LIMIT: 200,
  MAX_ADDONS_PER_ITEM: 20,
  MAX_TEXT_SHORT: 100,
  MAX_TEXT_MEDIUM: 255,
  MAX_TEXT_LONG: 500,
  MAX_TEXT_XLARGE: 1000,
  MAX_NOTES: 2000,
} as const;

export const VALID_ORDER_TYPES = [
  'dine_in',
  'takeout',
  'delivery',
  'drive_thru',
  'catering',
] as const;

export const VALID_KITCHEN_STATIONS = [
  'main',
  'grill',
  'fry',
  'salad',
  'sushi',
  'pizza',
  'dessert',
  'bar',
  'expeditor',
  'prep',
  'assembly',
] as const;

export const VALID_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'completed',
  'cancelled',
] as const;

export const VALID_ITEM_STATUSES = [
  'pending',
  'preparing',
  'ready',
  'served',
  'cancelled',
] as const;

export type OrderType = (typeof VALID_ORDER_TYPES)[number];
export type KitchenStation = (typeof VALID_KITCHEN_STATIONS)[number];
export type OrderStatus = (typeof VALID_ORDER_STATUSES)[number];
export type ItemStatus = (typeof VALID_ITEM_STATUSES)[number];
