/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * MetricsDashboard Component
 *
 * Main dashboard container that orchestrates all metrics,
 * charts, and tables with coordinated state management.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshIcon,
  BarChartIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';

// Dashboard components
import { MetricsGrid, RealtimeIndicator } from './MetricsGrid';
import { CallsChart } from './CallsChart';
import { LatencyChart } from './LatencyChart';
import { OutcomeChart } from './OutcomeChart';
import { RecentCallsTable } from './RecentCallsTable';
import { CallDetailsModal } from './CallDetailsModal';
import { DateRangePicker, CompactDateRangePicker } from './DateRangePicker';

// Types
import type { VoiceCall } from '@/src/features/voice-agent/types';
import type {
  DateRange,
  DateRangePreset,
  DashboardMetrics,
  CallsByDay,
  LatencyDataPoint,
  OutcomeDistribution,
  PaginationState,
  RealtimeMetrics,
} from './types';
import { getDateRangeDates } from './types';

// =====================================================
// TYPES
// =====================================================

export interface MetricsDashboardProps {
  /** Dashboard metrics data */
  metrics: DashboardMetrics | null;
  /** Calls by day for chart */
  callsByDay: CallsByDay[];
  /** Latency data for chart */
  latencyByDay: LatencyDataPoint[];
  /** Outcome distribution for chart */
  outcomeDistribution: OutcomeDistribution[];
  /** Recent calls list */
  recentCalls: VoiceCall[];
  /** Pagination state */
  pagination: PaginationState;
  /** Realtime metrics */
  realtimeMetrics?: RealtimeMetrics | null;
  /** Current date range */
  dateRange: DateRange;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Whether to show realtime indicator */
  showRealtime?: boolean;
  /** Whether to show the header section (set to false when embedded in another page) */
  showHeader?: boolean;
  /** Callback when date range changes */
  onDateRangeChange: (range: DateRange) => void;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Additional className */
  className?: string;
}

// =====================================================
// SKELETON
// =====================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="w-48 h-8 rounded bg-slate-100" />
        <div className="w-32 h-10 rounded-xl bg-slate-100" />
      </div>

      {/* Metrics grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-white rounded-2xl border border-slate-200" />
        <div className="h-80 bg-white rounded-2xl border border-slate-200" />
      </div>

      {/* Table skeleton */}
      <div className="h-96 bg-white rounded-2xl border border-slate-200" />
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function MetricsDashboard({
  metrics,
  callsByDay,
  latencyByDay,
  outcomeDistribution,
  recentCalls,
  pagination,
  realtimeMetrics,
  dateRange,
  isLoading = false,
  showRealtime = true,
  showHeader = true,
  onDateRangeChange,
  onPageChange,
  onRefresh,
  className = '',
}: MetricsDashboardProps) {
  // State for call details modal
  const [selectedCall, setSelectedCall] = useState<VoiceCall | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle call click
  const handleCallClick = useCallback((call: VoiceCall) => {
    setSelectedCall(call);
    setIsModalOpen(true);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    // Keep selectedCall for exit animation
    setTimeout(() => setSelectedCall(null), 200);
  }, []);

  // Handle date range preset change (compact picker)
  const handlePresetChange = useCallback(
    (preset: DateRangePreset) => {
      const dates = getDateRangeDates(preset);
      onDateRangeChange({ ...dates, preset });
    },
    [onDateRangeChange]
  );

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  if (isLoading && !metrics) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`space-y-6 ${className}`}
    >
      {/* Header - conditionally rendered */}
      {showHeader && (
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-coral flex items-center justify-center">
              <BarChartIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Dashboard de Voz</h1>
              <p className="text-sm text-slate-500">Métricas y análisis de llamadas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range picker (desktop) */}
            <div className="hidden sm:block">
              <DateRangePicker
                value={dateRange}
                onChange={onDateRangeChange}
                disabled={isLoading}
              />
            </div>

            {/* Compact date picker (mobile) */}
            <div className="sm:hidden">
              <CompactDateRangePicker
                value={dateRange.preset || '7d'}
                onChange={handlePresetChange}
                disabled={isLoading}
              />
            </div>

            {/* Refresh button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className={`
                  p-2.5 rounded-xl border border-slate-200 bg-white
                  text-slate-500 hover:text-slate-700 hover:border-slate-300
                  transition-all duration-200
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                aria-label="Actualizar datos"
              >
                <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Controls bar - shown when header is hidden */}
      {!showHeader && (
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-end gap-3"
        >
          {/* Date range picker (desktop) */}
          <div className="hidden sm:block">
            <DateRangePicker
              value={dateRange}
              onChange={onDateRangeChange}
              disabled={isLoading}
            />
          </div>

          {/* Compact date picker (mobile) */}
          <div className="sm:hidden">
            <CompactDateRangePicker
              value={dateRange.preset || '7d'}
              onChange={handlePresetChange}
              disabled={isLoading}
            />
          </div>

          {/* Refresh button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className={`
                p-2.5 rounded-xl border border-slate-200 bg-white
                text-slate-500 hover:text-slate-700 hover:border-slate-300
                transition-all duration-200
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              aria-label="Actualizar datos"
            >
              <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </motion.div>
      )}

      {/* Realtime indicator */}
      {showRealtime && realtimeMetrics && (
        <motion.div variants={itemVariants}>
          <RealtimeIndicator
            activeCalls={realtimeMetrics.activeCalls}
            callsLastHour={realtimeMetrics.callsLastHour}
            lastUpdated={realtimeMetrics.lastUpdated}
          />
        </motion.div>
      )}

      {/* Metrics grid */}
      <motion.div variants={itemVariants}>
        <MetricsGrid metrics={metrics} isLoading={isLoading} />
      </motion.div>

      {/* Charts row */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <CallsChart data={callsByDay} isLoading={isLoading} />
        <LatencyChart data={latencyByDay} isLoading={isLoading} targetLatency={500} />
      </motion.div>

      {/* Outcome chart and table row */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <OutcomeChart
          data={outcomeDistribution}
          isLoading={isLoading}
          className="lg:col-span-1"
        />
        <RecentCallsTable
          calls={recentCalls}
          pagination={pagination}
          isLoading={isLoading}
          onPageChange={onPageChange}
          onCallClick={handleCallClick}
          className="lg:col-span-2"
        />
      </motion.div>

      {/* Call details modal */}
      <CallDetailsModal
        call={selectedCall}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </motion.div>
  );
}

export default MetricsDashboard;
