// =====================================================
// TIS TIS PLATFORM - KB RAG Status Card
// V7.2: Muestra el estado de salud del sistema RAG
// =====================================================
//
// Este componente muestra:
// - Estado general del RAG (healthy, degraded, critical)
// - Embeddings procesados vs pendientes
// - Desglose por tipo de contenido
// - Botón para forzar procesamiento
//
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================

export interface RAGHealthStatus {
  status: 'healthy' | 'good' | 'degraded' | 'critical' | 'no_content';
  total_items: number;
  pending_embeddings: number;
  processed_embeddings: number;
  completion_percentage: number;
  details: Array<{
    type: string;
    total: number;
    pending: number;
    processed: number;
  }>;
  last_check: string;
}

export interface KBRAGStatusCardProps {
  className?: string;
  tenantId?: string;
  onRefresh?: () => void;
}

// ======================
// STATUS CONFIG
// ======================

const STATUS_CONFIG = {
  healthy: {
    label: 'Excelente',
    description: 'Todos los embeddings están procesados',
    color: 'emerald',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  good: {
    label: 'Bueno',
    description: 'Pocos embeddings pendientes',
    color: 'blue',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  degraded: {
    label: 'Degradado',
    description: 'Varios embeddings pendientes',
    color: 'amber',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  critical: {
    label: 'Crítico',
    description: 'Mayoría de embeddings sin procesar',
    color: 'red',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  no_content: {
    label: 'Sin contenido',
    description: 'Agrega contenido a tu base de conocimiento',
    color: 'gray',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
  },
};

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  knowledge_article: { label: 'Artículos', icon: '📖' },
  faq: { label: 'FAQs', icon: '❓' },
  policy: { label: 'Políticas', icon: '📋' },
  service: { label: 'Servicios', icon: '⚙️' },
};

// ======================
// PROGRESS BAR COMPONENT
// ======================

function ProgressBar({
  percentage,
  color,
  size = 'md',
}: {
  percentage: number;
  color: string;
  size?: 'sm' | 'md';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  };

  return (
    <div className={cn(
      'w-full bg-gray-200 rounded-full overflow-hidden',
      size === 'sm' ? 'h-1.5' : 'h-2.5'
    )}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={cn(
          'h-full rounded-full',
          colorClasses[color as keyof typeof colorClasses] || 'bg-gray-400'
        )}
      />
    </div>
  );
}

// ======================
// DETAIL ITEM COMPONENT
// ======================

function DetailItem({
  type,
  total,
  pending,
  processed,
}: {
  type: string;
  total: number;
  pending: number;
  processed: number;
}) {
  const typeConfig = TYPE_LABELS[type] || { label: type, icon: '📄' };
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 100;

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-lg">{typeConfig.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">
            {typeConfig.label}
          </span>
          <span className="text-xs text-gray-500">
            {processed}/{total}
          </span>
        </div>
        <ProgressBar
          percentage={percentage}
          color={pending === 0 ? 'emerald' : pending < total * 0.3 ? 'blue' : 'amber'}
          size="sm"
        />
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function KBRAGStatusCard({
  className,
  tenantId,
  onRefresh,
}: KBRAGStatusCardProps) {
  const [status, setStatus] = useState<RAGHealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch RAG status
  const fetchStatus = useCallback(async () => {
    if (!tenantId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/knowledge-base/rag-status?tenant_id=${tenantId}`);

      if (!response.ok) {
        throw new Error('Error al obtener estado del RAG');
      }

      const data = await response.json();
      setStatus(data.data);
    } catch (err) {
      console.error('[RAGStatusCard] Error fetching status:', err);
      setError('No se pudo cargar el estado del RAG');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Process pending embeddings
  const handleProcessEmbeddings = async () => {
    if (!tenantId || isProcessing) return;

    try {
      setIsProcessing(true);

      const response = await fetch('/api/cron/process-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, batch_size: 20 }),
      });

      if (response.ok) {
        // Refresh status after processing
        await fetchStatus();
        onRefresh?.();
      }
    } catch (err) {
      console.error('[RAGStatusCard] Error processing embeddings:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(
        'rounded-2xl border bg-white p-5',
        'animate-pulse',
        className
      )}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-200" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-32 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full" />
      </div>
    );
  }

  // Error state
  if (error || !status) {
    return (
      <div className={cn(
        'rounded-2xl border bg-white p-5',
        'border-gray-200',
        className
      )}>
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">{error || 'Sin datos disponibles'}</p>
          <button
            onClick={fetchStatus}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[status.status];
  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-600',
      iconBg: 'bg-emerald-100',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-600',
      iconBg: 'bg-blue-100',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-600',
      iconBg: 'bg-amber-100',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600',
      iconBg: 'bg-red-100',
    },
    gray: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-600',
      iconBg: 'bg-gray-100',
    },
  };
  const colors = colorClasses[statusConfig.color as keyof typeof colorClasses];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        'bg-white',
        'border-gray-200',
        className
      )}
    >
      {/* Header */}
      <div className={cn('p-5', colors.bg, colors.border, 'border-b')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              colors.iconBg,
              colors.text
            )}>
              {statusConfig.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">
                  Estado RAG
                </h3>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  colors.bg,
                  colors.text,
                  'border',
                  colors.border
                )}>
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {statusConfig.description}
              </p>
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchStatus}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors text-gray-500"
            title="Actualizar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="p-5">
        {/* Main progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Embeddings procesados
            </span>
            <span className={cn(
              'text-lg font-bold tabular-nums',
              colors.text
            )}>
              {status.completion_percentage}%
            </span>
          </div>
          <ProgressBar
            percentage={status.completion_percentage}
            color={statusConfig.color}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>{status.processed_embeddings} procesados</span>
            <span>{status.pending_embeddings} pendientes</span>
          </div>
        </div>

        {/* Toggle details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors w-full justify-between py-2 border-t border-gray-100"
        >
          <span>Ver detalles por tipo</span>
          <motion.svg
            animate={{ rotate: showDetails ? 180 : 0 }}
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </button>

        {/* Details */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 space-y-1">
                {status.details.map((detail) => (
                  <DetailItem
                    key={detail.type}
                    type={detail.type}
                    total={detail.total}
                    pending={detail.pending}
                    processed={detail.processed}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Process button (only show if pending > 0) */}
        {status.pending_embeddings > 0 && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleProcessEmbeddings}
            disabled={isProcessing}
            className={cn(
              'w-full mt-4 py-3 px-4 rounded-xl font-semibold text-sm transition-all',
              'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
              'shadow-lg shadow-blue-500/20',
              'hover:shadow-xl hover:shadow-blue-500/30',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Procesando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Procesar {status.pending_embeddings} pendiente{status.pending_embeddings !== 1 ? 's' : ''}
              </span>
            )}
          </motion.button>
        )}
      </div>

      {/* Footer info */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {new Date(status.last_check).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            {status.total_items} items totales
          </span>
          <span className="text-blue-600 font-medium">V7.2</span>
        </div>
      </div>
    </motion.div>
  );
}

export default KBRAGStatusCard;
