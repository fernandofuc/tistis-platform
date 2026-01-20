/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * MetricCard Component
 *
 * Premium metric card with animated value, trend indicator,
 * and optional sparkline. Follows TIS TIS design system.
 */

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUpIcon,
  TrendingDownIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import type { MetricValue } from './types';
import { formatPercent } from './types';

// =====================================================
// TYPES
// =====================================================

export type MetricVariant = 'default' | 'success' | 'warning' | 'coral' | 'purple';

export interface MetricCardProps {
  /** Card title */
  title: string;
  /** Metric value data */
  metric: MetricValue;
  /** Value format function */
  formatValue?: (value: number) => string;
  /** Icon component */
  icon?: React.ReactNode;
  /** Visual variant */
  variant?: MetricVariant;
  /** Description text */
  description?: string;
  /** Whether to show comparison */
  showComparison?: boolean;
  /** Additional className */
  className?: string;
  /** Whether card is loading */
  isLoading?: boolean;
  /** Animation delay for staggered entry */
  animationDelay?: number;
}

// =====================================================
// VARIANT STYLES
// =====================================================

const VARIANT_STYLES: Record<MetricVariant, {
  iconBg: string;
  iconText: string;
  accent: string;
  ring: string;
}> = {
  default: {
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
    accent: 'text-slate-900',
    ring: 'ring-slate-200',
  },
  success: {
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
    accent: 'text-green-600',
    ring: 'ring-green-200',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    accent: 'text-amber-600',
    ring: 'ring-amber-200',
  },
  coral: {
    iconBg: 'bg-tis-coral-100',
    iconText: 'text-tis-coral-600',
    accent: 'text-tis-coral',
    ring: 'ring-tis-coral-200',
  },
  purple: {
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
    accent: 'text-tis-purple',
    ring: 'ring-purple-200',
  },
};

// =====================================================
// SKELETON
// =====================================================

function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="w-16 h-5 rounded bg-slate-100" />
      </div>
      <div className="space-y-2">
        <div className="w-24 h-8 rounded bg-slate-100" />
        <div className="w-32 h-4 rounded bg-slate-50" />
      </div>
    </div>
  );
}

// =====================================================
// TREND INDICATOR
// =====================================================

interface TrendIndicatorProps {
  changePercent: number;
  changeIsPositive?: boolean;
}

function TrendIndicator({ changePercent, changeIsPositive }: TrendIndicatorProps) {
  const isPositive = changeIsPositive ?? changePercent >= 0;
  const isNeutral = Math.abs(changePercent) < 0.5;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Sin cambios
      </span>
    );
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
        ${isPositive
          ? 'bg-green-50 text-green-700'
          : 'bg-red-50 text-red-700'
        }
      `}
    >
      {changePercent >= 0 ? (
        <TrendingUpIcon className="w-3 h-3" />
      ) : (
        <TrendingDownIcon className="w-3 h-3" />
      )}
      {formatPercent(Math.abs(changePercent), 1)}
    </span>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function MetricCard({
  title,
  metric,
  formatValue = (v) => v.toLocaleString('es-MX'),
  icon,
  variant = 'default',
  description,
  showComparison = true,
  className = '',
  isLoading = false,
  animationDelay = 0,
}: MetricCardProps) {
  const styles = VARIANT_STYLES[variant];

  // Format the main value
  const formattedValue = useMemo(
    () => formatValue(metric.value),
    [metric.value, formatValue]
  );

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay: animationDelay,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  };

  const valueVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        delay: animationDelay + 0.1,
      },
    },
  };

  if (isLoading) {
    return <MetricCardSkeleton />;
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`
        bg-white rounded-2xl border border-slate-200 p-5
        shadow-card hover:shadow-card-hover
        transition-all duration-300
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        {/* Icon */}
        {icon && (
          <div
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${styles.iconBg} ${styles.iconText}
            `}
          >
            {icon}
          </div>
        )}

        {/* Trend */}
        {showComparison && metric.changePercent !== undefined && (
          <TrendIndicator
            changePercent={metric.changePercent}
            changeIsPositive={metric.changeIsPositive}
          />
        )}
      </div>

      {/* Value */}
      <motion.div variants={valueVariants} initial="hidden" animate="visible">
        <p className={`text-metric ${styles.accent} mb-1`}>
          {formattedValue}
        </p>
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {description && (
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        )}
      </motion.div>

      {/* Previous value comparison */}
      {showComparison && metric.previousValue !== undefined && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            Periodo anterior:{' '}
            <span className="font-medium text-slate-500">
              {formatValue(metric.previousValue)}
            </span>
          </p>
        </div>
      )}
    </motion.div>
  );
}

// =====================================================
// COMPACT VARIANT
// =====================================================

export interface CompactMetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export function CompactMetricCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  className = '',
}: CompactMetricCardProps) {
  return (
    <div
      className={`
        flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3
        ${className}
      `}
    >
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 truncate">{title}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
      {trend && trendValue && (
        <span
          className={`
            text-xs font-medium
            ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-400'}
          `}
        >
          {trend === 'up' && '↑'}
          {trend === 'down' && '↓'}
          {trendValue}
        </span>
      )}
    </div>
  );
}

export default MetricCard;
