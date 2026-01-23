# FASE 4: FRONTEND - TYPES & CONFIG - ANÁLISIS Y PLAN

**Fecha:** 2026-01-22
**Scope:** Frontend types, configuration, and hooks para Inventory Management System
**Objetivo:** Crear la capa frontend con máxima calidad, siguiendo el estilo TIS TIS (elegante, profesional, inspirado en Apple/Google)

---

## 📋 CONTEXTO

### Estado Actual
- ✅ FASE 1: Database Schema (completado)
- ✅ FASE 2: Webhooks y Product Mapping (completado)
- ✅ FASE 3: Servicios Core Backend (completado con 10/10 quality score)
- 🎯 FASE 4: Frontend Types & Config (en progreso)

### Arquitectura Frontend Actual

**Patrón Identificado en TIS TIS:**
```
src/features/[feature-name]/
├── types/
│   └── index.ts              # Type definitions completos
├── hooks/
│   └── use[FeatureName].ts   # React hooks con state management
├── services/
│   └── [feature].service.ts  # API calls y lógica de negocio
├── components/
│   ├── [Component].tsx       # React components
│   └── index.ts
└── lib/
    └── [utilities].ts        # Utilities específicas
```

**Ejemplo Existente: restaurant-kitchen/**
- Types: 417 líneas, completamente tipados
- Hook: useKitchen.ts con state management completo
- Services: kitchen.service.ts para API calls
- Components: KDS Display, Order Cards, etc.

---

## 🎨 DESIGN SYSTEM TIS TIS

### Colores Identificados (tailwind.config.ts)

**Brand Colors:**
- `tis-coral`: rgb(223, 115, 115) - Color principal
- `tis-pink`: rgb(194, 51, 80) - Accent color
- `tis-green`: #9DB8A1 - Success/inventory color

**Neutrales Sofisticados:**
- `slate-50` a `slate-900` - Escala de grises elegante
- `tis-text-primary`: #0f172a - Texto principal
- `tis-text-secondary`: #475569 - Texto secundario
- `tis-text-muted`: #94a3b8 - Texto muted

**Backgrounds:**
- `tis-bg-primary`: rgb(246, 246, 246) - Fondo principal
- `tis-bg-secondary`: rgb(225, 222, 213) - Fondo secundario

**Gradients:**
- `gradient-coral`: Linear gradient coral → pink
- `gradient-green`: Linear gradient verde inventory
- `gradient-hero`: Dark gradient para cards hero

### Typography

**Font Family:**
- Plus Jakarta Sans (display y body)
- Inter (fallback)

**Font Sizes Premium:**
- `metric`: 2rem, weight 800 - Números grandes
- `metric-sm`: 1.5rem, weight 700 - Métricas pequeñas
- `heading-lg`: 1.5rem, weight 700 - Headings
- `label`: 0.75rem, weight 500, letter-spacing 0.05em - Labels

### Shadows Premium

- `card`: Sombra suave para cards
- `card-hover`: Sombra elevada en hover
- `card-elevated`: Sombra para modals/popovers
- `score`: Sombra para badges (0 4px 12px rgba(0,0,0,0.15))

### Animations

- `shimmer`: Loading skeleton animation
- `pulse-soft`: Soft pulse para notifications
- `slide-up`: Entrance animation (0.2s ease-out)

---

## 🎯 FASE 4 - SCOPE Y OBJETIVOS

### Objetivo Principal
Crear la capa frontend completa para el Inventory Management System, siguiendo los estándares de TIS TIS y la elegancia de Apple/Google.

### Deliverables

**FASE 4.1: Frontend Types (PRIORIDAD ALTA)**
- ✅ Tipos frontend para inventory items
- ✅ Tipos frontend para recipes
- ✅ Tipos frontend para movements (kardex)
- ✅ Tipos frontend para low stock alerts
- ✅ Tipos para forms y validación
- ✅ Tipos para API responses
- ✅ Config objects (colores, iconos, labels)

**FASE 4.2: Design System Config (PRIORIDAD ALTA)**
- ✅ Inventory color palette
- ✅ Status colors config
- ✅ Icons mapping
- ✅ Movement type config
- ✅ Alert severity config

**FASE 4.3: React Hooks (PRIORIDAD ALTA)**
- ✅ useInventory hook (items CRUD)
- ✅ useRecipes hook (recipes CRUD)
- ✅ useMovements hook (kardex query)
- ✅ useLowStockAlerts hook (alerts query)
- ✅ useInventoryStats hook (analytics)

**FASE 4.4: API Client Layer (PRIORIDAD MEDIA)**
- ✅ inventory.service.ts (API calls)
- ✅ Error handling y retry logic
- ✅ Loading states
- ✅ Optimistic updates

---

## 📐 ARQUITECTURA PROPUESTA

### Estructura de Archivos

```
src/features/inventory-management/
├── types/
│   └── index.ts                    # Frontend types completos
├── hooks/
│   ├── useInventory.ts             # Inventory items hook
│   ├── useRecipes.ts               # Recipes hook
│   ├── useMovements.ts             # Movements/kardex hook
│   ├── useLowStockAlerts.ts        # Alerts hook
│   ├── useInventoryStats.ts        # Stats/analytics hook
│   └── index.ts
├── services/
│   ├── inventory.service.ts        # API calls inventory
│   ├── recipes.service.ts          # API calls recipes
│   ├── movements.service.ts        # API calls movements
│   └── index.ts
├── lib/
│   ├── inventory-colors.ts         # Color mapping
│   ├── inventory-icons.ts          # Icon mapping
│   └── inventory-utils.ts          # Utilities
└── config/
    └── inventory-config.ts         # Config constants
```

### Design Principles

**1. Type Safety 100%**
- Todo debe estar tipado
- No usar `any`
- Usar type guards cuando sea necesario

**2. Consistent Naming**
- Frontend types: PascalCase + "Frontend" suffix si es diferente de backend
- Hooks: camelCase con "use" prefix
- Services: camelCase + ".service.ts"
- Config: UPPER_SNAKE_CASE para constants

**3. Performance First**
- Memoization con useMemo/useCallback
- Pagination para listas grandes
- Lazy loading cuando sea posible

**4. User Experience**
- Loading states elegantes (skeleton screens)
- Error messages claros y accionables
- Optimistic updates donde tenga sentido
- Toast notifications para feedback

---

## 🎨 COLOR PALETTE - INVENTORY SYSTEM

### Colores Principales

**Stock Status Colors:**
```typescript
const STOCK_STATUS_COLORS = {
  in_stock: {
    bg: 'bg-tis-green-100',
    text: 'text-tis-green-600',
    border: 'border-tis-green-300',
    gradient: 'bg-gradient-green',
    icon: 'text-tis-green-500',
  },
  low_stock: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-300',
    gradient: 'bg-gradient-warm',
    icon: 'text-amber-500',
  },
  out_of_stock: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    gradient: 'bg-gradient-hot',
    icon: 'text-red-500',
  },
  overstocked: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
    gradient: 'bg-gradient-primary',
    icon: 'text-blue-500',
  },
};
```

**Alert Severity Colors:**
```typescript
const ALERT_SEVERITY_COLORS = {
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    badge: 'bg-gradient-hot',
    icon: 'text-red-500',
    pulse: 'animate-pulse-soft',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-gradient-warm',
    icon: 'text-amber-500',
  },
  low: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    badge: 'bg-gradient-cold',
    icon: 'text-slate-500',
  },
};
```

**Movement Type Colors:**
```typescript
const MOVEMENT_TYPE_COLORS = {
  purchase: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: 'text-green-500',
    label: 'Compra',
  },
  consumption: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    icon: 'text-orange-500',
    label: 'Consumo',
  },
  adjustment: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: 'text-blue-500',
    label: 'Ajuste',
  },
  waste: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: 'text-red-500',
    label: 'Merma',
  },
  transfer_in: {
    bg: 'bg-tis-green-100',
    text: 'text-tis-green-700',
    icon: 'text-tis-green-500',
    label: 'Entrada',
  },
  transfer_out: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    icon: 'text-slate-500',
    label: 'Salida',
  },
};
```

### Item Type Colors

```typescript
const ITEM_TYPE_COLORS = {
  ingredient: {
    bg: 'bg-tis-green-100',
    text: 'text-tis-green-700',
    icon: 'Leaf',
    label: 'Ingrediente',
  },
  supply: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: 'Box',
    label: 'Suministro',
  },
  equipment: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    icon: 'Wrench',
    label: 'Equipo',
  },
  packaging: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: 'Package',
    label: 'Empaque',
  },
};
```

---

## 🔌 INTEGRATION CON BACKEND

### Backend Types (FASE 3) → Frontend Types (FASE 4)

**Mapping Strategy:**

1. **Backend Entity Types** → **Frontend Display Types**
   - Añadir campos computados (ej: `stockStatus`, `daysUntilExpiration`)
   - Formatear fechas para display
   - Añadir campos de UI state

2. **Backend Service Params** → **Frontend Form Types**
   - Validación de forms
   - Default values
   - Helper fields para UX

3. **Backend Results** → **Frontend API Responses**
   - Loading states
   - Error messages user-friendly
   - Success feedback

### Ejemplo de Mapping

```typescript
// Backend (FASE 3)
interface InventoryItemEntity {
  id: string;
  name: string;
  current_stock: number;
  minimum_stock: number;
  unit: string;
  // ... más campos
}

// Frontend (FASE 4)
interface InventoryItemDisplay extends InventoryItemEntity {
  // Computed fields
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstocked';
  stockPercentage: number;
  statusColor: string;
  statusIcon: string;

  // UI state
  isSelected?: boolean;
  isExpanded?: boolean;

  // Formatted fields
  formattedStock: string; // "10.5 kg"
  formattedCost: string;  // "$150.00 MXN"
}
```

---

## 📊 HOOKS ARCHITECTURE

### Pattern: Smart Hooks con Services

Cada hook sigue este patrón:

```typescript
export function useInventoryItems(options?: UseInventoryOptions) {
  // 1. State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2. Queries
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await inventoryService.getItems(options);
      setItems(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options]);

  // 3. Mutations
  const createItem = useCallback(async (data: CreateItemData) => {
    // Optimistic update
    const tempId = crypto.randomUUID();
    setItems(prev => [...prev, { ...data, id: tempId }]);

    try {
      const result = await inventoryService.createItem(data);
      // Replace temp with real
      setItems(prev => prev.map(i => i.id === tempId ? result.data : i));
      return result.data;
    } catch (err) {
      // Rollback optimistic update
      setItems(prev => prev.filter(i => i.id !== tempId));
      throw err;
    }
  }, []);

  // 4. Effects
  useEffect(() => {
    if (options?.autoFetch) {
      fetchItems();
    }
  }, [fetchItems, options?.autoFetch]);

  // 5. Realtime subscriptions (optional)
  useEffect(() => {
    if (options?.realtime) {
      const subscription = inventoryService.subscribeToChanges((change) => {
        setItems(prev => applyChange(prev, change));
      });
      return () => subscription.unsubscribe();
    }
  }, [options?.realtime]);

  return {
    items,
    loading,
    error,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    // ... más métodos
  };
}
```

---

## ✅ SUCCESS CRITERIA

### Quality Gates

1. **Type Safety: 10/10**
   - 100% TypeScript
   - 0 `any` types
   - Type guards donde sea necesario

2. **Code Organization: 10/10**
   - Estructura clara por features
   - Exports organizados con index.ts
   - Naming conventions consistentes

3. **Design System Consistency: 10/10**
   - Colores de TIS TIS palette
   - Typography siguiendo scale
   - Shadows y animations consistentes

4. **Developer Experience: 10/10**
   - Hooks fáciles de usar
   - Docs inline completas
   - Ejemplos de uso en comments

5. **Performance: 10/10**
   - Memoization apropiada
   - No re-renders innecesarios
   - Lazy loading donde tenga sentido

---

## 📝 IMPLEMENTATION PLAN

### FASE 4.1: Frontend Types (Est: 30 min)
1. Crear `src/features/inventory-management/types/index.ts`
2. Definir todos los tipos frontend
3. Añadir config objects (colors, icons, labels)
4. Crear type guards y validators

### FASE 4.2: Design System Config (Est: 20 min)
1. Crear `lib/inventory-colors.ts`
2. Crear `lib/inventory-icons.ts`
3. Crear `config/inventory-config.ts`
4. Documentar uso de cada config

### FASE 4.3: React Hooks (Est: 45 min)
1. Crear `hooks/useInventory.ts`
2. Crear `hooks/useRecipes.ts`
3. Crear `hooks/useMovements.ts`
4. Crear `hooks/useLowStockAlerts.ts`
5. Crear `hooks/useInventoryStats.ts`
6. Crear `hooks/index.ts` con exports

### FASE 4.4: API Services (Est: 30 min)
1. Crear `services/inventory.service.ts`
2. Crear `services/recipes.service.ts`
3. Crear `services/movements.service.ts`
4. Añadir error handling y retry logic

### FASE 4.5: Validation (Est: 20 min)
1. TypeScript compilation check
2. Verify consistency con backend types
3. Verify design system alignment
4. Test hooks con ejemplo simple
5. Crear reporte de validación

**Total Estimated Time:** ~2.5 horas

---

## 🚀 NEXT PHASES (Future)

**FASE 5: UI Components**
- Inventory item cards
- Recipe builder
- Kardex viewer
- Low stock alerts dashboard
- Stats widgets

**FASE 6: Pages & Routes**
- /inventory - Lista de items
- /inventory/[id] - Item detail
- /recipes - Recipe management
- /movements - Kardex history
- /alerts - Low stock alerts

---

**Documento creado:** 2026-01-22
**Status:** READY TO IMPLEMENT
**Estimated Effort:** 2.5 horas
**Quality Target:** 10/10 ⭐⭐⭐⭐⭐
