// =====================================================
// TIS TIS PLATFORM - Badge Component (Premium Design)
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
// STYLES (Premium)
// ======================
const variantStyles = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-tis-green-100 text-tis-green-600',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-tis-coral-100 text-tis-coral-700',
  info: 'bg-tis-purple/10 text-tis-purple',
  hot: 'bg-gradient-hot text-white',
  warm: 'bg-gradient-warm text-white',
  cold: 'bg-gradient-cold text-white',
};

const dotStyles = {
  default: 'bg-slate-500',
  success: 'bg-tis-green',
  warning: 'bg-amber-500',
  danger: 'bg-tis-coral',
  info: 'bg-tis-purple',
  hot: 'bg-tis-coral',
  warm: 'bg-amber-500',
  cold: 'bg-slate-400',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
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
          'inline-flex items-center font-semibold rounded-full transition-colors',
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
// LEAD SCORE BADGE (Premium Visual - Sin Emojis)
// Reemplaza los emojis con gradientes elegantes
// ======================
export interface LeadScoreBadgeProps {
  score: number;
  classification?: 'hot' | 'warm' | 'cold';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function LeadScoreBadge({
  score,
  classification,
  size = 'md',
  showLabel = false,
  className,
}: LeadScoreBadgeProps) {
  // Auto-classify based on score if not provided
  const autoClassification = classification || (
    score >= 80 ? 'hot' :
    score >= 50 ? 'warm' : 'cold'
  );

  const gradientClass = {
    hot: 'score-badge-hot',
    warm: 'score-badge-warm',
    cold: 'score-badge-cold',
  }[autoClassification];

  const sizeClass = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
  }[size];

  const labels = {
    hot: 'Caliente',
    warm: 'Tibio',
    cold: 'Frío',
  };

  if (showLabel) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn('score-badge', gradientClass, sizeClass)}>
          <span className="text-white font-bold">{score}</span>
        </div>
        <span className="text-sm font-medium text-slate-600">
          {labels[autoClassification]}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('score-badge', gradientClass, sizeClass, className)}>
      <span className="text-white font-bold">{score}</span>
    </div>
  );
}

// ======================
// CLASSIFICATION BADGE (Legacy - mantenido por compatibilidad)
// Ahora usa LeadScoreBadge internamente sin emojis
// ======================
export interface ClassificationBadgeProps {
  classification: 'hot' | 'warm' | 'cold';
  score?: number;
  showEmoji?: boolean; // Deprecated - ignorado
  className?: string;
}

export function ClassificationBadge({
  classification,
  score,
  className,
}: ClassificationBadgeProps) {
  // Si hay score, usar LeadScoreBadge
  if (score !== undefined) {
    return (
      <LeadScoreBadge
        score={score}
        classification={classification}
        size="sm"
        className={className}
      />
    );
  }

  // Sin score, mostrar badge con gradiente
  const labels = {
    hot: 'Caliente',
    warm: 'Tibio',
    cold: 'Frío',
  };

  return (
    <Badge variant={classification} size="sm" className={className}>
      {labels[classification]}
    </Badge>
  );
}
