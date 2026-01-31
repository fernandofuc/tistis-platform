// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Hooks
// React hooks for menu state management
// With centralized cache for instant navigation
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/src/shared/lib/supabase';
import {
  useRestaurantDataStore,
  useCachedMenu,
} from '@/src/shared/stores/restaurantDataStore';
import * as menuService from '../services/menu.service';
import type {
  MenuCategory,
  MenuItem,
  CategoryFormData,
  MenuItemFormData,
  MenuFilters,
  MenuStats,
} from '../types';

// ======================
// CATEGORIES HOOK
// ======================
export function useCategories(includeInactive: boolean = false) {
  // Menu doesn't use branch_id, so we use null
  const cached = useCachedMenu(null);
  const store = useRestaurantDataStore();

  const [categories, setCategories] = useState<MenuCategory[]>(cached.categories || []);
  const [loading, setLoading] = useState(!cached.categories);
  const [error, setError] = useState<string | null>(null);

  const isFirstRender = useRef(true);

  const fetchCategories = useCallback(async (showLoading = true) => {
    try {
      if (showLoading && !cached.categories) {
        setLoading(true);
      }
      setError(null);
      const response = await menuService.getCategories(includeInactive);
      if (response.success) {
        setCategories(response.data);
        store.setMenuCategories(response.data, null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  }, [includeInactive, cached.categories, store]);

  useEffect(() => {
    if (isFirstRender.current && cached.categories) {
      setCategories(cached.categories);
      setLoading(false);
      isFirstRender.current = false;

      if (cached.isStale) {
        fetchCategories(false);
      }
    } else {
      fetchCategories(true);
    }

    // Real-time subscription
    const channel = supabase
      .channel('menu_categories_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_menu_categories',
        },
        () => {
          fetchCategories(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCategories, cached.categories, cached.isStale]);

  const createCategory = useCallback(async (data: CategoryFormData) => {
    const response = await menuService.createCategory(data);
    if (response.success) {
      setCategories((prev) => [...prev, response.data]);
    }
    return response;
  }, []);

  const updateCategory = useCallback(async (id: string, data: Partial<CategoryFormData>) => {
    const response = await menuService.updateCategory(id, data);
    if (response.success) {
      setCategories((prev) => prev.map((c) => (c.id === id ? response.data : c)));
    }
    return response;
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    const response = await menuService.deleteCategory(id);
    if (response.success) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
    return response;
  }, []);

  const reorderCategories = useCallback(async (updates: Array<{ id: string; display_order: number }>) => {
    const response = await menuService.reorderCategories(updates);
    if (response.success) {
      fetchCategories();
    }
    return response;
  }, [fetchCategories]);

  // Build category tree
  const categoryTree = useMemo(() => {
    const map = new Map<string, MenuCategory & { children: MenuCategory[] }>();
    const roots: (MenuCategory & { children: MenuCategory[] })[] = [];

    // First pass: create all nodes
    categories.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach((cat) => {
      const node = map.get(cat.id)!;
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots.sort((a, b) => a.display_order - b.display_order);
  }, [categories]);

  return {
    categories,
    categoryTree,
    loading,
    error,
    refresh: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  };
}

// ======================
// MENU ITEMS HOOK
// ======================
export function useMenuItems(filters: MenuFilters = {}, page: number = 1, limit: number = 50) {
  const cached = useCachedMenu(null);
  const store = useRestaurantDataStore();

  const [items, setItems] = useState<MenuItem[]>(cached.items || []);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(!cached.items);
  const [error, setError] = useState<string | null>(null);

  const isFirstRender = useRef(true);

  // Memoize filters to avoid complex dependency expressions
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const fetchItems = useCallback(async (showLoading = true) => {
    try {
      if (showLoading && !cached.items) {
        setLoading(true);
      }
      setError(null);
      const response = await menuService.getMenuItems(filters, page, limit);
      if (response.success) {
        setItems(response.data.items);
        setPagination(response.data.pagination);
        store.setMenuItems(response.data.items, null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar platillos');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, page, limit, cached.items]);

  useEffect(() => {
    if (isFirstRender.current && cached.items) {
      setItems(cached.items);
      setLoading(false);
      isFirstRender.current = false;

      if (cached.isStale) {
        fetchItems(false);
      }
    } else {
      fetchItems(true);
    }

    // Real-time subscription
    const channel = supabase
      .channel('menu_items_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_menu_items',
        },
        () => {
          fetchItems(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchItems, cached.items, cached.isStale]);

  const createItem = useCallback(async (data: MenuItemFormData) => {
    const response = await menuService.createMenuItem(data);
    if (response.success) {
      setItems((prev) => [...prev, response.data]);
    }
    return response;
  }, []);

  const updateItem = useCallback(async (id: string, data: Partial<MenuItemFormData>) => {
    const response = await menuService.updateMenuItem(id, data);
    if (response.success) {
      setItems((prev) => prev.map((item) => (item.id === id ? response.data : item)));
    }
    return response;
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const response = await menuService.deleteMenuItem(id);
    if (response.success) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
    return response;
  }, []);

  const toggleAvailability = useCallback(async (id: string, isAvailable: boolean) => {
    const response = await menuService.toggleItemAvailability(id, isAvailable);
    if (response.success) {
      setItems((prev) => prev.map((item) => (item.id === id ? response.data : item)));
    }
    return response;
  }, []);

  const toggleFeatured = useCallback(async (id: string, isFeatured: boolean) => {
    const response = await menuService.toggleItemFeatured(id, isFeatured);
    if (response.success) {
      setItems((prev) => prev.map((item) => (item.id === id ? response.data : item)));
    }
    return response;
  }, []);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    items.forEach((item) => {
      if (!grouped[item.category_id]) {
        grouped[item.category_id] = [];
      }
      grouped[item.category_id].push(item);
    });
    return grouped;
  }, [items]);

  return {
    items,
    itemsByCategory,
    pagination,
    loading,
    error,
    refresh: fetchItems,
    createItem,
    updateItem,
    deleteItem,
    toggleAvailability,
    toggleFeatured,
  };
}

// ======================
// SINGLE ITEM HOOK
// ======================
export function useMenuItem(id: string | null) {
  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await menuService.getMenuItem(id);
      if (response.success) {
        setItem(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar platillo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const update = useCallback(async (data: Partial<MenuItemFormData>) => {
    if (!id) return null;
    const response = await menuService.updateMenuItem(id, data);
    if (response.success) {
      setItem(response.data);
    }
    return response;
  }, [id]);

  return {
    item,
    loading,
    error,
    refresh: fetchItem,
    update,
  };
}

// ======================
// MENU STATS HOOK
// ======================
export function useMenuStats() {
  const cached = useCachedMenu(null);
  const store = useRestaurantDataStore();

  const [stats, setStats] = useState<MenuStats | null>(cached.stats || null);
  const [loading, setLoading] = useState(!cached.stats);
  const [error, setError] = useState<string | null>(null);

  const isFirstRender = useRef(true);

  const fetchStats = useCallback(async (showLoading = true) => {
    try {
      if (showLoading && !cached.stats) {
        setLoading(true);
      }
      setError(null);
      const response = await menuService.getMenuStats();
      if (response.success) {
        setStats(response.data);
        store.setMenuStats(response.data, null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, [cached.stats, store]);

  useEffect(() => {
    if (isFirstRender.current && cached.stats) {
      setStats(cached.stats);
      setLoading(false);
      isFirstRender.current = false;

      if (cached.isStale) {
        fetchStats(false);
      }
    } else {
      fetchStats(true);
    }
  }, [fetchStats, cached.stats, cached.isStale]);

  return {
    stats,
    loading,
    error,
    refresh: () => fetchStats(true),
  };
}

// ======================
// SEARCH HOOK
// ======================
export function useMenuSearch(query: string) {
  const [results, setResults] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const searchItems = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await menuService.getMenuItems({ search: query }, 1, 20);
        if (response.success) {
          setResults(response.data.items);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error en búsqueda');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchItems, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  return { results, loading, error };
}
