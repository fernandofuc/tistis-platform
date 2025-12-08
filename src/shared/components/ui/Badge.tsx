// =====================================================
// TIS TIS PLATFORM - Badge Component
// =====================================================

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils';

// ======================
// TYPES
// ======================
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'hot' | 'warm' | 'cold';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

// ======================
// STYLES
// ======================
const variantStyles = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-orange-100 text-orange-700',
  cold: 'bg-blue-100 text-blue-700',
};

const dotStyles = {
  default: 'bg-gray-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  hot: 'bg-red-500',
  warm: 'bg-orange-500',
  cold: 'bg-blue-500',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1 text-sm',
};

// ======================
// COMPONENT
// ======================
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full mr-1.5',
              dotStyles[variant]
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// ======================
// STATUS BADGE (Pre-configured)
// ======================
export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    // Lead statuses
    new: { variant: 'info', label: 'Nuevo' },
    contacted: { variant: 'info', label: 'Contactado' },
    qualified: { variant: 'success', label: 'Calificado' },
    appointment_scheduled: { variant: 'info', label: 'Cita Agendada' },
    converted: { variant: 'success', label: 'Convertido' },
    lost: { variant: 'danger', label: 'Perdido' },
    inactive: { variant: 'default', label: 'Inactivo' },
    // Appointment statuses
    scheduled: { variant: 'info', label: 'Programada' },
    confirmed: { variant: 'success', label: 'Confirmada' },
    in_progress: { variant: 'warning', label: 'En Progreso' },
    completed: { variant: 'success', label: 'Completada' },
    cancelled: { variant: 'danger', label: 'Cancelada' },
    no_show: { variant: 'warning', label: 'No Asistió' },
    rescheduled: { variant: 'info', label: 'Reagendada' },
    // Conversation statuses
    active: { variant: 'success', label: 'Activa' },
    waiting_response: { variant: 'warning', label: 'Esperando' },
    escalated: { variant: 'danger', label: 'Escalada' },
    resolved: { variant: 'default', label: 'Resuelta' },
    archived: { variant: 'default', label: 'Archivada' },
  };

  const config = statusConfig[status] || { variant: 'default', label: status };

  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}

// ======================
// CLASSIFICATION BADGE (Lead Scoring)
// ======================
export interface ClassificationBadgeProps {
  classification: 'hot' | 'warm' | 'cold';
  showEmoji?: boolean;
  className?: string;
}

export function ClassificationBadge({
  classification,
  showEmoji = true,
  className,
}: ClassificationBadgeProps) {
  const config = {
    hot: { label: 'Caliente', emoji: '🔥' },
    warm: { label: 'Tibio', emoji: '🌡️' },
    cold: { label: 'Frío', emoji: '❄️' },
  };

  const { label, emoji } = config[classification];

  return (
    <Badge variant={classification} className={className}>
      {showEmoji && <span className="mr-1">{emoji}</span>}
      {label}
    </Badge>
  );
}
