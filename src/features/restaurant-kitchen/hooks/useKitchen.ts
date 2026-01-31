'use client';

// =====================================================
// TIS TIS PLATFORM - Kitchen Hook
// React hook for Kitchen Display System state management
// With centralized cache for instant navigation
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/src/shared/lib/supabase';
import {
  useRestaurantDataStore,
  useCachedKitchen,
} from '@/src/shared/stores/restaurantDataStore';
import type {
  RestaurantOrder,
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

  // Get cached data from store
  const cached = useCachedKitchen(branch_id || null);
  const store = useRestaurantDataStore();

  const [orders, setOrders] = useState<KDSOrderView[]>(cached.orders || []);
  const [orderHistory, setOrderHistory] = useState<RestaurantOrder[]>(cached.orderHistory || []);
  const [stations, setStations] = useState<KitchenStationConfig[]>(cached.stations || []);
  const [stats, setStats] = useState<KDSStats | null>(cached.stats || null);
  const [loading, setLoading] = useState(!cached.orders);
  const [error, setError] = useState<string | null>(null);

  const isFirstRender = useRef(true);

  // ======================
  // DATA FETCHING
  // ======================

  const fetchData = useCallback(async (showLoading = true) => {
    if (!branch_id) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading && !cached.orders) {
        setLoading(true);
      }
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

      // Update global cache
      store.setKitchenOrders(ordersData, branch_id);
      store.setKitchenStations(stationsData, branch_id);
      store.setKitchenStats(statsData, branch_id);
    } catch (err) {
      console.error('Error fetching kitchen data:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [branch_id, station, cached.orders, store]);

  // Initial fetch with cache support
  useEffect(() => {
    if (isFirstRender.current && cached.orders) {
      setOrders(cached.orders);
      setOrderHistory(cached.orderHistory || []);
      setStations(cached.stations || []);
      setStats(cached.stats);
      setLoading(false);
      isFirstRender.current = false;

      if (cached.isStale) {
        fetchData(false);
      }
    } else {
      fetchData(true);
    }
  }, [fetchData, cached.orders, cached.orderHistory, cached.stations, cached.stats, cached.isStale]);

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

    // Debounce timer to prevent excessive fetches from rapid changes
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isMounted) {
          fetchData();
        }
      }, 300); // 300ms debounce
    };

    // Subscribe to order changes - filtered by branch_id
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
          // Refetch on order change for this branch
          debouncedFetch();
        }
      )
      .subscribe();

    // Subscribe to order item changes
    // NOTE: Cannot filter items by branch_id directly since that column doesn't exist on items
    // We rely on the order subscription + RLS to ensure data integrity
    // The debounce prevents excessive API calls from unrelated item changes
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
          // Debounced refetch - RLS will filter out data from other tenants
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
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
      store.setKitchenOrderHistory(historyData, branch_id);
    } catch (err) {
      console.error('Error fetching order history:', err);
    }
  }, [branch_id, store]);

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
