// =====================================================
// TIS TIS PLATFORM - Movement Type Badge Component
// Visual indicator for inventory movement types
// =====================================================

'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils';
import type { MovementType } from '../types';
import { MOVEMENT_TYPE_CONFIG } from '../config/inventory-config';

// ======================
// TYPES
// ======================
export interface MovementTypeBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  type: MovementType;
  size?: 'sm' | 'md' | 'lg';
  showDirection?: boolean;
  compact?: boolean;
}

// ======================
// SIZE STYLES
// ======================
const sizeStyles = {
  sm: 'px-2 py-1 sm:py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1.5 sm:py-1 text-xs gap-1.5',
  lg: 'px-3 py-2 sm:py-1.5 text-sm gap-2',
};

const iconSizeStyles = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

// ======================
// COMPONENT
// ======================
export const MovementTypeBadge = forwardRef<HTMLSpanElement, MovementTypeBadgeProps>(
  ({
    className,
    type,
    size = 'md',
    showDirection = true,
    compact = false,
    ...props
  }, ref) => {
    const config = MOVEMENT_TYPE_CONFIG[type];

    if (!config) {
      return null;
    }

    const label = compact ? config.shortLabel : config.label;

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
        {showDirection && (
          <span className={cn(
            'flex-shrink-0',
            config.isInbound ? 'text-tis-green-600' : 'text-red-500'
          )}>
            {config.isInbound ? (
              <svg className={iconSizeStyles[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            ) : (
              <svg className={iconSizeStyles[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
          </span>
        )}
        {label}
      </span>
    );
  }
);

MovementTypeBadge.displayName = 'MovementTypeBadge';

// ======================
// MOVEMENT DIRECTION INDICATOR
// Shows inbound/outbound with quantity
// ======================
export interface MovementDirectionProps extends HTMLAttributes<HTMLDivElement> {
  quantity: number;
  unit: string;
  isInbound: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const quantitySizeStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const directionIconSizeStyles = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const MovementDirection = forwardRef<HTMLDivElement, MovementDirectionProps>(
  ({ className, quantity, unit, isInbound, size = 'md', ...props }, ref) => {
    const formattedQuantity = Math.abs(quantity).toLocaleString('es-MX', {
      maximumFractionDigits: 2
    });

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 font-semibold',
          isInbound ? 'text-tis-green-600' : 'text-red-600',
          quantitySizeStyles[size],
          className
        )}
        {...props}
      >
        <span className="flex-shrink-0">
          {isInbound ? (
            <svg className={directionIconSizeStyles[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m0 0l-6-6m6 6l6-6" />
            </svg>
          ) : (
            <svg className={directionIconSizeStyles[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 20V4m0 0l6 6m-6-6l-6 6" />
            </svg>
          )}
        </span>
        <span>
          {isInbound ? '+' : '-'}{formattedQuantity} {unit}
        </span>
      </div>
    );
  }
);

MovementDirection.displayName = 'MovementDirection';
