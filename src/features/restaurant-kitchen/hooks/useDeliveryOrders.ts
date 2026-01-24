'use client';

// =====================================================
// TIS TIS PLATFORM - Delivery Orders Hook
// React hook para gestión de órdenes de delivery en KDS
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Types: src/shared/types/delivery-types.ts
// - Types: src/features/restaurant-kitchen/types/index.ts
// - Components: DeliveryPanel.tsx, DeliveryNotifications.tsx
// =====================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/src/shared/lib/supabase';
import type {
  KDSDeliveryOrderView,
  KDSDeliveryStats,
  KDSDeliveryFilter,
  DeliveryStatus,
  DeliveryDriver,
  DriverAssignmentResult,
} from '../types';

// ======================
// TYPES
// ======================

interface UseDeliveryOrdersOptions {
  branch_id?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableRealtime?: boolean;
  enableNotifications?: boolean;
  // Callbacks de eventos (opcionales)
  onNewDeliveryOrder?: (order: KDSDeliveryOrderView) => void;
  onStatusChange?: (orderId: string, oldStatus: DeliveryStatus, newStatus: DeliveryStatus) => void;
  onDriverAssigned?: (orderId: string, driver: DeliveryDriver) => void;
}

interface DeliveryOrdersState {
  orders: KDSDeliveryOrderView[];
  stats: KDSDeliveryStats;
  drivers: DeliveryDriver[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

interface UseDeliveryOrdersReturn extends DeliveryOrdersState {
  // Filtrado
  filter: KDSDeliveryFilter;
  setFilter: (filter: KDSDeliveryFilter) => void;
  filteredOrders: KDSDeliveryOrderView[];

  // Acciones de delivery
  assignDriver: (orderId: string, driverId: string) => Promise<DriverAssignmentResult>;
  autoAssignDriver: (orderId: string) => Promise<DriverAssignmentResult>;
  unassignDriver: (orderId: string) => Promise<void>;
  updateDeliveryStatus: (orderId: string, status: DeliveryStatus, notes?: string) => Promise<void>;
  markAsReady: (orderId: string) => Promise<void>;
  markAsPickedUp: (orderId: string) => Promise<void>;
  markAsDelivered: (orderId: string) => Promise<void>;
  markAsFailed: (orderId: string, reason: string) => Promise<void>;
  retryDelivery: (orderId: string) => Promise<void>;

  // Drivers
  fetchDrivers: () => Promise<void>;
  getAvailableDrivers: () => DeliveryDriver[];

  // Refresh
  refresh: () => Promise<void>;
}

// ======================
// API HELPERS
// ======================

const API_BASE = '/api/restaurant/kitchen';
const DELIVERY_API = '/api/restaurant/delivery';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data.data;
}

// ======================
// DEFAULT STATS
// ======================

const DEFAULT_STATS: KDSDeliveryStats = {
  pending_assignment: 0,
  driver_assigned: 0,
  in_transit: 0,
  ready_for_pickup: 0,
  total_active: 0,
};

// ======================
// HOOK
// ======================

export function useDeliveryOrders(options: UseDeliveryOrdersOptions = {}): UseDeliveryOrdersReturn {
  const {
    branch_id,
    autoRefresh = true,
    refreshInterval = 15000, // 15 segundos para delivery (más frecuente)
    enableRealtime = true,
    enableNotifications = true,
    // Callbacks de eventos
    onNewDeliveryOrder,
    onStatusChange,
    onDriverAssigned,
  } = options;

  // State
  const [orders, setOrders] = useState<KDSDeliveryOrderView[]>([]);
  const [stats, setStats] = useState<KDSDeliveryStats>(DEFAULT_STATS);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [filter, setFilter] = useState<KDSDeliveryFilter>('all');

  // Refs para callbacks de eventos (para evitar re-renders innecesarios)
  const onNewDeliveryOrderRef = useRef(onNewDeliveryOrder);
  const onStatusChangeRef = useRef(onStatusChange);
  const onDriverAssignedRef = useRef(onDriverAssigned);

  // Actualizar refs cuando cambian los callbacks
  onNewDeliveryOrderRef.current = onNewDeliveryOrder;
  onStatusChangeRef.current = onStatusChange;
  onDriverAssignedRef.current = onDriverAssigned;

  // Ref para tracking de órdenes previas (para detectar nuevas)
  const previousOrdersRef = useRef<Map<string, KDSDeliveryOrderView>>(new Map());

  // ======================
  // DATA FETCHING
  // ======================

  const fetchDeliveryOrders = useCallback(async () => {
    if (!branch_id) return;

    try {
      setError(null);
      const headers = await getAuthHeaders();

      const response = await fetch(
        `${API_BASE}/delivery?branch_id=${branch_id}`,
        { headers }
      );

      const data = await handleResponse<{
        orders: KDSDeliveryOrderView[];
        stats: KDSDeliveryStats;
      }>(response);

      // Detectar nuevas órdenes y cambios de estado
      if (enableNotifications) {
        const previousOrders = previousOrdersRef.current;

        data.orders.forEach(order => {
          const previousOrder = previousOrders.get(order.order_id);

          if (!previousOrder) {
            // Nueva orden
            onNewDeliveryOrderRef.current?.(order);
          } else if (previousOrder.delivery_status !== order.delivery_status) {
            // Cambio de estado
            onStatusChangeRef.current?.(
              order.order_id,
              previousOrder.delivery_status,
              order.delivery_status
            );
          }
        });

        // Actualizar mapa de órdenes previas
        previousOrdersRef.current = new Map(
          data.orders.map(o => [o.order_id, o])
        );
      }

      setOrders(data.orders);
      setStats(data.stats);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[useDeliveryOrders] Error fetching delivery orders:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar órdenes de delivery');
    } finally {
      setLoading(false);
    }
  }, [branch_id, enableNotifications]);

  const fetchDrivers = useCallback(async () => {
    if (!branch_id) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${DELIVERY_API}/drivers?branch_id=${branch_id}`,
        { headers }
      );

      const data = await handleResponse<DeliveryDriver[]>(response);
      setDrivers(data);
    } catch (err) {
      console.error('[useDeliveryOrders] Error fetching drivers:', err);
    }
  }, [branch_id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchDeliveryOrders(), fetchDrivers()]);
  }, [fetchDeliveryOrders, fetchDrivers]);

  // Initial fetch
  useEffect(() => {
    if (branch_id) {
      refresh();
    } else {
      setLoading(false);
    }
  }, [branch_id, refresh]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !branch_id) return;

    const interval = setInterval(fetchDeliveryOrders, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, branch_id, refreshInterval, fetchDeliveryOrders]);

  // ======================
  // REALTIME SUBSCRIPTIONS
  // ======================

  useEffect(() => {
    if (!enableRealtime || !branch_id) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isMounted) {
          fetchDeliveryOrders();
        }
      }, 200); // 200ms debounce para delivery (más responsivo)
    };

    // Suscripción a cambios de órdenes de delivery
    const deliveryChannel = supabase
      .channel(`delivery-orders-${branch_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_orders',
          filter: `branch_id=eq.${branch_id}`,
        },
        (payload) => {
          // Solo refrescar si es una orden de delivery
          const newRecord = payload.new as Record<string, unknown> | undefined;
          if (newRecord?.order_type === 'delivery') {
            debouncedFetch();
          }
        }
      )
      .subscribe();

    // Suscripción a tracking de delivery
    const trackingChannel = supabase
      .channel(`delivery-tracking-${branch_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_tracking',
        },
        () => {
          debouncedFetch();
        }
      )
      .subscribe();

    // Suscripción a cambios de drivers
    const driversChannel = supabase
      .channel(`delivery-drivers-${branch_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_drivers',
        },
        () => {
          fetchDrivers();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(deliveryChannel);
      supabase.removeChannel(trackingChannel);
      supabase.removeChannel(driversChannel);
    };
  }, [enableRealtime, branch_id, fetchDeliveryOrders, fetchDrivers]);

  // ======================
  // FILTERED ORDERS
  // ======================

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

  // ======================
  // DELIVERY ACTIONS
  // ======================

  const assignDriver = useCallback(async (
    orderId: string,
    driverId: string
  ): Promise<DriverAssignmentResult> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${DELIVERY_API}/assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ order_id: orderId, driver_id: driverId }),
    });

    const result = await handleResponse<DriverAssignmentResult>(response);

    // Notificar asignación
    if (result.success && result.driver_id) {
      const driver = drivers.find(d => d.id === result.driver_id);
      if (driver) {
        onDriverAssignedRef.current?.(orderId, driver);
      }
    }

    await fetchDeliveryOrders();
    return result;
  }, [drivers, fetchDeliveryOrders]);

  const autoAssignDriver = useCallback(async (
    orderId: string
  ): Promise<DriverAssignmentResult> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${DELIVERY_API}/assign/auto`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ order_id: orderId }),
    });

    const result = await handleResponse<DriverAssignmentResult>(response);
    await fetchDeliveryOrders();
    return result;
  }, [fetchDeliveryOrders]);

  const unassignDriver = useCallback(async (orderId: string): Promise<void> => {
    const headers = await getAuthHeaders();
    await fetch(`${DELIVERY_API}/assign/${orderId}`, {
      method: 'DELETE',
      headers,
    });
    await fetchDeliveryOrders();
  }, [fetchDeliveryOrders]);

  const updateDeliveryStatus = useCallback(async (
    orderId: string,
    status: DeliveryStatus,
    notes?: string
  ): Promise<void> => {
    const headers = await getAuthHeaders();
    await fetch(`${DELIVERY_API}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ order_id: orderId, status, notes }),
    });
    await fetchDeliveryOrders();
  }, [fetchDeliveryOrders]);

  const markAsReady = useCallback(async (orderId: string): Promise<void> => {
    // Actualizar el status de la orden a 'ready' (esto activa notificación al driver)
    const headers = await getAuthHeaders();
    await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'ready' }),
    });
    await fetchDeliveryOrders();
  }, [fetchDeliveryOrders]);

  const markAsPickedUp = useCallback(async (orderId: string): Promise<void> => {
    await updateDeliveryStatus(orderId, 'picked_up');
  }, [updateDeliveryStatus]);

  const markAsDelivered = useCallback(async (orderId: string): Promise<void> => {
    await updateDeliveryStatus(orderId, 'delivered');
  }, [updateDeliveryStatus]);

  const markAsFailed = useCallback(async (
    orderId: string,
    reason: string
  ): Promise<void> => {
    await updateDeliveryStatus(orderId, 'failed', reason);
  }, [updateDeliveryStatus]);

  const retryDelivery = useCallback(async (orderId: string): Promise<void> => {
    await updateDeliveryStatus(orderId, 'pending_assignment');
  }, [updateDeliveryStatus]);

  // ======================
  // DRIVER HELPERS
  // ======================

  const getAvailableDrivers = useCallback((): DeliveryDriver[] => {
    return drivers.filter(d => d.status === 'available' && d.is_active);
  }, [drivers]);

  // ======================
  // RETURN
  // ======================

  return {
    // State
    orders,
    stats,
    drivers,
    loading,
    error,
    lastUpdate,

    // Filtrado
    filter,
    setFilter,
    filteredOrders,

    // Acciones de delivery
    assignDriver,
    autoAssignDriver,
    unassignDriver,
    updateDeliveryStatus,
    markAsReady,
    markAsPickedUp,
    markAsDelivered,
    markAsFailed,
    retryDelivery,

    // Drivers
    fetchDrivers,
    getAvailableDrivers,

    // Refresh
    refresh,
  };
}

// ======================
// HOOK PARA NOTIFICACIONES
// ======================

interface UseDeliveryNotificationsOptions {
  branch_id?: string;
  enabled?: boolean;
}

interface DeliveryNotificationEvent {
  type: 'new_order' | 'status_change' | 'driver_assigned' | 'order_ready' | 'delivery_failed';
  orderId: string;
  orderNumber: string;
  message: string;
  data?: Record<string, unknown>;
}

export function useDeliveryNotificationsSubscription(
  options: UseDeliveryNotificationsOptions,
  onNotification: (event: DeliveryNotificationEvent) => void
) {
  const { branch_id, enabled = true } = options;

  useEffect(() => {
    if (!enabled || !branch_id) return;

    const channel = supabase
      .channel(`delivery-notifications-${branch_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_orders',
          filter: `branch_id=eq.${branch_id}`,
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown> | undefined;
          const oldRecord = payload.old as Record<string, unknown> | undefined;

          if (newRecord?.order_type !== 'delivery') return;

          const orderId = newRecord.id as string;
          const orderNumber = newRecord.display_number as string;

          // Nueva orden de delivery
          if (payload.eventType === 'INSERT') {
            onNotification({
              type: 'new_order',
              orderId,
              orderNumber,
              message: 'Nueva orden de delivery recibida',
            });
            return;
          }

          // Cambio de estado
          if (payload.eventType === 'UPDATE') {
            const oldStatus = oldRecord?.delivery_status as DeliveryStatus | undefined;
            const newStatus = newRecord.delivery_status as DeliveryStatus | undefined;

            if (oldStatus !== newStatus && newStatus) {
              // Driver asignado
              if (newStatus === 'driver_assigned' && !oldRecord?.delivery_driver_id && newRecord.delivery_driver_id) {
                onNotification({
                  type: 'driver_assigned',
                  orderId,
                  orderNumber,
                  message: 'Repartidor asignado',
                  data: { driverId: newRecord.delivery_driver_id },
                });
                return;
              }

              // Orden lista para recoger
              if (newRecord.status === 'ready' && oldRecord?.status !== 'ready') {
                onNotification({
                  type: 'order_ready',
                  orderId,
                  orderNumber,
                  message: 'Orden lista para recoger',
                });
                return;
              }

              // Entrega fallida
              if (newStatus === 'failed') {
                onNotification({
                  type: 'delivery_failed',
                  orderId,
                  orderNumber,
                  message: 'Entrega fallida',
                  data: { reason: newRecord.delivery_failure_reason },
                });
                return;
              }

              // Cambio de estado genérico
              onNotification({
                type: 'status_change',
                orderId,
                orderNumber,
                message: `Estado actualizado: ${newStatus}`,
                data: { oldStatus, newStatus },
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branch_id, enabled, onNotification]);
}

// ======================
// HOOK PARA STATS EN TIEMPO REAL
// ======================

export function useDeliveryStats(branch_id?: string) {
  const [stats, setStats] = useState<KDSDeliveryStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!branch_id) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/delivery/stats?branch_id=${branch_id}`,
        { headers }
      );

      const data = await handleResponse<KDSDeliveryStats>(response);
      setStats(data);
    } catch (err) {
      console.error('[useDeliveryStats] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [branch_id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Actualizar cada 30 segundos
  useEffect(() => {
    if (!branch_id) return;

    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [branch_id, fetchStats]);

  return { stats, loading, refresh: fetchStats };
}

export default useDeliveryOrders;
