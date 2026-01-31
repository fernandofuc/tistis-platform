// =====================================================
// TIS TIS PLATFORM - Dashboard Data Store (Zustand)
// Centralized cache for dashboard data with SWR pattern
// Prevents re-loading when navigating between pages
// =====================================================

import { create } from 'zustand';
import type { Lead, Appointment } from '@/src/shared/types';

// ======================
// TYPES
// ======================

interface CacheEntry<T> {
  data: T;
  lastFetched: number;
  branchId: string | null;
}

// Default TTL: 30 seconds - data is considered "stale" after this
const DEFAULT_STALE_TIME = 30 * 1000;

// ======================
// DASHBOARD STATS TYPES
// ======================

export interface DashboardStats {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  todayAppointments: number;
  activeConversations: number;
  escalatedConversations: number;
}

export interface RestaurantStats {
  tablesTotal: number;
  tablesAvailable: number;
  tablesOccupied: number;
  tablesReserved: number;
  todayReservations: number;
  pendingOrders: number;
  preparingOrders: number;
  lowStockItems: number;
  vipCustomersToday: number;
  todayRevenue: number;
}

export interface RestaurantOrder {
  id: string;
  status: string;
  total: number;
  order_type: string;
  created_at: string;
}

export interface RestaurantReservation {
  id: string;
  scheduled_at: string;
  status: string;
  reason: string;
  leads?: { full_name?: string; phone?: string };
  appointment_restaurant_details?: Array<{
    party_size?: number;
    occasion_type?: string;
    table_id?: string;
  }>;
}

// ======================
// DEFAULT DASHBOARD SLICE
// ======================

interface DefaultDashboardSlice {
  dashboardStats: CacheEntry<DashboardStats> | null;
  recentLeads: CacheEntry<Lead[]> | null;
  todayAppointments: CacheEntry<Appointment[]> | null;

  setDashboardStats: (stats: DashboardStats, branchId: string | null) => void;
  setRecentLeads: (leads: Lead[], branchId: string | null) => void;
  setTodayAppointments: (appointments: Appointment[], branchId: string | null) => void;
  isDashboardStale: (branchId: string | null, staleTime?: number) => boolean;
  clearDashboard: () => void;
}

// ======================
// RESTAURANT DASHBOARD SLICE
// ======================

interface RestaurantDashboardSlice {
  restaurantStats: CacheEntry<RestaurantStats> | null;
  restaurantOrders: CacheEntry<RestaurantOrder[]> | null;
  restaurantReservations: CacheEntry<RestaurantReservation[]> | null;

  setRestaurantStats: (stats: RestaurantStats, branchId: string | null) => void;
  setRestaurantOrders: (orders: RestaurantOrder[], branchId: string | null) => void;
  setRestaurantReservations: (reservations: RestaurantReservation[], branchId: string | null) => void;
  isRestaurantDashboardStale: (branchId: string | null, staleTime?: number) => boolean;
  clearRestaurantDashboard: () => void;
}

// ======================
// COMBINED STORE
// ======================

interface DashboardDataStore extends DefaultDashboardSlice, RestaurantDashboardSlice {
  clearAllDashboardCache: () => void;
  clearBranchDashboardCache: (branchId: string) => void;
}

// ======================
// HELPER FUNCTIONS
// ======================

function createCacheEntry<T>(data: T, branchId: string | null): CacheEntry<T> {
  return {
    data,
    lastFetched: Date.now(),
    branchId,
  };
}

function isStale(
  entry: CacheEntry<unknown> | null,
  branchId: string | null,
  staleTime: number = DEFAULT_STALE_TIME
): boolean {
  if (!entry) return true;
  if (entry.branchId !== branchId) return true;
  return Date.now() - entry.lastFetched > staleTime;
}

// ======================
// STORE IMPLEMENTATION
// ======================

export const useDashboardDataStore = create<DashboardDataStore>((set, get) => ({
  // ======================
  // DEFAULT DASHBOARD STATE & ACTIONS
  // ======================
  dashboardStats: null,
  recentLeads: null,
  todayAppointments: null,

  setDashboardStats: (stats, branchId) => set({
    dashboardStats: createCacheEntry(stats, branchId),
  }),

  setRecentLeads: (leads, branchId) => set({
    recentLeads: createCacheEntry(leads, branchId),
  }),

  setTodayAppointments: (appointments, branchId) => set({
    todayAppointments: createCacheEntry(appointments, branchId),
  }),

  isDashboardStale: (branchId, staleTime) => isStale(get().dashboardStats, branchId, staleTime),

  clearDashboard: () => set({
    dashboardStats: null,
    recentLeads: null,
    todayAppointments: null,
  }),

  // ======================
  // RESTAURANT DASHBOARD STATE & ACTIONS
  // ======================
  restaurantStats: null,
  restaurantOrders: null,
  restaurantReservations: null,

  setRestaurantStats: (stats, branchId) => set({
    restaurantStats: createCacheEntry(stats, branchId),
  }),

  setRestaurantOrders: (orders, branchId) => set({
    restaurantOrders: createCacheEntry(orders, branchId),
  }),

  setRestaurantReservations: (reservations, branchId) => set({
    restaurantReservations: createCacheEntry(reservations, branchId),
  }),

  isRestaurantDashboardStale: (branchId, staleTime) => isStale(get().restaurantStats, branchId, staleTime),

  clearRestaurantDashboard: () => set({
    restaurantStats: null,
    restaurantOrders: null,
    restaurantReservations: null,
  }),

  // ======================
  // GLOBAL ACTIONS
  // ======================
  clearAllDashboardCache: () => set({
    dashboardStats: null,
    recentLeads: null,
    todayAppointments: null,
    restaurantStats: null,
    restaurantOrders: null,
    restaurantReservations: null,
  }),

  clearBranchDashboardCache: (branchId) => {
    const state = get();
    const updates: Partial<DashboardDataStore> = {};

    if (state.dashboardStats?.branchId === branchId) updates.dashboardStats = null;
    if (state.recentLeads?.branchId === branchId) updates.recentLeads = null;
    if (state.todayAppointments?.branchId === branchId) updates.todayAppointments = null;
    if (state.restaurantStats?.branchId === branchId) updates.restaurantStats = null;
    if (state.restaurantOrders?.branchId === branchId) updates.restaurantOrders = null;
    if (state.restaurantReservations?.branchId === branchId) updates.restaurantReservations = null;

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },
}));

// ======================
// SELECTOR HOOKS
// ======================

/** Get cached default dashboard data if available and not stale */
export const useCachedDashboard = (branchId: string | null) => {
  const store = useDashboardDataStore();
  const isStale = store.isDashboardStale(branchId);

  const matchesBranch = (entry: CacheEntry<unknown> | null) =>
    !isStale && entry?.branchId === branchId;

  return {
    stats: matchesBranch(store.dashboardStats) ? store.dashboardStats!.data : null,
    recentLeads: matchesBranch(store.recentLeads) ? store.recentLeads!.data : null,
    todayAppointments: matchesBranch(store.todayAppointments) ? store.todayAppointments!.data : null,
    isStale,
    lastFetched: store.dashboardStats?.lastFetched || null,
  };
};

/** Get cached restaurant dashboard data if available and not stale */
export const useCachedRestaurantDashboard = (branchId: string | null) => {
  const store = useDashboardDataStore();
  const isStale = store.isRestaurantDashboardStale(branchId);

  const matchesBranch = (entry: CacheEntry<unknown> | null) =>
    !isStale && entry?.branchId === branchId;

  return {
    stats: matchesBranch(store.restaurantStats) ? store.restaurantStats!.data : null,
    orders: matchesBranch(store.restaurantOrders) ? store.restaurantOrders!.data : null,
    reservations: matchesBranch(store.restaurantReservations) ? store.restaurantReservations!.data : null,
    isStale,
    lastFetched: store.restaurantStats?.lastFetched || null,
  };
};
