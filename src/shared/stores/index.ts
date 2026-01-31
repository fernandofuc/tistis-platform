// =====================================================
// TIS TIS PLATFORM - Stores Index
// =====================================================

export { useAppStore, useToast, useBranch, useCurrentStaff } from './appStore';

// Restaurant Data Cache Store
export {
  useRestaurantDataStore,
  useCachedTables,
  useCachedInventory,
  useCachedMenu,
  useCachedKitchen,
} from './restaurantDataStore';

// Dashboard Data Cache Store
export {
  useDashboardDataStore,
  useCachedDashboard,
  useCachedRestaurantDashboard,
} from './dashboardDataStore';

export type {
  DashboardStats,
  RestaurantStats,
  RestaurantOrder,
  RestaurantReservation,
} from './dashboardDataStore';
