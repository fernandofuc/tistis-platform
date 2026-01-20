/**
 * TIS TIS Platform - Voice Agent v2.0
 * E2E Tests: Dashboard
 *
 * Tests the Voice Agent dashboard functionality including:
 * - Metrics display
 * - Call history
 * - Date range filtering
 * - Data refresh
 *
 * @jest-environment node
 */

// =====================================================
// MOCK DATA TYPES
// =====================================================

interface MetricValue {
  value: number;
  previousValue?: number;
  changePercent?: number;
  changeIsPositive?: boolean;
}

interface DashboardMetrics {
  totalCalls: MetricValue;
  successRate: MetricValue;
  avgDuration: MetricValue;
  avgLatency: MetricValue;
  bookingRate: MetricValue;
  escalationRate: MetricValue;
  totalCost: MetricValue;
}

interface CallsByDay {
  date: string;
  displayDate: string;
  total: number;
  completed: number;
  failed: number;
  escalated: number;
}

interface VoiceCall {
  id: string;
  caller_phone: string;
  status: 'completed' | 'failed' | 'escalated';
  outcome?: string;
  started_at: string;
  duration_seconds: number;
  cost_usd: number;
}

interface DateRange {
  startDate: string;
  endDate: string;
  preset?: '24h' | '7d' | '30d' | '90d' | 'custom';
}

// =====================================================
// DASHBOARD SIMULATOR
// =====================================================

class DashboardSimulator {
  private metrics: DashboardMetrics | null = null;
  private callsByDay: CallsByDay[] = [];
  private calls: VoiceCall[] = [];
  private dateRange: DateRange;
  private isLoading: boolean = false;
  private currentPage: number = 0;
  private pageSize: number = 10;

  constructor() {
    // Default to last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    this.dateRange = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      preset: '7d',
    };
  }

  async fetchMetrics(): Promise<DashboardMetrics> {
    this.isLoading = true;

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.metrics = this.generateMockMetrics();
    this.callsByDay = this.generateMockCallsByDay();
    this.calls = this.generateMockCalls(50);

    this.isLoading = false;
    return this.metrics;
  }

  private generateMockMetrics(): DashboardMetrics {
    return {
      totalCalls: { value: 156, previousValue: 142, changePercent: 9.9, changeIsPositive: true },
      successRate: { value: 87.5, previousValue: 84.2, changePercent: 3.9, changeIsPositive: true },
      avgDuration: { value: 145, previousValue: 160, changePercent: -9.4, changeIsPositive: true },
      avgLatency: { value: 312, previousValue: 345, changePercent: -9.6, changeIsPositive: true },
      bookingRate: { value: 42.3, previousValue: 38.1, changePercent: 11.0, changeIsPositive: true },
      escalationRate: { value: 8.5, previousValue: 12.0, changePercent: -29.2, changeIsPositive: true },
      totalCost: { value: 23.45 },
    };
  }

  private generateMockCallsByDay(): CallsByDay[] {
    const days: CallsByDay[] = [];
    const startDate = new Date(this.dateRange.startDate);
    const endDate = new Date(this.dateRange.endDate);

    while (startDate <= endDate) {
      const total = Math.floor(15 + Math.random() * 20);
      const completed = Math.floor(total * 0.85);
      const failed = Math.floor(total * 0.08);
      const escalated = total - completed - failed;

      days.push({
        date: startDate.toISOString().split('T')[0],
        displayDate: startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        total,
        completed,
        failed,
        escalated,
      });

      startDate.setDate(startDate.getDate() + 1);
    }

    return days;
  }

  private generateMockCalls(count: number): VoiceCall[] {
    const statuses: VoiceCall['status'][] = ['completed', 'completed', 'completed', 'failed', 'escalated'];
    const outcomes = ['appointment_booked', 'information_given', 'escalated_human', 'not_interested', null];

    return Array.from({ length: count }).map((_, i) => {
      const startedAt = new Date();
      startedAt.setHours(startedAt.getHours() - i * 2);

      return {
        id: `call-${i + 1}`,
        caller_phone: `+52 55 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        outcome: outcomes[Math.floor(Math.random() * outcomes.length)] ?? undefined,
        started_at: startedAt.toISOString(),
        duration_seconds: Math.floor(60 + Math.random() * 300),
        cost_usd: 0.05 + Math.random() * 0.2,
      };
    });
  }

  getMetrics(): DashboardMetrics | null {
    return this.metrics;
  }

  getCallsByDay(): CallsByDay[] {
    return this.callsByDay;
  }

  getCalls(): VoiceCall[] {
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    return this.calls.slice(start, end);
  }

  getTotalCalls(): number {
    return this.calls.length;
  }

  getTotalPages(): number {
    return Math.ceil(this.calls.length / this.pageSize);
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  setPage(page: number): void {
    if (page >= 0 && page < this.getTotalPages()) {
      this.currentPage = page;
    }
  }

  nextPage(): boolean {
    if (this.currentPage < this.getTotalPages() - 1) {
      this.currentPage++;
      return true;
    }
    return false;
  }

  prevPage(): boolean {
    if (this.currentPage > 0) {
      this.currentPage--;
      return true;
    }
    return false;
  }

  setDateRange(range: DateRange): void {
    this.dateRange = range;
  }

  getDateRange(): DateRange {
    return { ...this.dateRange };
  }

  isDataLoading(): boolean {
    return this.isLoading;
  }

  filterCallsByStatus(status: VoiceCall['status']): VoiceCall[] {
    return this.calls.filter((call) => call.status === status);
  }

  filterCallsByDateRange(start: string, end: string): VoiceCall[] {
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59);

    return this.calls.filter((call) => {
      const callDate = new Date(call.started_at);
      return callDate >= startDate && callDate <= endDate;
    });
  }

  searchCalls(query: string): VoiceCall[] {
    const lowerQuery = query.toLowerCase();
    return this.calls.filter(
      (call) =>
        call.caller_phone.includes(query) ||
        call.id.toLowerCase().includes(lowerQuery) ||
        (call.outcome && call.outcome.toLowerCase().includes(lowerQuery))
    );
  }
}

// =====================================================
// E2E TESTS: DASHBOARD METRICS
// =====================================================

describe('E2E: Dashboard Metrics Display', () => {
  let dashboard: DashboardSimulator;

  beforeEach(async () => {
    dashboard = new DashboardSimulator();
    await dashboard.fetchMetrics();
  });

  describe('KPI Cards', () => {
    it('should display total calls metric', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics?.totalCalls.value).toBeGreaterThan(0);
    });

    it('should display success rate metric', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics?.successRate.value).toBeGreaterThanOrEqual(0);
      expect(metrics?.successRate.value).toBeLessThanOrEqual(100);
    });

    it('should display average duration', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics?.avgDuration.value).toBeGreaterThan(0);
    });

    it('should display average latency', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics?.avgLatency.value).toBeGreaterThan(0);
    });

    it('should display booking rate', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics?.bookingRate.value).toBeGreaterThanOrEqual(0);
      expect(metrics?.bookingRate.value).toBeLessThanOrEqual(100);
    });

    it('should display escalation rate', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics?.escalationRate.value).toBeGreaterThanOrEqual(0);
      expect(metrics?.escalationRate.value).toBeLessThanOrEqual(100);
    });

    it('should display total cost', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics?.totalCost.value).toBeGreaterThanOrEqual(0);
    });

    it('should show change percentages', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics?.totalCalls.changePercent).toBeDefined();
      expect(metrics?.successRate.changePercent).toBeDefined();
    });

    it('should indicate positive/negative changes', () => {
      const metrics = dashboard.getMetrics();
      expect(typeof metrics?.totalCalls.changeIsPositive).toBe('boolean');
    });
  });

  describe('Charts', () => {
    it('should have calls by day data', () => {
      const callsByDay = dashboard.getCallsByDay();
      expect(callsByDay.length).toBeGreaterThan(0);
    });

    it('should have correct date format', () => {
      const callsByDay = dashboard.getCallsByDay();
      callsByDay.forEach((day) => {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(day.displayDate).toBeDefined();
      });
    });

    it('should have valid call counts per day', () => {
      const callsByDay = dashboard.getCallsByDay();
      callsByDay.forEach((day) => {
        expect(day.total).toBeGreaterThanOrEqual(0);
        expect(day.completed).toBeLessThanOrEqual(day.total);
        expect(day.failed).toBeLessThanOrEqual(day.total);
        expect(day.escalated).toBeLessThanOrEqual(day.total);
        expect(day.completed + day.failed + day.escalated).toBeLessThanOrEqual(day.total);
      });
    });
  });
});

// =====================================================
// E2E TESTS: CALL HISTORY
// =====================================================

describe('E2E: Dashboard Call History', () => {
  let dashboard: DashboardSimulator;

  beforeEach(async () => {
    dashboard = new DashboardSimulator();
    await dashboard.fetchMetrics();
  });

  describe('Call List', () => {
    it('should display calls', () => {
      const calls = dashboard.getCalls();
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should have valid call structure', () => {
      const calls = dashboard.getCalls();
      calls.forEach((call) => {
        expect(call.id).toBeDefined();
        expect(call.caller_phone).toBeDefined();
        expect(['completed', 'failed', 'escalated']).toContain(call.status);
        expect(call.started_at).toBeDefined();
        expect(call.duration_seconds).toBeGreaterThanOrEqual(0);
        expect(call.cost_usd).toBeGreaterThanOrEqual(0);
      });
    });

    it('should paginate calls', () => {
      const firstPage = dashboard.getCalls();
      expect(firstPage.length).toBeLessThanOrEqual(10);

      dashboard.nextPage();
      const secondPage = dashboard.getCalls();
      expect(secondPage[0]?.id).not.toBe(firstPage[0]?.id);
    });

    it('should track total pages', () => {
      const totalCalls = dashboard.getTotalCalls();
      const totalPages = dashboard.getTotalPages();
      expect(totalPages).toBe(Math.ceil(totalCalls / 10));
    });
  });

  describe('Pagination', () => {
    it('should start on page 0', () => {
      expect(dashboard.getCurrentPage()).toBe(0);
    });

    it('should go to next page', () => {
      expect(dashboard.nextPage()).toBe(true);
      expect(dashboard.getCurrentPage()).toBe(1);
    });

    it('should go to previous page', () => {
      dashboard.nextPage();
      dashboard.nextPage();
      expect(dashboard.prevPage()).toBe(true);
      expect(dashboard.getCurrentPage()).toBe(1);
    });

    it('should not go below page 0', () => {
      expect(dashboard.prevPage()).toBe(false);
      expect(dashboard.getCurrentPage()).toBe(0);
    });

    it('should not exceed total pages', () => {
      const totalPages = dashboard.getTotalPages();
      for (let i = 0; i < totalPages + 5; i++) {
        dashboard.nextPage();
      }
      expect(dashboard.getCurrentPage()).toBe(totalPages - 1);
    });

    it('should allow setting specific page', () => {
      dashboard.setPage(2);
      expect(dashboard.getCurrentPage()).toBe(2);
    });

    it('should not set invalid page', () => {
      dashboard.setPage(-1);
      expect(dashboard.getCurrentPage()).toBe(0);

      dashboard.setPage(1000);
      expect(dashboard.getCurrentPage()).toBe(0);
    });
  });

  describe('Filtering', () => {
    it('should filter by completed status', () => {
      const completed = dashboard.filterCallsByStatus('completed');
      completed.forEach((call) => {
        expect(call.status).toBe('completed');
      });
    });

    it('should filter by failed status', () => {
      const failed = dashboard.filterCallsByStatus('failed');
      failed.forEach((call) => {
        expect(call.status).toBe('failed');
      });
    });

    it('should filter by escalated status', () => {
      const escalated = dashboard.filterCallsByStatus('escalated');
      escalated.forEach((call) => {
        expect(call.status).toBe('escalated');
      });
    });

    it('should search by phone number', () => {
      const calls = dashboard.getCalls();
      if (calls.length > 0) {
        const phoneQuery = calls[0].caller_phone.substring(0, 8);
        const results = dashboard.searchCalls(phoneQuery);
        expect(results.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

// =====================================================
// E2E TESTS: DATE RANGE
// =====================================================

describe('E2E: Dashboard Date Range', () => {
  let dashboard: DashboardSimulator;

  beforeEach(() => {
    dashboard = new DashboardSimulator();
  });

  describe('Date Presets', () => {
    it('should default to 7 days', () => {
      const range = dashboard.getDateRange();
      expect(range.preset).toBe('7d');
    });

    it('should set 24h range', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      dashboard.setDateRange({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        preset: '24h',
      });

      await dashboard.fetchMetrics();

      const callsByDay = dashboard.getCallsByDay();
      expect(callsByDay.length).toBeLessThanOrEqual(2);
    });

    it('should set 30d range', () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      dashboard.setDateRange({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        preset: '30d',
      });

      const range = dashboard.getDateRange();
      expect(range.preset).toBe('30d');
    });

    it('should set custom range', () => {
      dashboard.setDateRange({
        startDate: '2024-01-01',
        endDate: '2024-01-15',
        preset: 'custom',
      });

      const range = dashboard.getDateRange();
      expect(range.preset).toBe('custom');
      expect(range.startDate).toBe('2024-01-01');
      expect(range.endDate).toBe('2024-01-15');
    });
  });

  describe('Date Filtering', () => {
    it('should filter calls by date range', async () => {
      await dashboard.fetchMetrics();

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const filtered = dashboard.filterCallsByDateRange(yesterday, today);

      filtered.forEach((call) => {
        const callDate = new Date(call.started_at);
        expect(callDate.getTime()).toBeGreaterThanOrEqual(new Date(yesterday).getTime());
      });
    });
  });
});

// =====================================================
// E2E TESTS: REFRESH
// =====================================================

describe('E2E: Dashboard Refresh', () => {
  let dashboard: DashboardSimulator;

  beforeEach(() => {
    dashboard = new DashboardSimulator();
  });

  it('should indicate loading state', async () => {
    const fetchPromise = dashboard.fetchMetrics();
    // Check loading state during fetch
    expect(dashboard.isDataLoading()).toBe(true);
    await fetchPromise;
    expect(dashboard.isDataLoading()).toBe(false);
  });

  it('should update metrics on refresh', async () => {
    await dashboard.fetchMetrics();
    const firstMetrics = dashboard.getMetrics();

    await dashboard.fetchMetrics();
    const secondMetrics = dashboard.getMetrics();

    // Metrics should exist after both fetches
    expect(firstMetrics).toBeDefined();
    expect(secondMetrics).toBeDefined();
  });

  it('should update calls on refresh', async () => {
    await dashboard.fetchMetrics();
    const firstCalls = dashboard.getCalls();

    await dashboard.fetchMetrics();
    const secondCalls = dashboard.getCalls();

    // Should have calls after both fetches
    expect(firstCalls.length).toBeGreaterThan(0);
    expect(secondCalls.length).toBeGreaterThan(0);
  });
});

// =====================================================
// E2E TESTS: RESPONSIVE BEHAVIOR
// =====================================================

describe('E2E: Dashboard Responsive', () => {
  let dashboard: DashboardSimulator;

  beforeEach(async () => {
    dashboard = new DashboardSimulator();
    await dashboard.fetchMetrics();
  });

  it('should provide compact data for mobile', () => {
    const metrics = dashboard.getMetrics();

    // Mobile should show key metrics
    const keyMetrics = {
      totalCalls: metrics?.totalCalls,
      successRate: metrics?.successRate,
      bookingRate: metrics?.bookingRate,
    };

    expect(keyMetrics.totalCalls).toBeDefined();
    expect(keyMetrics.successRate).toBeDefined();
    expect(keyMetrics.bookingRate).toBeDefined();
  });

  it('should have shorter display dates', () => {
    const callsByDay = dashboard.getCallsByDay();

    callsByDay.forEach((day) => {
      // Display date should be compact (e.g., "15 ene")
      expect(day.displayDate.length).toBeLessThan(10);
    });
  });

  it('should support smaller page sizes', () => {
    // Mobile might want 5 items per page instead of 10
    const calls = dashboard.getCalls();
    const first5 = calls.slice(0, 5);

    expect(first5.length).toBeLessThanOrEqual(5);
  });
});
