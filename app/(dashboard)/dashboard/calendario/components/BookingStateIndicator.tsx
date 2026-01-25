// =====================================================
// TIS TIS PLATFORM - Booking State Indicator Component
// Visual indicator for combined booking states
// Phase 7: UI/Dashboard - Booking States System
// =====================================================

'use client';

import { cn } from '@/src/shared/utils';
import {
  BOOKING_COMBINED_STATES,
  CONFIRMATION_STATUSES,
  DEPOSIT_STATUSES,
  TRUST_LEVELS,
} from '@/src/shared/constants';
import {
  getCombinedBookingState,
  getTrustLevelFromScore,
  type ConfirmationStatus,
  type DepositStatus,
  type BookingCombinedState,
  type TrustLevel,
} from '@/src/shared/types';

// ======================
// ICONS
// ======================
const icons = {
  clock: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  alert: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  dollar: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  x: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  user: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  shield: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  loader: (
    <svg className="w-full h-full animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
};

// Color map for combined states
const stateColorMap: Record<BookingCombinedState, { bg: string; border: string; text: string; icon: keyof typeof icons }> = {
  hold_active: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', icon: 'clock' },
  pending_confirmation: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', icon: 'alert' },
  pending_deposit: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-400', icon: 'dollar' },
  confirmed: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400', icon: 'check' },
  scheduled: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', icon: 'clock' },
  in_progress: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-400', icon: 'loader' },
  completed: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', icon: 'check' },
  no_show: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', icon: 'x' },
  cancelled: { bg: 'bg-gray-50 dark:bg-gray-800/50', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-500 dark:text-gray-400', icon: 'x' },
};

// Trust level color map
const trustColorMap: Record<TrustLevel, { bg: string; text: string }> = {
  trusted: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  standard: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  cautious: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  high_risk: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

// ======================
// PROPS
// ======================
interface BookingStateIndicatorProps {
  appointmentStatus: string;
  confirmationStatus?: ConfirmationStatus | null;
  depositStatus?: DepositStatus | null;
  trustScore?: number | null;
  hasActiveHold?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTrustBadge?: boolean;
  className?: string;
}

// Size configurations
const sizeConfig = {
  sm: { container: 'gap-1', icon: 'w-3 h-3', text: 'text-xs', badge: 'px-1.5 py-0.5' },
  md: { container: 'gap-2', icon: 'w-4 h-4', text: 'text-sm', badge: 'px-2 py-1' },
  lg: { container: 'gap-2', icon: 'w-5 h-5', text: 'text-base', badge: 'px-3 py-1.5' },
};

// ======================
// COMPONENT
// ======================
export function BookingStateIndicator({
  appointmentStatus,
  confirmationStatus,
  depositStatus,
  trustScore,
  hasActiveHold = false,
  size = 'md',
  showLabel = true,
  showTrustBadge = false,
  className,
}: BookingStateIndicatorProps) {
  // Calculate combined state
  const combinedState = getCombinedBookingState(
    appointmentStatus,
    confirmationStatus,
    depositStatus,
    hasActiveHold
  );

  // Get state config
  const stateConfig = BOOKING_COMBINED_STATES.find((s) => s.value === combinedState);
  const colorConfig = stateColorMap[combinedState];
  const sizeStyles = sizeConfig[size];

  // Get trust level if score provided
  const trustLevel = trustScore != null ? getTrustLevelFromScore(trustScore) : null;
  const trustConfig = trustLevel ? TRUST_LEVELS.find((t) => t.value === trustLevel) : null;
  const trustColors = trustLevel ? trustColorMap[trustLevel] : null;

  const stateLabel = stateConfig?.label || combinedState;

  return (
    <div
      className={cn('flex items-center', sizeStyles.container, className)}
      role="status"
      aria-label={`Estado: ${stateLabel}`}
    >
      {/* Main State Badge */}
      <div
        className={cn(
          'flex items-center rounded-full border',
          sizeStyles.badge,
          colorConfig.bg,
          colorConfig.border
        )}
      >
        <span className={cn(sizeStyles.icon, colorConfig.text)} aria-hidden="true">
          {icons[colorConfig.icon]}
        </span>
        {showLabel && (
          <span className={cn('ml-1.5 font-medium', sizeStyles.text, colorConfig.text)}>
            {stateLabel}
          </span>
        )}
      </div>

      {/* Trust Badge (optional) */}
      {showTrustBadge && trustConfig && trustColors && (
        <div
          className={cn(
            'flex items-center rounded-full',
            sizeStyles.badge,
            trustColors.bg
          )}
          title={`Score: ${trustScore}`}
          aria-label={`Nivel de confianza: ${trustConfig.label}, Score: ${trustScore}`}
        >
          <span className={cn(sizeStyles.icon, trustColors.text)} aria-hidden="true">
            {icons.shield}
          </span>
          {showLabel && size !== 'sm' && (
            <span className={cn('ml-1 font-medium', sizeStyles.text, trustColors.text)}>
              {trustScore}
            </span>
          )}
        </div>
      )}

      {/* Additional Indicators */}
      {confirmationStatus === 'pending' && combinedState !== 'pending_confirmation' && (
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30',
            size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'
          )}
          title="Confirmación pendiente"
          role="status"
          aria-label="Confirmación pendiente"
        >
          <span className={cn('text-orange-600 dark:text-orange-400', sizeStyles.icon)} aria-hidden="true">
            {icons.alert}
          </span>
        </span>
      )}

      {depositStatus === 'required' && combinedState !== 'pending_deposit' && (
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30',
            size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'
          )}
          title="Depósito requerido"
          role="status"
          aria-label="Depósito requerido"
        >
          <span className={cn('text-yellow-600 dark:text-yellow-400', sizeStyles.icon)} aria-hidden="true">
            {icons.dollar}
          </span>
        </span>
      )}
    </div>
  );
}

// ======================
// SIMPLE DOT INDICATOR
// ======================
interface BookingStateDotProps {
  appointmentStatus: string;
  confirmationStatus?: ConfirmationStatus | null;
  depositStatus?: DepositStatus | null;
  hasActiveHold?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const dotSizeMap = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

const dotColorMap: Record<BookingCombinedState, string> = {
  hold_active: 'bg-amber-500',
  pending_confirmation: 'bg-orange-500',
  pending_deposit: 'bg-yellow-500',
  confirmed: 'bg-green-500',
  scheduled: 'bg-blue-500',
  in_progress: 'bg-indigo-500',
  completed: 'bg-emerald-500',
  no_show: 'bg-red-500',
  cancelled: 'bg-gray-400',
};

export function BookingStateDot({
  appointmentStatus,
  confirmationStatus,
  depositStatus,
  hasActiveHold = false,
  size = 'md',
  animated = false,
  className,
}: BookingStateDotProps) {
  const combinedState = getCombinedBookingState(
    appointmentStatus,
    confirmationStatus,
    depositStatus,
    hasActiveHold
  );

  const shouldAnimate = animated && (combinedState === 'hold_active' || combinedState === 'in_progress');
  const stateLabel = BOOKING_COMBINED_STATES.find((s) => s.value === combinedState)?.label || combinedState;

  return (
    <span
      className={cn(
        'inline-block rounded-full',
        dotSizeMap[size],
        dotColorMap[combinedState],
        shouldAnimate && 'animate-pulse',
        className
      )}
      title={stateLabel}
      role="img"
      aria-label={stateLabel}
    />
  );
}
