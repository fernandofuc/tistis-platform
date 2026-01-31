'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Hook
// React hook for Inventory state management with realtime
// With centralized cache for instant navigation
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/src/shared/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  useRestaurantDataStore,
  useCachedInventory,
} from '@/src/shared/stores/restaurantDataStore';
import type {
  InventoryItem,
  InventoryCategory,
  InventorySupplier,
  InventoryMovement,
  InventoryStats,
  ItemFormData,
  CategoryFormData,
  SupplierFormData,
  MovementFormData,
} from '../types';
import * as inventoryService from '../services/inventory.service';

// ======================
// TYPES
// ======================

interface UseInventoryOptions {
  branch_id?: string;
  category_id?: string;
  search?: string;
  item_type?: string;
  low_stock_only?: boolean;
  enableRealtime?: boolean;
  autoRefreshInterval?: number; // ms, 0 to disable
}

interface UseInventoryReturn {
  // State
  items: InventoryItem[];
  categories: InventoryCategory[];
  suppliers: InventorySupplier[];
  movements: InventoryMovement[];
  stats: InventoryStats | null;
  loading: boolean;
  error: string | null;

  // Item actions
  createItem: (data: ItemFormData) => Promise<InventoryItem>;
  updateItem: (itemId: string, data: Partial<ItemFormData>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;

  // Category actions
  createCategory: (data: CategoryFormData) => Promise<InventoryCategory>;
  updateCategory: (categoryId: string, data: Partial<CategoryFormData>) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;

  // Supplier actions
  createSupplier: (data: SupplierFormData) => Promise<InventorySupplier>;
  updateSupplier: (supplierId: string, data: Partial<SupplierFormData>) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;

  // Movement actions
  recordMovement: (data: MovementFormData) => Promise<void>;
  adjustStock: (itemId: string, quantity: number, reason: string) => Promise<void>;
  recordWaste: (itemId: string, quantity: number, reason: string) => Promise<void>;
  recordPurchase: (itemId: string, quantity: number, unitCost: number, notes?: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

// ======================
// HOOK
// ======================

export function useInventory(options: UseInventoryOptions = {}): UseInventoryReturn {
  const {
    branch_id,
    category_id,
    search,
    item_type,
    low_stock_only,
    enableRealtime = true,
    autoRefreshInterval = 60000, // 1 minute default
  } = options;

  // Get cached data from store
  const cached = useCachedInventory(branch_id || null);
  const store = useRestaurantDataStore();

  // Local state - initialized from cache if available
  const [items, setItems] = useState<InventoryItem[]>(cached.items || []);
  const [categories, setCategories] = useState<InventoryCategory[]>(cached.categories || []);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>(cached.suppliers || []);
  const [movements, setMovements] = useState<InventoryMovement[]>(cached.movements || []);
  const [stats, setStats] = useState<InventoryStats | null>(cached.stats || null);
  const [loading, setLoading] = useState(!cached.items);
  const [error, setError] = useState<string | null>(null);

  const channelsRef = useRef<RealtimeChannel[]>([]);
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
      // Only show loading if no cached data
      if (showLoading && !cached.items) {
        setLoading(true);
      }
      setError(null);

      const [itemsData, categoriesData, suppliersData, movementsData, statsData] = await Promise.all([
        inventoryService.getItems({
          branch_id,
          category_id,
          search,
          item_type,
          low_stock_only,
        }),
        inventoryService.getCategories(branch_id),
        inventoryService.getSuppliers(),
        inventoryService.getMovements({ branch_id }),
        inventoryService.getStats(branch_id),
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setSuppliers(suppliersData);
      setMovements(movementsData);
      setStats(statsData);

      // Update global cache
      store.setInventoryItems(itemsData, branch_id);
      store.setInventoryCategories(categoriesData, branch_id);
      store.setInventorySuppliers(suppliersData, branch_id);
      store.setInventoryMovements(movementsData, branch_id);
      store.setInventoryStats(statsData, branch_id);
    } catch (err) {
      console.error('Error fetching inventory data:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  }, [branch_id, category_id, search, item_type, low_stock_only, cached.items, store]);

  // Initial fetch with cache support
  useEffect(() => {
    if (isFirstRender.current && cached.items) {
      // Use cached data immediately
      setItems(cached.items);
      setCategories(cached.categories || []);
      setSuppliers(cached.suppliers || []);
      setMovements(cached.movements || []);
      setStats(cached.stats);
      setLoading(false);
      isFirstRender.current = false;

      // Refresh in background if stale
      if (cached.isStale) {
        fetchData(false);
      }
    } else {
      fetchData(true);
    }
  }, [fetchData, cached.items, cached.categories, cached.suppliers, cached.movements, cached.stats, cached.isStale]);

  // ======================
  // REALTIME SUBSCRIPTIONS
  // ======================

  useEffect(() => {
    if (!branch_id || !enableRealtime) return;

    // Cleanup previous channels
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    // Subscribe to inventory_items changes
    const itemsChannel = supabase
      .channel(`inventory-items-${branch_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to inventory_movements changes
    const movementsChannel = supabase
      .channel(`inventory-movements-${branch_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_movements',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to inventory_batches changes
    const batchesChannel = supabase
      .channel(`inventory-batches-${branch_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_batches',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    channelsRef.current = [itemsChannel, movementsChannel, batchesChannel];

    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [branch_id, enableRealtime, fetchData]);

  // ======================
  // AUTO REFRESH
  // ======================

  useEffect(() => {
    if (!branch_id || autoRefreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchData();
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [branch_id, autoRefreshInterval, fetchData]);

  // ======================
  // ITEM ACTIONS
  // ======================

  const createItem = useCallback(
    async (data: ItemFormData) => {
      if (!branch_id) throw new Error('Branch ID requerido');
      const item = await inventoryService.createItem(data, branch_id);
      await fetchData();
      return item;
    },
    [branch_id, fetchData]
  );

  const updateItem = useCallback(
    async (itemId: string, data: Partial<ItemFormData>) => {
      await inventoryService.updateItem(itemId, data);
      await fetchData();
    },
    [fetchData]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      await inventoryService.deleteItem(itemId);
      await fetchData();
    },
    [fetchData]
  );

  // ======================
  // CATEGORY ACTIONS
  // ======================

  const createCategory = useCallback(
    async (data: CategoryFormData) => {
      if (!branch_id) throw new Error('Branch ID requerido');
      const category = await inventoryService.createCategory(data, branch_id);
      await fetchData();
      return category;
    },
    [branch_id, fetchData]
  );

  const updateCategory = useCallback(
    async (categoryId: string, data: Partial<CategoryFormData>) => {
      await inventoryService.updateCategory(categoryId, data);
      await fetchData();
    },
    [fetchData]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      await inventoryService.deleteCategory(categoryId);
      await fetchData();
    },
    [fetchData]
  );

  // ======================
  // SUPPLIER ACTIONS
  // ======================

  const createSupplier = useCallback(
    async (data: SupplierFormData) => {
      const supplier = await inventoryService.createSupplier(data);
      await fetchData();
      return supplier;
    },
    [fetchData]
  );

  const updateSupplier = useCallback(
    async (supplierId: string, data: Partial<SupplierFormData>) => {
      await inventoryService.updateSupplier(supplierId, data);
      await fetchData();
    },
    [fetchData]
  );

  const deleteSupplier = useCallback(
    async (supplierId: string) => {
      await inventoryService.deleteSupplier(supplierId);
      await fetchData();
    },
    [fetchData]
  );

  // ======================
  // MOVEMENT ACTIONS
  // ======================

  const recordMovement = useCallback(
    async (data: MovementFormData) => {
      if (!branch_id) throw new Error('Branch ID requerido');
      await inventoryService.createMovement(data, branch_id);
      await fetchData();
    },
    [branch_id, fetchData]
  );

  const adjustStock = useCallback(
    async (itemId: string, quantity: number, reason: string) => {
      if (!branch_id) throw new Error('Branch ID requerido');
      await inventoryService.adjustStock(itemId, quantity, reason, branch_id);
      await fetchData();
    },
    [branch_id, fetchData]
  );

  const recordWaste = useCallback(
    async (itemId: string, quantity: number, reason: string) => {
      if (!branch_id) throw new Error('Branch ID requerido');
      await inventoryService.recordWaste(itemId, quantity, reason, branch_id);
      await fetchData();
    },
    [branch_id, fetchData]
  );

  const recordPurchase = useCallback(
    async (itemId: string, quantity: number, unitCost: number, notes?: string) => {
      if (!branch_id) throw new Error('Branch ID requerido');
      await inventoryService.recordPurchase(itemId, quantity, unitCost, branch_id, notes);
      await fetchData();
    },
    [branch_id, fetchData]
  );

  return {
    items,
    categories,
    suppliers,
    movements,
    stats,
    loading,
    error,
    createItem,
    updateItem,
    deleteItem,
    createCategory,
    updateCategory,
    deleteCategory,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    recordMovement,
    adjustStock,
    recordWaste,
    recordPurchase,
    refresh: fetchData,
  };
}
