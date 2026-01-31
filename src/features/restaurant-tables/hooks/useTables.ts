// =====================================================
// TIS TIS PLATFORM - Restaurant Tables Hooks
// React hooks for tables state management
// With centralized cache for instant navigation
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/src/shared/lib/supabase';
import {
  useRestaurantDataStore,
  useCachedTables,
} from '@/src/shared/stores/restaurantDataStore';
import * as tablesService from '../services/tables.service';
import type {
  RestaurantTable,
  TableFormData,
  TableFilters,
  TableStats,
  TableStatus,
} from '../types';

// ======================
// TABLES LIST HOOK
// ======================
export function useTables(filters: TableFilters = {}) {
  const branchId = filters.branch_id || null;

  // Get cached data from store
  const cached = useCachedTables(branchId);
  const store = useRestaurantDataStore();

  // Local state - initialized from cache if available
  const [tables, setTables] = useState<RestaurantTable[]>(cached.tables || []);
  const [stats, setStats] = useState<TableStats | null>(cached.stats || null);
  const [loading, setLoading] = useState(!cached.tables);
  const [error, setError] = useState<string | null>(null);

  // Track if this is the first render to show cached data immediately
  const isFirstRender = useRef(true);

  // Memoize filters to avoid complex dependency expressions
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const fetchTables = useCallback(async (showLoading = true) => {
    try {
      // Only show loading if no cached data
      if (showLoading && !cached.tables) {
        setLoading(true);
      }
      setError(null);

      const response = await tablesService.getTables(filters);
      if (response.success) {
        setTables(response.data.tables);
        setStats(response.data.stats);

        // Update global cache
        store.setTables(response.data.tables, branchId);
        store.setTableStats(response.data.stats, branchId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mesas');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, branchId]);

  // Initialize from cache and fetch fresh data
  useEffect(() => {
    if (isFirstRender.current && cached.tables) {
      // Use cached data immediately
      setTables(cached.tables);
      setStats(cached.stats);
      setLoading(false);
      isFirstRender.current = false;

      // Refresh in background if stale
      if (cached.isStale) {
        fetchTables(false);
      }
    } else {
      // No cache, fetch fresh
      fetchTables(true);
    }

    // Real-time subscription for table changes
    const channel = supabase
      .channel('restaurant_tables_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTable = payload.new as RestaurantTable;
            setTables((prev) => [...prev, newTable]);
            store.addTable(newTable);
          } else if (payload.eventType === 'UPDATE') {
            const updatedTable = payload.new as RestaurantTable;
            setTables((prev) =>
              prev.map((t) => (t.id === updatedTable.id ? updatedTable : t))
            );
            store.updateTable(updatedTable);
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setTables((prev) => prev.filter((t) => t.id !== deletedId));
            store.removeTable(deletedId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTables, cached.tables, cached.stats, cached.isStale, store]);

  // Create table
  // Note: Don't add to state here - the real-time subscription will handle it
  // This prevents duplicate entries when both callback and subscription fire
  const createTable = useCallback(async (data: TableFormData, branchId: string) => {
    const response = await tablesService.createTable(data, branchId);
    // Real-time subscription will automatically add the new table to state
    return response;
  }, []);

  // Update table
  const updateTable = useCallback(async (id: string, data: Partial<TableFormData>) => {
    const response = await tablesService.updateTable(id, data);
    if (response.success) {
      setTables((prev) => prev.map((t) => (t.id === id ? response.data : t)));
    }
    return response;
  }, []);

  // Delete table
  // Note: Real-time subscription handles state update to prevent race conditions
  const deleteTable = useCallback(async (id: string) => {
    const response = await tablesService.deleteTable(id);
    // Real-time subscription will automatically remove the table from state
    return response;
  }, []);

  // Update status
  const updateStatus = useCallback(async (id: string, status: TableStatus) => {
    const response = await tablesService.updateTableStatus(id, status);
    if (response.success) {
      setTables((prev) => prev.map((t) => (t.id === id ? response.data : t)));
    }
    return response;
  }, []);

  // Toggle active
  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    const response = await tablesService.toggleTableActive(id, isActive);
    if (response.success) {
      setTables((prev) => prev.map((t) => (t.id === id ? response.data : t)));
    }
    return response;
  }, []);

  return {
    tables,
    stats,
    loading,
    error,
    refresh: fetchTables,
    createTable,
    updateTable,
    deleteTable,
    updateStatus,
    toggleActive,
  };
}

// ======================
// SINGLE TABLE HOOK
// ======================
export function useTable(id: string | null) {
  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTable = useCallback(async () => {
    if (!id) {
      setTable(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tablesService.getTable(id);
      if (response.success) {
        setTable(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mesa');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTable();
  }, [fetchTable]);

  const update = useCallback(async (data: Partial<TableFormData>) => {
    if (!id) return null;
    const response = await tablesService.updateTable(id, data);
    if (response.success) {
      setTable(response.data);
    }
    return response;
  }, [id]);

  return {
    table,
    loading,
    error,
    refresh: fetchTable,
    update,
  };
}

// ======================
// TABLE STATS HOOK
// ======================
export function useTableStats(branchId?: string) {
  const [stats, setStats] = useState<TableStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tablesService.getTableStats(branchId);
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchStats();

    // Real-time subscription for stat updates
    const channel = supabase
      .channel('table_stats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}

// ======================
// TABLE AVAILABILITY HOOK
// ======================
export function useTableAvailability(
  branchId: string | null,
  date: string | null,
  time: string | null,
  partySize: number
) {
  const [availableTables, setAvailableTables] = useState<
    Array<{
      table_id: string;
      table_number: string;
      table_name: string | null;
      max_capacity: number;
      zone: string;
      features: string[];
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!branchId || !date || !time || partySize < 1) {
      setAvailableTables([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tablesService.getAvailableTables(
        branchId,
        date,
        time,
        partySize
      );
      if (response.success) {
        setAvailableTables(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar disponibilidad');
    } finally {
      setLoading(false);
    }
  }, [branchId, date, time, partySize]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return {
    availableTables,
    loading,
    error,
    refresh: fetchAvailability,
  };
}

// ======================
// TABLES BY ZONE HOOK
// ======================
export function useTablesByZone(tables: RestaurantTable[]) {
  return useMemo(() => {
    const byZone: Record<string, RestaurantTable[]> = {};

    tables.forEach((table) => {
      const zone = table.zone || 'main';
      if (!byZone[zone]) {
        byZone[zone] = [];
      }
      byZone[zone].push(table);
    });

    // Sort tables within each zone by display_order
    Object.keys(byZone).forEach((zone) => {
      byZone[zone].sort((a, b) => a.display_order - b.display_order);
    });

    return byZone;
  }, [tables]);
}

// ======================
// TABLE RESERVATIONS HOOK
// ======================
export function useTableReservations(tableId: string | null, date: string) {
  const [reservations, setReservations] = useState<
    Array<{
      id: string;
      scheduled_at: string;
      duration_minutes: number;
      party_size: number;
      guest_name: string;
      status: string;
      arrival_status: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    if (!tableId) {
      setReservations([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tablesService.getTableReservations(tableId, date);
      if (response.success) {
        setReservations(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reservaciones');
    } finally {
      setLoading(false);
    }
  }, [tableId, date]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  return {
    reservations,
    loading,
    error,
    refresh: fetchReservations,
  };
}
