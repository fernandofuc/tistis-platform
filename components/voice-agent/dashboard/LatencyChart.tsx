/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * LatencyChart Component
 *
 * Line chart showing latency metrics over time (avg, p50, p95).
 * Uses Recharts with TIS TIS styling.
 */

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { LatencyDataPoint } from './types';
import { CHART_COLORS, formatLatency } from './types';

// =====================================================
// TYPES
// =====================================================

export interface LatencyChartProps {
  /** Latency data by day */
  data: LatencyDataPoint[];
  /** Chart height */
  height?: number;
  /** Whether to show legend */
  showLegend?: boolean;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Target latency line (ms) */
  targetLatency?: number;
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
        <div className="flex gap-4">
          <div className="w-16 h-4 rounded bg-slate-50" />
          <div className="w-16 h-4 rounded bg-slate-50" />
          <div className="w-16 h-4 rounded bg-slate-50" />
        </div>
      </div>
      <div className="h-[calc(100%-60px)] flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 400 200">
          <path
            d="M0,150 Q100,100 200,120 T400,80"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="2"
          />
          <path
            d="M0,120 Q100,80 200,100 T400,60"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="2"
          />
        </svg>
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 min-w-[140px]">
      <p className="text-xs font-semibold text-slate-500 mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-slate-600">{entry.name}</span>
            </div>
            <span className="text-xs font-semibold text-slate-900">
              {formatLatency(entry.value)}
            </span>
          </div>
        ))}
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
            className="w-3 h-0.5 rounded"
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

export function LatencyChart({
  data,
  height = 280,
  showLegend = true,
  isLoading = false,
  targetLatency,
  className = '',
}: LatencyChartProps) {
  // Transform data for chart
  const chartData = useMemo(() => {
    return data.map((d) => ({
      name: d.displayDate,
      date: d.date,
      'Promedio': d.avg,
      'P50': d.p50,
      'P95': d.p95,
    }));
  }, [data]);

  // Calculate averages for header
  const averages = useMemo(() => {
    if (data.length === 0) return { avg: 0, p50: 0, p95: 0 };
    const sum = data.reduce(
      (acc, d) => ({
        avg: acc.avg + d.avg,
        p50: acc.p50 + d.p50,
        p95: acc.p95 + d.p95,
      }),
      { avg: 0, p50: 0, p95: 0 }
    );
    return {
      avg: sum.avg / data.length,
      p50: sum.p50 / data.length,
      p95: sum.p95 / data.length,
    };
  }, [data]);

  // Animation
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: 0.1 },
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
          <p className="text-slate-500">No hay datos de latencia</p>
          <p className="text-xs text-slate-400 mt-1">
            Los datos aparecerán cuando haya llamadas
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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Latencia de Respuesta</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tiempo de respuesta del asistente
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-sm font-bold text-tis-purple">{formatLatency(averages.avg)}</p>
            <p className="text-xs text-slate-400">Promedio</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-tis-coral">{formatLatency(averages.p50)}</p>
            <p className="text-xs text-slate-400">P50</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-600">{formatLatency(averages.p95)}</p>
            <p className="text-xs text-slate-400">P95</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height - 100}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
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
            tickFormatter={(value) => `${value}ms`}
          />

          <Tooltip content={<CustomTooltip />} />

          {showLegend && <Legend content={<CustomLegend />} />}

          {/* Target line */}
          {targetLatency && (
            <ReferenceLine
              y={targetLatency}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              label={{
                value: `Objetivo: ${formatLatency(targetLatency)}`,
                position: 'right',
                fontSize: 10,
                fill: '#94a3b8',
              }}
            />
          )}

          <Line
            type="monotone"
            dataKey="Promedio"
            stroke={CHART_COLORS.purple}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.purple, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="P50"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.primary, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="P95"
            stroke={CHART_COLORS.muted}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ fill: CHART_COLORS.muted, strokeWidth: 0, r: 2 }}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export default LatencyChart;
