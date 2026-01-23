# Inventory Management System

## TIS TIS Platform - Sistema de Gestión de Inventario

> Módulo completo de gestión de inventario para restaurantes y negocios de alimentos, con soporte multi-tenant, actualización en tiempo real, y diseño premium inspirado en Apple/Google.

---

## Tabla de Contenidos

1. [Arquitectura del Módulo](#arquitectura-del-módulo)
2. [Instalación y Configuración](#instalación-y-configuración)
3. [Estructura de Archivos](#estructura-de-archivos)
4. [Tipos y Entidades](#tipos-y-entidades)
5. [Servicios](#servicios)
6. [Hooks](#hooks)
7. [Componentes](#componentes)
8. [Configuración](#configuración)
9. [Validación](#validación)
10. [Testing](#testing)
11. [Seguridad](#seguridad)
12. [Roadmap](#roadmap)

---

## Arquitectura del Módulo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INVENTORY MANAGEMENT                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Components │  │    Hooks    │  │  Services   │  │   Config    │ │
│  │     (UI)    │◄─│ (State Mgmt)│◄─│ (Data Layer)│◄─│  (Settings) │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│         │                │                │                │        │
│         └────────────────┴────────────────┴────────────────┘        │
│                                   │                                  │
│                          ┌────────▼────────┐                        │
│                          │      Types      │                        │
│                          │  (TypeScript)   │                        │
│                          └────────┬────────┘                        │
│                                   │                                  │
├───────────────────────────────────┼──────────────────────────────────┤
│                                   ▼                                  │
│                    ┌─────────────────────────────┐                  │
│                    │    Supabase (PostgreSQL)    │                  │
│                    │  - RLS (Row Level Security) │                  │
│                    │  - Realtime Subscriptions   │                  │
│                    │  - Multi-tenant Isolation   │                  │
│                    └─────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

```
Usuario → Componente → Hook → Servicio → Supabase → Base de Datos
                                    ↓
                            Transformación
                            (Display Types)
                                    ↓
Usuario ← Componente ← Hook ← Servicio ← Respuesta
```

---

## Instalación y Configuración

### Prerequisitos

- Node.js 18+
- pnpm 8+
- Cuenta de Supabase configurada
- Variables de entorno configuradas

### Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
```

### Importación del Módulo

```typescript
// Importar todo el módulo
import * as InventoryManagement from '@/features/inventory-management';

// Importar elementos específicos
import {
  // Types
  InventoryItem,
  InventoryItemDisplay,
  MovementType,
  StockStatus,

  // Hooks
  useInventory,

  // Services
  getInventoryItems,
  createInventoryItem,

  // Components
  StockStatusBadge,
  InventoryList,

  // Config
  STOCK_STATUS_CONFIG,
} from '@/features/inventory-management';
```

---

## Estructura de Archivos

```
src/features/inventory-management/
├── index.ts                    # Barrel export principal
├── README.md                   # Esta documentación
│
├── types/
│   └── index.ts               # Definiciones de tipos TypeScript
│
├── services/
│   ├── index.ts               # Barrel export de servicios
│   └── inventory.service.ts   # Cliente API para operaciones CRUD
│
├── hooks/
│   ├── index.ts               # Barrel export de hooks
│   └── useInventory.ts        # Hook principal de estado
│
├── components/
│   ├── index.ts               # Barrel export de componentes
│   ├── StockStatusBadge.tsx   # Badge de estado de stock
│   ├── MovementTypeBadge.tsx  # Badge de tipo de movimiento
│   ├── InventoryItemCard.tsx  # Tarjeta de item
│   ├── InventoryStats.tsx     # Panel de estadísticas
│   ├── InventoryFilters.tsx   # Barra de filtros
│   └── InventoryList.tsx      # Lista de inventario
│
├── config/
│   └── inventory-config.ts    # Configuración del sistema de diseño
│
└── lib/
    ├── index.ts               # Barrel export de utilidades
    └── validation.ts          # Funciones de validación
```

---

## Tipos y Entidades

### Entidades Principales

#### `InventoryItem`
Representa un item de inventario en la base de datos.

```typescript
interface InventoryItem {
  id: string;                   // UUID
  tenant_id: string;            // ID del tenant (multi-tenancy)
  branch_id: string | null;     // Sucursal (opcional)

  // Identificación
  sku: string | null;           // Código SKU
  name: string;                 // Nombre del item
  description: string | null;   // Descripción

  // Clasificación
  item_type: 'ingredient' | 'supply' | 'equipment' | 'packaging';

  // Unidades y Costos
  unit: string;                 // kg, g, l, ml, unit, etc.
  unit_cost: number;            // Costo por unidad
  currency: string;             // MXN, USD

  // Stock
  current_stock: number;        // Stock actual
  minimum_stock: number;        // Stock mínimo (trigger alertas)
  maximum_stock: number | null; // Stock máximo (opcional)
  reorder_quantity: number | null; // Cantidad de reorden

  // Almacenamiento
  storage_location: string | null;
  storage_type: 'dry' | 'refrigerated' | 'frozen' | 'ambient';

  // Caducidad
  is_perishable: boolean;
  default_shelf_life_days: number | null;
  track_expiration: boolean;

  // Metadatos
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;    // Soft delete
}
```

#### `InventoryItemDisplay`
Extiende `InventoryItem` con campos calculados para UI.

```typescript
interface InventoryItemDisplay extends InventoryItem {
  // Campos calculados
  stockStatus: StockStatus;     // 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstocked'
  stockPercentage: number;      // (current / minimum) * 100
  stockValue: number;           // current_stock * unit_cost

  // Campos formateados
  formattedStock: string;       // "10.5 kg"
  formattedCost: string;        // "$150.00 MXN"
  formattedValue: string;       // "$1,575.00 MXN"
  formattedLastUpdated: string; // "hace 2 horas"
}
```

#### `InventoryMovement`
Registra movimientos de inventario.

```typescript
interface InventoryMovement {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;

  movement_type: MovementType;  // Tipo de movimiento
  quantity: number;             // Positivo = entrada, Negativo = salida
  previous_stock: number;
  new_stock: number;

  unit_cost: number | null;
  total_cost: number | null;

  performed_by: string | null;  // Usuario que realizó el movimiento
  performed_at: string;         // Timestamp

  reason: string | null;
  notes: string | null;
}
```

### Tipos de Movimiento

```typescript
type MovementType =
  | 'purchase'      // Compra/Recepción de proveedor
  | 'sale'          // Venta directa
  | 'consumption'   // Consumo en producción (recetas)
  | 'waste'         // Merma/Desperdicio
  | 'adjustment'    // Ajuste manual
  | 'transfer_in'   // Transferencia entrante
  | 'transfer_out'  // Transferencia saliente
  | 'return'        // Devolución a proveedor
  | 'production';   // Producción interna
```

### Estados de Stock

```typescript
type StockStatus =
  | 'in_stock'      // Stock normal
  | 'low_stock'     // Stock bajo (≤ minimum_stock)
  | 'out_of_stock'  // Sin stock (= 0)
  | 'overstocked';  // Sobre stock (> 150% de maximum)
```

---

## Servicios

### `inventory.service.ts`

Cliente API para operaciones CRUD con Supabase.

#### Funciones Exportadas

##### `getInventoryItems(filters?)`

```typescript
async function getInventoryItems(
  filters?: InventoryFilters
): Promise<PaginatedResponse<InventoryItemDisplay>>
```

**Parámetros de filtro:**
- `search?: string` - Búsqueda por nombre o SKU
- `item_type?: ItemType` - Filtrar por tipo de item
- `category_id?: string` - Filtrar por categoría
- `stock_status?: StockStatus` - Filtrar por estado de stock
- `storage_type?: StorageType` - Filtrar por tipo de almacenamiento
- `is_active?: boolean` - Solo items activos
- `branch_id?: string` - Filtrar por sucursal
- `sort_by?: 'name' | 'current_stock' | 'unit_cost' | 'updated_at'`
- `sort_order?: 'asc' | 'desc'`
- `page?: number` - Número de página
- `limit?: number` - Items por página (default: 20)

**Ejemplo:**
```typescript
const result = await getInventoryItems({
  search: 'tomate',
  item_type: 'ingredient',
  stock_status: 'low_stock',
  sort_by: 'current_stock',
  sort_order: 'asc',
  page: 1,
  limit: 20,
});

if (result.success) {
  console.log(result.data); // InventoryItemDisplay[]
  console.log(result.pagination); // { total, page, pageSize, totalPages, hasMore }
}
```

##### `getInventoryItem(id)`

```typescript
async function getInventoryItem(
  id: string
): Promise<ApiResponse<InventoryItemDisplay>>
```

##### `createInventoryItem(data)`

```typescript
async function createInventoryItem(
  data: InventoryItemFormData
): Promise<ApiResponse<InventoryItemDisplay>>
```

**Campos requeridos:**
- `name` - Nombre del item
- `item_type` - Tipo de item
- `unit` - Unidad de medida
- `unit_cost` - Costo unitario
- `current_stock` - Stock actual
- `minimum_stock` - Stock mínimo

##### `updateInventoryItem(id, data)`

```typescript
async function updateInventoryItem(
  id: string,
  data: Partial<InventoryItemFormData>
): Promise<ApiResponse<InventoryItemDisplay>>
```

##### `deleteInventoryItem(id)`

```typescript
async function deleteInventoryItem(
  id: string
): Promise<ApiResponse<null>>
```

> **Nota:** Realiza soft delete (marca `deleted_at`).

##### `subscribeToInventoryChanges(callback)`

```typescript
async function subscribeToInventoryChanges(
  callback: (payload: InventoryRealtimePayload) => void
): Promise<{ unsubscribe: () => void }>
```

Suscripción a cambios en tiempo real (INSERT, UPDATE, DELETE).

**Ejemplo:**
```typescript
const { unsubscribe } = await subscribeToInventoryChanges((payload) => {
  if (payload.eventType === 'INSERT') {
    console.log('Nuevo item:', payload.new);
  } else if (payload.eventType === 'UPDATE') {
    console.log('Item actualizado:', payload.new);
  } else if (payload.eventType === 'DELETE') {
    console.log('Item eliminado:', payload.old);
  }
});

// Cleanup
unsubscribe();
```

---

## Hooks

### `useInventory`

Hook principal para gestión de estado de inventario.

```typescript
function useInventory(options?: UseInventoryOptions): UseInventoryReturn
```

**Opciones:**
```typescript
interface UseInventoryOptions {
  initialFilters?: InventoryFilters;  // Filtros iniciales
  autoFetch?: boolean;                // Fetch automático al montar
  realtime?: boolean;                 // Habilitar updates en tiempo real
  searchDebounce?: number;            // Delay de debounce (ms)
}
```

**Retorno:**
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

**Ejemplo de uso:**
```tsx
function InventoryPage() {
  const {
    items,
    loading,
    error,
    stats,
    filters,
    fetchItems,
    createItem,
    updateFilters,
  } = useInventory({
    autoFetch: true,
    realtime: true,
    searchDebounce: 300,
  });

  const handleSearch = (search: string) => {
    updateFilters({ search });
  };

  const handleCreate = async () => {
    await createItem({
      name: 'Nuevo Item',
      item_type: 'ingredient',
      unit: 'kg',
      unit_cost: 100,
      current_stock: 50,
      minimum_stock: 10,
    });
  };

  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;

  return (
    <div>
      <SearchBar onChange={handleSearch} />
      <StatsPanel stats={stats} />
      <InventoryList items={items} />
    </div>
  );
}
```

---

## Componentes

### Badge Components

#### `StockStatusBadge`

Indicador visual del estado de stock.

```tsx
interface StockStatusBadgeProps {
  status: StockStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;  // Mostrar indicador de punto animado
}

<StockStatusBadge status="low_stock" size="md" showDot />
```

#### `StockLevelIndicator`

Barra de progreso visual del nivel de stock.

```tsx
interface StockLevelIndicatorProps {
  currentStock: number;
  minimumStock: number;
  maximumStock?: number | null;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

<StockLevelIndicator
  currentStock={15}
  minimumStock={20}
  maximumStock={100}
  showLabels
/>
```

#### `StockValueDisplay`

Muestra el valor de stock formateado.

```tsx
interface StockValueDisplayProps {
  value: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

<StockValueDisplay
  value={15750}
  currency="MXN"
  trend="up"
  trendValue="12%"
/>
```

#### `MovementTypeBadge`

Badge para tipo de movimiento.

```tsx
interface MovementTypeBadgeProps {
  type: MovementType;
  size?: 'sm' | 'md' | 'lg';
  showDirection?: boolean;
  compact?: boolean;
}

<MovementTypeBadge type="purchase" showDirection />
```

#### `MovementDirection`

Indicador de dirección y cantidad de movimiento.

```tsx
interface MovementDirectionProps {
  quantity: number;
  unit: string;
  isInbound: boolean;
  size?: 'sm' | 'md' | 'lg';
}

<MovementDirection
  quantity={50}
  unit="kg"
  isInbound={true}
/>
// Muestra: +50 kg (verde)
```

### Layout Components

#### `InventoryItemCard`

Tarjeta de item de inventario con acciones.

```tsx
interface InventoryItemCardProps {
  item: InventoryItemDisplay;
  onSelect?: (item: InventoryItemDisplay) => void;
  onEdit?: (item: InventoryItemDisplay) => void;
  onDelete?: (item: InventoryItemDisplay) => void;
}
```

#### `InventoryList`

Lista de items con soporte para múltiples layouts.

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

#### `VirtualizedInventoryList`

Lista virtualizada para grandes conjuntos de datos.

```tsx
interface VirtualizedInventoryListProps {
  items: InventoryItemDisplay[];
  itemHeight?: number;
  onSelect?: (item: InventoryItemDisplay) => void;
}
```

#### `InventoryFiltersBar`

Barra de filtros completa.

```tsx
interface InventoryFiltersProps {
  filters: InventoryFilters;
  onChange: (filters: Partial<InventoryFilters>) => void;
  onClear: () => void;
}
```

#### `InventoryStatsPanel`

Panel de estadísticas de inventario.

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

### `inventory-config.ts`

Configuración centralizada del sistema de diseño.

#### `STOCK_STATUS_CONFIG`

```typescript
const STOCK_STATUS_CONFIG: Record<StockStatus, {
  label: string;      // "En Stock", "Stock Bajo", etc.
  icon: string;       // Nombre del icono de Lucide
  colors: {
    bg: string;       // Clase Tailwind de fondo
    text: string;     // Clase Tailwind de texto
    border: string;   // Clase Tailwind de borde
    badge: string;    // Clase de gradiente
    icon: string;     // Color del icono
  };
}>;
```

#### `MOVEMENT_TYPE_CONFIG`

```typescript
const MOVEMENT_TYPE_CONFIG: Record<MovementType, {
  label: string;
  shortLabel: string;
  icon: string;
  isInbound: boolean;
  colors: { bg, text, icon, badge };
  description: string;
}>;
```

#### `ITEM_TYPE_CONFIG`

```typescript
const ITEM_TYPE_CONFIG: Record<ItemType, {
  label: string;
  icon: string;
  colors: { bg, text, icon, badge };
  description: string;
}>;
```

#### `STORAGE_TYPE_CONFIG`

```typescript
const STORAGE_TYPE_CONFIG: Record<StorageType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  temperature: string;  // "2°C - 8°C", "-18°C o menos", etc.
}>;
```

#### `UNIT_TYPES`

```typescript
const UNIT_TYPES = {
  weight: {
    label: 'Peso',
    units: [
      { value: 'kg', label: 'Kilogramo (kg)' },
      { value: 'g', label: 'Gramo (g)' },
      // ...
    ],
  },
  volume: { ... },
  count: { ... },
};
```

#### `VALIDATION_RULES`

```typescript
const VALIDATION_RULES = {
  item: {
    name: { minLength: 2, maxLength: 255, required: true },
    sku: { pattern: /^[A-Z0-9-]+$/, maxLength: 50 },
    current_stock: { min: 0, required: true },
    minimum_stock: { min: 0, required: true },
    unit_cost: { min: 0, required: true },
  },
  recipe: {
    yield_quantity: { min: 0.01, required: true },
    ingredients: { minItems: 1, required: true },
  },
  movement: {
    quantity: { notZero: true, required: true },
  },
};
```

---

## Validación

### `validation.ts`

Funciones de validación para formularios y reglas de negocio.

#### `validateInventoryItem(data)`

```typescript
function validateInventoryItem(
  data: Partial<InventoryItemFormData>
): ValidationResult
```

Valida campos individuales de un item.

#### `validateCompleteInventoryItem(data)`

```typescript
function validateCompleteInventoryItem(
  data: unknown
): ValidationResult
```

Valida un item completo para creación (todos los campos requeridos).

#### `validateRecipe(data)`

```typescript
function validateRecipe(
  data: Partial<RecipeFormData>
): ValidationResult
```

#### `validateMovement(data)`

```typescript
function validateMovement(
  data: Partial<MovementFormData>
): ValidationResult
```

#### Utilidades

```typescript
// Valida formato UUID v1-5
function isValidUUID(value: string): boolean

// Valida formato SKU (mayúsculas, números, guiones)
function isValidSKU(value: string): boolean

// Formatea errores de validación como string
function formatValidationErrors(errors: ValidationError[]): string
```

---

## Testing

### Suite de Tests

El módulo incluye 282 tests organizados en 5 archivos:

1. **`validation.test.ts`** (49 tests)
   - Validación de items de inventario
   - Validación de recetas
   - Validación de movimientos
   - Funciones utilitarias

2. **`inventory-config.test.ts`** (57 tests)
   - Configuración de estados de stock
   - Configuración de tipos de movimiento
   - Configuración de tipos de item
   - Validación de clases Tailwind CSS

3. **`inventory-service-helpers.test.ts`** (45 tests)
   - Cálculo de estado de stock
   - Cálculo de porcentaje de stock
   - Formateo de stock y moneda
   - Formateo de tiempo relativo

4. **`components.test.tsx`** (82 tests)
   - StockStatusBadge
   - StockLevelIndicator
   - StockValueDisplay
   - MovementTypeBadge
   - MovementDirection

5. **`inventory-service.integration.test.ts`** (49 tests)
   - Operaciones CRUD
   - Filtrado y paginación
   - Suscripciones en tiempo real
   - Aislamiento de tenant

### Ejecutar Tests

```bash
# Todos los tests del módulo
pnpm test __tests__/features/inventory-management/

# Test específico
pnpm test validation.test.ts

# Con cobertura
pnpm test --coverage
```

---

## Seguridad

### Multi-Tenancy

- Todas las consultas incluyen `tenant_id` del usuario autenticado
- Row Level Security (RLS) en Supabase como segunda capa
- Validación de UUIDs antes de queries
- Sanitización de inputs de búsqueda

### Autenticación

```typescript
// Todas las operaciones verifican autenticación
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return { success: false, error: 'User not authenticated' };
}

const tenantId = user.user_metadata?.tenant_id;
if (!tenantId) {
  return { success: false, error: 'Tenant not found' };
}
```

### Validación de IDs

```typescript
// UUID validation regex (v1-5)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Antes de usar en queries
if (!isValidUUID(id)) {
  return { success: false, error: 'Invalid ID format' };
}
```

### Sanitización de Búsqueda

```typescript
// Escape de caracteres especiales para ILIKE
const sanitizedSearch = filters.search.replace(/[%_\\]/g, '\\$&');
```

---

## Roadmap

### Implementado (v1.0)

- [x] Tipos y entidades TypeScript
- [x] Servicio de inventario (CRUD)
- [x] Hook useInventory
- [x] Componentes de UI (badges, cards, lists)
- [x] Configuración del sistema de diseño
- [x] Validación de formularios
- [x] Suscripciones en tiempo real
- [x] Multi-tenancy
- [x] Suite de tests (282 tests)

### En Desarrollo (v1.1)

- [ ] Hook useRecipes
- [ ] Hook useMovements
- [ ] Hook useLowStockAlerts
- [ ] Hook useInventoryStats
- [ ] Componentes de formularios
- [ ] Deducción automática de recetas

### Planificado (v2.0)

- [ ] Reportes y analytics
- [ ] Exportación a Excel/PDF
- [ ] Escaneo de código de barras
- [ ] Integración con proveedores
- [ ] Predicción de reorden (ML)

---

## Contacto

**TIS TIS Platform**
Desarrollado con estándares de calidad enterprise.

---

*Última actualización: Enero 2026*
