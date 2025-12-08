// =====================================================
// TIS TIS PLATFORM - Shared Utilities
// =====================================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LEAD_SCORING } from '../constants';

// ======================
// CLASSNAME UTILITIES
// ======================
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ======================
// DATE UTILITIES
// ======================
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', options || {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return formatDate(d);
}

export function isToday(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

export function isTomorrow(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

export function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ======================
// PHONE UTILITIES
// ======================
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If it starts with +, keep it, otherwise add +52 (Mexico)
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If 10 digits, assume Mexico mobile
  if (cleaned.length === 10) {
    return `+52${cleaned}`;
  }

  // If 12 digits starting with 52, add +
  if (cleaned.length === 12 && cleaned.startsWith('52')) {
    return `+${cleaned}`;
  }

  return cleaned;
}

export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);

  // Format for display: +52 (XXX) XXX-XXXX
  if (normalized.startsWith('+52') && normalized.length === 13) {
    const number = normalized.slice(3);
    return `+52 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  }

  return phone;
}

// ======================
// CURRENCY UTILITIES
// ======================
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-MX').format(num);
}

// ======================
// LEAD SCORING UTILITIES
// ======================
export function getLeadClassification(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= LEAD_SCORING.HOT.min) return 'hot';
  if (score >= LEAD_SCORING.WARM.min) return 'warm';
  return 'cold';
}

export function getLeadClassificationColor(classification: string): string {
  switch (classification) {
    case 'hot':
      return 'text-red-600 bg-red-100';
    case 'warm':
      return 'text-orange-600 bg-orange-100';
    case 'cold':
      return 'text-blue-600 bg-blue-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

export function getLeadClassificationEmoji(classification: string): string {
  switch (classification) {
    case 'hot':
      return '🔥';
    case 'warm':
      return '🌡️';
    case 'cold':
      return '❄️';
    default:
      return '•';
  }
}

// ======================
// STATUS UTILITIES
// ======================
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Lead statuses
    new: 'text-blue-600 bg-blue-100',
    contacted: 'text-cyan-600 bg-cyan-100',
    qualified: 'text-green-600 bg-green-100',
    appointment_scheduled: 'text-purple-600 bg-purple-100',
    converted: 'text-emerald-600 bg-emerald-100',
    lost: 'text-red-600 bg-red-100',
    inactive: 'text-gray-600 bg-gray-100',
    // Appointment statuses
    scheduled: 'text-blue-600 bg-blue-100',
    confirmed: 'text-green-600 bg-green-100',
    in_progress: 'text-yellow-600 bg-yellow-100',
    completed: 'text-emerald-600 bg-emerald-100',
    cancelled: 'text-red-600 bg-red-100',
    no_show: 'text-orange-600 bg-orange-100',
    rescheduled: 'text-purple-600 bg-purple-100',
    // Conversation statuses
    active: 'text-green-600 bg-green-100',
    waiting_response: 'text-yellow-600 bg-yellow-100',
    escalated: 'text-red-600 bg-red-100',
    resolved: 'text-gray-600 bg-gray-100',
    archived: 'text-slate-600 bg-slate-100',
  };
  return colors[status] || 'text-gray-600 bg-gray-100';
}

// ======================
// STRING UTILITIES
// ======================
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

// ======================
// VALIDATION UTILITIES
// ======================
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// ======================
// DEBOUNCE UTILITY
// ======================
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

// ======================
// ASYNC UTILITIES
// ======================
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await sleep(delay);
    return retry(fn, retries - 1, delay * 2);
  }
}
