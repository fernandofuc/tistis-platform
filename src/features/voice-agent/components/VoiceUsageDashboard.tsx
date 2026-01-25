'use client';

// =====================================================
// TIS TIS PLATFORM - Voice Usage Dashboard
// Dashboard en tiempo real para monitoreo de minutos de voz
// Sistema: Voice Minute Limits (FASE 9 - Real-time Dashboard)
// =====================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Activity,
  Phone,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { VoiceUsageCard } from './VoiceUsageCard';
import { UsageHistoryTable } from './UsageHistoryTable';
import { useVoiceUsageRealtime, useVoiceUsage } from '../hooks';
import type { OveragePolicy } from '../types';

// =====================================================
// TYPES
// =====================================================

interface VoiceUsageDashboardProps {
  /** Enable real-time updates (default: true) */
  enableRealtime?: boolean;
  /** Show activity feed (default: true) */
  showActivityFeed?: boolean;
  /** Show usage history (default: false, expandable) */
  showHistoryByDefault?: boolean;
  /** Callback for threshold alerts */
  onThresholdAlert?: (threshold: number, message: string) => void;
  /** Additional className */
  className?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const TIS_CORAL = 'rgb(223, 115, 115)';

// =====================================================
// ACTIVITY FEED COMPONENT
// =====================================================

interface ActivityEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  timestamp: Date;
}

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-sm">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Sin actividad reciente</p>
      </div>
    );
  }

  const getEventIcon = (table: string, type: string) => {
    if (table === 'voice_call_records') {
      return <Phone className="w-4 h-4 text-emerald-500" />;
    }
    if (table === 'voice_minute_usage_periods') {
      return <Clock className="w-4 h-4 text-blue-500" />;
    }
    if (type === 'UPDATE') {
      return <RefreshCw className="w-4 h-4 text-amber-500" />;
    }
    return <Zap className="w-4 h-4 text-slate-400" />;
  };

  const getEventMessage = (table: string, type: string) => {
    if (table === 'voice_call_records' && type === 'INSERT') {
      return 'Nueva llamada registrada';
    }
    if (table === 'voice_minute_usage_periods') {
      if (type === 'UPDATE') return 'Uso actualizado';
      if (type === 'INSERT') return 'Nuevo período iniciado';
    }
    if (table === 'voice_minute_limits') {
      return 'Configuración actualizada';
    }
    return `${type} en ${table}`;
  };

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {events.slice(-5).reverse().map((event, index) => (
          <motion.div
            key={`${event.timestamp.getTime()}-${index}`}
            initial={{ opacity: 0, x: -20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 20, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg"
          >
            {getEventIcon(event.table, event.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 truncate">
                {getEventMessage(event.table, event.type)}
              </p>
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0">
              {event.timestamp.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// =====================================================
// CONNECTION STATUS INDICATOR
// =====================================================

function ConnectionStatus({
  isConnected,
  lastUpdate,
  onRefresh,
  isRefreshing,
}: {
  isConnected: boolean;
  lastUpdate: Date | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Connection indicator */}
      <div
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          ${isConnected
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-amber-50 text-amber-700'
          }
        `}
      >
        {isConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>En vivo</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>Desconectado</span>
          </>
        )}
      </div>

      {/* Last update */}
      {lastUpdate && (
        <span className="text-xs text-slate-400 hidden sm:inline">
          Actualizado: {lastUpdate.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      )}

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className={`
          p-1.5 rounded-lg transition-colors
          ${isRefreshing
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
          }
        `}
        aria-label="Actualizar datos"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function VoiceUsageDashboard({
  enableRealtime = true,
  showActivityFeed = true,
  showHistoryByDefault = false,
  onThresholdAlert,
  className = '',
}: VoiceUsageDashboardProps) {
  const [showHistory, setShowHistory] = useState(showHistoryByDefault);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-time hook
  const {
    usage,
    limits,
    isLoading,
    error,
    isConnected,
    lastUpdate,
    realtimeEvents,
    refetch,
    updatePolicy,
    isUpdatingPolicy,
  } = useVoiceUsageRealtime({
    enableRealtime,
    onThresholdExceeded: (threshold, usageData) => {
      const messages: Record<number, string> = {
        70: 'Has usado el 70% de tus minutos de voz',
        85: 'Has usado el 85% de tus minutos de voz',
        95: 'Has usado el 95% de tus minutos de voz',
        100: 'Has alcanzado el límite de minutos de voz',
      };
      onThresholdAlert?.(threshold, messages[threshold] || `Umbral ${threshold}% alcanzado`);
    },
  });

  // History hook (separate from real-time)
  const {
    history,
    isLoadingHistory,
    historyError,
    pagination,
    fetchHistory,
  } = useVoiceUsage({ autoFetch: false });

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      if (showHistory) {
        await fetchHistory();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, fetchHistory, showHistory]);

  // Handle policy update
  const handlePolicyUpdate = useCallback(async (policy: OveragePolicy) => {
    await updatePolicy(policy);
  }, [updatePolicy]);

  // Handle history toggle
  const handleToggleHistory = useCallback(() => {
    const newShowHistory = !showHistory;
    setShowHistory(newShowHistory);
    if (newShowHistory && history.length === 0) {
      fetchHistory();
    }
  }, [showHistory, history.length, fetchHistory]);

  // Error state
  if (error && !usage) {
    return (
      <div className={`bg-white rounded-2xl border border-red-200 p-6 ${className}`}>
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-semibold">Error al cargar datos</h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${TIS_CORAL} 0%, rgb(194, 51, 80) 100%)` }}
          >
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Monitor de Uso de Voz
            </h2>
            <p className="text-sm text-slate-500">
              {enableRealtime ? 'Actualizaciones en tiempo real' : 'Actualización manual'}
            </p>
          </div>
        </div>

        <ConnectionStatus
          isConnected={isConnected}
          lastUpdate={lastUpdate}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Main usage card */}
      <VoiceUsageCard
        usage={usage}
        isLoading={isLoading}
        onPolicyUpdate={handlePolicyUpdate}
        onViewHistory={handleToggleHistory}
      />

      {/* Activity feed */}
      {showActivityFeed && enableRealtime && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Actividad en Tiempo Real
            </h3>
            {isConnected && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Monitoreando
              </span>
            )}
          </div>
          <ActivityFeed events={realtimeEvents} />
        </motion.div>
      )}

      {/* Expandable history section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <button
          onClick={handleToggleHistory}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Historial de Llamadas
          </h3>
          {showHistory ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-100"
            >
              <div className="p-4">
                {historyError ? (
                  <div className="text-center py-4 text-red-600 text-sm">
                    <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
                    {historyError}
                  </div>
                ) : (
                  <UsageHistoryTable
                    transactions={history}
                    isLoading={isLoadingHistory}
                    pagination={pagination}
                    onPageChange={(offset) => fetchHistory(offset)}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Success indicators */}
      {usage && usage.usage_percent < 70 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700">
            Tu uso de minutos está dentro del rango normal. ¡Sigue así!
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default VoiceUsageDashboard;
