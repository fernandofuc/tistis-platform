# FASE 3: SERVICIOS CORE - ANÁLISIS Y PLAN DE IMPLEMENTACIÓN

**Fecha:** 2026-01-22
**Status:** ANÁLISIS COMPLETADO
**Metodología:** Arquitectura modular con máxima calidad

---

## 📊 ESTADO ACTUAL DEL SISTEMA

### Tablas Existentes (Migration 090)

✅ **inventory_items** - Items de inventario (ingredientes, suministros, equipo)
- Campos clave: `current_stock`, `minimum_stock`, `unit_cost`, `is_trackable`
- Branch-aware: `branch_id` (nullable = todas las sucursales)
- Soft delete: `deleted_at`

✅ **menu_item_recipes** - Recetas por platillo
- FK: `menu_item_id` → `restaurant_menu_items`
- Campos: `yield_quantity`, `total_cost`, `cost_per_portion`
- One-to-one: 1 recipe per menu item

✅ **recipe_ingredients** - Ingredientes de recetas
- FK: `recipe_id` → `menu_item_recipes`
- FK: `inventory_item_id` → `inventory_items`
- Campos: `quantity`, `unit`, `unit_cost`, `total_cost`

✅ **inventory_movements** - Kardex de movimientos
- Tipos: purchase, sale, consumption, waste, adjustment, transfer, return, production
- Tracking: `previous_stock`, `new_stock`, `quantity` (+ = entrada, - = salida)
- Referencias: `reference_type`, `reference_id` (linkea a ordenes, recetas, etc)

✅ **inventory_batches** - Lotes de stock (FIFO/FEFO)
- Tracking de lotes individuales con fechas de expiración
- Campos: `batch_number`, `lot_number`, `expiration_date`

---

## 🎯 OBJETIVO DE FASE 3

Crear servicios core que permitan:
1. **RecipeDeductionService** - Explosión de insumos automática (deducir ingredientes al vender)
2. **InventoryMovementService** - Registrar movimientos en kardex
3. **LowStockAlertService** - Detectar y alertar sobre stock bajo
4. **Integración con SoftRestaurantProcessor** - Conectar procesamiento de ventas con deducción de inventario

---

## 🏗️ ARQUITECTURA DE SERVICIOS

### Principios de Diseño

1. **Single Responsibility** - Cada servicio tiene una responsabilidad única
2. **Dependency Injection** - SupabaseClient inyectado como dependencia
3. **Error Handling** - Manejo comprehensivo de errores con resultados estructurados
4. **Type Safety** - TypeScript estricto con interfaces bien definidas
5. **Testability** - Diseño que facilita testing unitario e integración
6. **Idempotency** - Operaciones seguras para retry (donde aplique)

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│ SoftRestaurant Webhook                                       │
│ POST /api/soft-restaurant/webhook                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Registration (EXISTING)                            │
│ - Validate payload                                          │
│ - Save to sr_sales, sr_sale_items, sr_payments            │
│ - Status: pending                                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Processing (EXISTING - TO BE ENHANCED)             │
│ SoftRestaurantProcessor.processSale()                       │
│                                                             │
│ 1. Get sr_sale with items                                  │
│ 2. Map sr_product_code → menu_item_id                      │
│ 3. Create restaurant_order                                  │
│ 4. ✨ NEW: Deduce inventory (RecipeDeductionService)       │
│ 5. Update sr_sale.status = 'processed'                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ RecipeDeductionService (NEW)                                │
│                                                             │
│ For each menu_item sold:                                    │
│ 1. Get recipe (menu_item_recipes)                          │
│ 2. Get ingredients (recipe_ingredients)                    │
│ 3. Calculate quantities (with scaling & waste)             │
│ 4. For each ingredient:                                     │
│    ├─► Check current stock                                 │
│    ├─► Calculate deduction amount                          │
│    ├─► Update inventory_items.current_stock               │
│    └─► Call InventoryMovementService.recordDeduction()    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ InventoryMovementService (NEW)                              │
│                                                             │
│ recordDeduction():                                          │
│ 1. Create inventory_movements record                        │
│    - movement_type: 'consumption'                           │
│    - reference_type: 'sr_sale'                              │
│    - reference_id: sr_sale.id                               │
│    - quantity: -X (negative = salida)                       │
│    - previous_stock, new_stock                              │
│ 2. Return movement record                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ LowStockAlertService (NEW)                                  │
│                                                             │
│ checkLowStock():                                            │
│ 1. Query inventory_items where                              │
│    current_stock <= minimum_stock                           │
│ 2. For each low stock item:                                 │
│    ├─► Create notification (if not exists)                 │
│    ├─► Send email/SMS/push (optional)                      │
│    └─► Log alert                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
src/features/integrations/
├── services/
│   ├── soft-restaurant-processor.ts (EXISTING - TO BE ENHANCED)
│   ├── recipe-deduction.service.ts (NEW)
│   ├── inventory-movement.service.ts (NEW)
│   └── low-stock-alert.service.ts (NEW)
├── types/
│   ├── soft-restaurant.types.ts (EXISTING)
│   ├── recipe.types.ts (NEW)
│   └── inventory.types.ts (NEW)
└── tests/
    ├── recipe-deduction.test.ts (NEW)
    ├── inventory-movement.test.ts (NEW)
    └── integration/
        └── sr-inventory-flow.test.ts (NEW)
```

---

## 🔧 SERVICIOS A IMPLEMENTAR

### 3.1 RecipeDeductionService

**Responsabilidad:** Explosión de insumos - deducir ingredientes de inventario al vender un platillo

**Métodos Principales:**
```typescript
class RecipeDeductionService {
  // Deduce ingredientes para UN menu item vendido
  async deduceForMenuItem(params: {
    supabase: SupabaseClient;
    tenantId: string;
    branchId: string;
    menuItemId: string;
    quantitySold: number;
    saleId: string;
    allowNegativeStock?: boolean;
  }): Promise<DeductionResult>

  // Deduce ingredientes para TODOS los items de una venta
  async deduceForSale(params: {
    supabase: SupabaseClient;
    saleId: string;
    allowNegativeStock?: boolean;
  }): Promise<SaleDeductionResult>

  // Preview: Calcula qué se deduciría sin aplicar cambios
  async previewDeduction(params: {
    supabase: SupabaseClient;
    menuItemId: string;
    quantitySold: number;
  }): Promise<DeductionPreview>
}
```

**Casos de Uso:**
1. ✅ Menu item tiene receta con ingredientes → Deduce todos los ingredientes
2. ✅ Menu item sin receta → Log warning, continuar
3. ✅ Ingrediente con stock insuficiente + allowNegativeStock=true → Deduce, marca warning
4. ✅ Ingrediente con stock insuficiente + allowNegativeStock=false → Error, rollback
5. ✅ Scaling: Si venta es 2 unidades y receta yield=1, multiplica x2 todas las cantidades
6. ✅ Waste: Si ingrediente tiene 10% merma, deduce cantidad * 1.10

**Interfaces:**
```typescript
interface DeductionResult {
  success: boolean;
  ingredientsProcessed: number;
  ingredientsDeducted: number;
  totalCostDeducted: number;
  movements: InventoryMovementRecord[];
  errors: string[];
  warnings: string[];
}

interface DeductionPreview {
  menuItemName: string;
  recipeName: string;
  ingredients: Array<{
    ingredientId: string;
    ingredientName: string;
    quantityRequired: number;
    unit: string;
    currentStock: number;
    newStock: number;
    isLowStock: boolean;
    willBeNegative: boolean;
  }>;
  totalCost: number;
}
```

---

### 3.2 InventoryMovementService

**Responsabilidad:** Registrar movimientos en kardex (inventory_movements)

**Métodos Principales:**
```typescript
class InventoryMovementService {
  // Registrar movimiento de deducción por venta
  async recordDeduction(params: {
    supabase: SupabaseClient;
    tenantId: string;
    branchId: string;
    itemId: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    unitCost: number;
    referenceType: 'sr_sale' | 'restaurant_order';
    referenceId: string;
    notes?: string;
  }): Promise<InventoryMovementRecord>

  // Registrar movimiento de ajuste manual
  async recordAdjustment(params: {
    supabase: SupabaseClient;
    tenantId: string;
    branchId: string;
    itemId: string;
    quantity: number;
    reason: string;
    performedBy: string;
  }): Promise<InventoryMovementRecord>

  // Obtener historial de movimientos
  async getMovementHistory(params: {
    supabase: SupabaseClient;
    itemId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    movementType?: MovementType;
    limit?: number;
  }): Promise<InventoryMovementRecord[]>
}
```

**Casos de Uso:**
1. ✅ Registrar deducción por venta SR (movement_type: 'consumption', reference_type: 'sr_sale')
2. ✅ Registrar ajuste manual (movement_type: 'adjustment')
3. ✅ Query historial de movimientos por item
4. ✅ Query movimientos por fecha range

**Interfaces:**
```typescript
interface InventoryMovementRecord {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  movement_type: MovementType;
  quantity: number; // Negative = salida
  previous_stock: number;
  new_stock: number;
  unit_cost: number;
  total_cost: number;
  reference_type: string;
  reference_id: string;
  performed_at: string;
  notes?: string;
}

type MovementType =
  | 'purchase'
  | 'sale'
  | 'consumption'
  | 'waste'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'return'
  | 'production';
```

---

### 3.3 LowStockAlertService

**Responsabilidad:** Detectar y alertar sobre stock bajo

**Métodos Principales:**
```typescript
class LowStockAlertService {
  // Verificar stock bajo después de deducción
  async checkAfterDeduction(params: {
    supabase: SupabaseClient;
    tenantId: string;
    branchId: string;
    itemIds: string[];
  }): Promise<LowStockCheckResult>

  // Verificar todo el inventario de una sucursal
  async checkAllInventory(params: {
    supabase: SupabaseClient;
    tenantId: string;
    branchId: string;
  }): Promise<LowStockCheckResult>

  // Crear alerta de stock bajo
  async createAlert(params: {
    supabase: SupabaseClient;
    tenantId: string;
    branchId: string;
    itemId: string;
    currentStock: number;
    minimumStock: number;
  }): Promise<LowStockAlert>

  // Obtener alertas activas
  async getActiveAlerts(params: {
    supabase: SupabaseClient;
    tenantId: string;
    branchId?: string;
  }): Promise<LowStockAlert[]>
}
```

**Casos de Uso:**
1. ✅ Después de deducción, verificar si current_stock <= minimum_stock
2. ✅ Si bajo, crear notificación/alerta (si no existe ya)
3. ✅ Marcar item como "necesita reorden"
4. ✅ Query de todos los items con stock bajo

**Interfaces:**
```typescript
interface LowStockCheckResult {
  itemsChecked: number;
  lowStockItems: Array<{
    itemId: string;
    itemName: string;
    currentStock: number;
    minimumStock: number;
    reorderQuantity: number;
    unit: string;
  }>;
  alertsCreated: number;
}

interface LowStockAlert {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  item_name: string;
  current_stock: number;
  minimum_stock: number;
  status: 'active' | 'resolved';
  created_at: string;
  resolved_at?: string;
}
```

---

## 🔗 INTEGRACIÓN CON SOFT RESTAURANT PROCESSOR

### Modificaciones Necesarias

**Archivo:** `src/features/integrations/services/soft-restaurant-processor.ts`

**Cambios en `processSale()` method:**

```typescript
// EXISTING CODE (línea ~400)
// 4. Create restaurant order
const restaurantOrderId = await this.createRestaurantOrder(/* ... */);

// ✨ NEW CODE (insertar después de crear restaurant order)
// 5. Deduce inventory for all mapped items
console.log('[FASE 3] Deducing inventory for sale:', saleId);

const deductionResult = await RecipeDeductionService.deduceForSale({
  supabase: this.supabase,
  saleId: saleId,
  allowNegativeStock: false, // Configurable por tenant
});

if (!deductionResult.success) {
  console.error('[FASE 3] Inventory deduction failed:', deductionResult.errors);

  // Log errors but don't fail the sale processing
  // (Sale was already created, inventory will be manually adjusted)
  await this.logInventoryDeductionError(saleId, deductionResult.errors);
}

console.log('[FASE 3] Inventory deduction complete:', {
  ingredientsDeducted: deductionResult.ingredientsDeducted,
  totalCost: deductionResult.totalCostDeducted,
  warnings: deductionResult.warnings,
});

// 6. Check for low stock alerts
await LowStockAlertService.checkAfterDeduction({
  supabase: this.supabase,
  tenantId: sale.tenant_id,
  branchId: sale.branch_id,
  itemIds: deductionResult.movements.map(m => m.item_id),
});
```

---

## ⚙️ CONFIGURACIÓN POR TENANT

**Nuevos campos en `integration_connections` metadata:**

```typescript
interface SRIntegrationMetadata {
  // ... existing fields

  // FASE 3 config
  autoDeductInventory: boolean; // Default: true
  allowNegativeStock: boolean; // Default: false
  lowStockAlertEnabled: boolean; // Default: true
  lowStockAlertEmail?: string; // Email para alertas
  skipItemsWithoutRecipe: boolean; // Default: true (no falla si falta receta)
}
```

---

## 🧪 TESTING STRATEGY

### Unit Tests

1. **RecipeDeductionService**
   - ✅ Test scaling (quantity sold = 2, recipe yield = 1)
   - ✅ Test waste percentage (10% merma)
   - ✅ Test missing recipe (skip vs error)
   - ✅ Test insufficient stock (allowNegative true/false)
   - ✅ Test multiple ingredients

2. **InventoryMovementService**
   - ✅ Test recordDeduction creates correct movement
   - ✅ Test quantity is negative for consumption
   - ✅ Test reference linkage (sr_sale_id)

3. **LowStockAlertService**
   - ✅ Test detection (current_stock <= minimum_stock)
   - ✅ Test alert creation (no duplicates)
   - ✅ Test query active alerts

### Integration Tests

1. **Full SR Sale → Inventory Flow**
   - ✅ Webhook → processSale → deduceInventory → movements → alerts
   - ✅ Verify inventory_items.current_stock updated
   - ✅ Verify inventory_movements created
   - ✅ Verify low stock alerts created if applicable

---

## 📊 SUCCESS CRITERIA

### FASE 3.1: RecipeDeductionService
- ✅ Service created with all methods
- ✅ Unit tests passing (5+ test cases)
- ✅ Type definitions complete
- ✅ Error handling comprehensive

### FASE 3.2: InventoryMovementService
- ✅ Service created with all methods
- ✅ Unit tests passing (3+ test cases)
- ✅ Kardex movements correctly logged

### FASE 3.3: LowStockAlertService
- ✅ Service created with all methods
- ✅ Unit tests passing (3+ test cases)
- ✅ Alert detection working

### FASE 3.4: Integration
- ✅ SoftRestaurantProcessor modified
- ✅ Services called in correct order
- ✅ Configuration respected (allowNegativeStock, etc)

### FASE 3.5: Testing
- ✅ Integration test passing (full flow)
- ✅ Test JSON with recipe data
- ✅ Verified in actual DB (if possible)

### FASE 3.6: Validation (Bucle Agéntico)
- ✅ No type errors
- ✅ No logic errors
- ✅ No security issues
- ✅ Perfect architectural connections
- ✅ All edge cases handled

---

## 🚀 IMPLEMENTATION ORDER

1. **FASE 3.0:** ✅ Analysis complete (THIS DOCUMENT)
2. **FASE 3.1:** RecipeDeductionService (Core logic)
3. **FASE 3.2:** InventoryMovementService (Kardex logging)
4. **FASE 3.3:** LowStockAlertService (Alerting)
5. **FASE 3.4:** Integration with SoftRestaurantProcessor
6. **FASE 3.5:** Testing & Validation
7. **FASE 3.6:** Bucle Agéntico (Exhaustive review until NO ERRORS)

---

**Analysis Status:** ✅ COMPLETE
**Ready to implement:** YES
**Estimated LOC:** ~1,200 lines (3 services + types + tests)
**Risk Level:** MEDIUM (inventory deduction is critical)

**Next Step:** Implement FASE 3.1 - RecipeDeductionService
