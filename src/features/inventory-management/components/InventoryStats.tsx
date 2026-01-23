// =====================================================
// TIS TIS PLATFORM - Inventory Stats Component
// Premium dashboard statistics for inventory overview
// Apple/Google-inspired with TIS TIS brand identity
// =====================================================

'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils';
import { Card } from '@/shared/components/ui';
import type { UseInventoryReturn } from '../types';

// ======================
// TYPES
// ======================
export interface InventoryStatsProps extends HTMLAttributes<HTMLDivElement> {
  stats: UseInventoryReturn['stats'];
  loading?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  showValue?: boolean;
  onStatClick?: (stat: StatKey) => void;
}

type StatKey = 'total' | 'inStock' | 'lowStock' | 'outOfStock' | 'overstocked' | 'totalValue';

// ======================
// STAT CONFIGURATION
// ======================
interface StatConfig {
  label: string;
  shortLabel: string;
  icon: string;
  colors: {
    bg: string;
    icon: string;
    text: string;
    accent: string;
  };
}

const STAT_CONFIG: Record<StatKey, StatConfig> = {
  total: {
    label: 'Total de Items',
    shortLabel: 'Total',
    icon: 'Package',
    colors: {
      bg: 'bg-slate-100',
      icon: 'text-slate-600',
      text: 'text-slate-900',
      accent: 'bg-slate-500',
    },
  },
  inStock: {
    label: 'En Stock',
    shortLabel: 'En Stock',
    icon: 'CheckCircle',
    colors: {
      bg: 'bg-tis-green-100',
      icon: 'text-tis-green-600',
      text: 'text-tis-green-700',
      accent: 'bg-tis-green-500',
    },
  },
  lowStock: {
    label: 'Stock Bajo',
    shortLabel: 'Bajo',
    icon: 'AlertTriangle',
    colors: {
      bg: 'bg-amber-100',
      icon: 'text-amber-600',
      text: 'text-amber-700',
      accent: 'bg-amber-500',
    },
  },
  outOfStock: {
    label: 'Sin Stock',
    shortLabel: 'Agotado',
    icon: 'XCircle',
    colors: {
      bg: 'bg-red-100',
      icon: 'text-red-600',
      text: 'text-red-700',
      accent: 'bg-red-500',
    },
  },
  overstocked: {
    label: 'Sobrestock',
    shortLabel: 'Exceso',
    icon: 'TrendingUp',
    colors: {
      bg: 'bg-tis-purple-100',
      icon: 'text-tis-purple-600',
      text: 'text-tis-purple-700',
      accent: 'bg-tis-purple-500',
    },
  },
  totalValue: {
    label: 'Valor Total',
    shortLabel: 'Valor',
    icon: 'DollarSign',
    colors: {
      bg: 'bg-tis-coral-100',
      icon: 'text-tis-coral-600',
      text: 'text-tis-coral-700',
      accent: 'bg-tis-coral-500',
    },
  },
};

// ======================
// ICON PATHS
// ======================
const ICON_PATHS: Record<string, string> = {
  Package: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  CheckCircle: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  AlertTriangle: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  XCircle: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  TrendingUp: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  DollarSign: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

// ======================
// STAT ICON COMPONENT
// ======================
interface StatIconProps {
  icon: string;
  className?: string;
}

const StatIcon = ({ icon, className }: StatIconProps) => {
  const path = ICON_PATHS[icon] || ICON_PATHS.Package;

  return (
    <svg
      className={cn('w-5 h-5', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={path}
      />
    </svg>
  );
};

// ======================
// LOADING SKELETON
// ======================
const StatSkeleton = ({ variant = 'default' }: { variant?: 'default' | 'compact' }) => {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 animate-pulse">
        <div className="w-8 h-8 rounded-lg bg-slate-200" />
        <div className="flex-1">
          <div className="h-3 w-16 bg-slate-200 rounded mb-1" />
          <div className="h-5 w-12 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200" />
        <div className="h-4 w-20 bg-slate-200 rounded" />
      </div>
      <div className="h-8 w-16 bg-slate-200 rounded" />
    </div>
  );
};

// ======================
// SINGLE STAT CARD
// ======================
interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  statKey: StatKey;
  value: number;
  loading?: boolean;
  variant?: 'default' | 'compact';
  isCurrency?: boolean;
  onStatClick?: (stat: StatKey) => void;
}

const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ statKey, value, loading, variant = 'default', isCurrency = false, onStatClick, className, ...props }, ref) => {
    const config = STAT_CONFIG[statKey];

    const formattedValue = isCurrency
      ? new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value)
      : value.toLocaleString('es-MX');

    if (loading) {
      return <StatSkeleton variant={variant} />;
    }

    const isClickable = !!onStatClick;

    // Compact variant
    if (variant === 'compact') {
      return (
        <div
          ref={ref}
          onClick={isClickable ? () => onStatClick(statKey) : undefined}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
            config.colors.bg,
            isClickable && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
            className
          )}
          {...props}
        >
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            'bg-white/60'
          )}>
            <StatIcon icon={config.icon} className={config.colors.icon} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">{config.shortLabel}</p>
            <p className={cn('text-lg font-bold truncate', config.colors.text)}>
              {formattedValue}
            </p>
          </div>
        </div>
      );
    }

    // Default variant
    return (
      <Card
        ref={ref}
        variant="default"
        padding="none"
        hover={isClickable}
        onClick={isClickable ? () => onStatClick(statKey) : undefined}
        className={cn(
          'overflow-hidden transition-all duration-200',
          isClickable && 'cursor-pointer',
          className
        )}
        {...props}
      >
        {/* Accent bar */}
        <div className={cn('h-1', config.colors.accent)} />

        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              config.colors.bg
            )}>
              <StatIcon icon={config.icon} className={config.colors.icon} />
            </div>
            <p className="text-sm font-medium text-slate-500">{config.label}</p>
          </div>

          <p className={cn(
            'text-2xl sm:text-3xl font-bold tracking-tight',
            config.colors.text
          )}>
            {formattedValue}
          </p>
        </div>
      </Card>
    );
  }
);

StatCard.displayName = 'StatCard';

// ======================
// MAIN COMPONENT
// ======================
export const InventoryStats = forwardRef<HTMLDivElement, InventoryStatsProps>(
  ({
    className,
    stats,
    loading = false,
    variant = 'default',
    showValue = true,
    onStatClick,
    ...props
  }, ref) => {
    // Compact variant - horizontal scrollable chips
    if (variant === 'compact') {
      return (
        <div
          ref={ref}
          className={cn(
            'flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide',
            className
          )}
          {...props}
        >
          <StatCard
            statKey="total"
            value={stats.total}
            loading={loading}
            variant="compact"
            onStatClick={onStatClick}
          />
          <StatCard
            statKey="inStock"
            value={stats.inStock}
            loading={loading}
            variant="compact"
            onStatClick={onStatClick}
          />
          <StatCard
            statKey="lowStock"
            value={stats.lowStock}
            loading={loading}
            variant="compact"
            onStatClick={onStatClick}
          />
          <StatCard
            statKey="outOfStock"
            value={stats.outOfStock}
            loading={loading}
            variant="compact"
            onStatClick={onStatClick}
          />
          {showValue && (
            <StatCard
              statKey="totalValue"
              value={stats.totalValue}
              loading={loading}
              variant="compact"
              isCurrency
              onStatClick={onStatClick}
            />
          )}
        </div>
      );
    }

    // Detailed variant - full stats with charts placeholder
    if (variant === 'detailed') {
      return (
        <div ref={ref} className={cn('space-y-4', className)} {...props}>
          {/* Main stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <StatCard
              statKey="total"
              value={stats.total}
              loading={loading}
              onStatClick={onStatClick}
            />
            <StatCard
              statKey="inStock"
              value={stats.inStock}
              loading={loading}
              onStatClick={onStatClick}
            />
            <StatCard
              statKey="lowStock"
              value={stats.lowStock}
              loading={loading}
              onStatClick={onStatClick}
            />
            <StatCard
              statKey="outOfStock"
              value={stats.outOfStock}
              loading={loading}
              onStatClick={onStatClick}
            />
            <StatCard
              statKey="overstocked"
              value={stats.overstocked}
              loading={loading}
              onStatClick={onStatClick}
            />
            {showValue && (
              <StatCard
                statKey="totalValue"
                value={stats.totalValue}
                loading={loading}
                isCurrency
                onStatClick={onStatClick}
              />
            )}
          </div>

          {/* Distribution bar */}
          <Card variant="default" padding="md">
            <p className="text-sm font-medium text-slate-600 mb-3">Distribución de Stock</p>
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
              {stats.total > 0 && (
                <>
                  <div
                    className="bg-tis-green-500 transition-all duration-500"
                    style={{ width: `${(stats.inStock / stats.total) * 100}%` }}
                  />
                  <div
                    className="bg-amber-500 transition-all duration-500"
                    style={{ width: `${(stats.lowStock / stats.total) * 100}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all duration-500"
                    style={{ width: `${(stats.outOfStock / stats.total) * 100}%` }}
                  />
                  <div
                    className="bg-tis-purple-500 transition-all duration-500"
                    style={{ width: `${(stats.overstocked / stats.total) * 100}%` }}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-tis-green-500" />
                <span className="text-slate-600">En Stock ({stats.inStock})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-600">Bajo ({stats.lowStock})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-slate-600">Agotado ({stats.outOfStock})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-tis-purple-500" />
                <span className="text-slate-600">Exceso ({stats.overstocked})</span>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    // Default variant - responsive grid
    return (
      <div
        ref={ref}
        className={cn(
          'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4',
          className
        )}
        {...props}
      >
        <StatCard
          statKey="total"
          value={stats.total}
          loading={loading}
          onStatClick={onStatClick}
        />
        <StatCard
          statKey="inStock"
          value={stats.inStock}
          loading={loading}
          onStatClick={onStatClick}
        />
        <StatCard
          statKey="lowStock"
          value={stats.lowStock}
          loading={loading}
          onStatClick={onStatClick}
        />
        <StatCard
          statKey="outOfStock"
          value={stats.outOfStock}
          loading={loading}
          onStatClick={onStatClick}
        />
        {showValue && (
          <StatCard
            statKey="totalValue"
            value={stats.totalValue}
            loading={loading}
            isCurrency
            onStatClick={onStatClick}
          />
        )}
      </div>
    );
  }
);

InventoryStats.displayName = 'InventoryStats';
