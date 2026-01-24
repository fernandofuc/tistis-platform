'use client';

// =====================================================
// TIS TIS PLATFORM - KDS Delivery Panel
// Panel lateral dedicado para gestionar ordenes de delivery
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Types: src/features/restaurant-kitchen/types/index.ts
// - Types: src/shared/types/delivery-types.ts
// =====================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/utils';
import type {
  KDSDeliveryOrderView,
  KDSDeliveryStats,
  KDSDeliveryFilter,
} from '../types';
import {
  DELIVERY_STATUS_INFO,
  type DeliveryStatus,
} from '@/src/shared/types/delivery-types';
import { AssignDriverModal } from './AssignDriverModal';

// ======================
// ICONS
// ======================

const TruckIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

// ======================
// TYPES
// ======================

import type { DeliveryDriver, DriverAssignmentResult } from '../types';

interface DeliveryPanelProps {
  orders: KDSDeliveryOrderView[];
  stats: KDSDeliveryStats;
  drivers?: DeliveryDriver[];
  loading?: boolean;
  onAssignDriver: (orderId: string, driverId: string) => Promise<DriverAssignmentResult>;
  onAutoAssign?: (orderId: string) => Promise<DriverAssignmentResult>;
  onUpdateStatus: (orderId: string, status: DeliveryStatus, notes?: string) => Promise<void>;
  onMarkReady: (orderId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  selectedOrderId?: string | null;
  onSelectOrder?: (orderId: string | null) => void;
  className?: string;
}

const STATUS_TABS: Array<{ key: KDSDeliveryFilter; label: string; color: string }> = [
  { key: 'pending_assignment', label: 'Pendientes', color: 'bg-amber-500' },
  { key: 'ready_for_pickup', label: 'Listos', color: 'bg-green-500' },
  { key: 'driver_assigned', label: 'Asignados', color: 'bg-blue-500' },
  { key: 'in_transit', label: 'En Camino', color: 'bg-purple-500' },
  { key: 'all', label: 'Todos', color: 'bg-slate-500' },
];

// ======================
// HELPER FUNCTIONS
// ======================

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

function formatTimeUntil(dateString: string | null): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins <= 0) return 'Vencido';
  if (diffMins < 60) return `${diffMins}min`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ${diffMins % 60}min`;
}

function getDeliveryStatusColor(status: DeliveryStatus): { bg: string; text: string; border: string } {
  const colors: Record<DeliveryStatus, { bg: string; text: string; border: string }> = {
    pending_assignment: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
    driver_assigned: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    driver_arrived: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
    picked_up: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
    in_transit: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    arriving: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
    delivered: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    returned: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  };
  return colors[status] || colors.pending_assignment;
}

// ======================
// STATS BAR COMPONENT
// ======================

function DeliveryStatsBar({ stats, loading }: { stats: KDSDeliveryStats | null; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-6 w-12 bg-slate-200 rounded" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="flex items-center gap-2 py-2 text-xs">
      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
        {stats.pending_assignment} pend
      </span>
      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
        {stats.ready_for_pickup} listos
      </span>
      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
        {stats.driver_assigned} asig
      </span>
      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
        {stats.in_transit} ruta
      </span>
    </div>
  );
}

// ======================
// ORDER CARD COMPONENT
// ======================

interface DeliveryOrderCardProps {
  order: KDSDeliveryOrderView;
  isSelected: boolean;
  onClick: () => void;
  onAssignDriver: () => void;
  onMarkPickedUp?: () => void;
  onMarkReady?: () => void;
}

function DeliveryOrderCard({
  order,
  isSelected,
  onClick,
  onAssignDriver,
  onMarkPickedUp,
  onMarkReady,
}: DeliveryOrderCardProps) {
  const statusInfo = DELIVERY_STATUS_INFO[order.delivery_status];
  const statusColors = getDeliveryStatusColor(order.delivery_status);
  const timeAgo = formatTimeAgo(order.ordered_at);
  const timeUntil = formatTimeUntil(order.estimated_delivery_at);

  const isReady = order.order_status === 'ready';
  const isPreparing = order.order_status === 'preparing';
  const needsDriver = order.delivery_status === 'pending_assignment';
  const canPickup = order.delivery_status === 'driver_arrived' ||
                    (order.delivery_status === 'driver_assigned' && isReady);
  const canMarkReady = isPreparing && order.delivery_driver_id !== null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-purple-500 bg-purple-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
        needsDriver && isReady && 'ring-2 ring-amber-300 animate-pulse'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-900">
            #{order.display_number}
          </span>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            statusColors.bg,
            statusColors.text
          )}>
            {statusInfo?.label || order.delivery_status}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <ClockIcon className="w-3 h-3" />
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Direccion */}
      {order.delivery_address ? (
        <div className="flex items-start gap-2 mb-2">
          <MapPinIcon className="text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700 truncate">
              {order.delivery_address.street} #{order.delivery_address.exterior_number}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {order.delivery_address.colony}, {order.delivery_address.city}
            </p>
            {order.delivery_address.reference && (
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Ref: {order.delivery_address.reference}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-amber-50 rounded text-amber-600 text-xs">
          <AlertIcon className="w-4 h-4" />
          <span>Sin direccion configurada</span>
        </div>
      )}

      {/* Contacto */}
      <div className="flex items-center gap-4 text-xs text-slate-600 mb-2">
        {order.customer_name && (
          <span className="flex items-center gap-1">
            <UserIcon className="w-3 h-3" />
            <span className="truncate max-w-[80px]">{order.customer_name}</span>
          </span>
        )}
        {order.customer_phone && (
          <span className="flex items-center gap-1">
            <PhoneIcon className="w-3 h-3" />
            <span>{order.customer_phone}</span>
          </span>
        )}
      </div>

      {/* Tiempo estimado */}
      {timeUntil && (
        <div className={cn(
          'text-xs px-2 py-1 rounded mb-2',
          timeUntil === 'Vencido' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
        )}>
          ETA: {timeUntil}
        </div>
      )}

      {/* Driver info */}
      {order.driver_name && (
        <div className="flex items-center gap-2 text-xs bg-blue-50 px-2 py-1.5 rounded mb-2">
          <TruckIcon className="w-3 h-3 text-blue-600" />
          <span className="font-medium text-blue-700">{order.driver_name}</span>
          {order.driver_phone && (
            <span className="text-blue-600">{order.driver_phone}</span>
          )}
        </div>
      )}

      {/* Items summary */}
      <div className="text-xs text-slate-500 mb-3">
        <span className="font-medium">{order.items_count} items</span>
        {order.items_summary && (
          <span className="ml-1 truncate">- {order.items_summary}</span>
        )}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-2">
        <span className="text-slate-500">Total</span>
        <span className="font-bold text-slate-900">${order.total.toFixed(2)}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        {needsDriver && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssignDriver();
            }}
            className={cn(
              'flex-1 py-2 text-sm font-semibold rounded-lg transition-colors',
              isReady
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            )}
          >
            {isReady ? 'Asignar Repartidor' : 'Asignar'}
          </button>
        )}
        {canMarkReady && onMarkReady && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkReady();
            }}
            className="flex-1 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 transition-colors"
          >
            <CheckCircleIcon className="inline-block w-4 h-4 mr-1" />
            Marcar Listo
          </button>
        )}
        {canPickup && onMarkPickedUp && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkPickedUp();
            }}
            className="flex-1 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors"
          >
            <CheckCircleIcon className="inline-block w-4 h-4 mr-1" />
            Recogido
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function DeliveryPanel({
  orders,
  stats,
  drivers = [],
  loading = false,
  onAssignDriver,
  onAutoAssign,
  onUpdateStatus,
  onMarkReady,
  onRefresh,
  selectedOrderId,
  onSelectOrder,
  className,
}: DeliveryPanelProps) {
  const [filter, setFilter] = useState<KDSDeliveryFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(selectedOrderId || null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Sync selectedOrder with selectedOrderId prop
  useEffect(() => {
    if (selectedOrderId !== undefined) {
      setSelectedOrder(selectedOrderId);
    }
  }, [selectedOrderId]);

  // Filtrar ordenes
  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;

    return orders.filter(order => {
      switch (filter) {
        case 'pending_assignment':
          return order.delivery_status === 'pending_assignment';
        case 'ready_for_pickup':
          return order.order_status === 'ready' &&
                 ['pending_assignment', 'driver_assigned', 'driver_arrived'].includes(order.delivery_status);
        case 'driver_assigned':
          return ['driver_assigned', 'driver_arrived'].includes(order.delivery_status);
        case 'in_transit':
          return ['picked_up', 'in_transit', 'arriving'].includes(order.delivery_status);
        default:
          return true;
      }
    });
  }, [orders, filter]);

  // Contar ordenes por filtro
  const counts = useMemo(() => ({
    pending_assignment: orders.filter(o => o.delivery_status === 'pending_assignment').length,
    ready_for_pickup: orders.filter(o =>
      o.order_status === 'ready' &&
      ['pending_assignment', 'driver_assigned', 'driver_arrived'].includes(o.delivery_status)
    ).length,
    driver_assigned: orders.filter(o =>
      ['driver_assigned', 'driver_arrived'].includes(o.delivery_status)
    ).length,
    in_transit: orders.filter(o =>
      ['picked_up', 'in_transit', 'arriving'].includes(o.delivery_status)
    ).length,
    all: orders.length,
  }), [orders]);

  // Handlers
  const handleOrderClick = useCallback((orderId: string) => {
    setSelectedOrder(orderId);
    onSelectOrder?.(orderId);
  }, [onSelectOrder]);

  const handleAssignDriver = useCallback((orderId: string) => {
    setSelectedOrder(orderId);
    setShowAssignModal(true);
  }, []);

  const handleDriverAssigned = useCallback(async (driverId: string) => {
    if (selectedOrder && onAssignDriver) {
      await onAssignDriver(selectedOrder, driverId);
      setShowAssignModal(false);
    }
  }, [selectedOrder, onAssignDriver]);

  const handleMarkPickedUp = useCallback(async (orderId: string) => {
    if (onUpdateStatus) {
      await onUpdateStatus(orderId, 'picked_up');
    }
  }, [onUpdateStatus]);

  const handleMarkReady = useCallback(async (orderId: string) => {
    if (onMarkReady) {
      await onMarkReady(orderId);
    }
  }, [onMarkReady]);

  return (
    <div className={cn('h-full flex flex-col bg-white border-l border-slate-200', className)}>
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="font-semibold text-slate-900">Delivery</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {orders.length}
            </span>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshIcon className={cn(loading && 'animate-spin')} />
          </button>
        </div>

        {/* Stats */}
        <DeliveryStatsBar stats={stats} loading={loading} />

        {/* Status Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                filter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={cn(
                  'ml-1 px-1.5 py-0.5 rounded-full text-xs',
                  filter === tab.key ? 'bg-white/20' : 'bg-slate-300'
                )}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Loading state */}
        {loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <RefreshIcon className="w-6 h-6 animate-spin mb-2" />
            <span className="text-sm">Cargando ordenes...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <TruckIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Sin ordenes de delivery</p>
            <p className="text-xs mt-1">
              {filter !== 'all'
                ? 'No hay ordenes con este filtro'
                : 'Las nuevas ordenes apareceran aqui'
              }
            </p>
          </div>
        )}

        {/* Orders */}
        <AnimatePresence mode="popLayout">
          {filteredOrders.map((order) => (
            <DeliveryOrderCard
              key={order.order_id}
              order={order}
              isSelected={selectedOrder === order.order_id}
              onClick={() => handleOrderClick(order.order_id)}
              onAssignDriver={() => handleAssignDriver(order.order_id)}
              onMarkPickedUp={() => handleMarkPickedUp(order.order_id)}
              onMarkReady={() => handleMarkReady(order.order_id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Assign Driver Modal */}
      <AssignDriverModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        orderId={selectedOrder}
        orderNumber={filteredOrders.find(o => o.order_id === selectedOrder)?.display_number}
        drivers={drivers}
        onAssign={handleDriverAssigned}
        onAutoAssign={onAutoAssign ? async () => {
          if (selectedOrder) {
            await onAutoAssign(selectedOrder);
            setShowAssignModal(false);
          }
        } : undefined}
        loading={loading}
      />
    </div>
  );
}

export default DeliveryPanel;
