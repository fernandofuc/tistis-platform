/**
 * TIS TIS Platform - Voice Agent Dashboard Tests
 * Type Definitions and Utility Functions Tests
 */

import type { CallStatus, CallOutcome } from '@/src/features/voice-agent/types';
import {
  formatDuration,
  formatLatency,
  formatPercent,
  formatCurrency,
  getDateRangeDates,
  DATE_RANGE_PRESETS,
  STATUS_COLORS,
  STATUS_LABELS,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  CHART_COLORS,
} from '@/components/voice-agent/dashboard/types';

// =====================================================
// FORMAT DURATION TESTS
// =====================================================

describe('formatDuration', () => {
  it('should format seconds under 60', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('should format minutes', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(150)).toBe('2m 30s');
  });

  it('should format hours', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(7200)).toBe('2h 0m');
    expect(formatDuration(3700)).toBe('1h 1m');
  });

  it('should handle zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});

// =====================================================
// FORMAT LATENCY TESTS
// =====================================================

describe('formatLatency', () => {
  it('should format milliseconds under 1000', () => {
    expect(formatLatency(100)).toBe('100ms');
    expect(formatLatency(500)).toBe('500ms');
    expect(formatLatency(999)).toBe('999ms');
  });

  it('should format seconds for >= 1000ms', () => {
    expect(formatLatency(1000)).toBe('1.0s');
    expect(formatLatency(1500)).toBe('1.5s');
    expect(formatLatency(2000)).toBe('2.0s');
  });

  it('should round milliseconds', () => {
    expect(formatLatency(123.456)).toBe('123ms');
    expect(formatLatency(567.89)).toBe('568ms');
  });
});

// =====================================================
// FORMAT PERCENT TESTS
// =====================================================

describe('formatPercent', () => {
  it('should format with default decimals', () => {
    expect(formatPercent(50)).toBe('50.0%');
    expect(formatPercent(75.5)).toBe('75.5%');
    expect(formatPercent(99.99)).toBe('100.0%');
  });

  it('should format with custom decimals', () => {
    expect(formatPercent(50, 0)).toBe('50%');
    expect(formatPercent(75.555, 2)).toBe('75.56%');
    expect(formatPercent(100, 0)).toBe('100%');
  });

  it('should handle edge cases', () => {
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(100)).toBe('100.0%');
  });
});

// =====================================================
// FORMAT CURRENCY TESTS
// =====================================================

describe('formatCurrency', () => {
  it('should format USD by default', () => {
    const result = formatCurrency(10.5);
    expect(result).toContain('10');
    expect(result).toContain('50');
  });

  it('should format different amounts', () => {
    const zero = formatCurrency(0);
    const large = formatCurrency(1234.56);

    expect(zero).toContain('0');
    expect(large).toContain('1');
  });
});

// =====================================================
// DATE RANGE TESTS
// =====================================================

describe('getDateRangeDates', () => {
  it('should return today for "today" preset', () => {
    const { startDate, endDate } = getDateRangeDates('today');
    expect(startDate).toBe(endDate);

    const today = new Date().toISOString().split('T')[0];
    expect(startDate).toBe(today);
  });

  it('should return 7 days range for "7d" preset', () => {
    const { startDate, endDate } = getDateRangeDates('7d');

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    expect(diffDays).toBe(7);
  });

  it('should return 30 days range for "30d" preset', () => {
    const { startDate, endDate } = getDateRangeDates('30d');

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    expect(diffDays).toBe(30);
  });

  it('should return 90 days range for "90d" preset', () => {
    const { startDate, endDate } = getDateRangeDates('90d');

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    expect(diffDays).toBe(90);
  });
});

describe('DATE_RANGE_PRESETS', () => {
  it('should have 4 presets', () => {
    expect(DATE_RANGE_PRESETS).toHaveLength(4);
  });

  it('should have required fields for each preset', () => {
    DATE_RANGE_PRESETS.forEach((preset) => {
      expect(preset.id).toBeDefined();
      expect(preset.label).toBeDefined();
      expect(typeof preset.getDates).toBe('function');
    });
  });

  it('should include today, 7d, 30d, and 90d', () => {
    const ids = DATE_RANGE_PRESETS.map((p) => p.id);
    expect(ids).toContain('today');
    expect(ids).toContain('7d');
    expect(ids).toContain('30d');
    expect(ids).toContain('90d');
  });
});

// =====================================================
// STATUS COLORS TESTS
// =====================================================

describe('STATUS_COLORS', () => {
  const expectedStatuses = [
    'initiated',
    'ringing',
    'in_progress',
    'completed',
    'busy',
    'no_answer',
    'failed',
    'canceled',
    'escalated',
  ];

  it('should have colors for all statuses', () => {
    expectedStatuses.forEach((status) => {
      expect(STATUS_COLORS[status as CallStatus]).toBeDefined();
    });
  });

  it('should have bg, text, and border for each status', () => {
    Object.values(STATUS_COLORS).forEach((colors) => {
      expect(colors.bg).toBeDefined();
      expect(colors.text).toBeDefined();
      expect(colors.border).toBeDefined();
    });
  });
});

describe('STATUS_LABELS', () => {
  it('should have Spanish labels for all statuses', () => {
    const labels = Object.values(STATUS_LABELS);
    labels.forEach((label) => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('should have completed status label', () => {
    expect(STATUS_LABELS.completed).toBe('Completada');
  });

  it('should have failed status label', () => {
    expect(STATUS_LABELS.failed).toBe('Fallida');
  });
});

// =====================================================
// OUTCOME COLORS/LABELS TESTS
// =====================================================

describe('OUTCOME_LABELS', () => {
  const expectedOutcomes = [
    'appointment_booked',
    'information_given',
    'escalated_human',
    'callback_requested',
    'not_interested',
    'wrong_number',
    'voicemail',
    'dropped',
    'completed_other',
  ];

  it('should have labels for all outcomes', () => {
    expectedOutcomes.forEach((outcome) => {
      expect(OUTCOME_LABELS[outcome as CallOutcome]).toBeDefined();
    });
  });

  it('should have Spanish labels', () => {
    expect(OUTCOME_LABELS.appointment_booked).toBe('Cita agendada');
    expect(OUTCOME_LABELS.dropped).toBe('Llamada caída');
  });
});

describe('OUTCOME_COLORS', () => {
  it('should have hex color for appointment_booked', () => {
    expect(OUTCOME_COLORS.appointment_booked).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should have colors for main outcomes', () => {
    expect(OUTCOME_COLORS.appointment_booked).toBeDefined();
    expect(OUTCOME_COLORS.dropped).toBeDefined();
    expect(OUTCOME_COLORS.escalated_human).toBeDefined();
  });
});

// =====================================================
// CHART COLORS TESTS
// =====================================================

describe('CHART_COLORS', () => {
  it('should have primary color', () => {
    expect(CHART_COLORS.primary).toBeDefined();
  });

  it('should have success, warning, and error colors', () => {
    expect(CHART_COLORS.success).toBeDefined();
    expect(CHART_COLORS.warning).toBeDefined();
    expect(CHART_COLORS.error).toBeDefined();
  });

  it('should have TIS TIS brand colors', () => {
    expect(CHART_COLORS.primary).toContain('223'); // tis-coral rgb
    expect(CHART_COLORS.purple).toContain('#667eea');
  });
});
