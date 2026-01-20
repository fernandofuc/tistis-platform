/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * OutcomeChart Component
 *
 * Donut/Pie chart showing distribution of call outcomes.
 * Uses Recharts with TIS TIS styling.
 */

'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { OutcomeDistribution } from './types';
import { OUTCOME_COLORS, OUTCOME_LABELS, formatPercent } from './types';
import type { CallOutcome } from '@/src/features/voice-agent/types';

// =====================================================
// TYPES
// =====================================================

export interface OutcomeChartProps {
  /** Outcome distribution data */
  data: OutcomeDistribution[];
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
      </div>
      <div className="flex items-center justify-center">
        <div className="w-40 h-40 rounded-full bg-slate-100" />
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
    payload: {
      label: string;
      count: number;
      percent: number;
      color: string;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 min-w-[140px]">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: data.color }}
        />
        <span className="text-sm font-semibold text-slate-900">{data.label}</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-xs text-slate-500">Llamadas</span>
          <span className="text-xs font-semibold text-slate-900">{data.count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-slate-500">Porcentaje</span>
          <span className="text-xs font-semibold text-slate-900">
            {formatPercent(data.percent)}
          </span>
        </div>
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
    payload: {
      label: string;
      count: number;
      percent: number;
    };
  }>;
  onHover?: (outcome: string | null) => void;
  activeOutcome?: string | null;
}

function CustomLegend({ payload, onHover, activeOutcome }: CustomLegendProps) {
  if (!payload) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {payload.map((entry) => {
        const isActive = activeOutcome === entry.value || !activeOutcome;
        return (
          <div
            key={entry.value}
            className={`
              flex items-center gap-2 p-2 rounded-lg cursor-pointer
              transition-all duration-200
              ${isActive ? 'bg-slate-50' : 'opacity-40'}
            `}
            onMouseEnter={() => onHover?.(entry.value)}
            onMouseLeave={() => onHover?.(null)}
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700 truncate">
                {entry.payload.label}
              </p>
              <p className="text-[10px] text-slate-400">
                {entry.payload.count} ({formatPercent(entry.payload.percent)})
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// CENTER LABEL
// =====================================================

interface CenterLabelProps {
  total: number;
  activeOutcome?: string | null;
  data: OutcomeDistribution[];
}

function CenterLabel({ total, activeOutcome, data }: CenterLabelProps) {
  const activeData = activeOutcome
    ? data.find((d) => d.outcome === activeOutcome)
    : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center">
        {activeData ? (
          <>
            <p className="text-2xl font-bold text-slate-900">{activeData.count}</p>
            <p className="text-xs text-slate-500">{activeData.label}</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-slate-900">{total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </>
        )}
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function OutcomeChart({
  data,
  height = 320,
  showLegend = true,
  isLoading = false,
  className = '',
}: OutcomeChartProps) {
  const [activeOutcome, setActiveOutcome] = useState<string | null>(null);

  // Calculate total
  const total = useMemo(() => {
    return data.reduce((sum, d) => sum + d.count, 0);
  }, [data]);

  // Sort data by count (descending)
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.count - a.count);
  }, [data]);

  // Animation
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: 0.2 },
    },
  };

  if (isLoading) {
    return <ChartSkeleton height={height} />;
  }

  if (data.length === 0 || total === 0) {
    return (
      <div
        className={`bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-slate-500">No hay datos de resultados</p>
          <p className="text-xs text-slate-400 mt-1">
            Los datos aparecerán cuando haya llamadas completadas
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
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Resultados de Llamadas</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Distribución por tipo de resultado
        </p>
      </div>

      {/* Chart with center label */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={height - 140}>
          <PieChart>
            <Pie
              data={sortedData as unknown as Array<Record<string, unknown>>}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="count"
              nameKey="outcome"
              onMouseEnter={(_, index) => setActiveOutcome(sortedData[index].outcome)}
              onMouseLeave={() => setActiveOutcome(null)}
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="white"
                  strokeWidth={2}
                  style={{
                    opacity: activeOutcome === entry.outcome || !activeOutcome ? 1 : 0.4,
                    transition: 'opacity 0.2s ease',
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <CenterLabel total={total} activeOutcome={activeOutcome} data={sortedData} />
      </div>

      {/* Legend */}
      {showLegend && (
        <CustomLegend
          payload={sortedData.map((d) => ({
            value: d.outcome,
            color: d.color,
            payload: d,
          }))}
          onHover={setActiveOutcome}
          activeOutcome={activeOutcome}
        />
      )}
    </motion.div>
  );
}

// =====================================================
// HELPER FUNCTION
// =====================================================

/**
 * Create outcome distribution from raw data
 */
export function createOutcomeDistribution(
  outcomeCounts: Record<CallOutcome, number>
): OutcomeDistribution[] {
  const total = Object.values(outcomeCounts).reduce((sum, count) => sum + count, 0);

  return Object.entries(outcomeCounts)
    .filter(([_, count]) => count > 0)
    .map(([outcome, count]) => ({
      outcome: outcome as CallOutcome,
      label: OUTCOME_LABELS[outcome as CallOutcome] || outcome,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
      color: OUTCOME_COLORS[outcome as CallOutcome] || '#94a3b8',
    }));
}

export default OutcomeChart;
