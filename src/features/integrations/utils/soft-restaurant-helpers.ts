// =====================================================
// TIS TIS PLATFORM - SoftRestaurant Helper Utilities
// Common utility functions for SR integration
// =====================================================

import type {
  SRWebhookSale,
  SRWebhookSaleItem,
  SRWebhookPayment,
} from '../types/integration.types';
import type {
  SRSaleEntity,
  SRSaleItemEntity,
  SRPaymentEntity,
} from '../types/soft-restaurant.types';

// ========================================
// DATA TRANSFORMATION
// ========================================

/**
 * Calculate totals from SR sale items
 * Useful for validation
 */
export function calculateSaleTotals(items: SRWebhookSaleItem[]): {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
} {
  let subtotal = 0;
  let tax = 0;
  let discount = 0;

  for (const item of items) {
    subtotal += item.Importe || 0;
    discount += item.Descuento || 0;

    if (item.Impuestos && Array.isArray(item.Impuestos)) {
      for (const impuesto of item.Impuestos) {
        tax += impuesto.Importe || 0;
      }
    }
  }

  const total = subtotal + tax - discount;

  return { subtotal, tax, discount, total };
}

/**
 * Normalize currency code
 */
export function normalizeCurrency(currency?: string): string {
  if (!currency) return 'MXN';

  const normalized = currency.toUpperCase().trim();

  // Common variations
  const currencyMap: Record<string, string> = {
    PESO: 'MXN',
    PESOS: 'MXN',
    MX: 'MXN',
    DOLLAR: 'USD',
    DOLLARS: 'USD',
    DOLAR: 'USD',
    DOLARES: 'USD',
  };

  return currencyMap[normalized] || normalized;
}

/**
 * Normalize date to ISO 8601
 */
export function normalizeDate(date: string): string {
  try {
    return new Date(date).toISOString();
  } catch {
    // If invalid, return current timestamp
    return new Date().toISOString();
  }
}

/**
 * Sanitize product name for matching
 */
export function sanitizeProductName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Calculate similarity between two strings (Levenshtein distance)
 * Returns 0.0 (no match) to 1.0 (exact match)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = sanitizeProductName(str1);
  const s2 = sanitizeProductName(str2);

  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0.0;

  const matrix: number[][] = [];

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);

  return 1 - distance / maxLen;
}

// ========================================
// VALIDATION HELPERS
// ========================================

/**
 * Check if sale is within duplicate detection window
 */
export function isWithinDuplicateWindow(
  saleDate: string,
  windowMinutes: number
): boolean {
  const saleTime = new Date(saleDate).getTime();
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;

  return now - saleTime <= windowMs;
}

/**
 * Validate payment methods sum to total
 */
export function validatePayments(
  payments: SRWebhookPayment[],
  expectedTotal: number,
  tolerance: number = 0.01
): boolean {
  const paymentTotal = payments.reduce((sum, p) => sum + p.Monto, 0);
  const difference = Math.abs(paymentTotal - expectedTotal);

  return difference <= tolerance;
}

/**
 * Validate item totals match calculated values
 */
export function validateItemTotals(
  item: SRWebhookSaleItem,
  tolerance: number = 0.01
): boolean {
  const expectedSubtotal = item.Precio * item.Cantidad;
  const difference = Math.abs(item.Importe - expectedSubtotal);

  return difference <= tolerance;
}

// ========================================
// FORMATTING HELPERS
// ========================================

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currency: string = 'MXN'
): string {
  const locale = currency === 'MXN' ? 'es-MX' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(date: string, locale: string = 'es-MX'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Generate friendly sale summary
 */
export function generateSaleSummary(sale: SRSaleEntity): string {
  const productos = sale.raw_payload.Productos as Array<unknown> | undefined;
  const items = productos?.length || 0;
  const date = formatDate(sale.opened_at);

  return `${sale.folio_venta} - ${items} items - ${formatCurrency(
    sale.total,
    sale.currency
  )} - ${date}`;
}

// ========================================
// STATISTICAL HELPERS
// ========================================

/**
 * Calculate average ticket
 */
export function calculateAverageTicket(sales: SRSaleEntity[]): number {
  if (sales.length === 0) return 0;

  const total = sales.reduce((sum, sale) => sum + sale.total, 0);
  return total / sales.length;
}

/**
 * Calculate revenue by sale type
 */
export function calculateRevenueByType(
  sales: SRSaleEntity[]
): Record<string, number> {
  const revenue: Record<string, number> = {};

  for (const sale of sales) {
    const type = sale.sale_type || 'unknown';
    revenue[type] = (revenue[type] || 0) + sale.total;
  }

  return revenue;
}

/**
 * Calculate revenue by payment method
 */
export function calculateRevenueByPaymentMethod(
  payments: SRPaymentEntity[]
): Record<string, number> {
  const revenue: Record<string, number> = {};

  for (const payment of payments) {
    const method = payment.payment_method;
    revenue[method] = (revenue[method] || 0) + payment.amount;
  }

  return revenue;
}

/**
 * Get top selling products
 */
export function getTopSellingProducts(
  items: SRSaleItemEntity[],
  limit: number = 10
): Array<{
  productCode: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}> {
  const productStats: Record<
    string,
    { name: string; quantity: number; revenue: number }
  > = {};

  for (const item of items) {
    const code = item.product_code;

    if (!productStats[code]) {
      productStats[code] = {
        name: item.product_name,
        quantity: 0,
        revenue: 0,
      };
    }

    productStats[code].quantity += item.quantity;
    productStats[code].revenue +=
      item.subtotal_without_tax + item.tax_amount - item.discount_amount;
  }

  return Object.entries(productStats)
    .map(([code, stats]) => ({
      productCode: code,
      productName: stats.name,
      quantitySold: stats.quantity,
      revenue: stats.revenue,
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, limit);
}

// ========================================
// ERROR HANDLING HELPERS
// ========================================

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('enotfound')
  ) {
    return true;
  }

  // Database temporary errors
  if (
    message.includes('deadlock') ||
    message.includes('lock timeout') ||
    message.includes('connection') ||
    message.includes('too many')
  ) {
    return true;
  }

  return false;
}

/**
 * Get retry delay based on attempt number (exponential backoff)
 */
export function getRetryDelay(attemptNumber: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds

  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);

  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);

  return delay + jitter;
}

// ========================================
// CONVERSION HELPERS
// ========================================

/**
 * Convert SR sale type to restaurant order type
 */
export function convertSaleTypeToOrderType(
  srSaleType?: string | null
): 'dine_in' | 'takeout' | 'delivery' {
  if (!srSaleType) return 'dine_in';

  const normalized = srSaleType.toLowerCase().trim();

  if (
    normalized.includes('mesa') ||
    normalized.includes('dine') ||
    normalized.includes('local')
  ) {
    return 'dine_in';
  }

  if (
    normalized.includes('llevar') ||
    normalized.includes('takeout') ||
    normalized.includes('take out') ||
    normalized.includes('para llevar')
  ) {
    return 'takeout';
  }

  if (
    normalized.includes('domicilio') ||
    normalized.includes('delivery') ||
    normalized.includes('entrega')
  ) {
    return 'delivery';
  }

  return 'dine_in';
}

/**
 * Convert SR payment method to standardized value
 */
export function convertPaymentMethod(srMethod: string): string {
  const normalized = srMethod.toLowerCase().trim();

  const methodMap: Record<string, string> = {
    efectivo: 'cash',
    cash: 'cash',
    tarjeta: 'card',
    'tarjeta de credito': 'credit_card',
    'tarjeta de debito': 'debit_card',
    'credit card': 'credit_card',
    'debit card': 'debit_card',
    transferencia: 'transfer',
    transfer: 'transfer',
    vales: 'voucher',
    voucher: 'voucher',
  };

  return methodMap[normalized] || srMethod;
}

// ========================================
// EXPORT ALL
// ========================================

export const SRHelpers = {
  // Transformation
  calculateSaleTotals,
  normalizeCurrency,
  normalizeDate,
  sanitizeProductName,
  calculateSimilarity,

  // Validation
  isWithinDuplicateWindow,
  validatePayments,
  validateItemTotals,

  // Formatting
  formatCurrency,
  formatDate,
  generateSaleSummary,

  // Statistics
  calculateAverageTicket,
  calculateRevenueByType,
  calculateRevenueByPaymentMethod,
  getTopSellingProducts,

  // Error handling
  isRetryableError,
  getRetryDelay,

  // Conversion
  convertSaleTypeToOrderType,
  convertPaymentMethod,
};
