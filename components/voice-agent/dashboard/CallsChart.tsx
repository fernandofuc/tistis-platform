/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * CallsChart Component
 *
 * Area chart showing calls over time with stacked breakdown
 * by completion status. Uses Recharts with TIS TIS styling.
 */

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { CallsByDay } from './types';
import { CHART_COLORS } from './types';

// =====================================================
// TYPES
// =====================================================

export interface CallsChartProps {
  /** Calls data by day */
  data: CallsByDay[];
  /** Chart height */
  height?: number;
  /** Whether to show legend */
  showLegend?: boolean;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Additional className */
  className?: string;
}

// =====================================================
// SKELETON
// =====================================================

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse"
      style={{ height }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="w-40 h-6 rounded bg-slate-100" />
        <div className="w-24 h-8 rounded bg-slate-50" />
      </div>
      <div className="flex items-end gap-2 h-[calc(100%-60px)]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-100 rounded-t"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// =====================================================
// CUSTOM TOOLTIP
// =====================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-slate-500 mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-slate-600">{entry.name}</span>
            </div>
            <span className="text-xs font-semibold text-slate-900">{entry.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between">
        <span className="text-xs font-medium text-slate-500">Total</span>
        <span className="text-sm font-bold text-slate-900">{total}</span>
      </div>
    </div>
  );
}

// =====================================================
// CUSTOM LEGEND
// =====================================================

interface CustomLegendProps {
  payload?: Array<{
    value: string;
    color: string;
    dataKey: string;
  }>;
}

function CustomLegend({ payload }: CustomLegendProps) {
  if (!payload) return null;

  return (
    <div className="flex items-center justify-center gap-6 mt-4">
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-medium text-slate-600">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function CallsChart({
  data,
  height = 320,
  showLegend = true,
  isLoading = false,
  className = '',
}: CallsChartProps) {
  // Transform data for stacked area
  const chartData = useMemo(() => {
    return data.map((d) => ({
      name: d.displayDate,
      date: d.date,
      Completadas: d.completed,
      Fallidas: d.failed,
      Escaladas: d.escalated,
      total: d.total,
    }));
  }, [data]);

  // Animation
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  if (isLoading) {
    return <ChartSkeleton height={height} />;
  }

  if (data.length === 0) {
    return (
      <div
        className={`bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-slate-500">No hay datos disponibles</p>
          <p className="text-xs text-slate-400 mt-1">
            Selecciona un rango de fechas diferente
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`bg-white rounded-2xl border border-slate-200 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Llamadas por Día</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Desglose por estado de llamada
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">
            {chartData.reduce((sum, d) => sum + d.total, 0)}
          </p>
          <p className="text-xs text-slate-500">Total periodo</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height - 100}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="gradientCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.tertiary} stopOpacity={0.4} />
              <stop offset="95%" stopColor={CHART_COLORS.tertiary} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradientFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.error} stopOpacity={0.4} />
              <stop offset="95%" stopColor={CHART_COLORS.error} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradientEscalated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.warning} stopOpacity={0.4} />
              <stop offset="95%" stopColor={CHART_COLORS.warning} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            dy={10}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            dx={-10}
            allowDecimals={false}
          />

          <Tooltip content={<CustomTooltip />} />

          {showLegend && <Legend content={<CustomLegend />} />}

          <Area
            type="monotone"
            dataKey="Completadas"
            stackId="1"
            stroke={CHART_COLORS.tertiary}
            strokeWidth={2}
            fill="url(#gradientCompleted)"
          />
          <Area
            type="monotone"
            dataKey="Escaladas"
            stackId="1"
            stroke={CHART_COLORS.warning}
            strokeWidth={2}
            fill="url(#gradientEscalated)"
          />
          <Area
            type="monotone"
            dataKey="Fallidas"
            stackId="1"
            stroke={CHART_COLORS.error}
            strokeWidth={2}
            fill="url(#gradientFailed)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export default CallsChart;
