# API Reference - Inventory Management

## TIS TIS Platform - Referencia de API

> Documentación completa de todas las funciones, tipos y componentes exportados del módulo de Inventory Management.

---

## Tabla de Contenidos

1. [Tipos Exportados](#tipos-exportados)
2. [Servicios](#servicios)
3. [Hooks](#hooks)
4. [Componentes](#componentes)
5. [Configuración](#configuración)
6. [Validación](#validación)

---

## Tipos Exportados

### Entidades de Base de Datos

```typescript
// Desde @/features/inventory-management/types

export interface InventoryItem {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  category_id: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  item_type: 'ingredient' | 'supply' | 'equipment' | 'packaging';
  unit: string;
  unit_cost: number;
  currency: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number | null;
  reorder_quantity: number | null;
  storage_location: string | null;
  storage_type: 'dry' | 'refrigerated' | 'frozen' | 'ambient';
  is_perishable: boolean;
  default_shelf_life_days: number | null;
  track_expiration: boolean;
  preferred_supplier_id: string | null;
  supplier_sku: string | null;
  image_url: string | null;
  allergens: string[];
  is_active: boolean;
  is_trackable: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MenuItemRecipe {
  id: string;
  tenant_id: string;
  menu_item_id: string;
  yield_quantity: number;
  yield_unit: string;
  total_cost: number;
  cost_per_portion: number;
  is_active: boolean;
  preparation_notes: string | null;
  storage_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RecipeIngredient {
  id: string;
  tenant_id: string;
  recipe_id: string;
  inventory_item_id: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  preparation_notes: string | null;
  is_optional: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  batch_id: string | null;
  movement_type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_cost: number | null;
  total_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  performed_by: string | null;
  staff_id: string | null;
  reason: string | null;
  notes: string | null;
  performed_at: string;
  metadata: Record<string, unknown>;
}

export interface InventoryCategory {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  icon: string | null;
  color: string;
  display_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  payment_terms: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

### Tipos de Enumeración

```typescript
export type MovementType =
  | 'purchase'
  | 'sale'
  | 'consumption'
  | 'waste'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'return'
  | 'production';

export type StockStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'overstocked';

export type AlertSeverity =
  | 'critical'
  | 'warning'
  | 'low';
```

### Tipos de Display (Extendidos)

```typescript
export interface InventoryItemDisplay extends InventoryItem {
  stockStatus: StockStatus;
  stockPercentage: number;
  stockValue: number;
  daysUntilReorder: number | null;
  formattedStock: string;
  formattedCost: string;
  formattedValue: string;
  formattedLastUpdated: string;
  isSelected?: boolean;
  isExpanded?: boolean;
  isEditing?: boolean;
  category?: InventoryCategory;
  supplier?: Supplier;
  recentMovements?: InventoryMovement[];
}

export interface RecipeDisplay extends MenuItemRecipe {
  ingredientCount: number;
  totalIngredientCost: number;
  profitMargin: number;
  formattedYield: string;
  formattedTotalCost: string;
  formattedCostPerPortion: string;
  menuItemName?: string;
  ingredients?: RecipeIngredientDisplay[];
  isExpanded?: boolean;
  isEditing?: boolean;
}

export interface RecipeIngredientDisplay extends RecipeIngredient {
  itemName: string;
  itemUnit: string;
  currentStock: number;
  minimumStock: number;
  isInStock: boolean;
  canFulfill: boolean;
  formattedQuantity: string;
  formattedCost: string;
  isSelected?: boolean;
}

export interface MovementDisplay extends InventoryMovement {
  itemName: string;
  itemUnit: string;
  performedByName: string | null;
  isInbound: boolean;
  impactAmount: number;
  formattedQuantity: string;
  formattedCost: string;
  formattedDate: string;
  formattedTimeAgo: string;
  isHighlighted?: boolean;
}

export interface LowStockAlert {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  item_name: string;
  sku: string | null;
  current_stock: number;
  minimum_stock: number;
  reorder_quantity: number | null;
  unit: string;
  percentageRemaining: number;
  severity: AlertSeverity;
  status: 'active' | 'resolved';
  created_at: string;
  resolved_at: string | null;
  formattedStock: string;
  formattedTimeActive: string;
  isDismissed?: boolean;
}
```

### Tipos de Formulario

```typescript
export interface InventoryItemFormData {
  name: string;
  item_type: 'ingredient' | 'supply' | 'equipment' | 'packaging';
  unit: string;
  unit_cost: number;
  current_stock: number;
  minimum_stock: number;
  sku?: string;
  description?: string;
  category_id?: string;
  maximum_stock?: number;
  reorder_quantity?: number;
  storage_location?: string;
  storage_type?: 'dry' | 'refrigerated' | 'frozen' | 'ambient';
  is_perishable?: boolean;
  default_shelf_life_days?: number;
  track_expiration?: boolean;
  preferred_supplier_id?: string;
  supplier_sku?: string;
  image_url?: string;
  allergens?: string[];
  is_active?: boolean;
  is_trackable?: boolean;
}

export interface RecipeFormData {
  menu_item_id: string;
  yield_quantity: number;
  yield_unit: string;
  preparation_notes?: string;
  storage_notes?: string;
  is_active?: boolean;
  ingredients: RecipeIngredientFormData[];
}

export interface RecipeIngredientFormData {
  inventory_item_id: string;
  quantity: number;
  unit: string;
  preparation_notes?: string;
  is_optional?: boolean;
  display_order: number;
}

export interface MovementFormData {
  item_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost?: number;
  reason?: string;
  notes?: string;
  performed_by?: string;
}

export interface BulkAdjustmentFormData {
  items: Array<{
    item_id: string;
    quantity: number;
    reason: string;
  }>;
  performed_by: string;
  notes?: string;
}
```

### Tipos de Filtros

```typescript
export interface InventoryFilters {
  search?: string;
  item_type?: 'ingredient' | 'supply' | 'equipment' | 'packaging';
  category_id?: string;
  stock_status?: StockStatus;
  storage_type?: 'dry' | 'refrigerated' | 'frozen' | 'ambient';
  is_active?: boolean;
  is_trackable?: boolean;
  branch_id?: string;
  sort_by?: 'name' | 'current_stock' | 'unit_cost' | 'updated_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MovementFilters {
  item_id?: string;
  movement_type?: MovementType;
  start_date?: string;
  end_date?: string;
  performed_by?: string;
  branch_id?: string;
  page?: number;
  limit?: number;
}

export interface RecipeFilters {
  menu_item_id?: string;
  search?: string;
  is_active?: boolean;
  has_low_stock_ingredients?: boolean;
  min_cost?: number;
  max_cost?: number;
  page?: number;
  limit?: number;
}

export interface AlertFilters {
  severity?: AlertSeverity;
  status?: 'active' | 'resolved';
  item_type?: 'ingredient' | 'supply' | 'equipment' | 'packaging';
  branch_id?: string;
  category_id?: string;
}
```

### Tipos de Respuesta API

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: string;
}

// Alias específicos
export interface InventoryItemsResponse extends PaginatedResponse<InventoryItemDisplay> {}
export interface RecipesResponse extends PaginatedResponse<RecipeDisplay> {}
export interface MovementsResponse extends PaginatedResponse<MovementDisplay> {}
export interface AlertsResponse extends ApiResponse<LowStockAlert[]> {}
```

### Tipos de Estadísticas

```typescript
export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  criticalAlerts: number;
  averageStockLevel: number;
  byItemType: Record<'ingredient' | 'supply' | 'equipment' | 'packaging', {
    count: number;
    value: number;
  }>;
  byStorageType: Record<'dry' | 'refrigerated' | 'frozen' | 'ambient', {
    count: number;
    value: number;
  }>;
  consumption: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  topByValue: Array<{ id: string; name: string; value: number }>;
  topByMovement: Array<{ id: string; name: string; movementCount: number }>;
}

export interface MovementStats {
  totalMovements: number;
  totalInbound: number;
  totalOutbound: number;
  netChange: number;
  byType: Record<MovementType, {
    count: number;
    totalQuantity: number;
    totalCost: number;
  }>;
  byDay: Array<{
    date: string;
    inbound: number;
    outbound: number;
    net: number;
  }>;
}
```

---

## Servicios

### `getInventoryItems`

```typescript
async function getInventoryItems(
  filters?: InventoryFilters
): Promise<PaginatedResponse<InventoryItemDisplay>>
```

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `filters.search` | `string` | - | Búsqueda en nombre y SKU |
| `filters.item_type` | `ItemType` | - | Filtrar por tipo |
| `filters.category_id` | `string` | - | Filtrar por categoría (UUID) |
| `filters.stock_status` | `StockStatus` | - | Filtrar por estado |
| `filters.storage_type` | `StorageType` | - | Filtrar por almacenamiento |
| `filters.is_active` | `boolean` | - | Solo items activos |
| `filters.is_trackable` | `boolean` | - | Solo items rastreables |
| `filters.branch_id` | `string` | - | Filtrar por sucursal (UUID) |
| `filters.sort_by` | `string` | `'name'` | Campo de ordenamiento |
| `filters.sort_order` | `'asc'\|'desc'` | `'asc'` | Dirección de orden |
| `filters.page` | `number` | `1` | Número de página |
| `filters.limit` | `number` | `20` | Items por página |

**Retorno:**
```typescript
{
  success: true,
  data: InventoryItemDisplay[],
  pagination: {
    total: 150,
    page: 1,
    pageSize: 20,
    totalPages: 8,
    hasMore: true
  }
}
```

---

### `getInventoryItem`

```typescript
async function getInventoryItem(
  id: string
): Promise<ApiResponse<InventoryItemDisplay>>
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | `string` | UUID del item |

**Retorno exitoso:**
```typescript
{
  success: true,
  data: InventoryItemDisplay
}
```

**Retorno con error:**
```typescript
{
  success: false,
  data: null,
  error: 'Invalid item ID format' | 'User not authenticated' | 'Item not found'
}
```

---

### `createInventoryItem`

```typescript
async function createInventoryItem(
  data: InventoryItemFormData
): Promise<ApiResponse<InventoryItemDisplay>>
```

**Campos requeridos:**
- `name: string`
- `item_type: ItemType`
- `unit: string`
- `unit_cost: number`
- `current_stock: number`
- `minimum_stock: number`

**Retorno:**
```typescript
{
  success: true,
  data: InventoryItemDisplay,
  message: 'Item creado exitosamente'
}
```

---

### `updateInventoryItem`

```typescript
async function updateInventoryItem(
  id: string,
  data: Partial<InventoryItemFormData>
): Promise<ApiResponse<InventoryItemDisplay>>
```

Solo actualiza los campos proporcionados.

---

### `deleteInventoryItem`

```typescript
async function deleteInventoryItem(
  id: string
): Promise<ApiResponse<null>>
```

Realiza soft delete (marca `deleted_at`).

---

### `subscribeToInventoryChanges`

```typescript
async function subscribeToInventoryChanges(
  callback: (payload: InventoryRealtimePayload) => void
): Promise<{ unsubscribe: () => void }>
```

**Payload:**
```typescript
interface InventoryRealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: InventoryItemDisplay;
  old: InventoryItemDisplay;
}
```

---

## Hooks

### `useInventory`

```typescript
function useInventory(options?: UseInventoryOptions): UseInventoryReturn
```

**UseInventoryOptions:**
```typescript
interface UseInventoryOptions {
  initialFilters?: InventoryFilters;
  autoFetch?: boolean;         // default: false
  realtime?: boolean;          // default: false
  searchDebounce?: number;     // default: 300
}
```

**UseInventoryReturn:**
```typescript
interface UseInventoryReturn {
  // Estado
  items: InventoryItemDisplay[];
  selectedItem: InventoryItemDisplay | null;
  loading: boolean;
  error: string | null;
  stats: {
    total: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    overstocked: number;
    totalValue: number;
  };
  filters: InventoryFilters;

  // Queries
  fetchItems: (filters?: InventoryFilters) => Promise<void>;
  getItem: (id: string) => Promise<InventoryItemDisplay | null>;
  refreshItem: (id: string) => Promise<void>;

  // Mutations
  createItem: (data: InventoryItemFormData) => Promise<InventoryItemDisplay>;
  updateItem: (id: string, data: Partial<InventoryItemFormData>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  // Selection
  selectItem: (id: string | null) => void;

  // Filters
  updateFilters: (newFilters: Partial<InventoryFilters>) => void;
  clearFilters: () => void;
}
```

---

## Componentes

### StockStatusBadge

```tsx
interface StockStatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: StockStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}
```

### StockLevelIndicator

```tsx
interface StockLevelIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  currentStock: number;
  minimumStock: number;
  maximumStock?: number | null;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

### StockValueDisplay

```tsx
interface StockValueDisplayProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}
```

### MovementTypeBadge

```tsx
interface MovementTypeBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  type: MovementType;
  size?: 'sm' | 'md' | 'lg';
  showDirection?: boolean;
  compact?: boolean;
}
```

### MovementDirection

```tsx
interface MovementDirectionProps extends HTMLAttributes<HTMLDivElement> {
  quantity: number;
  unit: string;
  isInbound: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

### InventoryItemCard

```tsx
interface InventoryItemCardProps {
  item: InventoryItemDisplay;
  onSelect?: (item: InventoryItemDisplay) => void;
  onEdit?: (item: InventoryItemDisplay) => void;
  onDelete?: (item: InventoryItemDisplay) => void;
}
```

### InventoryList

```tsx
interface InventoryListProps {
  items: InventoryItemDisplay[];
  layout?: 'grid' | 'list';
  loading?: boolean;
  onSelect?: (item: InventoryItemDisplay) => void;
  onEdit?: (item: InventoryItemDisplay) => void;
  onDelete?: (item: InventoryItemDisplay) => void;
}
```

### VirtualizedInventoryList

```tsx
interface VirtualizedInventoryListProps {
  items: InventoryItemDisplay[];
  itemHeight?: number;
  onSelect?: (item: InventoryItemDisplay) => void;
}
```

### InventoryFiltersBar

```tsx
interface InventoryFiltersProps {
  filters: InventoryFilters;
  onChange: (filters: Partial<InventoryFilters>) => void;
  onClear: () => void;
}
```

### InventoryStatsPanel

```tsx
interface InventoryStatsProps {
  stats: {
    total: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    overstocked: number;
    totalValue: number;
  };
}
```

---

## Configuración

### STOCK_STATUS_CONFIG

```typescript
const STOCK_STATUS_CONFIG: Record<StockStatus, {
  label: string;
  icon: string;
  colors: {
    bg: string;
    text: string;
    border: string;
    badge: string;
    icon: string;
  };
}>
```

### ALERT_SEVERITY_CONFIG

```typescript
const ALERT_SEVERITY_CONFIG: Record<AlertSeverity, {
  label: string;
  icon: string;
  priority: number;
  colors: { bg, text, border, badge, icon };
  animation?: string;
}>
```

### MOVEMENT_TYPE_CONFIG

```typescript
const MOVEMENT_TYPE_CONFIG: Record<MovementType, {
  label: string;
  shortLabel: string;
  icon: string;
  isInbound: boolean;
  colors: { bg, text, icon, badge };
  description: string;
}>
```

### ITEM_TYPE_CONFIG

```typescript
const ITEM_TYPE_CONFIG: Record<ItemType, {
  label: string;
  icon: string;
  colors: { bg, text, icon, badge };
  description: string;
}>
```

### STORAGE_TYPE_CONFIG

```typescript
const STORAGE_TYPE_CONFIG: Record<StorageType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  temperature: string;
}>
```

### UNIT_TYPES

```typescript
const UNIT_TYPES: {
  weight: { label: string; units: Array<{ value, label }> };
  volume: { label: string; units: Array<{ value, label }> };
  count: { label: string; units: Array<{ value, label }> };
}
```

### CURRENCY_CONFIG

```typescript
const CURRENCY_CONFIG: {
  MXN: { symbol, code, name, format: (amount) => string };
  USD: { symbol, code, name, format: (amount) => string };
}
```

### STOCK_THRESHOLDS

```typescript
const STOCK_THRESHOLDS: {
  CRITICAL: 0.5;   // < 50% of minimum
  WARNING: 0.75;   // < 75% of minimum
  LOW: 1.0;        // <= 100% of minimum
  OVERSTOCK: 1.5;  // > 150% of maximum
}
```

### PAGINATION_DEFAULTS

```typescript
const PAGINATION_DEFAULTS: {
  PAGE_SIZE: 20;
  PAGE_SIZES: [10, 20, 50, 100];
  MAX_PAGE_SIZE: 100;
}
```

### SORT_OPTIONS

```typescript
const SORT_OPTIONS: {
  inventory: Array<{ value, label }>;
  movements: Array<{ value, label }>;
  recipes: Array<{ value, label }>;
}
```

### VALIDATION_RULES

```typescript
const VALIDATION_RULES: {
  item: {
    name: { minLength, maxLength, required };
    sku: { pattern, maxLength };
    current_stock: { min, required };
    minimum_stock: { min, required };
    unit_cost: { min, required };
  };
  recipe: {
    yield_quantity: { min, required };
    ingredients: { minItems, required };
  };
  movement: {
    quantity: { notZero, required };
  };
}
```

---

## Validación

### validateInventoryItem

```typescript
function validateInventoryItem(
  data: Partial<InventoryItemFormData>
): ValidationResult
```

### validateCompleteInventoryItem

```typescript
function validateCompleteInventoryItem(
  data: unknown
): ValidationResult
```

### validateRecipe

```typescript
function validateRecipe(
  data: Partial<RecipeFormData>
): ValidationResult
```

### validateMovement

```typescript
function validateMovement(
  data: Partial<MovementFormData>
): ValidationResult
```

### isValidUUID

```typescript
function isValidUUID(value: string): boolean
```

Valida formato UUID v1-5.

### isValidSKU

```typescript
function isValidSKU(value: string): boolean
```

Valida formato SKU (mayúsculas, números, guiones).

### formatValidationErrors

```typescript
function formatValidationErrors(errors: ValidationError[]): string
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

---

*Documentación generada: Enero 2026*
