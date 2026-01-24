'use client';

// =====================================================
// TIS TIS PLATFORM - KDS Order Card Component
// Individual order card for Kitchen Display System
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql (delivery extensions)
// - Types: src/features/restaurant-kitchen/types/index.ts
// =====================================================

import { useMemo, useCallback } from 'react';
import { cn } from '@/shared/utils';
import type {
  KDSOrderView,
  KDSOrderItemView,
  OrderItemStatus,
  DeliveryStatus,
  DeliveryAddress,
} from '../types';
import {
  ORDER_TYPE_CONFIG,
  ORDER_STATUS_CONFIG,
  ITEM_STATUS_CONFIG,
  STATION_CONFIG,
  PRIORITY_CONFIG,
  DELIVERY_STATUS_INFO,
} from '../types';

// ======================
// TYPES
// ======================

interface KDSOrderCardProps {
  order: KDSOrderView;
  onBumpOrder?: (orderId: string) => void;
  onRecallOrder?: (orderId: string) => void;
  onStartItem?: (itemId: string) => void;
  onBumpItem?: (itemId: string) => void;
  onCancelItem?: (itemId: string) => void;
  onPriorityChange?: (orderId: string, priority: number) => void;
  compact?: boolean;
  showStation?: boolean;
  showDeliveryDetails?: boolean;
}

// ======================
// HELPER FUNCTIONS
// ======================

function formatTime(date: string | null): string {
  if (!date) return '--:--';
  return new Date(date).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getElapsedColor(minutes: number): string {
  if (minutes < 5) return 'text-green-600';
  if (minutes < 10) return 'text-yellow-600';
  if (minutes < 15) return 'text-orange-600';
  return 'text-red-600';
}

function getPriorityBorder(priority: number): string {
  const config = PRIORITY_CONFIG.find(p => p.value === priority);
  if (!config) return 'border-slate-200';
  return priority >= 4 ? 'border-l-4 border-l-orange-500' : 'border-slate-200';
}

/**
 * Formatea direccion de delivery de forma compatible con ambos tipos
 * (simplificado con 'number' y extendido con 'exterior_number')
 */
function formatDeliveryAddressShort(address: DeliveryAddress | null | undefined): string {
  if (!address) return '';
  // Handle both 'number' (simplified) and 'exterior_number' (extended) formats
  const num = ('exterior_number' in address && address.exterior_number)
    ? address.exterior_number
    : ('number' in address && address.number)
      ? address.number
      : '';
  const interior = ('apartment' in address && address.apartment)
    ? ` Int. ${address.apartment}`
    : '';
  const colony = address.colony || '';
  return `${address.street} #${num}${interior}${colony ? `, ${colony}` : ''}`;
}

// ======================
// DELIVERY BADGE COMPONENT
// ======================

interface DeliveryBadgeProps {
  status: DeliveryStatus;
  driverName?: string | null;
  compact?: boolean;
}

function DeliveryBadge({ status, driverName, compact }: DeliveryBadgeProps) {
  const statusInfo = DELIVERY_STATUS_INFO[status];

  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1 rounded-lg',
      statusInfo.bgColor
    )}>
      <svg className={cn('w-4 h-4', statusInfo.color)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
      {!compact && (
        <span className={cn('text-xs font-medium', statusInfo.color)}>
          {statusInfo.label}
        </span>
      )}
      {driverName && !compact && (
        <>
          <span className="text-slate-300">•</span>
          <span className={cn('text-xs', statusInfo.color)}>{driverName}</span>
        </>
      )}
    </div>
  );
}

// ======================
// DELIVERY INFO SECTION
// ======================

interface DeliveryInfoProps {
  order: KDSOrderView;
}

function DeliveryInfo({ order }: DeliveryInfoProps) {
  if (order.order_type !== 'delivery' || !order.delivery_status) return null;

  const statusInfo = DELIVERY_STATUS_INFO[order.delivery_status];

  return (
    <div className="px-4 py-2 bg-purple-50 border-b border-purple-100">
      {/* Status & Driver */}
      <div className="flex items-center justify-between mb-2">
        <div className={cn(
          'flex items-center gap-2 px-2 py-1 rounded-lg',
          statusInfo.bgColor
        )}>
          <svg className={cn('w-4 h-4', statusInfo.color)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
          <span className={cn('text-xs font-medium', statusInfo.color)}>
            {statusInfo.label}
          </span>
        </div>

        {order.delivery_driver_name ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-xs text-purple-700 font-medium">
              {order.delivery_driver_name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-amber-600 font-medium animate-pulse">
            Sin repartidor
          </span>
        )}
      </div>

      {/* Address */}
      {order.delivery_address && (
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-xs text-purple-700">
            {formatDeliveryAddressShort(order.delivery_address)}
          </p>
        </div>
      )}

      {/* Instructions */}
      {order.delivery_instructions && (
        <div className="flex items-start gap-2 mt-1">
          <svg className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-purple-600 italic">
            {order.delivery_instructions}
          </p>
        </div>
      )}

      {/* ETA */}
      {order.estimated_delivery_at && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-purple-100">
          <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-purple-700">
            ETA: {new Date(order.estimated_delivery_at).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}
    </div>
  );
}

// ======================
// ITEM ROW COMPONENT
// ======================

interface ItemRowProps {
  item: KDSOrderItemView;
  onStart?: () => void;
  onBump?: () => void;
  onCancel?: () => void;
  showStation?: boolean;
}

function ItemRow({ item, onStart, onBump, onCancel, showStation }: ItemRowProps) {
  const statusConfig = ITEM_STATUS_CONFIG[item.status];
  const stationConfig = item.kitchen_station ? STATION_CONFIG[item.kitchen_station] : null;

  const canStart = item.status === 'pending';
  const canBump = item.status === 'preparing';

  return (
    <div
      className={cn(
        'flex items-start gap-3 py-2 px-3 rounded-lg transition-colors',
        item.status === 'ready' && 'bg-green-50',
        item.status === 'preparing' && 'bg-orange-50',
        item.status === 'pending' && 'bg-slate-50'
      )}
    >
      {/* Quantity */}
      <div className="flex-shrink-0 w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-sm">
        {item.quantity}x
      </div>

      {/* Item details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 truncate">
            {item.menu_item_name}
          </span>
          {showStation && stationConfig && (
            <span
              className="text-xs px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: stationConfig.color }}
            >
              {stationConfig.label}
            </span>
          )}
        </div>

        {/* Variant/Size */}
        {(item.variant_name || item.size_name) && (
          <p className="text-xs text-slate-500 mt-0.5">
            {[item.variant_name, item.size_name].filter(Boolean).join(' • ')}
          </p>
        )}

        {/* Add-ons */}
        {item.add_ons?.length > 0 && (
          <p className="text-xs text-slate-600 mt-0.5">
            + {item.add_ons.map(a => a.name).join(', ')}
          </p>
        )}

        {/* Modifiers */}
        {item.modifiers?.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {item.modifiers.map((mod, i) => (
              <span
                key={i}
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  mod.type === 'remove' && 'bg-red-100 text-red-700',
                  mod.type === 'extra' && 'bg-blue-100 text-blue-700',
                  mod.type === 'substitute' && 'bg-purple-100 text-purple-700'
                )}
              >
                {mod.type === 'remove' ? 'SIN' : mod.type === 'extra' ? 'EXTRA' : ''} {mod.item}
              </span>
            ))}
          </div>
        )}

        {/* Special instructions */}
        {item.special_instructions && (
          <p className="text-xs text-orange-600 mt-1 font-medium">
            ⚠️ {item.special_instructions}
          </p>
        )}

        {/* Allergen notes */}
        {item.allergen_notes && (
          <p className="text-xs text-red-600 mt-1 font-bold">
            🚨 ALERGIA: {item.allergen_notes}
          </p>
        )}
      </div>

      {/* Status & Actions */}
      <div className="flex flex-col items-end gap-1">
        <span className={cn('text-xs px-2 py-0.5 rounded-full', statusConfig.color, statusConfig.bgColor)}>
          {statusConfig.label}
        </span>

        <div className="flex gap-1 mt-1">
          {canStart && onStart && (
            <button
              onClick={onStart}
              className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
            >
              Iniciar
            </button>
          )}
          {canBump && onBump && (
            <button
              onClick={onBump}
              className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Listo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function KDSOrderCard({
  order,
  onBumpOrder,
  onRecallOrder,
  onStartItem,
  onBumpItem,
  onCancelItem,
  onPriorityChange,
  compact = false,
  showStation = true,
  showDeliveryDetails = true,
}: KDSOrderCardProps) {
  const orderTypeConfig = ORDER_TYPE_CONFIG[order.order_type];
  const statusConfig = ORDER_STATUS_CONFIG[order.order_status];
  const elapsedMinutes = Math.floor(order.minutes_elapsed);
  const isDeliveryOrder = order.order_type === 'delivery';
  const needsDeliveryAttention = isDeliveryOrder && order.delivery_status === 'pending_assignment';

  const pendingItems = useMemo(
    () => order.items?.filter(i => i.status === 'pending') || [],
    [order.items]
  );
  const preparingItems = useMemo(
    () => order.items?.filter(i => i.status === 'preparing') || [],
    [order.items]
  );
  const readyItems = useMemo(
    () => order.items?.filter(i => i.status === 'ready') || [],
    [order.items]
  );

  const allItemsReady = readyItems.length === order.items?.length;
  const canBump = order.order_status === 'ready' || allItemsReady;

  const handleBumpOrder = useCallback(() => {
    onBumpOrder?.(order.order_id);
  }, [order.order_id, onBumpOrder]);

  const handleRecallOrder = useCallback(() => {
    onRecallOrder?.(order.order_id);
  }, [order.order_id, onRecallOrder]);

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm border overflow-hidden',
        getPriorityBorder(order.priority),
        order.priority >= 4 && 'ring-2 ring-orange-200',
        canBump && 'ring-2 ring-green-300',
        needsDeliveryAttention && 'ring-2 ring-purple-300 animate-pulse'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between',
          isDeliveryOrder ? 'bg-purple-600' : orderTypeConfig.color,
          'text-white'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Delivery truck icon */}
          {isDeliveryOrder && (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          )}
          <span className="text-2xl font-bold">{order.display_number}</span>
          {order.table_number && !isDeliveryOrder && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
              Mesa {order.table_number}
            </span>
          )}
          {isDeliveryOrder && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
              DELIVERY
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Priority indicator */}
          {order.priority >= 4 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
              URGENTE
            </span>
          )}

          {/* Delivery status quick badge */}
          {isDeliveryOrder && order.delivery_status && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              order.delivery_status === 'pending_assignment' && 'bg-amber-400 text-amber-900',
              order.delivery_status === 'driver_assigned' && 'bg-blue-400 text-blue-900',
              order.delivery_status === 'picked_up' && 'bg-indigo-400 text-indigo-900',
              order.delivery_status === 'in_transit' && 'bg-purple-400 text-purple-900',
            )}>
              {DELIVERY_STATUS_INFO[order.delivery_status]?.label}
            </span>
          )}

          {/* Elapsed time */}
          <span className={cn('font-mono text-lg font-bold', getElapsedColor(elapsedMinutes))}>
            {elapsedMinutes}m
          </span>
        </div>
      </div>

      {/* Order info */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className={cn('px-2 py-0.5 rounded-full text-xs', statusConfig.color, statusConfig.bgColor)}>
            {statusConfig.label}
          </span>
          <span className="text-slate-500">
            {formatTime(order.ordered_at)}
          </span>
        </div>

        {order.estimated_prep_time && (
          <span className="text-slate-500 text-xs">
            Est: {order.estimated_prep_time}min
          </span>
        )}
      </div>

      {/* Delivery Info Section */}
      {showDeliveryDetails && isDeliveryOrder && (
        <DeliveryInfo order={order} />
      )}

      {/* Notes */}
      {(order.customer_notes || order.kitchen_notes) && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
          {order.customer_notes && (
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Cliente:</span> {order.customer_notes}
            </p>
          )}
          {order.kitchen_notes && (
            <p className="text-xs text-amber-800 mt-1">
              <span className="font-semibold">Cocina:</span> {order.kitchen_notes}
            </p>
          )}
        </div>
      )}

      {/* Items */}
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {order.items?.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            onStart={() => onStartItem?.(item.id)}
            onBump={() => onBumpItem?.(item.id)}
            onCancel={() => onCancelItem?.(item.id)}
            showStation={showStation}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="text-yellow-600">{pendingItems.length} pendiente</span>
          <span>•</span>
          <span className="text-orange-600">{preparingItems.length} preparando</span>
          <span>•</span>
          <span className="text-green-600">{readyItems.length} listo</span>
        </div>
        <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${(readyItems.length / (order.items?.length || 1)) * 100}%` }}
          />
          <div
            className="bg-orange-500 transition-all"
            style={{ width: `${(preparingItems.length / (order.items?.length || 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex gap-2">
        {canBump && onBumpOrder && (
          <button
            onClick={handleBumpOrder}
            className="flex-1 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            ✓ BUMP ORDER
          </button>
        )}
        {order.order_status === 'served' && onRecallOrder && (
          <button
            onClick={handleRecallOrder}
            className="flex-1 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
          >
            ↩ RECALL
          </button>
        )}
        {onPriorityChange && order.priority < 5 && (
          <button
            onClick={() => onPriorityChange(order.order_id, Math.min(5, order.priority + 1))}
            className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            ⬆ RUSH
          </button>
        )}
      </div>
    </div>
  );
}

export default KDSOrderCard;
