'use client';

// =====================================================
// TIS TIS PLATFORM - Kitchen Hook
// React hook for Kitchen Display System state management
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/shared/lib/supabase';
import type {
  RestaurantOrder,
  RestaurantOrderItem,
  KDSOrderView,
  KDSStats,
  KitchenStationConfig,
  OrderFormData,
  OrderItemFormData,
  StationFormData,
  OrderStatus,
  OrderItemStatus,
  KitchenStation,
} from '../types';
import * as kitchenService from '../services/kitchen.service';

// ======================
// TYPES
// ======================

interface UseKitchenOptions {
  branch_id?: string;
  station?: KitchenStation;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseKitchenReturn {
  // State
  orders: KDSOrderView[];
  orderHistory: RestaurantOrder[];
  stations: KitchenStationConfig[];
  stats: KDSStats | null;
  loading: boolean;
  error: string | null;

  // Order actions
  createOrder: (data: OrderFormData, items: OrderItemFormData[]) => Promise<RestaurantOrder>;
  updateOrder: (orderId: string, data: Partial<OrderFormData>) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  cancelOrder: (orderId: string, reason: string) => Promise<void>;
  bumpOrder: (orderId: string) => Promise<void>;
  recallOrder: (orderId: string) => Promise<void>;
  setPriority: (orderId: string, priority: number) => Promise<void>;
  fetchOrderHistory: () => Promise<void>;

  // Item actions
  addItem: (orderId: string, item: OrderItemFormData) => Promise<void>;
  updateItem: (itemId: string, data: Partial<OrderItemFormData>) => Promise<void>;
  updateItemStatus: (itemId: string, status: OrderItemStatus) => Promise<void>;
  startItem: (itemId: string) => Promise<void>;
  bumpItem: (itemId: string) => Promise<void>;
  cancelItem: (itemId: string) => Promise<void>;
  assignToStation: (itemId: string, station: KitchenStation) => Promise<void>;

  // Station actions
  createStation: (data: StationFormData) => Promise<void>;
  updateStation: (stationId: string, data: Partial<StationFormData>) => Promise<void>;
  deleteStation: (stationId: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

// ======================
// HOOK
// ======================

export function useKitchen(options: UseKitchenOptions = {}): UseKitchenReturn {
  const { branch_id, station, autoRefresh = true, refreshInterval = 30000 } = options;

  const [orders, setOrders] = useState<KDSOrderView[]>([]);
  const [orderHistory, setOrderHistory] = useState<RestaurantOrder[]>([]);
  const [stations, setStations] = useState<KitchenStationConfig[]>([]);
  const [stats, setStats] = useState<KDSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ======================
  // DATA FETCHING
  // ======================

  const fetchData = useCallback(async () => {
    if (!branch_id) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const [ordersData, stationsData, statsData] = await Promise.all([
        station
          ? kitchenService.getKDSOrdersByStation(branch_id, station)
          : kitchenService.getKDSOrders(branch_id),
        kitchenService.getStations(branch_id),
        kitchenService.getKDSStats(branch_id),
      ]);

      setOrders(ordersData);
      setStations(stationsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching kitchen data:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [branch_id, station]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !branch_id) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, branch_id, refreshInterval, fetchData]);

  // ======================
  // REALTIME SUBSCRIPTIONS
  // ======================

  useEffect(() => {
    if (!branch_id) return;

    // Subscribe to order changes
    const ordersChannel = supabase
      .channel(`kds-orders-${branch_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_orders',
          filter: `branch_id=eq.${branch_id}`,
        },
        () => {
          // Refetch on any order change
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to order item changes
    const itemsChannel = supabase
      .channel(`kds-items-${branch_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_order_items',
        },
        () => {
          // Refetch on any item change
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, [branch_id, fetchData]);

  // ======================
  // ORDER ACTIONS
  // ======================

  const createOrder = useCallback(
    async (data: OrderFormData, items: OrderItemFormData[]) => {
      if (!branch_id) throw new Error('Branch ID requerido');
      const order = await kitchenService.createOrder(data, branch_id, items);
      await fetchData();
      return order;
    },
    [branch_id, fetchData]
  );

  const updateOrder = useCallback(
    async (orderId: string, data: Partial<OrderFormData>) => {
      await kitchenService.updateOrder(orderId, data);
      await fetchData();
    },
    [fetchData]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      await kitchenService.updateOrderStatus(orderId, status);
      await fetchData();
    },
    [fetchData]
  );

  const cancelOrder = useCallback(
    async (orderId: string, reason: string) => {
      await kitchenService.cancelOrder(orderId, reason);
      await fetchData();
    },
    [fetchData]
  );

  const bumpOrder = useCallback(
    async (orderId: string) => {
      await kitchenService.bumpOrder(orderId);
      await fetchData();
    },
    [fetchData]
  );

  const recallOrder = useCallback(
    async (orderId: string) => {
      await kitchenService.recallOrder(orderId);
      await fetchData();
    },
    [fetchData]
  );

  const setPriority = useCallback(
    async (orderId: string, priority: number) => {
      await kitchenService.setPriority(orderId, priority);
      await fetchData();
    },
    [fetchData]
  );

  // Fetch historical orders (completed/cancelled)
  const fetchOrderHistory = useCallback(async () => {
    if (!branch_id) return;

    try {
      // Get orders from last 30 days with completed/cancelled/served status
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const historyData = await kitchenService.getOrders({
        branch_id,
        status: ['completed', 'served', 'cancelled'],
        date_from: thirtyDaysAgo.toISOString(),
        limit: 200,
      });

      setOrderHistory(historyData);
    } catch (err) {
      console.error('Error fetching order history:', err);
    }
  }, [branch_id]);

  // ======================
  // ITEM ACTIONS
  // ======================

  const addItem = useCallback(
    async (orderId: string, item: OrderItemFormData) => {
      await kitchenService.addOrderItem(orderId, item);
      await fetchData();
    },
    [fetchData]
  );

  const updateItem = useCallback(
    async (itemId: string, data: Partial<OrderItemFormData>) => {
      await kitchenService.updateOrderItem(itemId, data);
      await fetchData();
    },
    [fetchData]
  );

  const updateItemStatusAction = useCallback(
    async (itemId: string, status: OrderItemStatus) => {
      await kitchenService.updateItemStatus(itemId, status);
      await fetchData();
    },
    [fetchData]
  );

  const startItem = useCallback(
    async (itemId: string) => {
      await kitchenService.startItem(itemId);
      await fetchData();
    },
    [fetchData]
  );

  const bumpItem = useCallback(
    async (itemId: string) => {
      await kitchenService.bumpItem(itemId);
      await fetchData();
    },
    [fetchData]
  );

  const cancelItem = useCallback(
    async (itemId: string) => {
      await kitchenService.cancelItem(itemId);
      await fetchData();
    },
    [fetchData]
  );

  const assignToStation = useCallback(
    async (itemId: string, stationCode: KitchenStation) => {
      await kitchenService.assignItemToStation(itemId, stationCode);
      await fetchData();
    },
    [fetchData]
  );

  // ======================
  // STATION ACTIONS
  // ======================

  const createStation = useCallback(
    async (data: StationFormData) => {
      if (!branch_id) throw new Error('Branch ID requerido');
      await kitchenService.createStation(data, branch_id);
      await fetchData();
    },
    [branch_id, fetchData]
  );

  const updateStation = useCallback(
    async (stationId: string, data: Partial<StationFormData>) => {
      await kitchenService.updateStation(stationId, data);
      await fetchData();
    },
    [fetchData]
  );

  const deleteStation = useCallback(
    async (stationId: string) => {
      await kitchenService.deleteStation(stationId);
      await fetchData();
    },
    [fetchData]
  );

  return {
    orders,
    orderHistory,
    stations,
    stats,
    loading,
    error,
    createOrder,
    updateOrder,
    updateOrderStatus,
    cancelOrder,
    bumpOrder,
    recallOrder,
    setPriority,
    fetchOrderHistory,
    addItem,
    updateItem,
    updateItemStatus: updateItemStatusAction,
    startItem,
    bumpItem,
    cancelItem,
    assignToStation,
    createStation,
    updateStation,
    deleteStation,
    refresh: fetchData,
  };
}

export default useKitchen;
