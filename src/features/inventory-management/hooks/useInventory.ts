'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Hook
// React hook for Inventory Management state
// Elegant, performant, Apple/Google-inspired UX
// =====================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  InventoryItemDisplay,
  InventoryItemFormData,
  InventoryFilters,
  UseInventoryReturn,
} from '../types';
import * as inventoryService from '../services/inventory.service';

// ========================================
// HOOK OPTIONS
// ========================================

export interface UseInventoryOptions {
  /** Initial filters to apply */
  initialFilters?: InventoryFilters;

  /** Auto-fetch items on mount */
  autoFetch?: boolean;

  /** Enable realtime updates */
  realtime?: boolean;

  /** Debounce delay for search (ms) */
  searchDebounce?: number;
}

// ========================================
// MAIN HOOK
// ========================================

export function useInventory(options?: UseInventoryOptions): UseInventoryReturn {
  // ========================================
  // STATE
  // ========================================

  const [items, setItems] = useState<InventoryItemDisplay[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItemDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<InventoryFilters>(options?.initialFilters || {});

  // ========================================
  // COMPUTED VALUES
  // ========================================

  const stats = useMemo(() => {
    if (items.length === 0) {
      return {
        total: 0,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
        overstocked: 0,
        totalValue: 0,
      };
    }

    return {
      total: items.length,
      inStock: items.filter(i => i.stockStatus === 'in_stock').length,
      lowStock: items.filter(i => i.stockStatus === 'low_stock').length,
      outOfStock: items.filter(i => i.stockStatus === 'out_of_stock').length,
      overstocked: items.filter(i => i.stockStatus === 'overstocked').length,
      totalValue: items.reduce((sum, i) => sum + i.stockValue, 0),
    };
  }, [items]);

  // ========================================
  // QUERIES
  // ========================================

  /**
   * Fetch inventory items with filters
   */
  const fetchItems = useCallback(async (customFilters?: InventoryFilters) => {
    setLoading(true);
    setError(null);

    try {
      const filtersToUse = customFilters || filters;
      const result = await inventoryService.getInventoryItems(filtersToUse);

      if (result.success) {
        setItems(result.data);
      } else {
        setError(result.error || 'Error al cargar items');
        setItems([]);
      }
    } catch (err) {
      console.error('[useInventory] Error fetching items:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /**
   * Get single item by ID
   */
  const getItem = useCallback(async (id: string): Promise<InventoryItemDisplay | null> => {
    try {
      const result = await inventoryService.getInventoryItem(id);

      if (result.success) {
        return result.data;
      } else {
        console.error('[useInventory] Error getting item:', result.error);
        return null;
      }
    } catch (err) {
      console.error('[useInventory] Error getting item:', err);
      return null;
    }
  }, []);

  /**
   * Refresh single item
   */
  const refreshItem = useCallback(async (id: string) => {
    try {
      const result = await inventoryService.getInventoryItem(id);

      if (result.success) {
        setItems(prevItems =>
          prevItems.map(item => item.id === id ? result.data : item)
        );

        if (selectedItem?.id === id) {
          setSelectedItem(result.data);
        }
      }
    } catch (err) {
      console.error('[useInventory] Error refreshing item:', err);
    }
  }, [selectedItem]);

  // ========================================
  // MUTATIONS
  // ========================================

  /**
   * Create new inventory item
   */
  const createItem = useCallback(async (data: InventoryItemFormData): Promise<InventoryItemDisplay> => {
    setLoading(true);
    setError(null);

    try {
      const result = await inventoryService.createInventoryItem(data);

      if (result.success) {
        // Optimistic update - add to list immediately
        setItems(prevItems => [result.data, ...prevItems]);
        return result.data;
      } else {
        setError(result.error || 'Error al crear item');
        throw new Error(result.error || 'Error al crear item');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update inventory item
   */
  const updateItem = useCallback(async (
    id: string,
    data: Partial<InventoryItemFormData>
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    // Store original for rollback
    const originalItems = [...items];
    const originalSelected = selectedItem;

    try {
      // Optimistic update
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === id ? { ...item, ...data } as InventoryItemDisplay : item
        )
      );

      if (selectedItem?.id === id) {
        setSelectedItem(prev => prev ? { ...prev, ...data } as InventoryItemDisplay : null);
      }

      const result = await inventoryService.updateInventoryItem(id, data);

      if (result.success) {
        // Replace optimistic update with real data
        setItems(prevItems =>
          prevItems.map(item => item.id === id ? result.data : item)
        );

        if (selectedItem?.id === id) {
          setSelectedItem(result.data);
        }
      } else {
        // Rollback on error
        setItems(originalItems);
        setSelectedItem(originalSelected);
        setError(result.error || 'Error al actualizar item');
        throw new Error(result.error || 'Error al actualizar item');
      }
    } catch (err) {
      // Rollback on error
      setItems(originalItems);
      setSelectedItem(originalSelected);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [items, selectedItem]);

  /**
   * Delete inventory item
   */
  const deleteItem = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    // Store original for rollback
    const originalItems = [...items];

    try {
      // Optimistic update - remove immediately
      setItems(prevItems => prevItems.filter(item => item.id !== id));

      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }

      const result = await inventoryService.deleteInventoryItem(id);

      if (!result.success) {
        // Rollback on error
        setItems(originalItems);
        setError(result.error || 'Error al eliminar item');
        throw new Error(result.error || 'Error al eliminar item');
      }
    } catch (err) {
      // Rollback on error
      setItems(originalItems);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [items, selectedItem]);

  // ========================================
  // SELECTION
  // ========================================

  /**
   * Select/deselect item
   */
  const selectItem = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedItem(null);
      return;
    }

    const item = items.find(i => i.id === id);
    setSelectedItem(item || null);
  }, [items]);

  // ========================================
  // FILTERS
  // ========================================

  /**
   * Update filters and refetch
   */
  const updateFilters = useCallback((newFilters: Partial<InventoryFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // ========================================
  // EFFECTS
  // ========================================

  // Track if this is the first render to avoid double-fetch
  const isFirstRender = useRef(true);

  /**
   * Auto-fetch on mount
   */
  useEffect(() => {
    if (options?.autoFetch) {
      fetchItems();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Refetch when filters change (with debouncing)
   * Skip on first render to avoid double-fetch with mount effect
   */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (options?.autoFetch) {
      const timer = setTimeout(() => {
        fetchItems();
      }, options?.searchDebounce || 300);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, options?.autoFetch, options?.searchDebounce]);

  /**
   * Realtime subscription
   */
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    if (options?.realtime) {
      // Subscribe asynchronously
      inventoryService.subscribeToInventoryChanges((payload) => {
        // Only process if component is still mounted
        if (!isMounted) return;

        console.log('[useInventory] Realtime update:', payload);

        // Handle different event types with null safety
        if (payload.eventType === 'INSERT' && payload.new) {
          setItems(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          setItems(prev =>
            prev.map(item => item.id === payload.new.id ? payload.new : item)
          );
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setItems(prev => prev.filter(item => item.id !== payload.old.id));
        }
      }).then(sub => {
        if (isMounted) {
          subscription = sub;
        } else {
          // Component unmounted before subscription was ready - cleanup immediately
          sub.unsubscribe();
        }
      });

      return () => {
        isMounted = false;
        subscription?.unsubscribe();
      };
    }
  }, [options?.realtime]);

  // ========================================
  // RETURN
  // ========================================

  return {
    // State
    items,
    selectedItem,
    loading,
    error,
    stats,
    filters,

    // Queries
    fetchItems,
    getItem,
    refreshItem,

    // Mutations
    createItem,
    updateItem,
    deleteItem,

    // Selection
    selectItem,

    // Filters
    updateFilters,
    clearFilters,
  };
}
