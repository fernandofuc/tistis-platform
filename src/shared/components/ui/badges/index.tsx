// =====================================================
// TIS TIS PLATFORM - Unified Badge Exports
// Sprint 4: Central export for all badge components
// =====================================================

import React, { forwardRef } from 'react';
import { cn } from '@/shared/utils';
import { Badge, type BadgeProps } from '../Badge';

// ======================
// BASE BADGE (Core component)
// ======================
export {
  Badge,
  type BadgeProps,
  // Pre-configured status badges
  StatusBadge,
  type StatusBadgeProps,
  DynamicStatusBadge,
  type DynamicStatusBadgeProps,
  // Lead score badges
  LeadScoreBadge,
  type LeadScoreBadgeProps,
  // Classification badges
  ClassificationBadge,
  type ClassificationBadgeProps,
} from '../Badge';

// ======================
// CHANNEL BADGE (For messaging channels)
// ======================
export {
  ChannelBadge,
  ChannelIcon,
  type ChannelType,
} from '../../ChannelBadge';

// ======================
// PRIORITY BADGE (New - common use case)
// ======================

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export interface PriorityBadgeProps {
  priority: PriorityLevel;
  size?: BadgeProps['size'];
  showDot?: boolean;
  className?: string;
}

const priorityConfig: Record<PriorityLevel, { variant: BadgeProps['variant']; label: string }> = {
  low: { variant: 'default', label: 'Baja' },
  medium: { variant: 'info', label: 'Media' },
  high: { variant: 'warning', label: 'Alta' },
  urgent: { variant: 'danger', label: 'Urgente' },
};

export const PriorityBadge = forwardRef<HTMLSpanElement, PriorityBadgeProps>(
  ({ priority, size = 'sm', showDot = true, className }, ref) => {
    const config = priorityConfig[priority];
    return (
      <Badge ref={ref} variant={config.variant} size={size} dot={showDot} className={className}>
        {config.label}
      </Badge>
    );
  }
);
PriorityBadge.displayName = 'PriorityBadge';

// ======================
// NOTIFICATION BADGE (New - for counts)
// ======================

export interface NotificationBadgeProps {
  count: number;
  max?: number;
  variant?: 'danger' | 'warning' | 'info' | 'default';
  size?: 'sm' | 'md';
  className?: string;
}

const notificationSizeStyles = {
  sm: 'min-w-[18px] h-[18px] text-[10px] px-1',
  md: 'min-w-[22px] h-[22px] text-xs px-1.5',
};

const notificationVariantStyles = {
  danger: 'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-blue-500 text-white',
  default: 'bg-slate-500 text-white',
};

export const NotificationBadge = forwardRef<HTMLSpanElement, NotificationBadgeProps>(
  ({ count, max = 99, variant = 'danger', size = 'sm', className }, ref) => {
    if (count <= 0) return null;

    const displayCount = count > max ? `${max}+` : count.toString();

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-bold rounded-full',
          notificationSizeStyles[size],
          notificationVariantStyles[variant],
          className
        )}
      >
        {displayCount}
      </span>
    );
  }
);
NotificationBadge.displayName = 'NotificationBadge';

// ======================
// ONLINE STATUS BADGE (New - for presence)
// ======================

export type OnlineStatus = 'online' | 'away' | 'busy' | 'offline';

export interface OnlineStatusBadgeProps {
  status: OnlineStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const onlineStatusConfig: Record<OnlineStatus, { color: string; label: string }> = {
  online: { color: 'bg-green-500', label: 'En línea' },
  away: { color: 'bg-amber-500', label: 'Ausente' },
  busy: { color: 'bg-red-500', label: 'Ocupado' },
  offline: { color: 'bg-slate-400', label: 'Desconectado' },
};

const onlineStatusSizeStyles = {
  sm: { dot: 'w-2 h-2', text: 'text-xs' },
  md: { dot: 'w-2.5 h-2.5', text: 'text-sm' },
};

export const OnlineStatusBadge = forwardRef<HTMLSpanElement, OnlineStatusBadgeProps>(
  ({ status, showLabel = false, size = 'sm', className }, ref) => {
    const config = onlineStatusConfig[status];
    const sizeStyles = onlineStatusSizeStyles[size];

    if (!showLabel) {
      return (
        <span
          ref={ref}
          className={cn(
            'inline-block rounded-full ring-2 ring-white',
            sizeStyles.dot,
            config.color,
            className
          )}
          title={config.label}
        />
      );
    }

    return (
      <span
        ref={ref}
        className={cn('inline-flex items-center gap-1.5', className)}
      >
        <span className={cn('rounded-full', sizeStyles.dot, config.color)} />
        <span className={cn('text-slate-600', sizeStyles.text)}>{config.label}</span>
      </span>
    );
  }
);
OnlineStatusBadge.displayName = 'OnlineStatusBadge';

// ======================
// TAG BADGE (New - for labels/tags)
// ======================

export interface TagBadgeProps {
  label: string;
  color?: string;
  removable?: boolean;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

const tagSizeStyles = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
};

export const TagBadge = forwardRef<HTMLSpanElement, TagBadgeProps>(
  ({ label, color, removable = false, onRemove, size = 'sm', className }, ref) => {
    const backgroundColor = color || '#e2e8f0';
    const textColor = getContrastColor(backgroundColor);

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-medium transition-colors',
          tagSizeStyles[size],
          className
        )}
        style={{ backgroundColor, color: textColor }}
      >
        {label}
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-0.5 hover:opacity-70 transition-opacity focus:outline-none"
            aria-label={`Eliminar ${label}`}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </span>
    );
  }
);
TagBadge.displayName = 'TagBadge';

// Helper function for tag color contrast
function getContrastColor(color: string): string {
  // Default contrast color for invalid inputs
  const defaultDark = '#1e293b';
  const defaultLight = '#ffffff';

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');

    // Validate hex format (3 or 6 characters)
    if (!/^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
      return defaultDark;
    }

    // Expand 3-char hex to 6-char
    const fullHex = hex.length === 3
      ? hex.split('').map(c => c + c).join('')
      : hex;

    // Parse RGB
    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? defaultDark : defaultLight;
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? defaultDark : defaultLight;
  }

  // For named colors or unknown formats, default to dark text
  return defaultDark;
}

// ======================
// CATEGORY BADGE (New - for categories)
// ======================

export interface CategoryBadgeProps {
  category: string;
  icon?: React.ReactNode;
  variant?: BadgeProps['variant'];
  size?: BadgeProps['size'];
  className?: string;
}

export const CategoryBadge = forwardRef<HTMLSpanElement, CategoryBadgeProps>(
  ({ category, icon, variant = 'default', size = 'sm', className }, ref) => {
    return (
      <Badge ref={ref} variant={variant} size={size} className={cn('gap-1', className)}>
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {category}
      </Badge>
    );
  }
);
CategoryBadge.displayName = 'CategoryBadge';

// ======================
// RE-EXPORT FEATURE-SPECIFIC BADGES
// Note: These are kept in their feature folders but can be imported from here
// ======================

// Type re-exports for documentation
export type { StockStatus } from '@/src/features/inventory-management/types';
export type { Capability } from '@/lib/voice-agent/types';
