// =====================================================
// TIS TIS PLATFORM - Stock Status Badge Component
// Premium visual indicator for inventory stock levels
// =====================================================

'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils';
import type { StockStatus } from '../types';
import { STOCK_STATUS_CONFIG } from '../config/inventory-config';

// ======================
// TYPES
// ======================
export interface StockStatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: StockStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

// ======================
// SIZE STYLES
// ======================
const sizeStyles = {
  sm: 'px-2 py-1 sm:py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1.5 sm:py-1 text-xs gap-1.5',
  lg: 'px-3 py-2 sm:py-1.5 text-sm gap-2',
};

const dotSizeStyles = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

// ======================
// DOT COLORS (matches config.colors.icon pattern)
// ======================
const dotColorMap: Record<StockStatus, string> = {
  in_stock: 'bg-tis-green-500',
  low_stock: 'bg-amber-500',
  out_of_stock: 'bg-red-500',
  overstocked: 'bg-tis-purple-500',
};

// ======================
// COMPONENT
// ======================
export const StockStatusBadge = forwardRef<HTMLSpanElement, StockStatusBadgeProps>(
  ({ className, status, size = 'md', showDot = true, ...props }, ref) => {
    const config = STOCK_STATUS_CONFIG[status];

    if (!config) {
      return null;
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-semibold rounded-full transition-all duration-200',
          config.colors.bg,
          config.colors.text,
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {showDot && (
          <span
            className={cn(
              'rounded-full animate-pulse-soft',
              dotSizeStyles[size],
              dotColorMap[status]
            )}
          />
        )}
        {config.label}
      </span>
    );
  }
);

StockStatusBadge.displayName = 'StockStatusBadge';

// ======================
// STOCK LEVEL INDICATOR
// Visual progress bar for stock levels
// ======================
export interface StockLevelIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  currentStock: number;
  minimumStock: number;
  maximumStock?: number | null;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const barHeightStyles = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export const StockLevelIndicator = forwardRef<HTMLDivElement, StockLevelIndicatorProps>(
  ({
    className,
    currentStock,
    minimumStock,
    maximumStock,
    showLabels = false,
    size = 'md',
    ...props
  }, ref) => {
    // Calculate percentage (capped at 100% for display)
    const maxReference = maximumStock || minimumStock * 2;
    const percentage = Math.min((currentStock / maxReference) * 100, 100);

    // Determine color based on stock level
    const getBarColor = () => {
      if (currentStock <= 0) return 'bg-red-500';
      if (currentStock <= minimumStock) return 'bg-amber-500';
      if (maximumStock && currentStock > maximumStock) return 'bg-tis-purple-500';
      return 'bg-tis-green-500';
    };

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {showLabels && (
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{currentStock.toLocaleString('es-MX')}</span>
            <span>/ {minimumStock.toLocaleString('es-MX')} mín</span>
          </div>
        )}
        <div className={cn(
          'w-full bg-slate-100 rounded-full overflow-hidden',
          barHeightStyles[size]
        )}>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              getBarColor()
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

StockLevelIndicator.displayName = 'StockLevelIndicator';

// ======================
// STOCK VALUE DISPLAY
// Formatted display of stock value
// ======================
export interface StockValueDisplayProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const valueSizeStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export const StockValueDisplay = forwardRef<HTMLDivElement, StockValueDisplayProps>(
  ({
    className,
    value,
    currency = 'MXN',
    size = 'md',
    trend,
    trendValue,
    ...props
  }, ref) => {
    const formattedValue = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

    return (
      <div ref={ref} className={cn('flex items-center gap-2', className)} {...props}>
        <span className={cn(
          'font-bold text-slate-900',
          valueSizeStyles[size]
        )}>
          {formattedValue}
        </span>
        {trend && trendValue && (
          <span className={cn(
            'text-xs font-medium px-1.5 py-0.5 rounded',
            trend === 'up' && 'text-tis-green-600 bg-tis-green-100',
            trend === 'down' && 'text-red-600 bg-red-100',
            trend === 'neutral' && 'text-slate-600 bg-slate-100'
          )}>
            {trend === 'up' && '+'}
            {trend === 'down' && '-'}
            {trendValue}
          </span>
        )}
      </div>
    );
  }
);

StockValueDisplay.displayName = 'StockValueDisplay';
