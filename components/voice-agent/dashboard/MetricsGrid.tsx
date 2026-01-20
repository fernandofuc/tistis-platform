/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * MetricsGrid Component
 *
 * Grid layout for displaying multiple metric cards with
 * coordinated animations and responsive design.
 */

'use client';

import { motion } from 'framer-motion';
import { MetricCard, type MetricCardProps } from './MetricCard';
import {
  PhoneCallIcon,
  CheckCircleIcon,
  ClockIcon,
  ZapIcon,
  CalendarIcon,
  UsersIcon,
  DollarIcon,
  TrendingUpIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import type { DashboardMetrics } from './types';
import { formatDuration, formatLatency, formatPercent, formatCurrency } from './types';

// =====================================================
// TYPES
// =====================================================

export interface MetricsGridProps {
  /** Dashboard metrics data */
  metrics: DashboardMetrics | null;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Layout variant */
  variant?: 'full' | 'compact';
  /** Additional className */
  className?: string;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function MetricsGrid({
  metrics,
  isLoading = false,
  variant = 'full',
  className = '',
}: MetricsGridProps) {
  // Container animation
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  // Define metrics config
  const metricConfigs: (MetricCardProps & { key: string; show?: boolean })[] = [
    {
      key: 'totalCalls',
      title: 'Total de Llamadas',
      metric: metrics?.totalCalls ?? { value: 0 },
      icon: <PhoneCallIcon className="w-5 h-5" />,
      variant: 'coral',
      description: 'Llamadas recibidas',
      show: true,
    },
    {
      key: 'successRate',
      title: 'Tasa de Éxito',
      metric: metrics?.successRate ?? { value: 0 },
      formatValue: (v) => formatPercent(v, 1),
      icon: <CheckCircleIcon className="w-5 h-5" />,
      variant: 'success',
      description: 'Llamadas completadas',
      show: true,
    },
    {
      key: 'avgDuration',
      title: 'Duración Promedio',
      metric: metrics?.avgDuration ?? { value: 0 },
      formatValue: (v) => formatDuration(Math.round(v)),
      icon: <ClockIcon className="w-5 h-5" />,
      variant: 'purple',
      description: 'Por llamada',
      show: true,
    },
    {
      key: 'avgLatency',
      title: 'Latencia Promedio',
      metric: metrics?.avgLatency ?? { value: 0 },
      formatValue: (v) => formatLatency(v),
      icon: <ZapIcon className="w-5 h-5" />,
      variant: 'default',
      description: 'Tiempo de respuesta',
      show: true,
    },
    {
      key: 'bookingRate',
      title: 'Tasa de Reservas',
      metric: metrics?.bookingRate ?? { value: 0 },
      formatValue: (v) => formatPercent(v, 1),
      icon: <CalendarIcon className="w-5 h-5" />,
      variant: 'success',
      description: 'Citas agendadas',
      show: variant === 'full' && !!metrics?.bookingRate,
    },
    {
      key: 'escalationRate',
      title: 'Tasa de Escalación',
      metric: metrics?.escalationRate ?? { value: 0 },
      formatValue: (v) => formatPercent(v, 1),
      icon: <UsersIcon className="w-5 h-5" />,
      variant: 'warning',
      description: 'Transferidas a humano',
      show: variant === 'full' && !!metrics?.escalationRate,
    },
    {
      key: 'totalCost',
      title: 'Costo Total',
      metric: metrics?.totalCost ?? { value: 0 },
      formatValue: (v) => formatCurrency(v),
      icon: <DollarIcon className="w-5 h-5" />,
      variant: 'default',
      description: 'Periodo actual',
      show: variant === 'full' && !!metrics?.totalCost,
    },
  ];

  // Filter visible metrics
  const visibleMetrics = metricConfigs.filter((m) => m.show);

  // Grid columns based on visible count
  const gridCols = visibleMetrics.length <= 4
    ? 'sm:grid-cols-2 lg:grid-cols-4'
    : 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`grid grid-cols-1 ${gridCols} gap-4 ${className}`}
    >
      {visibleMetrics.map((config, index) => (
        <MetricCard
          key={config.key}
          title={config.title}
          metric={config.metric}
          formatValue={config.formatValue}
          icon={config.icon}
          variant={config.variant}
          description={config.description}
          isLoading={isLoading}
          animationDelay={index * 0.1}
        />
      ))}
    </motion.div>
  );
}

// =====================================================
// REALTIME INDICATOR
// =====================================================

export interface RealtimeIndicatorProps {
  activeCalls: number;
  callsLastHour: number;
  lastUpdated: string;
  className?: string;
}

export function RealtimeIndicator({
  activeCalls,
  callsLastHour,
  lastUpdated,
  className = '',
}: RealtimeIndicatorProps) {
  const formattedTime = new Date(lastUpdated).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`
        flex items-center gap-4 px-4 py-3 bg-white rounded-xl border border-slate-200
        ${className}
      `}
    >
      {/* Pulse indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        <span className="text-sm font-medium text-slate-900">En vivo</span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <PhoneCallIcon className="w-4 h-4 text-tis-coral" />
          <span className="text-slate-600">
            <strong className="text-slate-900">{activeCalls}</strong> activas
          </span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <TrendingUpIcon className="w-4 h-4 text-slate-400" />
          <span className="text-slate-600">
            <strong className="text-slate-900">{callsLastHour}</strong> última hora
          </span>
        </div>
      </div>

      {/* Last updated */}
      <div className="ml-auto text-xs text-slate-400">
        Actualizado: {formattedTime}
      </div>
    </div>
  );
}

export default MetricsGrid;
