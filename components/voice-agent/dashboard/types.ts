/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * Type Definitions
 *
 * Types for the metrics dashboard and call analytics.
 */

import type {
  VoiceCall,
  CallStatus,
  CallOutcome,
  CallDirection,
} from '@/src/features/voice-agent/types';

// =====================================================
// DATE RANGE
// =====================================================

/**
 * Date range presets for filtering
 */
export type DateRangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

/**
 * Date range selection
 */
export interface DateRange {
  /** Start date (ISO string) */
  startDate: string;
  /** End date (ISO string) */
  endDate: string;
  /** Preset used (if any) */
  preset?: DateRangePreset;
}

/**
 * Date range option for UI
 */
export interface DateRangeOption {
  id: DateRangePreset;
  label: string;
  description?: string;
  getDates: () => { startDate: string; endDate: string };
}

// =====================================================
// METRICS
// =====================================================

/**
 * Single metric value with comparison
 */
export interface MetricValue {
  /** Current value */
  value: number;
  /** Previous period value for comparison */
  previousValue?: number;
  /** Percentage change from previous period */
  changePercent?: number;
  /** Whether the change is positive (good) */
  changeIsPositive?: boolean;
}

/**
 * Dashboard metrics summary
 */
export interface DashboardMetrics {
  /** Total number of calls */
  totalCalls: MetricValue;
  /** Success rate (completed calls / total) */
  successRate: MetricValue;
  /** Average call duration in seconds */
  avgDuration: MetricValue;
  /** Average response latency in ms */
  avgLatency: MetricValue;
  /** Appointment booking rate */
  bookingRate?: MetricValue;
  /** Escalation rate */
  escalationRate?: MetricValue;
  /** Total cost in USD */
  totalCost?: MetricValue;
}

/**
 * Calls by day for charts
 */
export interface CallsByDay {
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Display date (formatted) */
  displayDate: string;
  /** Total calls */
  total: number;
  /** Completed calls */
  completed: number;
  /** Failed calls */
  failed: number;
  /** Escalated calls */
  escalated: number;
}

/**
 * Latency data point
 */
export interface LatencyDataPoint {
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Display date */
  displayDate: string;
  /** Average latency (ms) */
  avg: number;
  /** P50 latency (ms) */
  p50: number;
  /** P95 latency (ms) */
  p95: number;
}

/**
 * Outcome distribution
 */
export interface OutcomeDistribution {
  /** Outcome type */
  outcome: CallOutcome;
  /** Display label */
  label: string;
  /** Count */
  count: number;
  /** Percentage */
  percent: number;
  /** Color for chart */
  color: string;
}

// =====================================================
// CALLS TABLE
// =====================================================

/**
 * Sorting options for calls table
 */
export type CallSortField = 'started_at' | 'duration_seconds' | 'status' | 'outcome';
export type SortDirection = 'asc' | 'desc';

/**
 * Filters for calls table
 */
export interface CallFilters {
  /** Filter by status */
  status?: CallStatus[];
  /** Filter by outcome */
  outcome?: CallOutcome[];
  /** Filter by direction */
  direction?: CallDirection;
  /** Search query (phone, transcription) */
  search?: string;
  /** Date range */
  dateRange?: DateRange;
}

/**
 * Pagination state
 */
export interface PaginationState {
  /** Current page (0-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total items */
  totalItems: number;
  /** Total pages */
  totalPages: number;
}

/**
 * Calls list response
 */
export interface CallsListResponse {
  /** List of calls */
  calls: VoiceCall[];
  /** Pagination info */
  pagination: PaginationState;
}

// =====================================================
// CALL DETAILS
// =====================================================

/**
 * Extended call details for modal
 */
export interface CallDetails extends VoiceCall {
  /** Formatted duration */
  formattedDuration: string;
  /** Formatted date/time */
  formattedDateTime: string;
  /** Status badge color */
  statusColor: string;
  /** Outcome badge color */
  outcomeColor: string;
}

// =====================================================
// REALTIME
// =====================================================

/**
 * Realtime metrics update
 */
export interface RealtimeMetrics {
  /** Calls in last hour */
  callsLastHour: number;
  /** Active calls right now */
  activeCalls: number;
  /** Average latency in last hour */
  avgLatencyLastHour: number;
  /** Last update timestamp */
  lastUpdated: string;
}

// =====================================================
// API RESPONSES
// =====================================================

/**
 * Metrics API response
 */
export interface MetricsAPIResponse {
  success: boolean;
  metrics: DashboardMetrics;
  callsByDay: CallsByDay[];
  latencyByDay: LatencyDataPoint[];
  outcomeDistribution: OutcomeDistribution[];
  dateRange: DateRange;
}

/**
 * Calls API response
 */
export interface CallsAPIResponse {
  success: boolean;
  calls: VoiceCall[];
  pagination: PaginationState;
  filters: CallFilters;
}

// =====================================================
// CHART CONFIG
// =====================================================

/**
 * Chart theme colors matching TIS TIS design
 */
export const CHART_COLORS = {
  primary: 'rgb(223, 115, 115)', // tis-coral
  secondary: 'rgb(194, 51, 80)', // tis-pink
  tertiary: 'rgb(157, 184, 161)', // tis-green
  purple: '#667eea', // tis-purple
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  muted: '#94a3b8',
  background: 'rgba(223, 115, 115, 0.1)',
} as const;

/**
 * Outcome colors for charts
 */
export const OUTCOME_COLORS: Record<CallOutcome, string> = {
  appointment_booked: '#22c55e', // green
  information_given: '#667eea', // purple
  escalated_human: '#f59e0b', // amber
  callback_requested: '#06b6d4', // cyan
  not_interested: '#94a3b8', // slate
  wrong_number: '#64748b', // slate-500
  voicemail: '#a855f7', // purple
  dropped: '#ef4444', // red
  completed_other: '#9DB8A1', // tis-green
};

/**
 * Status colors for badges
 */
export const STATUS_COLORS: Record<CallStatus, { bg: string; text: string; border: string }> = {
  initiated: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  ringing: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  in_progress: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  completed: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  busy: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  no_answer: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  canceled: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
  escalated: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Format duration from seconds to human readable
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format latency from ms to human readable
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Get date range dates
 */
export function getDateRangeDates(preset: DateRangePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];

  switch (preset) {
    case 'today': {
      return { startDate: endDate, endDate };
    }
    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { startDate: start.toISOString().split('T')[0], endDate };
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { startDate: start.toISOString().split('T')[0], endDate };
    }
    case '90d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      return { startDate: start.toISOString().split('T')[0], endDate };
    }
    default:
      return { startDate: endDate, endDate };
  }
}

/**
 * Date range presets
 */
export const DATE_RANGE_PRESETS: DateRangeOption[] = [
  {
    id: 'today',
    label: 'Hoy',
    getDates: () => getDateRangeDates('today'),
  },
  {
    id: '7d',
    label: 'Últimos 7 días',
    getDates: () => getDateRangeDates('7d'),
  },
  {
    id: '30d',
    label: 'Últimos 30 días',
    getDates: () => getDateRangeDates('30d'),
  },
  {
    id: '90d',
    label: 'Últimos 90 días',
    getDates: () => getDateRangeDates('90d'),
  },
];

/**
 * Status display labels
 */
export const STATUS_LABELS: Record<CallStatus, string> = {
  initiated: 'Iniciada',
  ringing: 'Timbrando',
  in_progress: 'En progreso',
  completed: 'Completada',
  busy: 'Ocupado',
  no_answer: 'Sin respuesta',
  failed: 'Fallida',
  canceled: 'Cancelada',
  escalated: 'Escalada',
};

/**
 * Outcome display labels
 */
export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  appointment_booked: 'Cita agendada',
  information_given: 'Información dada',
  escalated_human: 'Escalada a humano',
  callback_requested: 'Callback solicitado',
  not_interested: 'No interesado',
  wrong_number: 'Número equivocado',
  voicemail: 'Buzón de voz',
  dropped: 'Llamada caída',
  completed_other: 'Completada (otro)',
};
