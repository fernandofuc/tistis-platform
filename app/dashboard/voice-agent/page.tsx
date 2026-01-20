/**
 * TIS TIS Platform - Voice Agent Dashboard Page
 * /dashboard/voice-agent
 *
 * Main dashboard page for voice agent metrics and analytics.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { MetricsDashboard } from '@/components/voice-agent/dashboard';
import type {
  DateRange,
  DashboardMetrics,
  CallsByDay,
  LatencyDataPoint,
  OutcomeDistribution,
  PaginationState,
  RealtimeMetrics,
} from '@/components/voice-agent/dashboard/types';
import { getDateRangeDates } from '@/components/voice-agent/dashboard/types';
import type { VoiceCall } from '@/src/features/voice-agent/types';

// =====================================================
// DATA FETCHING HOOKS
// =====================================================

function useDashboardData(dateRange: DateRange) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [callsByDay, setCallsByDay] = useState<CallsByDay[]>([]);
  const [latencyByDay, setLatencyByDay] = useState<LatencyDataPoint[]>([]);
  const [outcomeDistribution, setOutcomeDistribution] = useState<OutcomeDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const response = await fetch(`/api/voice-agent/metrics?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
        setCallsByDay(data.callsByDay);
        setLatencyByDay(data.latencyByDay);
        setOutcomeDistribution(data.outcomeDistribution);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching data');
    }

    setIsLoading(false);
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    metrics,
    callsByDay,
    latencyByDay,
    outcomeDistribution,
    isLoading,
    error,
    refetch: fetchData,
  };
}

function useCallsData(dateRange: DateRange, page: number) {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        sortField: 'started_at',
        sortDirection: 'desc',
      });

      const response = await fetch(`/api/voice-agent/metrics/calls?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch calls');
      }

      const data = await response.json();

      if (data.success) {
        setCalls(data.calls);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error fetching calls:', err);
    }

    setIsLoading(false);
  }, [dateRange.startDate, dateRange.endDate, page]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  return { calls, pagination, isLoading };
}

function useRealtimeMetrics() {
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics | null>(null);

  useEffect(() => {
    const fetchRealtime = async () => {
      try {
        const response = await fetch('/api/voice-agent/metrics/realtime');
        const data = await response.json();

        if (data.success) {
          setRealtimeMetrics({
            callsLastHour: data.callsLastHour,
            activeCalls: data.activeCalls,
            avgLatencyLastHour: data.avgLatencyLastHour,
            lastUpdated: data.lastUpdated,
          });
        }
      } catch (err) {
        console.error('Error fetching realtime metrics:', err);
      }
    };

    // Fetch immediately
    fetchRealtime();

    // Refresh every 30 seconds
    const interval = setInterval(fetchRealtime, 30000);

    return () => clearInterval(interval);
  }, []);

  return realtimeMetrics;
}

// =====================================================
// MAIN PAGE COMPONENT
// =====================================================

export default function VoiceAgentDashboardPage() {
  // State
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    ...getDateRangeDates('7d'),
    preset: '7d',
  }));
  const [currentPage, setCurrentPage] = useState(0);

  // Data hooks
  const {
    metrics,
    callsByDay,
    latencyByDay,
    outcomeDistribution,
    isLoading: isLoadingMetrics,
    refetch,
  } = useDashboardData(dateRange);

  const {
    calls,
    pagination,
    isLoading: isLoadingCalls,
  } = useCallsData(dateRange, currentPage);

  const realtimeMetrics = useRealtimeMetrics();

  // Handlers
  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
    setCurrentPage(0); // Reset pagination
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Combined loading state
  const isLoading = isLoadingMetrics || isLoadingCalls;

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MetricsDashboard
          metrics={metrics}
          callsByDay={callsByDay}
          latencyByDay={latencyByDay}
          outcomeDistribution={outcomeDistribution}
          recentCalls={calls}
          pagination={pagination}
          realtimeMetrics={realtimeMetrics}
          dateRange={dateRange}
          isLoading={isLoading}
          showRealtime={true}
          onDateRangeChange={handleDateRangeChange}
          onPageChange={handlePageChange}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  );
}
