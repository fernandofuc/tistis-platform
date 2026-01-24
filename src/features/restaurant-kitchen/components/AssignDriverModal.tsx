'use client';

// =====================================================
// TIS TIS PLATFORM - Assign Driver Modal
// Modal para asignar repartidores a ordenes de delivery
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - API: /api/restaurant/delivery/drivers
// - API: /api/restaurant/delivery/[orderId]/assign
// =====================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/utils';
import type { DeliveryDriver } from '@/src/shared/types/delivery-types';

// ======================
// ICONS
// ======================

const XIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.5 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const TruckIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

const StarIcon = ({ className, filled }: { className?: string; filled?: boolean }) => (
  <svg className={cn('w-4 h-4', className)} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

// ======================
// TYPES
// ======================

interface AssignDriverModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  orderNumber?: string;
  drivers?: DeliveryDriver[];
  onAssign: (driverId: string) => Promise<void>;
  onAutoAssign?: () => Promise<void>;
  loading?: boolean;
}

interface DriverListItem extends DeliveryDriver {
  active_deliveries?: number;
}

// ======================
// VEHICLE ICONS
// ======================

const VehicleIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'motorcycle':
      return (
        <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h3m-3.75-7.5h4.5m-10.5 0L7.5 6l4.5-.75m0 0l3 1.5m-3-1.5l-.375 3.75m3.375-2.25l1.5.75m0 0l.75 2.25m-.75-2.25l3 2.25M12 12.75l-1.5.75" />
        </svg>
      );
    case 'bicycle':
      return (
        <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'car':
      return (
        <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      );
    default:
      return <TruckIcon className={className} />;
  }
};

// ======================
// DRIVER CARD COMPONENT
// ======================

interface DriverCardProps {
  driver: DriverListItem;
  isSelected: boolean;
  onSelect: () => void;
}

function DriverCard({ driver, isSelected, onSelect }: DriverCardProps) {
  // SINCRONIZADO CON: src/shared/types/delivery-types.ts DriverStatus
  const statusColors: Record<string, { bg: string; text: string }> = {
    available: { bg: 'bg-green-100', text: 'text-green-700' },
    busy: { bg: 'bg-orange-100', text: 'text-orange-700' },
    offline: { bg: 'bg-slate-100', text: 'text-slate-500' },
    break: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  };

  const status = statusColors[driver.status] || statusColors.offline;
  const isAvailable = driver.status === 'available';

  return (
    <button
      onClick={onSelect}
      disabled={!isAvailable}
      className={cn(
        'w-full p-3 rounded-lg border text-left transition-all',
        isSelected && 'border-purple-500 bg-purple-50 ring-2 ring-purple-200',
        !isSelected && isAvailable && 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
        !isAvailable && 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          isSelected ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-600'
        )}>
          <UserIcon className="w-5 h-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 truncate">{driver.full_name}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', status.bg, status.text)}>
              {driver.status === 'available' ? 'Disponible' :
               driver.status === 'busy' ? 'Ocupado' :
               driver.status === 'break' ? 'En descanso' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            {/* Vehicle */}
            <span className="flex items-center gap-1">
              <VehicleIcon type={driver.vehicle_type || 'motorcycle'} className="w-3 h-3" />
              {driver.vehicle_type === 'motorcycle' ? 'Moto' :
               driver.vehicle_type === 'bicycle' ? 'Bici' :
               driver.vehicle_type === 'car' ? 'Auto' : 'Veh'}
            </span>

            {/* Rating */}
            {driver.average_rating && (
              <span className="flex items-center gap-0.5">
                <StarIcon className="w-3 h-3 text-yellow-500" filled />
                {driver.average_rating.toFixed(1)}
              </span>
            )}

            {/* Deliveries */}
            <span className="flex items-center gap-1">
              <TruckIcon className="w-3 h-3" />
              {driver.total_deliveries || 0} entregas
            </span>
          </div>

          {/* Active deliveries warning */}
          {driver.active_deliveries && driver.active_deliveries > 0 && (
            <div className="mt-1 text-xs text-orange-600">
              {driver.active_deliveries} entrega(s) activa(s)
            </div>
          )}
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div className="flex-shrink-0 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
            <CheckIcon className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </button>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function AssignDriverModal({
  open,
  onClose,
  orderId,
  orderNumber,
  drivers: driversProp = [],
  onAssign,
  onAutoAssign,
  loading: loadingProp = false,
}: AssignDriverModalProps) {
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // Convert to DriverListItem
  const drivers: DriverListItem[] = useMemo(() =>
    driversProp.map(d => ({ ...d })),
    [driversProp]
  );

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedDriverId(null);
      setSearchQuery('');
      setError(null);
    }
  }, [open]);

  // Filter drivers
  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return drivers;

    const query = searchQuery.toLowerCase();
    return drivers.filter(driver =>
      driver.full_name.toLowerCase().includes(query) ||
      driver.phone?.toLowerCase().includes(query)
    );
  }, [drivers, searchQuery]);

  // Sort drivers: available first, then by rating
  const sortedDrivers = useMemo(() => {
    return [...filteredDrivers].sort((a, b) => {
      // Available first
      if (a.status === 'available' && b.status !== 'available') return -1;
      if (b.status === 'available' && a.status !== 'available') return 1;

      // Then by active deliveries (fewer first)
      const aDeliveries = a.active_deliveries || 0;
      const bDeliveries = b.active_deliveries || 0;
      if (aDeliveries !== bDeliveries) return aDeliveries - bDeliveries;

      // Then by rating
      const aRating = a.average_rating || 0;
      const bRating = b.average_rating || 0;
      return bRating - aRating;
    });
  }, [filteredDrivers]);

  // Handle assign
  const handleAssign = async () => {
    if (!selectedDriverId || !orderId) return;

    setAssigning(true);
    try {
      await onAssign(selectedDriverId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar repartidor');
    } finally {
      setAssigning(false);
    }
  };

  // Auto-assign using the callback or select first available
  const handleAutoAssign = async () => {
    if (onAutoAssign) {
      setAssigning(true);
      try {
        await onAutoAssign();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al auto-asignar');
      } finally {
        setAssigning(false);
      }
    } else {
      // Fallback: just select first available
      const firstAvailable = sortedDrivers.find(d => d.status === 'available');
      if (firstAvailable) {
        setSelectedDriverId(firstAvailable.id);
      }
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl mx-4 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Asignar Repartidor</h2>
              {orderId && (
                <p className="text-sm text-slate-500 mt-0.5">
                  Orden #{orderId.slice(0, 8)}...
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <XIcon />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar repartidor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-slate-500">
                {sortedDrivers.filter(d => d.status === 'available').length} disponibles
              </span>
              {onAutoAssign && (
                <button
                  onClick={handleAutoAssign}
                  disabled={loadingProp || sortedDrivers.filter(d => d.status === 'available').length === 0}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  Auto-asignar
                </button>
              )}
            </div>
          </div>

          {/* Driver List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* Loading */}
            {loadingProp && (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <RefreshIcon className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Cargando repartidores...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Empty */}
            {!loadingProp && !error && sortedDrivers.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <UserIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No hay repartidores</p>
                <p className="text-xs mt-1">
                  {searchQuery ? 'Intenta con otro termino de busqueda' : 'Agrega repartidores primero'}
                </p>
              </div>
            )}

            {/* Drivers */}
            {sortedDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                isSelected={selectedDriverId === driver.id}
                onSelect={() => setSelectedDriverId(driver.id)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedDriverId || assigning}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                selectedDriverId && !assigning
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              )}
            >
              {assigning ? (
                <>
                  <RefreshIcon className="w-4 h-4 animate-spin inline-block mr-1" />
                  Asignando...
                </>
              ) : (
                'Asignar Repartidor'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default AssignDriverModal;
