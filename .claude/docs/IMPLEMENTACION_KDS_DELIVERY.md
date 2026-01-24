# FASE 3: Integracion KDS con Sistema de Delivery

**Version:** 1.0.0
**Fecha:** 2026-01-24
**Documento Padre:** IMPLEMENTACION_UNIFICACION_AGENTES_V1.md

---

## INDICE

1. [Badges de Tipo de Orden](#1-badges-de-tipo-de-orden)
2. [Panel de Delivery](#2-panel-de-delivery)
3. [Sistema de Notificaciones](#3-sistema-de-notificaciones)
4. [Asignacion de Repartidores](#4-asignacion-de-repartidores)
5. [Flujo Completo en KDS](#5-flujo-completo-en-kds)

---

## 1. BADGES DE TIPO DE ORDEN

### 1.1 Componente OrderTypeBadge

Muestra visualmente el tipo de orden en cada ticket del KDS.

#### Archivo: `components/kds/OrderTypeBadge.tsx`

```tsx
/**
 * TIS TIS Platform - Order Type Badge
 * Badge visual para identificar tipo de orden en KDS
 */

'use client';

import { cn } from '@/lib/utils';
import { Store, ShoppingBag, Truck, Car } from 'lucide-react';

type OrderType = 'dine_in' | 'pickup' | 'delivery' | 'drive_thru';

interface OrderTypeBadgeProps {
  orderType: OrderType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const ORDER_TYPE_CONFIG: Record<OrderType, {
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  dine_in: {
    label: 'En Restaurante',
    shortLabel: 'Mesa',
    icon: Store,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
  },
  pickup: {
    label: 'Para Recoger',
    shortLabel: 'Pickup',
    icon: ShoppingBag,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
  },
  delivery: {
    label: 'Delivery',
    shortLabel: 'Delivery',
    icon: Truck,
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300',
  },
  drive_thru: {
    label: 'Drive Thru',
    shortLabel: 'Drive',
    icon: Car,
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
  },
};

export function OrderTypeBadge({
  orderType,
  size = 'md',
  showLabel = true,
  className,
}: OrderTypeBadgeProps) {
  const config = ORDER_TYPE_CONFIG[orderType];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && (
        <span>{size === 'sm' ? config.shortLabel : config.label}</span>
      )}
    </span>
  );
}

// Version simplificada solo icono con tooltip
export function OrderTypeIcon({
  orderType,
  size = 'md',
  className,
}: Omit<OrderTypeBadgeProps, 'showLabel'>) {
  const config = ORDER_TYPE_CONFIG[orderType];
  const Icon = config.icon;

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full p-1.5',
        config.bgColor,
        config.textColor,
        className
      )}
      title={config.label}
    >
      <Icon className={iconSizes[size]} />
    </span>
  );
}

export default OrderTypeBadge;
```

### 1.2 Integracion en KDS Ticket

#### Modificar: `components/kds/KDSTicket.tsx`

```tsx
// Agregar import
import { OrderTypeBadge } from './OrderTypeBadge';

// En el componente, agregar el badge en el header del ticket:
function KDSTicketHeader({ order }: { order: KDSOrder }) {
  return (
    <div className="flex items-center justify-between p-3 border-b">
      {/* Numero de orden */}
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-slate-900">
          #{order.display_number}
        </span>
        {/* NUEVO: Badge de tipo */}
        <OrderTypeBadge orderType={order.order_type} size="sm" />
      </div>

      {/* Timer y status */}
      <div className="flex items-center gap-2">
        <OrderTimer createdAt={order.created_at} />
        <OrderStatusBadge status={order.status} />
      </div>
    </div>
  );
}

// Para ordenes de delivery, mostrar direccion resumida:
function KDSTicketBody({ order }: { order: KDSOrder }) {
  return (
    <div className="p-3 space-y-3">
      {/* Info de delivery si aplica */}
      {order.order_type === 'delivery' && order.delivery_address && (
        <DeliveryInfoCompact address={order.delivery_address} />
      )}

      {/* Items del pedido */}
      <OrderItemsList items={order.items} />
    </div>
  );
}

// Componente para info de delivery compacta
function DeliveryInfoCompact({
  address,
}: {
  address: DeliveryAddress;
}) {
  return (
    <div className="bg-green-50 rounded-lg p-2 border border-green-200">
      <div className="flex items-start gap-2">
        <Truck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-800 truncate">
            {address.contact_name}
          </p>
          <p className="text-xs text-green-600 truncate">
            {address.street} #{address.exterior_number}, {address.colony}
          </p>
          {address.reference && (
            <p className="text-xs text-green-500 truncate mt-0.5">
              Ref: {address.reference}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 2. PANEL DE DELIVERY

### 2.1 Componente DeliveryPanel

Panel lateral o pestana dedicada a ordenes de delivery.

#### Archivo: `components/kds/DeliveryPanel.tsx`

```tsx
/**
 * TIS TIS Platform - KDS Delivery Panel
 * Panel dedicado para gestionar ordenes de delivery
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Clock,
  MapPin,
  Phone,
  User,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeliveryOrders } from '@/src/features/kds/hooks/useDeliveryOrders';
import { OrderTypeBadge } from './OrderTypeBadge';
import { AssignDriverModal } from './AssignDriverModal';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeliveryPanelProps {
  branchId: string;
  onOrderClick?: (orderId: string) => void;
}

type DeliveryStatusFilter = 'all' | 'pending' | 'assigned' | 'in_transit';

const STATUS_TABS = [
  { key: 'pending', label: 'Pendientes', color: 'bg-amber-500' },
  { key: 'assigned', label: 'Asignados', color: 'bg-blue-500' },
  { key: 'in_transit', label: 'En Camino', color: 'bg-green-500' },
  { key: 'all', label: 'Todos', color: 'bg-slate-500' },
] as const;

export function DeliveryPanel({ branchId, onOrderClick }: DeliveryPanelProps) {
  const [filter, setFilter] = useState<DeliveryStatusFilter>('pending');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const {
    orders,
    isLoading,
    error,
    refetch,
    updateDeliveryStatus,
  } = useDeliveryOrders(branchId, filter);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Contar ordenes por estado
  const counts = {
    pending: orders.filter((o) => o.delivery_status === 'pending').length,
    assigned: orders.filter((o) => o.delivery_status === 'assigned').length,
    in_transit: orders.filter((o) => o.delivery_status === 'in_transit').length,
    all: orders.length,
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold text-slate-900">Delivery</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`
                flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors
                ${filter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`
                  ml-1 px-1.5 py-0.5 rounded-full text-xs
                  ${filter === tab.key ? 'bg-white/20' : 'bg-slate-300'}
                `}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && orders.length === 0 && (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Cargando...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
            <AlertCircle className="h-4 w-4" />
            Error al cargar ordenes
          </div>
        )}

        {!isLoading && orders.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay ordenes de delivery</p>
          </div>
        )}

        <AnimatePresence>
          {orders.map((order) => (
            <motion.div
              key={order.order_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <DeliveryOrderCard
                order={order}
                isSelected={selectedOrder === order.order_id}
                onClick={() => {
                  setSelectedOrder(order.order_id);
                  onOrderClick?.(order.order_id);
                }}
                onAssignDriver={() => {
                  setSelectedOrder(order.order_id);
                  setShowAssignModal(true);
                }}
                onUpdateStatus={updateDeliveryStatus}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Assign Driver Modal */}
      <AssignDriverModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        orderId={selectedOrder}
        onAssign={async (driverId) => {
          if (selectedOrder) {
            await updateDeliveryStatus(selectedOrder, 'assigned', driverId);
            setShowAssignModal(false);
          }
        }}
      />
    </div>
  );
}

// =====================================================
// DELIVERY ORDER CARD
// =====================================================

interface DeliveryOrderCardProps {
  order: DeliveryOrder;
  isSelected: boolean;
  onClick: () => void;
  onAssignDriver: () => void;
  onUpdateStatus: (orderId: string, status: string, driverId?: string) => Promise<void>;
}

function DeliveryOrderCard({
  order,
  isSelected,
  onClick,
  onAssignDriver,
  onUpdateStatus,
}: DeliveryOrderCardProps) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700' },
    assigned: { label: 'Asignado', color: 'bg-blue-100 text-blue-700' },
    picked_up: { label: 'Recogido', color: 'bg-indigo-100 text-indigo-700' },
    in_transit: { label: 'En Camino', color: 'bg-green-100 text-green-700' },
    delivered: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-700' },
    failed: { label: 'Fallido', color: 'bg-red-100 text-red-700' },
  };

  const config = statusConfig[order.delivery_status] || statusConfig.pending;
  const timeAgo = formatDistanceToNow(new Date(order.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div
      className={`
        p-3 rounded-lg border cursor-pointer transition-all
        ${isSelected
          ? 'border-green-500 bg-green-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
        }
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-900">
            #{order.display_number}
          </span>
          <Badge className={config.color}>{config.label}</Badge>
        </div>
        <span className="text-xs text-slate-500">{timeAgo}</span>
      </div>

      {/* Direccion */}
      <div className="flex items-start gap-2 mb-2">
        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-slate-700 truncate">
            {order.delivery_address.street} #{order.delivery_address.exterior_number}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {order.delivery_address.colony}
          </p>
        </div>
      </div>

      {/* Contacto */}
      <div className="flex items-center gap-4 text-xs text-slate-600 mb-3">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {order.delivery_address.contact_name}
        </span>
        <span className="flex items-center gap-1">
          <Phone className="h-3 w-3" />
          {order.delivery_address.contact_phone}
        </span>
      </div>

      {/* Items preview */}
      <div className="text-xs text-slate-500 mb-3">
        {order.items.slice(0, 2).map((item, i) => (
          <span key={i}>
            {i > 0 && ', '}
            {item.quantity}x {item.name}
          </span>
        ))}
        {order.items.length > 2 && ` +${order.items.length - 2} mas`}
      </div>

      {/* Driver info o boton asignar */}
      {order.driver ? (
        <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-md">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
            {order.driver.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {order.driver.name}
            </p>
            <p className="text-xs text-slate-500">{order.driver.phone}</p>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onAssignDriver();
          }}
        >
          <User className="h-4 w-4 mr-2" />
          Asignar Repartidor
        </Button>
      )}

      {/* Acciones rapidas segun estado */}
      {order.delivery_status === 'assigned' && (
        <Button
          size="sm"
          className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700"
          onClick={(e) => {
            e.stopPropagation();
            onUpdateStatus(order.order_id, 'picked_up');
          }}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Marcar Recogido
        </Button>
      )}

      {order.delivery_status === 'picked_up' && (
        <Button
          size="sm"
          className="w-full mt-2 bg-green-600 hover:bg-green-700"
          onClick={(e) => {
            e.stopPropagation();
            onUpdateStatus(order.order_id, 'in_transit');
          }}
        >
          <Truck className="h-4 w-4 mr-2" />
          En Camino
        </Button>
      )}

      {order.delivery_status === 'in_transit' && (
        <Button
          size="sm"
          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700"
          onClick={(e) => {
            e.stopPropagation();
            onUpdateStatus(order.order_id, 'delivered');
          }}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Marcar Entregado
        </Button>
      )}

      {/* Total y tiempo estimado */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Est: {order.estimated_delivery_time
            ? formatDistanceToNow(new Date(order.estimated_delivery_time), { locale: es })
            : 'N/A'}
        </span>
        <span className="text-sm font-semibold text-slate-900">
          ${order.total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default DeliveryPanel;
```

### 2.2 Hook useDeliveryOrders

#### Archivo: `src/features/kds/hooks/useDeliveryOrders.ts`

```typescript
/**
 * TIS TIS Platform - Delivery Orders Hook
 * Hook para manejar ordenes de delivery en KDS
 */

import { useState, useEffect, useCallback } from 'react';
import type { DeliveryOrder } from '@/src/shared/types/delivery';

type DeliveryStatusFilter = 'all' | 'pending' | 'assigned' | 'in_transit';

interface UseDeliveryOrdersReturn {
  orders: DeliveryOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateDeliveryStatus: (
    orderId: string,
    status: string,
    driverId?: string
  ) => Promise<void>;
}

export function useDeliveryOrders(
  branchId: string,
  filter: DeliveryStatusFilter = 'all'
): UseDeliveryOrdersReturn {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        branch_id: branchId,
        status: filter,
        limit: '50',
      });

      const response = await fetch(`/api/restaurant/delivery/orders?${params}`);

      if (!response.ok) {
        throw new Error('Error al cargar ordenes');
      }

      const data = await response.json();
      setOrders(data.data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, [branchId, filter]);

  const updateDeliveryStatus = useCallback(async (
    orderId: string,
    status: string,
    driverId?: string
  ) => {
    try {
      const response = await fetch(`/api/restaurant/delivery/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, driver_id: driverId }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar estado');
      }

      // Actualizar orden localmente
      setOrders((prev) =>
        prev.map((order) =>
          order.order_id === orderId
            ? { ...order, delivery_status: status as DeliveryOrder['delivery_status'] }
            : order
        )
      );

      // Refetch para asegurar consistencia
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    error,
    refetch: fetchOrders,
    updateDeliveryStatus,
  };
}
```

---

## 3. SISTEMA DE NOTIFICACIONES

### 3.1 Notificaciones de Nuevas Ordenes de Delivery

#### Archivo: `components/kds/DeliveryNotifications.tsx`

```tsx
/**
 * TIS TIS Platform - Delivery Notifications
 * Sistema de notificaciones para nuevas ordenes de delivery
 */

'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface DeliveryNotificationsProps {
  branchId: string;
  enabled?: boolean;
  soundEnabled?: boolean;
}

export function DeliveryNotifications({
  branchId,
  enabled = true,
  soundEnabled = true,
}: DeliveryNotificationsProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Cargar audio de notificacion
    if (soundEnabled) {
      audioRef.current = new Audio('/sounds/delivery-notification.mp3');
      audioRef.current.volume = 0.7;
    }

    const supabase = createClient();

    // Suscribirse a nuevas ordenes de delivery
    const channel = supabase
      .channel(`delivery-orders-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'restaurant_orders',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const order = payload.new as {
            order_type: string;
            display_number: number;
            delivery_address?: { contact_name?: string };
          };

          // Solo notificar ordenes de delivery
          if (order.order_type === 'delivery') {
            // Reproducir sonido
            if (soundEnabled && audioRef.current) {
              audioRef.current.play().catch(console.error);
            }

            // Mostrar toast
            toast.custom(
              (t) => (
                <div className="bg-green-600 text-white rounded-lg p-4 shadow-lg flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Nueva Orden de Delivery</p>
                    <p className="text-sm text-white/80">
                      Pedido #{order.display_number}
                      {order.delivery_address?.contact_name &&
                        ` - ${order.delivery_address.contact_name}`}
                    </p>
                  </div>
                </div>
              ),
              {
                duration: 10000,
                position: 'top-right',
              }
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurant_orders',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const order = payload.new as {
            order_type: string;
            display_number: number;
            delivery_status: string;
          };
          const oldOrder = payload.old as { delivery_status: string };

          // Notificar cambios de estado importantes
          if (
            order.order_type === 'delivery' &&
            order.delivery_status !== oldOrder.delivery_status
          ) {
            if (order.delivery_status === 'delivered') {
              toast.success(
                `Pedido #${order.display_number} entregado exitosamente`
              );
            } else if (order.delivery_status === 'failed') {
              toast.error(
                `Fallo en entrega del pedido #${order.display_number}`
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, enabled, soundEnabled]);

  return null;
}

export default DeliveryNotifications;
```

### 3.2 Integracion en KDS Layout

#### Modificar: `app/dashboard/kds/page.tsx`

```tsx
// Agregar el componente de notificaciones
import { DeliveryNotifications } from '@/components/kds/DeliveryNotifications';
import { DeliveryPanel } from '@/components/kds/DeliveryPanel';

export default function KDSPage() {
  const { branchId, settings } = useKDSContext();

  return (
    <div className="h-screen flex">
      {/* Notificaciones de delivery */}
      <DeliveryNotifications
        branchId={branchId}
        enabled={settings.deliveryNotifications}
        soundEnabled={settings.soundEnabled}
      />

      {/* Area principal del KDS */}
      <div className="flex-1">
        <KDSBoard branchId={branchId} />
      </div>

      {/* Panel lateral de Delivery */}
      {settings.showDeliveryPanel && (
        <div className="w-96">
          <DeliveryPanel branchId={branchId} />
        </div>
      )}
    </div>
  );
}
```

---

## 4. ASIGNACION DE REPARTIDORES

### 4.1 Modal de Asignacion

#### Archivo: `components/kds/AssignDriverModal.tsx`

```tsx
/**
 * TIS TIS Platform - Assign Driver Modal
 * Modal para asignar repartidor a una orden
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Phone,
  Truck,
  CheckCircle,
  X,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  available: boolean;
  active_orders: number;
}

interface AssignDriverModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  onAssign: (driverId: string) => Promise<void>;
}

export function AssignDriverModal({
  open,
  onClose,
  orderId,
  onAssign,
}: AssignDriverModalProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cargar lista de repartidores
  useEffect(() => {
    if (open) {
      fetchDrivers();
    }
  }, [open]);

  const fetchDrivers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/staff/drivers?available=true');
      if (response.ok) {
        const data = await response.json();
        setDrivers(data.data.drivers);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedDriver || !orderId) return;

    setIsAssigning(true);
    try {
      await onAssign(selectedDriver);
      onClose();
    } catch (error) {
      console.error('Error assigning driver:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  // Filtrar repartidores por busqueda
  const filteredDrivers = drivers.filter((driver) => {
    const fullName = `${driver.first_name} ${driver.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  // Ordenar: disponibles primero, luego por numero de ordenes activas
  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    if (a.available !== b.available) {
      return a.available ? -1 : 1;
    }
    return a.active_orders - b.active_orders;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-green-600" />
            Asignar Repartidor
          </DialogTitle>
        </DialogHeader>

        {/* Busqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar repartidor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Lista de repartidores */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              Cargando repartidores...
            </div>
          ) : sortedDrivers.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay repartidores disponibles</p>
            </div>
          ) : (
            sortedDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                isSelected={selectedDriver === driver.id}
                onClick={() => setSelectedDriver(driver.id)}
              />
            ))
          )}
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedDriver || isAssigning}
            className="bg-green-600 hover:bg-green-700"
          >
            {isAssigning ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                />
                Asignando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Asignar
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// DRIVER CARD
// =====================================================

interface DriverCardProps {
  driver: Driver;
  isSelected: boolean;
  onClick: () => void;
}

function DriverCard({ driver, isSelected, onClick }: DriverCardProps) {
  const fullName = `${driver.first_name} ${driver.last_name}`;
  const initials = `${driver.first_name[0]}${driver.last_name[0]}`;

  return (
    <button
      onClick={onClick}
      disabled={!driver.available}
      className={`
        w-full p-3 rounded-lg border text-left transition-all
        ${isSelected
          ? 'border-green-500 bg-green-50'
          : driver.available
            ? 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center text-white font-medium
          ${driver.available ? 'bg-green-500' : 'bg-slate-400'}
        `}>
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900 truncate">{fullName}</p>
            {driver.active_orders > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                {driver.active_orders} pedido{driver.active_orders > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {driver.phone}
          </p>
        </div>

        {isSelected && (
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
        )}
      </div>
    </button>
  );
}

export default AssignDriverModal;
```

---

## 5. FLUJO COMPLETO EN KDS

### 5.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE ORDEN DELIVERY EN KDS                        │
└─────────────────────────────────────────────────────────────────────────┘

  AI AGENT              COCINA/KDS                DELIVERY PANEL
     │                      │                          │
     │  Crea orden          │                          │
     │  order_type=delivery │                          │
     │─────────────────────>│                          │
     │                      │                          │
     │                      │  Notificacion sonora     │
     │                      │  + toast "Nueva orden    │
     │                      │    delivery #47"         │
     │                      │                          │
     │                      │  Ticket aparece en KDS   │
     │                      │  con badge DELIVERY      │
     │                      │─────────────────────────>│
     │                      │                          │
     │                      │                    Orden aparece en
     │                      │                    panel "Pendientes"
     │                      │                          │
     │                      │                    Staff asigna
     │                      │                    repartidor
     │                      │<─────────────────────────│
     │                      │                          │
     │                      │  Estado: ASSIGNED        │
     │                      │                          │
     │                      │  Cocina prepara orden    │
     │                      │                          │
     │                      │  Cocina marca como       │
     │                      │  LISTA                   │
     │                      │─────────────────────────>│
     │                      │                          │
     │                      │                    Notificacion a
     │                      │                    repartidor
     │                      │                          │
     │                      │                    Repartidor recoge
     │                      │                    → PICKED_UP
     │                      │                          │
     │                      │                    Repartidor en
     │                      │                    camino → IN_TRANSIT
     │                      │                          │
     │                      │                    Entrega exitosa
     │                      │                    → DELIVERED
     │                      │                          │
     │  Cliente recibe      │                          │
     │  notificacion de     │<─────────────────────────│
     │  entrega             │                          │
     │                      │                          │
```

### 5.2 Estados de Orden en KDS

| Estado Orden | Estado Delivery | Ubicacion en KDS | Color |
|--------------|-----------------|------------------|-------|
| pending | pending | Columna "Nuevos" | Naranja |
| pending | assigned | Columna "Nuevos" | Azul |
| in_progress | assigned | Columna "En Preparacion" | Azul |
| in_progress | picked_up | Columna "En Preparacion" | Indigo |
| ready | in_transit | Columna "Listos" (delivery panel) | Verde |
| completed | delivered | Historial | Verde oscuro |
| cancelled | failed | Historial | Rojo |

### 5.3 Configuracion KDS para Delivery

#### Archivo: `src/features/kds/config/kds-settings.ts`

```typescript
/**
 * TIS TIS Platform - KDS Settings
 * Configuracion del Kitchen Display System
 */

export interface KDSSettings {
  // General
  autoRefreshInterval: number; // segundos
  soundEnabled: boolean;

  // Delivery
  showDeliveryPanel: boolean;
  deliveryNotifications: boolean;
  deliveryPanelPosition: 'left' | 'right';
  deliveryPanelWidth: number; // pixels

  // Filtros
  defaultOrderFilter: 'all' | 'dine_in' | 'pickup' | 'delivery';
  showCompletedOrders: boolean;
  completedOrdersTimeout: number; // minutos

  // Display
  ticketSize: 'compact' | 'normal' | 'large';
  columnsLayout: 'auto' | '2' | '3' | '4';
  showItemModifiers: boolean;
  showOrderNotes: boolean;
}

export const DEFAULT_KDS_SETTINGS: KDSSettings = {
  autoRefreshInterval: 10,
  soundEnabled: true,

  showDeliveryPanel: true,
  deliveryNotifications: true,
  deliveryPanelPosition: 'right',
  deliveryPanelWidth: 384,

  defaultOrderFilter: 'all',
  showCompletedOrders: true,
  completedOrdersTimeout: 30,

  ticketSize: 'normal',
  columnsLayout: 'auto',
  showItemModifiers: true,
  showOrderNotes: true,
};
```

---

## Checklist de Implementacion

- [ ] Componente OrderTypeBadge creado
- [ ] Integracion de badges en KDS Ticket
- [ ] Componente DeliveryPanel creado
- [ ] Hook useDeliveryOrders implementado
- [ ] Sistema de notificaciones real-time
- [ ] Modal AssignDriverModal creado
- [ ] API para obtener repartidores disponibles
- [ ] Configuracion de KDS actualizada
- [ ] Tests de componentes
- [ ] Tests de integracion

---

**Documento generado por Claude Opus 4.5**
**Fecha:** 2026-01-24
