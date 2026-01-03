'use client';

// =====================================================
// TIS TIS PLATFORM - KDS Order Card Component
// Individual order card for Kitchen Display System
// =====================================================

import { useMemo, useCallback } from 'react';
import { cn } from '@/shared/utils';
import type {
  KDSOrderView,
  KDSOrderItemView,
  OrderItemStatus,
} from '../types';
import {
  ORDER_TYPE_CONFIG,
  ORDER_STATUS_CONFIG,
  ITEM_STATUS_CONFIG,
  STATION_CONFIG,
  PRIORITY_CONFIG,
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
}: KDSOrderCardProps) {
  const orderTypeConfig = ORDER_TYPE_CONFIG[order.order_type];
  const statusConfig = ORDER_STATUS_CONFIG[order.order_status];
  const elapsedMinutes = Math.floor(order.minutes_elapsed);

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
        canBump && 'ring-2 ring-green-300'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between',
          orderTypeConfig.color,
          'text-white'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">{order.display_number}</span>
          {order.table_number && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
              Mesa {order.table_number}
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
