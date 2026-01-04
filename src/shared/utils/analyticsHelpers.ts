// =====================================================
// TIS TIS PLATFORM - Analytics Helpers
// Shared utilities for analytics calculations
// =====================================================

// ======================
// TYPES
// ======================
export type Period = '7d' | '30d' | '90d';

export interface DateLabel {
  date: string;
  label: string;
}

export interface HourLabel {
  label: string;
  hour: number;
}

export interface DateRange {
  startDate: Date;
  prevStartDate: Date;
  days: number;
}

// ======================
// CONSTANTS
// ======================
export const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
};

export const ANALYTICS_DEFAULTS = {
  MIN_PREP_TIME: 18,
  MAX_PREP_TIME: 30,
  DEFAULT_TURNOVER: 3.2,
  DEFAULT_AI_HANDLING_RATE: 85,
  DEFAULT_AI_SATISFACTION: 92,
  DEFAULT_AI_PRECISION: 95,
  DEFAULT_FIRST_RESPONSE_TIME: 1.2,
  DEFAULT_MESSAGES_PER_CONVERSATION: 4.2,
};

// ======================
// DATE FUNCTIONS
// ======================

/**
 * Calculates the date range for a given period
 * @param period - The period to calculate ('7d', '30d', '90d')
 * @returns Object with startDate, prevStartDate (for comparison), and days count
 */
export function getDateRange(period: Period): DateRange {
  const days = PERIOD_DAYS[period];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - days);

  return { startDate, prevStartDate, days };
}

/**
 * Generates daily labels for a given number of days
 * @param days - Number of days to generate labels for
 * @returns Array of date labels with date string and formatted label
 */
export function generateDailyLabels(days: number): DateLabel[] {
  const labels: DateLabel[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const label = date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
    });
    labels.push({ date: dateStr, label });
  }
  return labels;
}

/**
 * Generates hour labels for a 24-hour day
 * @returns Array of hour labels (00:00 - 23:00)
 */
export function generateHourLabels(): HourLabel[] {
  return Array.from({ length: 24 }, (_, i) => ({
    label: `${i.toString().padStart(2, '0')}:00`,
    hour: i,
  }));
}

// ======================
// CALCULATION FUNCTIONS
// ======================

/**
 * Calculates percentage change between two values
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Percentage change (positive or negative)
 */
export function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Calculates percentage of a value relative to a total
 * @param value - The value to calculate percentage for
 * @param total - The total value
 * @returns Percentage (0-100)
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Safely divides two numbers, returning 0 if divisor is 0
 * @param dividend - The number to divide
 * @param divisor - The number to divide by
 * @returns Result of division or 0 if divisor is 0
 */
export function safeDivide(dividend: number, divisor: number): number {
  if (divisor === 0) return 0;
  return dividend / divisor;
}

/**
 * Calculates average from an array of numbers
 * @param values - Array of numbers
 * @returns Average value or 0 if array is empty or invalid
 */
export function calculateAverage(values: number[] | undefined | null): number {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, val) => sum + (val || 0), 0) / values.length;
}

/**
 * Ensures a number is valid (not NaN, null, or undefined)
 * @param value - The value to check
 * @param defaultValue - Default value if invalid (defaults to 0)
 * @returns Valid number or default
 */
export function safeNumber(value: number | undefined | null, defaultValue: number = 0): number {
  if (value === null || value === undefined || isNaN(value)) return defaultValue;
  return value;
}

// ======================
// DATA AGGREGATION
// ======================

/**
 * Groups data by a key and aggregates values
 * @param items - Array of items to group
 * @param keyFn - Function to extract the grouping key
 * @param valueFn - Function to extract the value to aggregate
 * @returns Map of key to aggregated value
 */
export function groupAndSum<T>(
  items: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => number
): Map<string, number> {
  const result = new Map<string, number>();
  items.forEach((item) => {
    const key = keyFn(item);
    const current = result.get(key) || 0;
    result.set(key, current + valueFn(item));
  });
  return result;
}

/**
 * Groups data by a key and counts occurrences
 * @param items - Array of items to group
 * @param keyFn - Function to extract the grouping key
 * @returns Map of key to count
 */
export function groupAndCount<T>(
  items: T[],
  keyFn: (item: T) => string
): Map<string, number> {
  const result = new Map<string, number>();
  items.forEach((item) => {
    const key = keyFn(item);
    result.set(key, (result.get(key) || 0) + 1);
  });
  return result;
}

// ======================
// TREND HELPERS
// ======================

/**
 * Determines trend direction based on value
 * @param value - The value to evaluate
 * @returns 'up', 'down', or 'neutral'
 */
export function getTrend(value: number): 'up' | 'down' | 'neutral' {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'neutral';
}

/**
 * Determines if a metric is good based on direction preference
 * @param value - The value to evaluate
 * @param higherIsBetter - Whether higher values are better
 * @returns 'up' (good), 'down' (bad), or 'neutral'
 */
export function getMetricTrend(
  value: number,
  higherIsBetter: boolean = true
): 'up' | 'down' | 'neutral' {
  if (value === 0) return 'neutral';
  if (higherIsBetter) {
    return value > 0 ? 'up' : 'down';
  }
  return value < 0 ? 'up' : 'down';
}

// ======================
// FORMATTING
// ======================

/**
 * Formats a duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2.5s", "1m 30s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Formats a percentage value
 * @param value - The value (0-100)
 * @param decimals - Number of decimal places
 * @returns Formatted string with % symbol
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

// ======================
// VALIDATION
// ======================

/**
 * Validates that analytics data has required fields
 * @param data - The data object to validate
 * @param requiredFields - Array of required field names
 * @returns true if all required fields exist
 */
export function validateAnalyticsData(
  data: Record<string, unknown>,
  requiredFields: string[]
): boolean {
  return requiredFields.every((field) => field in data);
}

/**
 * Provides default values for missing analytics data
 * @param data - Partial data object
 * @param defaults - Default values object
 * @returns Merged object with defaults for missing values
 */
export function withDefaults<T extends Record<string, unknown>>(
  data: Partial<T>,
  defaults: T
): T {
  return { ...defaults, ...data };
}
