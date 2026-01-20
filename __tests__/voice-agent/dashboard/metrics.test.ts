/**
 * TIS TIS Platform - Voice Agent Dashboard Tests
 * Metrics Components and Data Processing Tests
 */

import type {
  MetricValue,
  DashboardMetrics,
  CallsByDay,
  LatencyDataPoint,
  OutcomeDistribution,
  PaginationState,
} from '@/components/voice-agent/dashboard/types';

// =====================================================
// METRIC VALUE TESTS
// =====================================================

describe('MetricValue type', () => {
  it('should allow basic value', () => {
    const metric: MetricValue = {
      value: 100,
    };

    expect(metric.value).toBe(100);
    expect(metric.previousValue).toBeUndefined();
  });

  it('should allow value with comparison', () => {
    const metric: MetricValue = {
      value: 120,
      previousValue: 100,
      changePercent: 20,
      changeIsPositive: true,
    };

    expect(metric.value).toBe(120);
    expect(metric.previousValue).toBe(100);
    expect(metric.changePercent).toBe(20);
    expect(metric.changeIsPositive).toBe(true);
  });

  it('should allow negative change', () => {
    const metric: MetricValue = {
      value: 80,
      previousValue: 100,
      changePercent: -20,
      changeIsPositive: false,
    };

    expect(metric.changePercent).toBe(-20);
    expect(metric.changeIsPositive).toBe(false);
  });
});

// =====================================================
// DASHBOARD METRICS TESTS
// =====================================================

describe('DashboardMetrics type', () => {
  it('should have all required metrics', () => {
    const metrics: DashboardMetrics = {
      totalCalls: { value: 100 },
      successRate: { value: 85 },
      avgDuration: { value: 120 },
      avgLatency: { value: 300 },
    };

    expect(metrics.totalCalls.value).toBe(100);
    expect(metrics.successRate.value).toBe(85);
    expect(metrics.avgDuration.value).toBe(120);
    expect(metrics.avgLatency.value).toBe(300);
  });

  it('should support optional metrics', () => {
    const metrics: DashboardMetrics = {
      totalCalls: { value: 100 },
      successRate: { value: 85 },
      avgDuration: { value: 120 },
      avgLatency: { value: 300 },
      bookingRate: { value: 35 },
      escalationRate: { value: 8 },
      totalCost: { value: 45.67 },
    };

    expect(metrics.bookingRate?.value).toBe(35);
    expect(metrics.escalationRate?.value).toBe(8);
    expect(metrics.totalCost?.value).toBe(45.67);
  });
});

// =====================================================
// CALLS BY DAY TESTS
// =====================================================

describe('CallsByDay type', () => {
  it('should have required fields', () => {
    const day: CallsByDay = {
      date: '2024-01-15',
      displayDate: '15 Ene',
      total: 25,
      completed: 20,
      failed: 3,
      escalated: 2,
    };

    expect(day.date).toBe('2024-01-15');
    expect(day.displayDate).toBe('15 Ene');
    expect(day.total).toBe(25);
    expect(day.completed).toBe(20);
    expect(day.failed).toBe(3);
    expect(day.escalated).toBe(2);
  });

  it('should allow zero values', () => {
    const day: CallsByDay = {
      date: '2024-01-15',
      displayDate: '15 Ene',
      total: 0,
      completed: 0,
      failed: 0,
      escalated: 0,
    };

    expect(day.total).toBe(0);
  });

  it('should satisfy invariant: total >= completed + failed', () => {
    const day: CallsByDay = {
      date: '2024-01-15',
      displayDate: '15 Ene',
      total: 25,
      completed: 20,
      failed: 3,
      escalated: 2,
    };

    // Total should be greater than or equal to sum of breakdowns
    // (some calls might have other statuses)
    expect(day.total).toBeGreaterThanOrEqual(day.completed + day.failed);
  });
});

// =====================================================
// LATENCY DATA TESTS
// =====================================================

describe('LatencyDataPoint type', () => {
  it('should have required fields', () => {
    const point: LatencyDataPoint = {
      date: '2024-01-15',
      displayDate: '15 Ene',
      avg: 280,
      p50: 250,
      p95: 450,
    };

    expect(point.date).toBe('2024-01-15');
    expect(point.avg).toBe(280);
    expect(point.p50).toBe(250);
    expect(point.p95).toBe(450);
  });

  it('should satisfy percentile invariants', () => {
    const point: LatencyDataPoint = {
      date: '2024-01-15',
      displayDate: '15 Ene',
      avg: 280,
      p50: 250,
      p95: 450,
    };

    // P50 should be <= P95
    expect(point.p50).toBeLessThanOrEqual(point.p95);
  });
});

// =====================================================
// OUTCOME DISTRIBUTION TESTS
// =====================================================

describe('OutcomeDistribution type', () => {
  it('should have required fields', () => {
    const distribution: OutcomeDistribution = {
      outcome: 'appointment_booked',
      label: 'Cita agendada',
      count: 35,
      percent: 35,
      color: '#22c55e',
    };

    expect(distribution.outcome).toBe('appointment_booked');
    expect(distribution.label).toBe('Cita agendada');
    expect(distribution.count).toBe(35);
    expect(distribution.percent).toBe(35);
    expect(distribution.color).toBe('#22c55e');
  });

  it('should have valid color format', () => {
    const distribution: OutcomeDistribution = {
      outcome: 'dropped',
      label: 'Llamada caída',
      count: 10,
      percent: 10,
      color: '#ef4444',
    };

    // Should be hex color
    expect(distribution.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

// =====================================================
// PAGINATION TESTS
// =====================================================

describe('PaginationState type', () => {
  it('should have required fields', () => {
    const pagination: PaginationState = {
      page: 0,
      pageSize: 10,
      totalItems: 100,
      totalPages: 10,
    };

    expect(pagination.page).toBe(0);
    expect(pagination.pageSize).toBe(10);
    expect(pagination.totalItems).toBe(100);
    expect(pagination.totalPages).toBe(10);
  });

  it('should calculate total pages correctly', () => {
    const pagination: PaginationState = {
      page: 0,
      pageSize: 10,
      totalItems: 95,
      totalPages: 10, // ceil(95/10) = 10
    };

    const calculatedPages = Math.ceil(pagination.totalItems / pagination.pageSize);
    expect(pagination.totalPages).toBe(calculatedPages);
  });

  it('should handle empty data', () => {
    const pagination: PaginationState = {
      page: 0,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    };

    expect(pagination.totalItems).toBe(0);
    expect(pagination.totalPages).toBe(0);
  });

  it('should handle single page', () => {
    const pagination: PaginationState = {
      page: 0,
      pageSize: 10,
      totalItems: 5,
      totalPages: 1,
    };

    expect(pagination.totalPages).toBe(1);
    expect(pagination.totalItems).toBeLessThan(pagination.pageSize);
  });
});

// =====================================================
// INTEGRATION TESTS
// =====================================================

describe('Dashboard data integration', () => {
  it('should create valid dashboard state', () => {
    const metrics: DashboardMetrics = {
      totalCalls: { value: 100, previousValue: 80, changePercent: 25, changeIsPositive: true },
      successRate: { value: 85, previousValue: 82, changePercent: 3.7, changeIsPositive: true },
      avgDuration: { value: 127, previousValue: 145, changePercent: -12.4, changeIsPositive: true },
      avgLatency: { value: 312, previousValue: 350, changePercent: -10.9, changeIsPositive: true },
    };

    const callsByDay: CallsByDay[] = [
      { date: '2024-01-15', displayDate: '15 Ene', total: 20, completed: 17, failed: 2, escalated: 1 },
      { date: '2024-01-16', displayDate: '16 Ene', total: 25, completed: 21, failed: 3, escalated: 1 },
    ];

    const latencyByDay: LatencyDataPoint[] = [
      { date: '2024-01-15', displayDate: '15 Ene', avg: 280, p50: 250, p95: 450 },
      { date: '2024-01-16', displayDate: '16 Ene', avg: 300, p50: 270, p95: 480 },
    ];

    const outcomeDistribution: OutcomeDistribution[] = [
      { outcome: 'appointment_booked', label: 'Cita agendada', count: 35, percent: 35, color: '#22c55e' },
      { outcome: 'information_given', label: 'Información dada', count: 28, percent: 28, color: '#667eea' },
    ];

    // Verify all data is valid
    expect(metrics.totalCalls.value).toBeGreaterThan(0);
    expect(callsByDay.length).toBeGreaterThan(0);
    expect(latencyByDay.length).toBeGreaterThan(0);
    expect(outcomeDistribution.length).toBeGreaterThan(0);

    // Verify total calls equals sum of days
    const sumOfDays = callsByDay.reduce((sum, day) => sum + day.total, 0);
    expect(sumOfDays).toBe(45); // 20 + 25

    // Verify percentages sum to <= 100
    const sumOfPercents = outcomeDistribution.reduce((sum, o) => sum + o.percent, 0);
    expect(sumOfPercents).toBeLessThanOrEqual(100);
  });
});
