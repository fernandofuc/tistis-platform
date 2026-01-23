# Developer Guide - Inventory Management

## TIS TIS Platform - Guía de Desarrollo

> Guía práctica para desarrolladores que trabajan con el módulo de Inventory Management.

---

## Quick Start

### 1. Importar el módulo

```typescript
import {
  useInventory,
  StockStatusBadge,
  InventoryList,
  type InventoryItemDisplay,
} from '@/features/inventory-management';
```

### 2. Usar el hook en un componente

```tsx
'use client';

import { useInventory } from '@/features/inventory-management';

export function InventoryPage() {
  const {
    items,
    loading,
    error,
    stats,
    fetchItems,
    createItem,
    updateFilters,
  } = useInventory({
    autoFetch: true,
    realtime: true,
  });

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Inventario ({stats.total} items)</h1>
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name} - {item.formattedStock}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Casos de Uso Comunes

### Crear un nuevo item de inventario

```tsx
const { createItem } = useInventory();

const handleCreate = async () => {
  try {
    const newItem = await createItem({
      name: 'Tomate Roma',
      item_type: 'ingredient',
      unit: 'kg',
      unit_cost: 25.00,
      current_stock: 100,
      minimum_stock: 20,
      storage_type: 'refrigerated',
      is_perishable: true,
      default_shelf_life_days: 7,
    });

    console.log('Item creado:', newItem.id);
  } catch (error) {
    console.error('Error al crear:', error);
  }
};
```

### Actualizar stock de un item

```tsx
const { updateItem } = useInventory();

const handleStockUpdate = async (itemId: string, newStock: number) => {
  await updateItem(itemId, {
    current_stock: newStock,
  });
};
```

### Filtrar items por estado de stock

```tsx
const { items, updateFilters, clearFilters } = useInventory({ autoFetch: true });

// Mostrar solo items con stock bajo
const showLowStock = () => {
  updateFilters({ stock_status: 'low_stock' });
};

// Mostrar solo ingredientes
const showIngredients = () => {
  updateFilters({ item_type: 'ingredient' });
};

// Buscar por nombre
const handleSearch = (term: string) => {
  updateFilters({ search: term });
};

// Limpiar todos los filtros
const resetFilters = () => {
  clearFilters();
};
```

### Suscribirse a cambios en tiempo real

```tsx
import { useEffect } from 'react';
import { subscribeToInventoryChanges } from '@/features/inventory-management';

function RealtimeInventory() {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const subscribe = async () => {
      const sub = await subscribeToInventoryChanges((payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            console.log('Nuevo item agregado:', payload.new.name);
            break;
          case 'UPDATE':
            console.log('Item actualizado:', payload.new.name);
            break;
          case 'DELETE':
            console.log('Item eliminado:', payload.old.name);
            break;
        }
      });

      unsubscribe = sub.unsubscribe;
    };

    subscribe();

    return () => {
      unsubscribe?.();
    };
  }, []);

  return <div>Escuchando cambios...</div>;
}
```

---

## Componentes de UI

### StockStatusBadge

Muestra el estado de stock con colores e icono.

```tsx
import { StockStatusBadge } from '@/features/inventory-management';

// Tamaños disponibles
<StockStatusBadge status="in_stock" size="sm" />
<StockStatusBadge status="low_stock" size="md" />
<StockStatusBadge status="out_of_stock" size="lg" />

// Sin punto animado
<StockStatusBadge status="in_stock" showDot={false} />
```

### StockLevelIndicator

Barra de progreso visual del nivel de stock.

```tsx
import { StockLevelIndicator } from '@/features/inventory-management';

<StockLevelIndicator
  currentStock={15}
  minimumStock={20}
  maximumStock={100}
  showLabels
  size="md"
/>
```

### StockValueDisplay

Muestra el valor monetario formateado.

```tsx
import { StockValueDisplay } from '@/features/inventory-management';

<StockValueDisplay
  value={15750}
  currency="MXN"
  size="lg"
/>

// Con indicador de tendencia
<StockValueDisplay
  value={15750}
  trend="up"
  trendValue="12%"
/>
```

### MovementTypeBadge

Badge para tipo de movimiento.

```tsx
import { MovementTypeBadge } from '@/features/inventory-management';

<MovementTypeBadge type="purchase" />
<MovementTypeBadge type="sale" />
<MovementTypeBadge type="consumption" compact />
<MovementTypeBadge type="waste" showDirection={false} />
```

### MovementDirection

Indicador de dirección con cantidad.

```tsx
import { MovementDirection } from '@/features/inventory-management';

// Entrada (verde)
<MovementDirection
  quantity={50}
  unit="kg"
  isInbound={true}
/>

// Salida (rojo)
<MovementDirection
  quantity={10}
  unit="unidades"
  isInbound={false}
/>
```

### InventoryList

Lista de items con soporte para grid y lista.

```tsx
import { InventoryList } from '@/features/inventory-management';

<InventoryList
  items={items}
  layout="grid"
  loading={loading}
  onSelect={(item) => console.log('Selected:', item.id)}
  onEdit={(item) => openEditModal(item)}
  onDelete={(item) => confirmDelete(item)}
/>
```

### InventoryFiltersBar

Barra de filtros completa.

```tsx
import { InventoryFiltersBar } from '@/features/inventory-management';

<InventoryFiltersBar
  filters={filters}
  onChange={(newFilters) => updateFilters(newFilters)}
  onClear={clearFilters}
/>
```

### InventoryStatsPanel

Panel de estadísticas.

```tsx
import { InventoryStatsPanel } from '@/features/inventory-management';

<InventoryStatsPanel stats={stats} />
```

---

## Validación de Formularios

### Validar un item antes de crear

```tsx
import {
  validateInventoryItem,
  validateCompleteInventoryItem,
  formatValidationErrors,
} from '@/features/inventory-management';

const formData = {
  name: 'Tomate',
  item_type: 'ingredient',
  unit: 'kg',
  unit_cost: 25,
  current_stock: 100,
  minimum_stock: 20,
};

// Validar item completo
const result = validateCompleteInventoryItem(formData);

if (!result.valid) {
  // Mostrar errores
  const errorMessage = formatValidationErrors(result.errors);
  alert(errorMessage);
  return;
}

// Proceder a crear
await createItem(formData);
```

### Validar campos individuales

```tsx
import { validateInventoryItem } from '@/features/inventory-management';

// Validar solo el nombre
const nameResult = validateInventoryItem({ name: 'A' });
// { valid: false, errors: [{ field: 'name', message: 'El nombre debe tener al menos 2 caracteres', code: 'MIN_LENGTH' }] }

// Validar stock negativo
const stockResult = validateInventoryItem({ current_stock: -5 });
// { valid: false, errors: [{ field: 'current_stock', message: 'El stock actual no puede ser negativo', code: 'MIN_VALUE' }] }
```

### Validar UUID y SKU

```tsx
import { isValidUUID, isValidSKU } from '@/features/inventory-management';

// UUID válido
isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
isValidUUID('invalid-uuid'); // false

// SKU válido
isValidSKU('TOMATE-001'); // true
isValidSKU('tomate 001'); // false (minúsculas y espacios no permitidos)
```

---

## Configuración del Sistema de Diseño

### Usar colores de configuración

```tsx
import { STOCK_STATUS_CONFIG } from '@/features/inventory-management';

function CustomBadge({ status }: { status: StockStatus }) {
  const config = STOCK_STATUS_CONFIG[status];

  return (
    <span className={`${config.colors.bg} ${config.colors.text}`}>
      {config.label}
    </span>
  );
}
```

### Usar tipos de movimiento

```tsx
import { MOVEMENT_TYPE_CONFIG } from '@/features/inventory-management';

function MovementInfo({ type }: { type: MovementType }) {
  const config = MOVEMENT_TYPE_CONFIG[type];

  return (
    <div>
      <span>{config.label}</span>
      <p>{config.description}</p>
      <span>{config.isInbound ? 'Entrada' : 'Salida'}</span>
    </div>
  );
}
```

### Usar unidades

```tsx
import { UNIT_TYPES } from '@/features/inventory-management';

function UnitSelect() {
  return (
    <select>
      {Object.entries(UNIT_TYPES).map(([group, data]) => (
        <optgroup key={group} label={data.label}>
          {data.units.map(unit => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
```

---

## Patrones Comunes

### Optimistic Updates

El hook `useInventory` implementa actualizaciones optimistas automáticamente:

```tsx
const { updateItem, deleteItem } = useInventory();

// La UI se actualiza inmediatamente
// Si hay error, se hace rollback automático
const handleUpdate = async () => {
  try {
    await updateItem(itemId, { name: 'Nuevo Nombre' });
    // UI ya está actualizada
  } catch (error) {
    // UI fue restaurada al estado anterior
    console.error('Error:', error);
  }
};
```

### Debounce en Búsqueda

El hook incluye debounce configurable:

```tsx
const { updateFilters } = useInventory({
  autoFetch: true,
  searchDebounce: 500, // 500ms de espera
});

// Cada cambio espera 500ms antes de hacer fetch
const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
  updateFilters({ search: e.target.value });
};
```

### Lista Virtualizada

Para grandes conjuntos de datos:

```tsx
import { VirtualizedInventoryList } from '@/features/inventory-management';

// Solo renderiza items visibles
<VirtualizedInventoryList
  items={largeDataset} // 10,000+ items
  itemHeight={80}
  onSelect={handleSelect}
/>
```

### Estadísticas Calculadas

El hook calcula estadísticas automáticamente:

```tsx
const { stats } = useInventory({ autoFetch: true });

// Stats se recalcula automáticamente cuando items cambian
console.log(stats.total);       // Total de items
console.log(stats.lowStock);    // Items con stock bajo
console.log(stats.outOfStock);  // Items agotados
console.log(stats.totalValue);  // Valor total del inventario
```

---

## Mejores Prácticas

### 1. Siempre manejar estados de carga y error

```tsx
const { items, loading, error } = useInventory();

if (loading) return <Skeleton />;
if (error) return <ErrorAlert message={error} />;
if (items.length === 0) return <EmptyState />;

return <InventoryList items={items} />;
```

### 2. Limpiar suscripciones

```tsx
useEffect(() => {
  const sub = await subscribeToInventoryChanges(callback);

  return () => {
    sub.unsubscribe(); // Importante!
  };
}, []);
```

### 3. Validar antes de enviar

```tsx
const handleSubmit = async (data: InventoryItemFormData) => {
  const validation = validateCompleteInventoryItem(data);

  if (!validation.valid) {
    setErrors(validation.errors);
    return;
  }

  await createItem(data);
};
```

### 4. Usar tipos de TypeScript

```tsx
import type {
  InventoryItemDisplay,
  InventoryFilters,
  StockStatus,
} from '@/features/inventory-management';

// Los tipos proporcionan autocompletado y verificación
const filters: InventoryFilters = {
  stock_status: 'low_stock', // Autocompletado
  sort_by: 'name',           // Solo valores válidos
};
```

### 5. Reutilizar configuración

```tsx
import {
  STOCK_STATUS_CONFIG,
  MOVEMENT_TYPE_CONFIG,
} from '@/features/inventory-management';

// Consistencia visual en toda la app
const getStatusColor = (status: StockStatus) =>
  STOCK_STATUS_CONFIG[status].colors;
```

---

## Troubleshooting

### Error: "User not authenticated"

Asegúrate de que el usuario está autenticado antes de usar el servicio:

```tsx
import { supabase } from '@/shared/lib/supabase';

const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  // Redirigir a login
}
```

### Error: "Tenant not found"

El usuario debe tener `tenant_id` en sus metadatos:

```tsx
const tenantId = user.user_metadata?.tenant_id;
```

### Error: "Invalid item ID format"

El ID debe ser un UUID válido (v1-5):

```tsx
import { isValidUUID } from '@/features/inventory-management';

if (!isValidUUID(itemId)) {
  console.error('ID inválido');
}
```

### Los cambios en tiempo real no se reciben

1. Verifica que Supabase Realtime está habilitado
2. Verifica RLS policies permiten SELECT
3. Verifica el tenant_id es correcto

```tsx
const { realtime } = useInventory({ realtime: true });
```

---

## Recursos Adicionales

- [README.md](./README.md) - Documentación técnica completa
- [API.md](./API.md) - Referencia de API
- [Tests](__tests__/features/inventory-management/) - Ejemplos en tests

---

*Guía actualizada: Enero 2026*
