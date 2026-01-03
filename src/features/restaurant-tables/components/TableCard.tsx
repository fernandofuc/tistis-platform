// =====================================================
// TIS TIS PLATFORM - Table Card Component
// Individual table display card with status and actions
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils';
import type { RestaurantTable, TableStatus } from '../types';
import { STATUS_CONFIG, ZONE_CONFIG, FEATURE_LABELS } from '../types';

// ======================
// STATUS BADGE
// ======================
interface StatusBadgeProps {
  status: TableStatus;
  size?: 'sm' | 'md';
}

function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        config.bgColor,
        config.color,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span
        className={cn(
          'rounded-full',
          size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5',
          status === 'available' && 'bg-emerald-500',
          status === 'occupied' && 'bg-blue-500',
          status === 'reserved' && 'bg-amber-500',
          status === 'unavailable' && 'bg-slate-400',
          status === 'maintenance' && 'bg-red-500'
        )}
      />
      {config.label}
    </span>
  );
}

// ======================
// CAPACITY INDICATOR
// ======================
interface CapacityIndicatorProps {
  min: number;
  max: number;
  current?: number;
}

function CapacityIndicator({ min, max, current }: CapacityIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 text-slate-500">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      <span className="text-sm">
        {current !== undefined ? (
          <span className="font-medium text-slate-900">{current}</span>
        ) : null}
        {current !== undefined && '/'}
        {min === max ? max : `${min}-${max}`}
      </span>
    </div>
  );
}

// ======================
// ZONE BADGE
// ======================
interface ZoneBadgeProps {
  zone: string;
}

function ZoneBadge({ zone }: ZoneBadgeProps) {
  const config = ZONE_CONFIG[zone as keyof typeof ZONE_CONFIG];

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs">
      {config?.label || zone}
    </span>
  );
}

// ======================
// FEATURE TAGS
// ======================
interface FeatureTagsProps {
  features: string[];
  maxShow?: number;
}

function FeatureTags({ features, maxShow = 3 }: FeatureTagsProps) {
  if (features.length === 0) return null;

  const visibleFeatures = features.slice(0, maxShow);
  const remaining = features.length - maxShow;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleFeatures.map((feature) => (
        <span
          key={feature}
          className="inline-flex px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 text-[10px]"
        >
          {FEATURE_LABELS[feature as keyof typeof FEATURE_LABELS] || feature}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 text-[10px]">
          +{remaining}
        </span>
      )}
    </div>
  );
}

// ======================
// CURRENT RESERVATION INFO
// ======================
interface CurrentReservationProps {
  reservation: {
    guest_name: string;
    party_size: number;
    scheduled_at: string;
    arrival_status: string;
  };
}

function CurrentReservation({ reservation }: CurrentReservationProps) {
  const time = new Date(reservation.scheduled_at).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-medium">
          {reservation.guest_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {reservation.guest_name}
          </p>
          <p className="text-xs text-slate-500">
            {time} • {reservation.party_size} personas
          </p>
        </div>
      </div>
    </div>
  );
}

// ======================
// TABLE CARD MENU
// ======================
interface TableCardMenuProps {
  table: RestaurantTable;
  onEdit: () => void;
  onChangeStatus: (status: TableStatus) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onViewReservations: () => void;
}

function TableCardMenu({
  table,
  onEdit,
  onChangeStatus,
  onToggleActive,
  onDelete,
  onViewReservations,
}: TableCardMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 overflow-hidden">
            <button
              onClick={() => {
                onEdit();
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar mesa
            </button>

            <button
              onClick={() => {
                onViewReservations();
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Ver reservaciones
            </button>

            <div className="border-t border-slate-100 my-1" />

            <p className="px-3 py-1.5 text-xs text-slate-400 font-medium">Cambiar estado</p>

            {(['available', 'occupied', 'reserved', 'unavailable', 'maintenance'] as TableStatus[]).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => {
                    onChangeStatus(status);
                    setOpen(false);
                  }}
                  disabled={table.status === status}
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-sm flex items-center gap-2',
                    table.status === status
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      status === 'available' && 'bg-emerald-500',
                      status === 'occupied' && 'bg-blue-500',
                      status === 'reserved' && 'bg-amber-500',
                      status === 'unavailable' && 'bg-slate-400',
                      status === 'maintenance' && 'bg-red-500'
                    )}
                  />
                  {STATUS_CONFIG[status].label}
                </button>
              )
            )}

            <div className="border-t border-slate-100 my-1" />

            <button
              onClick={() => {
                onToggleActive();
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {table.is_active ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              {table.is_active ? 'Desactivar mesa' : 'Activar mesa'}
            </button>

            <button
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar mesa
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
interface TableCardProps {
  table: RestaurantTable;
  onEdit: (table: RestaurantTable) => void;
  onChangeStatus: (table: RestaurantTable, status: TableStatus) => void;
  onToggleActive: (table: RestaurantTable) => void;
  onDelete: (table: RestaurantTable) => void;
  onViewReservations: (table: RestaurantTable) => void;
  compact?: boolean;
}

export function TableCard({
  table,
  onEdit,
  onChangeStatus,
  onToggleActive,
  onDelete,
  onViewReservations,
  compact = false,
}: TableCardProps) {
  const displayName = table.name || `Mesa ${table.table_number}`;

  if (compact) {
    return (
      <div
        className={cn(
          'relative rounded-xl border p-3 transition-all duration-200',
          table.is_active
            ? 'border-slate-200 bg-white hover:shadow-md hover:border-slate-300'
            : 'border-slate-100 bg-slate-50 opacity-60'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {table.table_number}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-900 text-sm truncate">{displayName}</p>
              <CapacityIndicator min={table.min_capacity} max={table.max_capacity} />
            </div>
          </div>
          <StatusBadge status={table.status} size="sm" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl border p-5 transition-all duration-200',
        table.is_active
          ? 'border-slate-200 bg-white hover:shadow-md hover:border-slate-300/80'
          : 'border-slate-100 bg-slate-50/50 opacity-70'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg font-bold">
            {table.table_number}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{displayName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <ZoneBadge zone={table.zone} />
              {table.floor > 1 && (
                <span className="text-xs text-slate-400">Piso {table.floor}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={table.status} />
          <TableCardMenu
            table={table}
            onEdit={() => onEdit(table)}
            onChangeStatus={(status) => onChangeStatus(table, status)}
            onToggleActive={() => onToggleActive(table)}
            onDelete={() => onDelete(table)}
            onViewReservations={() => onViewReservations(table)}
          />
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center gap-4 text-sm">
        <CapacityIndicator
          min={table.min_capacity}
          max={table.max_capacity}
          current={table.current_reservation?.party_size}
        />

        {table.is_outdoor && (
          <div className="flex items-center gap-1 text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <span>Exterior</span>
          </div>
        )}

        {table.is_accessible && (
          <div className="flex items-center gap-1 text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Accesible</span>
          </div>
        )}
      </div>

      {/* Features */}
      {table.features.length > 0 && (
        <div className="mt-3">
          <FeatureTags features={table.features} />
        </div>
      )}

      {/* Current Reservation */}
      {table.current_reservation && (
        <CurrentReservation reservation={table.current_reservation} />
      )}

      {/* Inactive Overlay */}
      {!table.is_active && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-2xl">
          <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
            Mesa desactivada
          </span>
        </div>
      )}
    </div>
  );
}

export { StatusBadge, CapacityIndicator, ZoneBadge, FeatureTags };
