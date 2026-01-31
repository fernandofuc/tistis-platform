// =====================================================
// TIS TIS PLATFORM - Restaurant Data Store (Zustand)
// Centralized cache for restaurant data with SWR pattern
// Prevents re-loading when navigating between tabs
// =====================================================

import { create } from 'zustand';
import type { RestaurantTable, TableStats } from '@/src/features/restaurant-tables/types';
import type {
  InventoryItem,
  InventoryCategory,
  InventorySupplier,
  InventoryMovement,
  InventoryStats,
} from '@/src/features/restaurant-inventory/types';
import type { MenuCategory, MenuItem, MenuStats } from '@/src/features/restaurant-menu/types';
import type {
  KDSOrderView,
  KitchenStationConfig,
  KDSStats,
  RestaurantOrder,
} from '@/src/features/restaurant-kitchen/types';

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
// TABLES SLICE
// ======================

interface TablesSlice {
  tables: CacheEntry<RestaurantTable[]> | null;
  tableStats: CacheEntry<TableStats | null> | null;

  setTables: (tables: RestaurantTable[], branchId: string | null) => void;
  setTableStats: (stats: TableStats | null, branchId: string | null) => void;
  updateTable: (table: RestaurantTable) => void;
  removeTable: (tableId: string) => void;
  addTable: (table: RestaurantTable) => void;
  isTablesStale: (branchId: string | null, staleTime?: number) => boolean;
  clearTables: () => void;
}

// ======================
// INVENTORY SLICE
// ======================

interface InventorySlice {
  inventoryItems: CacheEntry<InventoryItem[]> | null;
  inventoryCategories: CacheEntry<InventoryCategory[]> | null;
  inventorySuppliers: CacheEntry<InventorySupplier[]> | null;
  inventoryMovements: CacheEntry<InventoryMovement[]> | null;
  inventoryStats: CacheEntry<InventoryStats | null> | null;

  setInventoryItems: (items: InventoryItem[], branchId: string | null) => void;
  setInventoryCategories: (categories: InventoryCategory[], branchId: string | null) => void;
  setInventorySuppliers: (suppliers: InventorySupplier[], branchId: string | null) => void;
  setInventoryMovements: (movements: InventoryMovement[], branchId: string | null) => void;
  setInventoryStats: (stats: InventoryStats | null, branchId: string | null) => void;
  isInventoryStale: (branchId: string | null, staleTime?: number) => boolean;
  clearInventory: () => void;
}

// ======================
// MENU SLICE
// ======================

interface MenuSlice {
  menuCategories: CacheEntry<MenuCategory[]> | null;
  menuItems: CacheEntry<MenuItem[]> | null;
  menuStats: CacheEntry<MenuStats | null> | null;

  setMenuCategories: (categories: MenuCategory[], branchId: string | null) => void;
  setMenuItems: (items: MenuItem[], branchId: string | null) => void;
  setMenuStats: (stats: MenuStats | null, branchId: string | null) => void;
  updateMenuItem: (item: MenuItem) => void;
  updateMenuCategory: (category: MenuCategory) => void;
  isMenuStale: (branchId: string | null, staleTime?: number) => boolean;
  clearMenu: () => void;
}

// ======================
// KITCHEN SLICE
// ======================

interface KitchenSlice {
  kitchenOrders: CacheEntry<KDSOrderView[]> | null;
  kitchenOrderHistory: CacheEntry<RestaurantOrder[]> | null;
  kitchenStations: CacheEntry<KitchenStationConfig[]> | null;
  kitchenStats: CacheEntry<KDSStats | null> | null;

  setKitchenOrders: (orders: KDSOrderView[], branchId: string | null) => void;
  setKitchenOrderHistory: (orders: RestaurantOrder[], branchId: string | null) => void;
  setKitchenStations: (stations: KitchenStationConfig[], branchId: string | null) => void;
  setKitchenStats: (stats: KDSStats | null, branchId: string | null) => void;
  isKitchenStale: (branchId: string | null, staleTime?: number) => boolean;
  clearKitchen: () => void;
}

// ======================
// COMBINED STORE
// ======================

interface RestaurantDataStore extends TablesSlice, InventorySlice, MenuSlice, KitchenSlice {
  // Global actions
  clearAllCache: () => void;
  clearBranchCache: (branchId: string) => void;
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

export const useRestaurantDataStore = create<RestaurantDataStore>((set, get) => ({
  // ======================
  // TABLES STATE & ACTIONS
  // ======================
  tables: null,
  tableStats: null,

  setTables: (tables, branchId) => set({
    tables: createCacheEntry(tables, branchId),
  }),

  setTableStats: (stats, branchId) => set({
    tableStats: createCacheEntry(stats, branchId),
  }),

  updateTable: (table) => set((state) => {
    if (!state.tables) return state;
    return {
      tables: {
        ...state.tables,
        data: state.tables.data.map((t) => t.id === table.id ? table : t),
      },
    };
  }),

  removeTable: (tableId) => set((state) => {
    if (!state.tables) return state;
    return {
      tables: {
        ...state.tables,
        data: state.tables.data.filter((t) => t.id !== tableId),
      },
    };
  }),

  addTable: (table) => set((state) => {
    if (!state.tables) return state;
    // Avoid duplicates
    if (state.tables.data.some((t) => t.id === table.id)) return state;
    return {
      tables: {
        ...state.tables,
        data: [...state.tables.data, table],
      },
    };
  }),

  isTablesStale: (branchId, staleTime) => isStale(get().tables, branchId, staleTime),

  clearTables: () => set({ tables: null, tableStats: null }),

  // ======================
  // INVENTORY STATE & ACTIONS
  // ======================
  inventoryItems: null,
  inventoryCategories: null,
  inventorySuppliers: null,
  inventoryMovements: null,
  inventoryStats: null,

  setInventoryItems: (items, branchId) => set({
    inventoryItems: createCacheEntry(items, branchId),
  }),

  setInventoryCategories: (categories, branchId) => set({
    inventoryCategories: createCacheEntry(categories, branchId),
  }),

  setInventorySuppliers: (suppliers, branchId) => set({
    inventorySuppliers: createCacheEntry(suppliers, branchId),
  }),

  setInventoryMovements: (movements, branchId) => set({
    inventoryMovements: createCacheEntry(movements, branchId),
  }),

  setInventoryStats: (stats, branchId) => set({
    inventoryStats: createCacheEntry(stats, branchId),
  }),

  isInventoryStale: (branchId, staleTime) => isStale(get().inventoryItems, branchId, staleTime),

  clearInventory: () => set({
    inventoryItems: null,
    inventoryCategories: null,
    inventorySuppliers: null,
    inventoryMovements: null,
    inventoryStats: null,
  }),

  // ======================
  // MENU STATE & ACTIONS
  // ======================
  menuCategories: null,
  menuItems: null,
  menuStats: null,

  setMenuCategories: (categories, branchId) => set({
    menuCategories: createCacheEntry(categories, branchId),
  }),

  setMenuItems: (items, branchId) => set({
    menuItems: createCacheEntry(items, branchId),
  }),

  setMenuStats: (stats, branchId) => set({
    menuStats: createCacheEntry(stats, branchId),
  }),

  updateMenuItem: (item) => set((state) => {
    if (!state.menuItems) return state;
    return {
      menuItems: {
        ...state.menuItems,
        data: state.menuItems.data.map((i) => i.id === item.id ? item : i),
      },
    };
  }),

  updateMenuCategory: (category) => set((state) => {
    if (!state.menuCategories) return state;
    return {
      menuCategories: {
        ...state.menuCategories,
        data: state.menuCategories.data.map((c) => c.id === category.id ? category : c),
      },
    };
  }),

  isMenuStale: (branchId, staleTime) => isStale(get().menuItems, branchId, staleTime),

  clearMenu: () => set({
    menuCategories: null,
    menuItems: null,
    menuStats: null,
  }),

  // ======================
  // KITCHEN STATE & ACTIONS
  // ======================
  kitchenOrders: null,
  kitchenOrderHistory: null,
  kitchenStations: null,
  kitchenStats: null,

  setKitchenOrders: (orders, branchId) => set({
    kitchenOrders: createCacheEntry(orders, branchId),
  }),

  setKitchenOrderHistory: (orders, branchId) => set({
    kitchenOrderHistory: createCacheEntry(orders, branchId),
  }),

  setKitchenStations: (stations, branchId) => set({
    kitchenStations: createCacheEntry(stations, branchId),
  }),

  setKitchenStats: (stats, branchId) => set({
    kitchenStats: createCacheEntry(stats, branchId),
  }),

  isKitchenStale: (branchId, staleTime) => isStale(get().kitchenOrders, branchId, staleTime),

  clearKitchen: () => set({
    kitchenOrders: null,
    kitchenOrderHistory: null,
    kitchenStations: null,
    kitchenStats: null,
  }),

  // ======================
  // GLOBAL ACTIONS
  // ======================
  clearAllCache: () => set({
    tables: null,
    tableStats: null,
    inventoryItems: null,
    inventoryCategories: null,
    inventorySuppliers: null,
    inventoryMovements: null,
    inventoryStats: null,
    menuCategories: null,
    menuItems: null,
    menuStats: null,
    kitchenOrders: null,
    kitchenOrderHistory: null,
    kitchenStations: null,
    kitchenStats: null,
  }),

  clearBranchCache: (branchId) => {
    const state = get();
    const updates: Partial<RestaurantDataStore> = {};

    if (state.tables?.branchId === branchId) updates.tables = null;
    if (state.tableStats?.branchId === branchId) updates.tableStats = null;
    if (state.inventoryItems?.branchId === branchId) updates.inventoryItems = null;
    if (state.inventoryCategories?.branchId === branchId) updates.inventoryCategories = null;
    if (state.inventorySuppliers?.branchId === branchId) updates.inventorySuppliers = null;
    if (state.inventoryMovements?.branchId === branchId) updates.inventoryMovements = null;
    if (state.inventoryStats?.branchId === branchId) updates.inventoryStats = null;
    if (state.menuCategories?.branchId === branchId) updates.menuCategories = null;
    if (state.menuItems?.branchId === branchId) updates.menuItems = null;
    if (state.menuStats?.branchId === branchId) updates.menuStats = null;
    if (state.kitchenOrders?.branchId === branchId) updates.kitchenOrders = null;
    if (state.kitchenOrderHistory?.branchId === branchId) updates.kitchenOrderHistory = null;
    if (state.kitchenStations?.branchId === branchId) updates.kitchenStations = null;
    if (state.kitchenStats?.branchId === branchId) updates.kitchenStats = null;

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },
}));

// ======================
// SELECTOR HOOKS
// ======================

/** Get cached tables data if available and not stale */
export const useCachedTables = (branchId: string | null) => {
  const { tables, tableStats, isTablesStale } = useRestaurantDataStore();
  const isStale = isTablesStale(branchId);

  return {
    tables: !isStale && tables?.branchId === branchId ? tables.data : null,
    stats: !isStale && tableStats?.branchId === branchId ? tableStats.data : null,
    isStale,
    lastFetched: tables?.lastFetched || null,
  };
};

/** Get cached inventory data if available and not stale */
export const useCachedInventory = (branchId: string | null) => {
  const store = useRestaurantDataStore();
  const isStale = store.isInventoryStale(branchId);

  const matchesBranch = (entry: CacheEntry<unknown> | null) =>
    !isStale && entry?.branchId === branchId;

  return {
    items: matchesBranch(store.inventoryItems) ? store.inventoryItems!.data : null,
    categories: matchesBranch(store.inventoryCategories) ? store.inventoryCategories!.data : null,
    suppliers: matchesBranch(store.inventorySuppliers) ? store.inventorySuppliers!.data : null,
    movements: matchesBranch(store.inventoryMovements) ? store.inventoryMovements!.data : null,
    stats: matchesBranch(store.inventoryStats) ? store.inventoryStats!.data : null,
    isStale,
    lastFetched: store.inventoryItems?.lastFetched || null,
  };
};

/** Get cached menu data if available and not stale */
export const useCachedMenu = (branchId: string | null) => {
  const store = useRestaurantDataStore();
  const isStale = store.isMenuStale(branchId);

  const matchesBranch = (entry: CacheEntry<unknown> | null) =>
    !isStale && entry?.branchId === branchId;

  return {
    categories: matchesBranch(store.menuCategories) ? store.menuCategories!.data : null,
    items: matchesBranch(store.menuItems) ? store.menuItems!.data : null,
    stats: matchesBranch(store.menuStats) ? store.menuStats!.data : null,
    isStale,
    lastFetched: store.menuItems?.lastFetched || null,
  };
};

/** Get cached kitchen data if available and not stale */
export const useCachedKitchen = (branchId: string | null) => {
  const store = useRestaurantDataStore();
  const isStale = store.isKitchenStale(branchId);

  const matchesBranch = (entry: CacheEntry<unknown> | null) =>
    !isStale && entry?.branchId === branchId;

  return {
    orders: matchesBranch(store.kitchenOrders) ? store.kitchenOrders!.data : null,
    orderHistory: matchesBranch(store.kitchenOrderHistory) ? store.kitchenOrderHistory!.data : null,
    stations: matchesBranch(store.kitchenStations) ? store.kitchenStations!.data : null,
    stats: matchesBranch(store.kitchenStats) ? store.kitchenStats!.data : null,
    isStale,
    lastFetched: store.kitchenOrders?.lastFetched || null,
  };
};
