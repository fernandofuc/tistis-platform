'use client';

// =====================================================
// TIS TIS PLATFORM - Usage History Table
// Tabla de historial de uso de minutos
// Sistema: Voice Minute Limits (FASE 4.4)
// =====================================================

import { motion } from 'framer-motion';
import {
  Phone,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Zap,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import type { VoiceMinuteTransaction } from '../types';

// =====================================================
// TYPES
// =====================================================

interface FormattedTransaction extends VoiceMinuteTransaction {
  formatted?: {
    minutes: string;
    charge: string | null;
    date: string;
    type: string;
  };
}

interface UsageHistoryTableProps {
  /** Lista de transacciones */
  transactions: FormattedTransaction[];
  /** Estado de carga */
  isLoading?: boolean;
  /** Paginación */
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  /** Callback para cambiar de página */
  onPageChange: (offset: number) => void;
  /** Callback para exportar */
  onExport?: () => void;
  /** Clases adicionales */
  className?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const TIS_CORAL = 'rgb(223, 115, 115)';

// =====================================================
// HELPERS
// =====================================================

function formatMinutes(minutes: number): string {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  if (secs > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${mins} min`;
}

function formatDate(dateString: string): { date: string; time: string } {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function formatCurrency(centavos: number): string {
  const pesos = centavos / 100;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(pesos);
}

// =====================================================
// SKELETON COMPONENT
// =====================================================

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 sm:gap-4 py-3 sm:py-4 px-4 sm:px-6 animate-pulse">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-200 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-4 w-24 sm:w-32 bg-slate-200 rounded mb-1.5" />
            <div className="h-3 w-16 sm:w-20 bg-slate-100 rounded" />
          </div>
          <div className="hidden sm:block h-4 w-16 bg-slate-100 rounded" />
          <div className="h-6 w-16 sm:w-20 bg-slate-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// =====================================================
// EMPTY STATE
// =====================================================

function EmptyState() {
  return (
    <div className="py-12 sm:py-16 text-center px-4">
      <div
        className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${TIS_CORAL}20 0%, ${TIS_CORAL}10 100%)`,
        }}
      >
        <FileText className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: TIS_CORAL }} />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
        Sin registros
      </h3>
      <p className="text-sm text-slate-500 max-w-xs mx-auto">
        Aún no hay llamadas registradas en este período de facturación.
      </p>
    </div>
  );
}

// =====================================================
// TRANSACTION ROW
// =====================================================

function TransactionRow({
  transaction,
  index,
}: {
  transaction: FormattedTransaction;
  index: number;
}) {
  const { date, time } = formatDate(transaction.recorded_at);
  const displayMinutes = transaction.formatted?.minutes || formatMinutes(transaction.minutes_used);
  const displayCharge = transaction.charge_centavos > 0
    ? formatCurrency(transaction.charge_centavos)
    : null;

  // Extract call info from metadata if available
  const callMetadata = transaction.call_metadata || {};
  const endedReason = callMetadata.ended_reason as string | undefined;
  const outcome = callMetadata.outcome as string | undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.2 }}
      className="
        flex items-center gap-3 sm:gap-4 py-3 sm:py-4 px-4 sm:px-6
        hover:bg-slate-50 transition-colors
        border-b border-slate-100 last:border-0
      "
    >
      {/* Icon */}
      <div
        className={`
          w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0
          ${transaction.is_overage ? 'bg-amber-50' : 'bg-emerald-50'}
        `}
      >
        {transaction.is_overage ? (
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
        ) : (
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="font-medium text-slate-900 text-sm sm:text-base truncate">
            {displayMinutes}
          </span>
          {outcome && (
            <span className="hidden sm:inline text-xs text-slate-400 truncate">
              • {outcome.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs sm:text-sm text-slate-500">
          <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>{date}</span>
          <span className="text-slate-300">•</span>
          <span>{time}</span>
        </div>
      </div>

      {/* Charge (desktop) */}
      <div className="hidden sm:block text-right">
        {displayCharge ? (
          <span className="text-sm font-medium text-amber-600">
            {displayCharge}
          </span>
        ) : (
          <span className="text-sm text-slate-400">-</span>
        )}
      </div>

      {/* Type badge */}
      <span
        className={`
          inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full
          text-[10px] sm:text-xs font-medium flex-shrink-0
          ${transaction.is_overage
            ? 'bg-amber-100 text-amber-700'
            : 'bg-emerald-100 text-emerald-700'
          }
        `}
      >
        {transaction.is_overage ? 'Excedente' : 'Incluido'}
        {/* Mobile charge */}
        {displayCharge && (
          <span className="sm:hidden ml-1 text-amber-600">
            {displayCharge}
          </span>
        )}
      </span>
    </motion.div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function UsageHistoryTable({
  transactions,
  isLoading = false,
  pagination,
  onPageChange,
  onExport,
  className = '',
}: UsageHistoryTableProps) {
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const hasNextPage = pagination.hasMore;
  const hasPrevPage = pagination.offset > 0;

  // Calculate totals
  const totalMinutes = transactions.reduce((sum, t) => sum + t.minutes_used, 0);
  const totalCharges = transactions.reduce((sum, t) => sum + t.charge_centavos, 0);

  return (
    <div
      className={`
        bg-white rounded-2xl border border-slate-200 overflow-hidden
        ${className}
      `}
    >
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Historial de Uso
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {transactions.length > 0
              ? `${transactions.length} registros • ${formatMinutes(totalMinutes)} total`
              : 'Sin registros en este período'
            }
          </p>
        </div>

        {/* Export button */}
        {onExport && transactions.length > 0 && (
          <button
            onClick={onExport}
            className="
              flex items-center gap-1.5 px-3 py-1.5
              text-xs sm:text-sm font-medium text-slate-600
              bg-slate-100 hover:bg-slate-200
              rounded-lg transition-colors
              min-h-[36px] sm:min-h-0
            "
            title="Exportar a CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        )}
      </div>

      {/* Summary bar (if has charges) */}
      {totalCharges > 0 && !isLoading && (
        <div className="px-4 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
          <span className="text-xs sm:text-sm text-amber-700">
            Cargos por excedente acumulados
          </span>
          <span className="text-sm font-semibold text-amber-800">
            {formatCurrency(totalCharges)}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="min-h-[200px]">
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : transactions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(hasNextPage || hasPrevPage) && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs sm:text-sm text-slate-500">
            Página {currentPage}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
              disabled={!hasPrevPage}
              className="
                p-2 hover:bg-slate-100 rounded-lg transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0
                flex items-center justify-center
              "
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <span className="px-2 sm:px-3 py-1 text-sm font-medium text-slate-600 tabular-nums">
              {currentPage}
            </span>
            <button
              onClick={() => onPageChange(pagination.offset + pagination.limit)}
              disabled={!hasNextPage}
              className="
                p-2 hover:bg-slate-100 rounded-lg transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0
                flex items-center justify-center
              "
              aria-label="Página siguiente"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsageHistoryTable;
