'use client';

// =====================================================
// TIS TIS PLATFORM - Usage Progress Bar
// Barra de progreso animada para uso de minutos
// Sistema: Voice Minute Limits (FASE 4.2)
// =====================================================

import { motion } from 'framer-motion';

// =====================================================
// TYPES
// =====================================================

type AlertLevel = 'normal' | 'caution' | 'warning' | 'critical';

interface UsageProgressBarProps {
  /** Porcentaje de uso (0-100+) */
  percent: number;
  /** Nivel de alerta */
  alertLevel: AlertLevel;
  /** Altura de la barra */
  height?: 'sm' | 'md' | 'lg';
  /** Mostrar marcadores de umbrales */
  showMarkers?: boolean;
  /** Clases adicionales */
  className?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const TIS_CORAL = 'rgb(223, 115, 115)';
const TIS_PINK = 'rgb(194, 51, 80)';

const GRADIENTS: Record<AlertLevel, string> = {
  normal: `linear-gradient(90deg, ${TIS_CORAL} 0%, ${TIS_PINK} 100%)`,
  caution: 'linear-gradient(90deg, #eab308 0%, #f59e0b 100%)',
  warning: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)',
  critical: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
};

const GLOW_COLORS: Record<AlertLevel, string> = {
  normal: 'rgba(223, 115, 115, 0.3)',
  caution: 'rgba(234, 179, 8, 0.3)',
  warning: 'rgba(245, 158, 11, 0.3)',
  critical: 'rgba(239, 68, 68, 0.4)',
};

const HEIGHTS = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

// =====================================================
// COMPONENT
// =====================================================

export function UsageProgressBar({
  percent,
  alertLevel,
  height = 'md',
  showMarkers = true,
  className = '',
}: UsageProgressBarProps) {
  // Ensure percent is within valid range for display
  const safePercent = Math.max(0, percent);
  const displayPercent = Math.min(100, safePercent);
  const isOverLimit = safePercent > 100;
  const shouldPulse = safePercent >= 85;

  return (
    <div
      className={`relative ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(safePercent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Uso de minutos: ${Math.round(safePercent)}%${isOverLimit ? ' - Excedido' : ''}`}
    >
      {/* Background track */}
      <div
        className={`
          w-full ${HEIGHTS[height]} bg-slate-200 rounded-full overflow-hidden
          relative
        `}
      >
        {/* Progress fill */}
        <motion.div
          className={`h-full rounded-full relative ${shouldPulse ? 'animate-pulse' : ''}`}
          initial={{ width: 0 }}
          animate={{ width: `${displayPercent}%` }}
          transition={{
            duration: 0.8,
            ease: [0.4, 0, 0.2, 1],
          }}
          style={{
            background: GRADIENTS[alertLevel],
            boxShadow: shouldPulse ? `0 0 12px ${GLOW_COLORS[alertLevel]}` : 'none',
          }}
        >
          {/* Shine effect */}
          <div
            className="absolute inset-0 opacity-30 overflow-hidden rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
            }}
          />

          {/* Animated shine sweep (only for normal state) */}
          {alertLevel === 'normal' && (
            <motion.div
              className="absolute inset-0 opacity-20"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{
                duration: 2,
                ease: 'easeInOut',
                repeat: Infinity,
                repeatDelay: 3,
              }}
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                width: '50%',
              }}
            />
          )}
        </motion.div>
      </div>

      {/* Overage indicator (pulsing dot) */}
      {isOverLimit && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        </motion.div>
      )}

      {/* Threshold markers */}
      {showMarkers && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* 70% marker */}
          <div
            className={`
              absolute top-0 h-full w-px transition-colors duration-300
              ${safePercent >= 70 ? 'bg-slate-300' : 'bg-slate-200'}
            `}
            style={{ left: '70%' }}
          >
            <div
              className={`
                absolute -bottom-4 left-1/2 -translate-x-1/2
                text-[9px] font-medium transition-colors duration-300
                ${safePercent >= 70 ? 'text-slate-400' : 'text-slate-300'}
              `}
            >
              70
            </div>
          </div>

          {/* 85% marker */}
          <div
            className={`
              absolute top-0 h-full w-px transition-colors duration-300
              ${safePercent >= 85 ? 'bg-amber-400' : 'bg-slate-200'}
            `}
            style={{ left: '85%' }}
          >
            <div
              className={`
                absolute -bottom-4 left-1/2 -translate-x-1/2
                text-[9px] font-medium transition-colors duration-300
                ${safePercent >= 85 ? 'text-amber-500' : 'text-slate-300'}
              `}
            >
              85
            </div>
          </div>

          {/* 100% marker */}
          <div
            className={`
              absolute top-0 h-full w-px transition-colors duration-300
              ${safePercent >= 100 ? 'bg-red-400' : 'bg-slate-200'}
            `}
            style={{ left: 'calc(100% - 1px)' }}
          >
            <div
              className={`
                absolute -bottom-4 left-1/2 -translate-x-1/2
                text-[9px] font-medium transition-colors duration-300
                ${safePercent >= 100 ? 'text-red-500' : 'text-slate-300'}
              `}
            >
              100
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsageProgressBar;
