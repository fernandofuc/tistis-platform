// =====================================================
// TIS TIS PLATFORM - Inventory Management Components
// Barrel exports for all UI components
// =====================================================

// ======================
// BADGE COMPONENTS
// ======================
export {
  StockStatusBadge,
  StockLevelIndicator,
  StockValueDisplay,
  type StockStatusBadgeProps,
  type StockLevelIndicatorProps,
  type StockValueDisplayProps,
} from './StockStatusBadge';

export {
  MovementTypeBadge,
  MovementDirection,
  type MovementTypeBadgeProps,
  type MovementDirectionProps,
} from './MovementTypeBadge';

// ======================
// CARD COMPONENTS
// ======================
export {
  InventoryItemCard,
  type InventoryItemCardProps,
} from './InventoryItemCard';

// ======================
// FILTER COMPONENTS
// ======================
export {
  InventoryFiltersComponent as InventoryFiltersBar,
  type InventoryFiltersProps,
} from './InventoryFilters';

// ======================
// STATS COMPONENTS
// ======================
export {
  InventoryStats as InventoryStatsPanel,
  type InventoryStatsProps,
} from './InventoryStats';

// ======================
// LIST COMPONENTS
// ======================
export {
  InventoryList,
  InventoryLayoutToggle,
  VirtualizedInventoryList,
  type InventoryListProps,
  type VirtualizedInventoryListProps,
} from './InventoryList';
