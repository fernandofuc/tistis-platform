// =====================================================
// TIS TIS PLATFORM - Character Count Bar Component
// Visual progress bar for text input with color states
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { cn } from '@/src/shared/utils';
import { motion } from 'framer-motion';

// ======================
// TYPES
// ======================
interface CharacterCountBarProps {
  current: number;
  max: number;
  showWarningAt?: number; // Percentage (default 70)
  showDangerAt?: number;  // Percentage (default 90)
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

// ======================
// COMPONENT
// ======================
export function CharacterCountBar({
  current,
  max,
  showWarningAt = 70,
  showDangerAt = 90,
  showLabel = true,
  size = 'md',
  className,
}: CharacterCountBarProps) {
  const percentage = Math.min((current / max) * 100, 100);
  const remaining = max - current;

  // Determine color state
  const getColorState = () => {
    if (percentage >= showDangerAt) return 'danger';
    if (percentage >= showWarningAt) return 'warning';
    return 'normal';
  };

  const colorState = getColorState();

  // Color mappings
  const colors = {
    normal: {
      bar: 'bg-emerald-500',
      bg: 'bg-slate-200',
      text: 'text-slate-500',
      label: 'text-emerald-600',
    },
    warning: {
      bar: 'bg-amber-500',
      bg: 'bg-amber-100',
      text: 'text-amber-600',
      label: 'text-amber-600',
    },
    danger: {
      bar: 'bg-red-500',
      bg: 'bg-red-100',
      text: 'text-red-600',
      label: 'text-red-600',
    },
  };

  const currentColors = colors[colorState];

  // Size mappings
  const sizes = {
    sm: {
      bar: 'h-1',
      text: 'text-xs',
    },
    md: {
      bar: 'h-1.5',
      text: 'text-xs',
    },
  };

  const currentSize = sizes[size];

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Progress Bar with ARIA attributes for accessibility */}
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${current} de ${max} caracteres usados`}
        className={cn('w-full rounded-full overflow-hidden', currentColors.bg, currentSize.bar)}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn('h-full rounded-full transition-colors', currentColors.bar)}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <div className="flex items-center justify-between">
          <div className={cn('flex items-center gap-1', currentSize.text, currentColors.text)}>
            {colorState === 'danger' && remaining <= 0 && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {colorState === 'warning' && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span>
              {colorState === 'danger' && remaining <= 0
                ? 'Límite alcanzado'
                : colorState === 'warning'
                  ? `${remaining} caracteres restantes`
                  : ''
              }
            </span>
          </div>
          <span className={cn('font-medium tabular-nums', currentSize.text, currentColors.label)}>
            {current}/{max}
          </span>
        </div>
      )}
    </div>
  );
}

export default CharacterCountBar;
