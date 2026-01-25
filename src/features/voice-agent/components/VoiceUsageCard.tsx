'use client';

// =====================================================
// TIS TIS PLATFORM - Voice Usage Card
// Muestra el uso de minutos del agente de voz
// Sistema: Voice Minute Limits (FASE 4.1)
// =====================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Settings2,
  TrendingUp,
  Phone,
  Zap,
  Calendar,
} from 'lucide-react';
import { UsageProgressBar } from './UsageProgressBar';
import { OveragePolicyModal } from './OveragePolicyModal';
import type { MinuteUsageSummary, OveragePolicy } from '../types';

// =====================================================
// TYPES
// =====================================================

interface VoiceUsageCardProps {
  /** Datos de uso actual */
  usage: MinuteUsageSummary | null;
  /** Loading state */
  isLoading?: boolean;
  /** Callback cuando se actualiza la política */
  onPolicyUpdate?: (policy: OveragePolicy) => Promise<void>;
  /** Callback para ver historial */
  onViewHistory?: () => void;
  /** Clases adicionales */
  className?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const TIS_CORAL = 'rgb(223, 115, 115)';
const TIS_PINK = 'rgb(194, 51, 80)';

// =====================================================
// HELPERS
// =====================================================

function formatMinutes(minutes: number): string {
  // Handle negative values (can happen with overage)
  if (minutes <= 0) {
    return '0 min';
  }
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getAlertConfig(percentUsed: number) {
  if (percentUsed >= 100) {
    return {
      level: 'critical' as const,
      bgClass: 'bg-red-50 border-red-200',
      textClass: 'text-red-700',
      icon: AlertCircle,
      message: 'Límite alcanzado',
    };
  }
  if (percentUsed >= 85) {
    return {
      level: 'warning' as const,
      bgClass: 'bg-amber-50 border-amber-200',
      textClass: 'text-amber-700',
      icon: AlertTriangle,
      message: 'Próximo al límite',
    };
  }
  if (percentUsed >= 70) {
    return {
      level: 'caution' as const,
      bgClass: 'bg-yellow-50 border-yellow-200',
      textClass: 'text-yellow-700',
      icon: TrendingUp,
      message: 'Uso moderado',
    };
  }
  return {
    level: 'normal' as const,
    bgClass: 'bg-emerald-50 border-emerald-200',
    textClass: 'text-emerald-700',
    icon: Phone,
    message: 'Uso normal',
  };
}

function getPolicyLabel(policy: OveragePolicy): string {
  switch (policy) {
    case 'block':
      return 'Bloquear';
    case 'charge':
      return 'Cobrar extra';
    case 'notify_only':
      return 'Solo notificar';
    default:
      return 'No configurado';
  }
}

function getPolicyColor(policy: OveragePolicy): string {
  switch (policy) {
    case 'block':
      return 'bg-red-100 text-red-700';
    case 'charge':
      return 'bg-emerald-100 text-emerald-700';
    case 'notify_only':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

// =====================================================
// SKELETON COMPONENT
// =====================================================

function UsageCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-slate-200 rounded-xl" />
            <div>
              <div className="h-5 w-28 sm:w-32 bg-slate-200 rounded mb-2" />
              <div className="h-3.5 w-20 sm:w-24 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="w-20 sm:w-24 h-7 sm:h-8 bg-slate-100 rounded-lg" />
        </div>

        {/* Stats */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2 mb-3">
            <div className="h-9 sm:h-10 w-24 sm:w-28 bg-slate-200 rounded" />
            <div className="h-5 sm:h-6 w-16 sm:w-20 bg-slate-100 rounded" />
          </div>
          <div className="h-2.5 sm:h-3 bg-slate-200 rounded-full mb-3" />
          <div className="flex justify-between">
            <div className="h-3.5 sm:h-4 w-20 sm:w-24 bg-slate-100 rounded" />
            <div className="h-3.5 sm:h-4 w-16 sm:w-20 bg-slate-100 rounded" />
          </div>
        </div>

        {/* Quick stats grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-2.5 sm:p-3 bg-slate-50 rounded-xl">
              <div className="h-6 sm:h-7 w-10 sm:w-12 bg-slate-200 rounded mx-auto mb-1.5" />
              <div className="h-3 w-12 sm:w-14 bg-slate-100 rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Button */}
        <div className="h-11 sm:h-12 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function VoiceUsageCard({
  usage,
  isLoading = false,
  onPolicyUpdate,
  onViewHistory,
  className = '',
}: VoiceUsageCardProps) {
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  // Loading state
  if (isLoading || !usage) {
    return <UsageCardSkeleton />;
  }

  const alertConfig = getAlertConfig(usage.usage_percent);
  const AlertIcon = alertConfig.icon;
  const hasOverage = usage.overage_minutes_used > 0;
  const isBlocked = usage.overage_policy === 'block' && usage.is_blocked;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`
          relative bg-white rounded-2xl border overflow-hidden transition-all
          ${usage.usage_percent >= 85 ? alertConfig.bgClass : 'border-slate-200'}
          ${className}
        `}
      >
        {/* Alert banner for critical states */}
        <AnimatePresence>
          {usage.usage_percent >= 85 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`px-4 py-2 flex items-center gap-2 ${alertConfig.textClass} border-b ${alertConfig.bgClass}`}
            >
              <AlertIcon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{alertConfig.message}</span>
              {isBlocked && (
                <span className="ml-auto text-xs bg-red-100 px-2 py-0.5 rounded-full font-medium">
                  Llamadas bloqueadas
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 sm:mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${TIS_CORAL} 0%, ${TIS_PINK} 100%)`,
                }}
              >
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  Minutos de Voz
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="truncate">
                    {usage.days_remaining <= 0
                      ? 'Reinicio hoy'
                      : usage.days_remaining === 1
                        ? '1 día restante'
                        : `${usage.days_remaining} días restantes`
                    }
                  </span>
                </p>
              </div>
            </div>

            {/* Policy badge */}
            <button
              onClick={() => setIsPolicyModalOpen(true)}
              className={`
                flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5
                rounded-lg text-xs sm:text-sm font-medium transition-all
                hover:ring-2 hover:ring-slate-200
                ${getPolicyColor(usage.overage_policy)}
              `}
              aria-label={`Política de excedentes: ${getPolicyLabel(usage.overage_policy)}. Click para configurar.`}
            >
              <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{getPolicyLabel(usage.overage_policy)}</span>
            </button>
          </div>

          {/* Main stats */}
          <div className="mb-4 sm:mb-5">
            <div className="flex items-baseline gap-2 mb-2 sm:mb-3">
              <span className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">
                {formatMinutes(usage.total_minutes_used)}
              </span>
              <span className="text-base sm:text-lg text-slate-400">
                / {formatMinutes(usage.included_minutes)}
              </span>
            </div>

            {/* Progress bar */}
            <UsageProgressBar
              percent={usage.usage_percent}
              alertLevel={alertConfig.level}
            />

            <div className="flex justify-between mt-2 text-xs sm:text-sm">
              <span className="text-slate-500">
                {formatMinutes(usage.remaining_included)} restantes
              </span>
              <span className={`font-semibold ${alertConfig.textClass}`}>
                {usage.usage_percent.toFixed(0)}% usado
              </span>
            </div>
          </div>

          {/* Overage info */}
          <AnimatePresence>
            {hasOverage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-amber-800">
                      Excedente: {formatMinutes(usage.overage_minutes_used)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-amber-900">
                    ${usage.overage_charges_pesos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            <div className="text-center p-2.5 sm:p-3 bg-slate-50 rounded-xl">
              <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {usage.total_calls}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Llamadas</p>
            </div>
            <div className="text-center p-2.5 sm:p-3 bg-slate-50 rounded-xl">
              <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {usage.avg_call_duration > 0 ? usage.avg_call_duration.toFixed(1) : '0'}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Min/llamada</p>
            </div>
            <div className="text-center p-2.5 sm:p-3 bg-slate-50 rounded-xl">
              <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {usage.days_remaining}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Días</p>
            </div>
          </div>

          {/* View history button */}
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="
                w-full flex items-center justify-center gap-2
                px-4 py-2.5 sm:py-3
                bg-slate-100 hover:bg-slate-200
                text-slate-700 font-medium text-sm sm:text-base
                rounded-xl transition-colors
                min-h-[44px] sm:min-h-0
              "
            >
              <span>Ver historial de uso</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Policy configuration modal */}
      <OveragePolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        currentPolicy={usage.overage_policy}
        overagePricePesos={usage.overage_price_pesos}
        includedMinutes={usage.included_minutes}
        onSave={async (policy) => {
          if (onPolicyUpdate) {
            await onPolicyUpdate(policy);
          }
          // Close only on success - if onPolicyUpdate throws, modal catches it
          setIsPolicyModalOpen(false);
        }}
      />
    </>
  );
}

export default VoiceUsageCard;
