/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * RecentCallsTable Component
 *
 * Table displaying recent calls with sorting, filtering,
 * and pagination. Click a row to view call details.
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  EyeIcon,
  PlayIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import type { VoiceCall } from '@/src/features/voice-agent/types';
import type { CallFilters, PaginationState, CallSortField, SortDirection } from './types';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  formatDuration,
} from './types';

// =====================================================
// TYPES
// =====================================================

export interface RecentCallsTableProps {
  /** List of calls */
  calls: VoiceCall[];
  /** Pagination state */
  pagination: PaginationState;
  /** Current filters */
  filters?: CallFilters;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when sort changes */
  onSortChange?: (field: CallSortField, direction: SortDirection) => void;
  /** Callback when call is clicked */
  onCallClick?: (call: VoiceCall) => void;
  /** Callback to play recording */
  onPlayRecording?: (call: VoiceCall) => void;
  /** Additional className */
  className?: string;
}

// =====================================================
// TABLE SKELETON
// =====================================================

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="w-40 h-6 rounded bg-slate-100 animate-pulse" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="w-32 h-4 rounded bg-slate-100" />
              <div className="w-20 h-3 rounded bg-slate-50" />
            </div>
            <div className="w-20 h-6 rounded-full bg-slate-100" />
            <div className="w-16 h-4 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// STATUS BADGE
// =====================================================

interface StatusBadgeProps {
  status: VoiceCall['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-1 rounded-full
        text-xs font-medium border
        ${colors.bg} ${colors.text} ${colors.border}
      `}
    >
      {label}
    </span>
  );
}

// =====================================================
// OUTCOME BADGE
// =====================================================

interface OutcomeBadgeProps {
  outcome: VoiceCall['outcome'];
}

function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
  if (!outcome) {
    return (
      <span className="text-xs text-slate-400">-</span>
    );
  }

  const label = OUTCOME_LABELS[outcome];
  const color = OUTCOME_COLORS[outcome] || '#94a3b8';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// =====================================================
// SORTABLE HEADER
// =====================================================

interface SortableHeaderProps {
  field: CallSortField;
  label: string;
  currentSort?: { field: CallSortField; direction: SortDirection };
  onSort: (field: CallSortField) => void;
  className?: string;
}

function SortableHeader({
  field,
  label,
  currentSort,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isActive = currentSort?.field === field;
  const direction = isActive ? currentSort.direction : null;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`
        flex items-center gap-1 text-xs font-semibold uppercase tracking-wider
        text-slate-500 hover:text-slate-700 transition-colors
        ${className}
      `}
    >
      {label}
      <span className="flex flex-col">
        <ChevronUpIcon
          className={`w-3 h-3 -mb-1 ${
            direction === 'asc' ? 'text-tis-coral' : 'text-slate-300'
          }`}
        />
        <ChevronDownIcon
          className={`w-3 h-3 -mt-1 ${
            direction === 'desc' ? 'text-tis-coral' : 'text-slate-300'
          }`}
        />
      </span>
    </button>
  );
}

// =====================================================
// PAGINATION
// =====================================================

interface PaginationProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
}

function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, pageSize, totalItems, totalPages } = pagination;

  const startItem = page * pageSize + 1;
  const endItem = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
      <p className="text-sm text-slate-500">
        Mostrando <span className="font-medium text-slate-700">{startItem}</span> a{' '}
        <span className="font-medium text-slate-700">{endItem}</span> de{' '}
        <span className="font-medium text-slate-700">{totalItems}</span> llamadas
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className={`
            p-2 rounded-lg border border-slate-200
            transition-all duration-200
            ${page === 0
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-slate-50 hover:border-slate-300'
            }
          `}
          aria-label="Página anterior"
        >
          <ChevronLeftIcon className="w-4 h-4 text-slate-500" />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            // Calculate which page numbers to show
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i;
            } else if (page < 3) {
              pageNum = i;
            } else if (page > totalPages - 4) {
              pageNum = totalPages - 5 + i;
            } else {
              pageNum = page - 2 + i;
            }

            const isActive = pageNum === page;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`
                  w-8 h-8 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${isActive
                    ? 'bg-tis-coral text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                  }
                `}
              >
                {pageNum + 1}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          className={`
            p-2 rounded-lg border border-slate-200
            transition-all duration-200
            ${page >= totalPages - 1
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-slate-50 hover:border-slate-300'
            }
          `}
          aria-label="Página siguiente"
        >
          <ChevronRightIcon className="w-4 h-4 text-slate-500" />
        </button>
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function RecentCallsTable({
  calls,
  pagination,
  filters,
  isLoading = false,
  onPageChange,
  onSortChange,
  onCallClick,
  onPlayRecording,
  className = '',
}: RecentCallsTableProps) {
  const [currentSort, setCurrentSort] = useState<{
    field: CallSortField;
    direction: SortDirection;
  }>({ field: 'started_at', direction: 'desc' });

  // Handle sort
  const handleSort = useCallback(
    (field: CallSortField) => {
      const newDirection =
        currentSort.field === field && currentSort.direction === 'desc' ? 'asc' : 'desc';
      setCurrentSort({ field, direction: newDirection });
      onSortChange?.(field, newDirection);
    },
    [currentSort, onSortChange]
  );

  // Format date/time
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Animation
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, delay: 0.3 },
    },
  };

  const rowVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { duration: 0.2, delay: i * 0.05 },
    }),
  };

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`bg-white rounded-2xl border border-slate-200 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Llamadas Recientes</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {pagination.totalItems} llamadas en total
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      {calls.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-slate-500">No hay llamadas en este periodo</p>
          <p className="text-xs text-slate-400 mt-1">
            Las llamadas aparecerán aquí cuando se reciban
          </p>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100">
            <div className="col-span-3">
              <SortableHeader
                field="started_at"
                label="Fecha/Hora"
                currentSort={currentSort}
                onSort={handleSort}
              />
            </div>
            <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Teléfono
            </div>
            <div className="col-span-2">
              <SortableHeader
                field="status"
                label="Estado"
                currentSort={currentSort}
                onSort={handleSort}
              />
            </div>
            <div className="col-span-2">
              <SortableHeader
                field="outcome"
                label="Resultado"
                currentSort={currentSort}
                onSort={handleSort}
              />
            </div>
            <div className="col-span-2">
              <SortableHeader
                field="duration_seconds"
                label="Duración"
                currentSort={currentSort}
                onSort={handleSort}
              />
            </div>
            <div className="col-span-1 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">
              Acciones
            </div>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-slate-100">
            <AnimatePresence>
              {calls.map((call, index) => (
                <motion.div
                  key={call.id}
                  custom={index}
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                  className={`
                    grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4
                    hover:bg-slate-50 transition-colors cursor-pointer
                    group
                  `}
                  onClick={() => onCallClick?.(call)}
                >
                  {/* Date/Time + Direction */}
                  <div className="md:col-span-3 flex items-center gap-3">
                    <div
                      className={`
                        w-9 h-9 rounded-full flex items-center justify-center
                        ${call.call_direction === 'inbound'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-blue-100 text-blue-600'
                        }
                      `}
                    >
                      {call.call_direction === 'inbound' ? (
                        <PhoneIncomingIcon className="w-4 h-4" />
                      ) : (
                        <PhoneOutgoingIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatDateTime(call.started_at)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {call.call_direction === 'inbound' ? 'Entrante' : 'Saliente'}
                      </p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="md:col-span-2 flex items-center">
                    <p className="text-sm text-slate-600 font-mono">
                      {call.caller_phone || '-'}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="md:col-span-2 flex items-center">
                    <StatusBadge status={call.status} />
                  </div>

                  {/* Outcome */}
                  <div className="md:col-span-2 flex items-center">
                    <OutcomeBadge outcome={call.outcome} />
                  </div>

                  {/* Duration */}
                  <div className="md:col-span-2 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600">
                      {formatDuration(call.duration_seconds)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-1 flex items-center justify-end gap-2">
                    {call.recording_url && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayRecording?.(call);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-tis-coral hover:bg-tis-coral-50 transition-colors"
                        aria-label="Reproducir grabación"
                      >
                        <PlayIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCallClick?.(call);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-tis-purple hover:bg-purple-50 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Ver detalles"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && onPageChange && (
        <Pagination pagination={pagination} onPageChange={onPageChange} />
      )}
    </motion.div>
  );
}

export default RecentCallsTable;
