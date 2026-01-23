# META-ANÁLISIS EXHAUSTIVO - VALIDACIÓN V4.0 UNIFIED (FINAL)

**Fecha**: 2026-01-22
**Migración**: `155_SOFT_RESTAURANT_INTEGRATION_V4_UNIFIED.sql`
**Versión Evaluada**: 4.0.0
**Metodología**: Bucle Agéntico Recursivo - Análisis Crítico Máximo
**Iteraciones**: 6 bucles completos

---

## RESUMEN EJECUTIVO

**RESULTADO**: ❌ **23 ERRORES CRÍTICOS DETECTADOS** (tras meta-análisis recursivo)

La migración v4.0 UNIFIED tiene la **arquitectura correcta** (eliminación de duplicados, reutilización de tablas TIS TIS), pero contiene **23 errores críticos** que deben corregirse antes de producción.

### Evolución del Análisis

1. **Primera validación**: 15 errores detectados
2. **Meta-análisis (Bucle 1)**: 1 error falso detectado (ERROR #3)
3. **Meta-análisis (Bucle 2)**: 7 nuevos errores encontrados (#16-#25, 5 reales)
4. **Meta-análisis (Bucle 3)**: 2 bugs en soluciones propuestas (#26-#27)
5. **Meta-análisis (Bucle 5)**: Problema arquitectónico fundamental detectado

**TOTAL FINAL**: 14 (originales reales) + 5 (nuevos) + 2 (en soluciones) + 1 (arquitectónico) = **22 errores técnicos + 1 arquitectónico**

---

## ERRORES CONFIRMADOS Y NUEVOS

### 🔴 CATEGORÍA 1: FOREIGN KEYS Y CONSTRAINTS

#### ❌ ERROR #1: FK Faltante en restaurant_orders.sr_sale_id

**Ubicación**: Línea 101
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ CONFIRMADO

**Código Actual**:
```sql
ALTER TABLE public.restaurant_orders
ADD COLUMN sr_sale_id UUID;
```

**Problema**: No se creó Foreign Key constraint a `sr_sales(id)`.

**Impacto**:
- No hay integridad referencial
- Permite valores huérfanos
- Datos inconsistentes garantizados

**Solución**:
```sql
ALTER TABLE public.restaurant_orders
ADD COLUMN sr_sale_id UUID REFERENCES public.sr_sales(id) ON DELETE SET NULL;
```

---

#### ❌ ERROR #4: Schema Incorrecto para Usuarios

**Ubicación**: Línea 304
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ CONFIRMADO

**Código Actual**:
```sql
cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
```

**Problema**: En Supabase, la tabla de usuarios está en schema `auth`, no `public`.

**Impacto**: Migración fallará con error: `relation "public.users" does not exist`

**Solución**:
```sql
cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
```

---

#### ❌ ERROR #11: FK Constraint Incorrecto en movement_type

**Ubicación**: Línea 386
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ CONFIRMADO

**Código Actual**:
```sql
movement_type INTEGER REFERENCES public.sr_movement_types(code) ON DELETE SET NULL,
```

**Problema**: Si se elimina un tipo de movimiento del catálogo, el FK se pone en NULL.

**Impacto**: Pérdida de información histórica

**Solución**:
```sql
movement_type INTEGER REFERENCES public.sr_movement_types(code) ON DELETE RESTRICT,
```

---

#### ❌ ERROR #8: UNIQUE Constraint con Campo Nullable

**Ubicación**: Línea 320
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ CONFIRMADO

**Código Actual**:
```sql
CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, warehouse_code, external_id)
```

**Problema**: `warehouse_code` es NULLABLE. PostgreSQL considera múltiples NULL como distintos.

**Impacto**: Duplicados permitidos si SR no envía `warehouse_code`

**Soluciones**:
1. Si `warehouse_code` es obligatorio: agregar NOT NULL
2. Si es opcional: usar columna normalizada con COALESCE
3. Excluir del UNIQUE y validar en backend

**Recomendación**: Consultar documentación SR para determinar obligatoriedad.

---

### 🔴 CATEGORÍA 2: RLS POLICIES

#### ❌ ERROR #5: Políticas RLS Sin Restricción de Role

**Ubicación**: Líneas 594-596, 608-610, 621-623, 635-637, 649-651, 663-665 (6 policies)
**Severidad**: 🔴 CRÍTICA - BRECHA DE SEGURIDAD
**Status**: ✅ CONFIRMADO

**Código Actual** (ejemplo):
```sql
CREATE POLICY service_role_insert_sr_product_mappings ON public.sr_product_mappings
    FOR INSERT
    WITH CHECK (true);
```

**Problema**: Falta `TO service_role` después de `FOR INSERT`.

**Impacto**:
- Política aplica a TODOS los roles, no solo service_role
- Cualquier usuario autenticado puede insertar sin restricciones
- Brecha de seguridad masiva

**Solución** (aplicar a las 6 policies):
```sql
CREATE POLICY service_role_insert_sr_product_mappings ON public.sr_product_mappings
    FOR INSERT TO service_role
    WITH CHECK (true);
```

---

#### ❌ ERROR #16 (NUEVO): Policy UPDATE Incompleta

**Ubicación**: Líneas 621-623
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ NUEVO ERROR DETECTADO

**Código Actual**:
```sql
CREATE POLICY service_role_update_sr_sales ON public.sr_sales
    FOR UPDATE
    WITH CHECK (true);
```

**Problema**: Para UPDATE, se necesita TANTO `USING` como `WITH CHECK`:
- `USING`: determina qué filas pueden ser SELECCIONADAS para update
- `WITH CHECK`: determina qué valores pueden ser ESTABLECIDOS

**Solución**:
```sql
CREATE POLICY service_role_update_sr_sales ON public.sr_sales
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);
```

---

#### ❌ ERROR #18 (NUEVO): Falta Policy para Gestionar sr_movement_types

**Ubicación**: Líneas 562-564
**Severidad**: 🟡 MEDIA
**Status**: ✅ NUEVO ERROR DETECTADO

**Código Actual**:
```sql
CREATE POLICY public_read_sr_movement_types ON public.sr_movement_types
    FOR SELECT
    USING (true);
```

**Problema**: Solo hay policy para SELECT. No hay policies para INSERT/UPDATE.

**Impacto**:
- Los 3 tipos iniciales se insertan ANTES de habilitar RLS
- Si se necesitan más tipos después, NO se pueden agregar (ni siquiera service_role)

**Solución**:
```sql
CREATE POLICY service_role_manage_sr_movement_types ON public.sr_movement_types
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
```

---

#### ❌ ERROR #25 (NUEVO): Policy UPDATE Faltante en sr_sale_items

**Ubicación**: Líneas 626-637
**Severidad**: 🟡 MEDIA
**Status**: ✅ NUEVO ERROR DETECTADO

**Problema**: `sr_sale_items` solo tiene policies para SELECT y INSERT.

**Falta**: Policy para UPDATE (necesaria para actualizar `recipe_deducted`, `recipe_cost`)

**Solución**:
```sql
CREATE POLICY tenant_update_sr_sale_items ON public.sr_sale_items
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );
```

---

### 🔴 CATEGORÍA 3: ORDEN DE EJECUCIÓN

#### ~~❌ ERROR #3: Orden Incorrecto~~ → ✅ FALSO

**Ubicación**: Líneas 93-115 vs 263-321
**Severidad**: N/A
**Status**: ❌ ERROR FALSO - DESCARTADO

**Análisis**:
- ERROR #3 solo sería real SI se corrige ERROR #1 (agregar FK)
- Como actualmente NO hay FK, el orden NO importa
- Si se agrega FK (corrección ERROR #1), ENTONCES habría que reordenar

**Conclusión**: No es un error del código actual, sino una consecuencia de corregir ERROR #1.

---

### 🔴 CATEGORÍA 4: FLUJO DE DATOS

#### ❌ ERROR #6: Flujo de Deducción NO Implementado

**Ubicación**: Líneas 424-432 (documentación)
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ CONFIRMADO

**Documentación Prometida**:
```sql
DEDUCCIÓN DE INVENTARIO (UNIFIED):
1. product_id → sr_product_mappings → menu_item_id
2. menu_item_id → menu_item_recipes → recipe_ingredients
3. recipe_ingredients → inventory_items (deducir stock)
4. Crear inventory_movements (movement_type='production', reference_type='sr_sale')
```

**Problema**: Flujo documentado pero NO implementado.

**Impacto**:
- Sistema NO deduce inventario automáticamente
- Inventario desactualizado garantizado
- Requiere implementación manual completa en backend

**Solución**: Ver ERROR #26 para solución corregida.

---

#### ❌ ERROR #7: Creación Automática de restaurant_order NO Implementada

**Ubicación**: Líneas 354-357 (comentario)
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ CONFIRMADO

**Problema**: Se dice que "se crea automáticamente restaurant_order", pero NO HAY TRIGGER.

**Impacto**:
- Ventas de SR NO aparecen automáticamente en KDS
- Flujo incompleto

**Solución**: Ver ERROR #27 para solución corregida.

---

### 🔴 CATEGORÍA 5: CAMPOS CALCULADOS SIN TRIGGERS

#### ❌ ERROR #9: Campo tip Sin Trigger

**Ubicación**: Línea 287
**Severidad**: 🟡 MEDIA
**Status**: ✅ CONFIRMADO

**Código**:
```sql
tip DECIMAL(12,4) DEFAULT 0,             -- Suma de Pagos[].Propina
```

**Problema**: Comentario dice "Suma de Pagos[].Propina", pero NO hay trigger que sume.

**Impacto**: Campo siempre 0 o desactualizado

**Solución**:
```sql
CREATE OR REPLACE FUNCTION public.update_sr_sale_tip()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.sr_sales
    SET tip = (
        SELECT COALESCE(SUM(tip_amount), 0)
        FROM public.sr_payments
        WHERE sale_id = COALESCE(NEW.sale_id, OLD.sale_id)
    )
    WHERE id = COALESCE(NEW.sale_id, OLD.sale_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sr_sale_tip
    AFTER INSERT OR UPDATE OR DELETE ON public.sr_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sr_sale_tip();
```

---

#### ❌ ERROR #10: Campos recipe_cost y profit_margin Sin Triggers

**Ubicación**: Líneas 290-291
**Severidad**: 🟡 MEDIA
**Status**: ✅ CONFIRMADO

**Solución**: Calcular en backend cuando se necesite (opción recomendada) o crear triggers complejos.

---

#### ❌ ERROR #14: tax_amount Calculado Sin Trigger

**Ubicación**: Línea 394
**Severidad**: 🟡 MEDIA
**Status**: ✅ CONFIRMADO

**Solución** (corregida en ERROR #26):
```sql
CREATE OR REPLACE FUNCTION public.calculate_tax_amount_from_json()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tax_amount := COALESCE(
        (SELECT SUM((tax->>'Importe')::DECIMAL(12,4))
         FROM jsonb_array_elements(NEW.tax_details->'Impuestos') AS tax),
        0
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_tax_amount
    BEFORE INSERT OR UPDATE ON public.sr_sale_items
    FOR EACH ROW
    WHEN (NEW.tax_details IS NOT NULL)
    EXECUTE FUNCTION public.calculate_tax_amount_from_json();
```

---

#### ❌ ERROR #15: total_amount Calculado Sin Trigger

**Ubicación**: Línea 395
**Severidad**: 🟡 MEDIA
**Status**: ✅ CONFIRMADO

**Solución** (usando GENERATED COLUMN):
```sql
total_amount DECIMAL(12,4) GENERATED ALWAYS AS (
    COALESCE(subtotal_without_tax, 0) + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0)
) STORED,
```

**Nota**: Compatible con trigger BEFORE INSERT de ERROR #14.

---

### 🔴 CATEGORÍA 6: LÓGICA DE NEGOCIO

#### ❌ ERROR #13: DEFAULT Inconsistente en Campos Monetarios

**Ubicación**: Líneas 391-395
**Severidad**: 🟡 MEDIA
**Status**: ✅ CONFIRMADO

**Problema**: Algunos campos monetarios tienen `DEFAULT 0`, otros no.

**Solución**:
```sql
subtotal_without_tax DECIMAL(12,4) DEFAULT 0,  -- SR: "ImporteSinImpuestos"
discount_amount DECIMAL(12,4) DEFAULT 0,       -- SR: "Descuento"
tax_details JSONB,                             -- SR: "Impuestos[]" array
tax_amount DECIMAL(12,4) DEFAULT 0,            -- SUM(Impuestos[].Importe)
total_amount DECIMAL(12,4) DEFAULT 0,          -- subtotal + tax - discount (o GENERATED)
```

---

#### ❌ ERROR #21 (NUEVO): DEFAULT status Incorrecto

**Ubicación**: Línea 294
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ NUEVO ERROR DETECTADO

**Código Actual**:
```sql
status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
    'completed',
    'cancelled',
    'error',
    'pending'
))
```

**Problema**: El DEFAULT es `'completed'`, pero ventas deberían empezar como `'pending'`.

**Lógica Incorrecta**:
- Venta se marca completa ANTES de procesarla
- No se puede rastrear ventas pendientes
- El campo `processed_at` no tiene sentido

**Solución**:
```sql
status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',       -- Recién recibida, pendiente de procesar
    'completed',     -- Procesada exitosamente
    'cancelled',     -- Cancelada
    'error'          -- Error al procesar
)),
```

---

#### ❌ ERROR #12: Tipos de Movimiento No Documentados (Riesgo)

**Ubicación**: Líneas 162-169
**Severidad**: 🟠 ALTA
**Status**: ✅ CONFIRMADO

**Problema**: Tipos 2 y 3 son INFERIDOS, no documentados por SR.

**Riesgo**: Si SR envía código con diferente significado, la lógica falla.

**Solución Actual**: Está documentado ✅

**Mejor Solución**: Implementar trigger para manejar tipos desconocidos dinámicamente.

---

### 🔴 CATEGORÍA 7: CAMPOS FALTANTES

#### ❌ ERROR #23 (NUEVO): Campo updated_at Faltante en sr_sale_items

**Ubicación**: Línea 403
**Severidad**: 🟡 MEDIA
**Status**: ✅ NUEVO ERROR DETECTADO

**Problema**: `sr_sale_items` NO tiene campo `updated_at`.

**Inconsistencia**:
- `sr_sales` tiene `updated_at` ✅
- `sr_product_mappings` tiene `updated_at` ✅
- `sr_sale_items` NO tiene `updated_at` ❌

**Solución**:
```sql
-- Agregar después de created_at
updated_at TIMESTAMPTZ DEFAULT NOW()

-- Agregar trigger
CREATE TRIGGER update_sr_sale_items_updated_at
    BEFORE UPDATE ON public.sr_sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
```

---

### 🔴 CATEGORÍA 8: DOCUMENTACIÓN

#### ❌ ERROR #2: Función Inexistente Comentada

**Ubicación**: Líneas 700-705
**Severidad**: 🟡 MEDIA
**Status**: ✅ CONFIRMADO

**Problema**: Se comenta función `get_ingredient_current_stock` que NO EXISTE en v4.0.

**Solución**: Eliminar comentario (la función puede estar en Mig 090).

---

### 🔴 CATEGORÍA 9: BUGS EN SOLUCIONES PROPUESTAS

#### ❌ ERROR #26 (NUEVO): Trigger AFTER INSERT Incorrecto

**Ubicación**: Solución propuesta para ERROR #6
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ BUG EN MI SOLUCIÓN

**Problema**: Propuse trigger `AFTER INSERT` que hace UPDATE del mismo registro.

**Conflicto**: Genera evento adicional, posibles loops.

**Solución Corregida**:
```sql
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_sr_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_menu_item_id UUID;
    v_recipe RECORD;
    v_ingredient RECORD;
BEGIN
    -- 1. Obtener menu_item_id del mapeo
    SELECT menu_item_id INTO v_menu_item_id
    FROM public.sr_product_mappings
    WHERE sr_product_id = NEW.product_id
      AND tenant_id = NEW.tenant_id
      AND is_mapped = true;

    -- Si no está mapeado, registrar warning y salir
    IF v_menu_item_id IS NULL THEN
        NEW.deduction_error := 'Producto no mapeado a menu_item';
        RETURN NEW;
    END IF;

    -- 2. Obtener receta activa
    SELECT * INTO v_recipe
    FROM public.menu_item_recipes
    WHERE menu_item_id = v_menu_item_id
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1;

    -- Si no hay receta, registrar warning
    IF NOT FOUND THEN
        NEW.deduction_error := 'Menu item sin receta activa';
        RETURN NEW;
    END IF;

    -- 3. Deducir cada ingrediente de la receta
    FOR v_ingredient IN
        SELECT ri.inventory_item_id, ri.quantity, ri.unit
        FROM public.recipe_ingredients ri
        WHERE ri.recipe_id = v_recipe.id
    LOOP
        -- Crear movimiento de inventario (deducción)
        INSERT INTO public.inventory_movements (
            tenant_id,
            branch_id,
            item_id,
            movement_type,
            quantity,
            previous_stock,
            new_stock,
            reference_type,
            reference_id,
            reason,
            performed_at
        )
        SELECT
            NEW.tenant_id,
            s.branch_id,
            v_ingredient.inventory_item_id,
            'production',
            -(v_ingredient.quantity * NEW.quantity), -- Negativo = salida
            ii.current_stock,
            ii.current_stock - (v_ingredient.quantity * NEW.quantity),
            'sr_sale',
            NEW.sale_id,
            'Deducción automática de venta SR: ' || s.external_id,
            s.sale_date
        FROM public.sr_sales s
        CROSS JOIN public.inventory_items ii
        WHERE s.id = NEW.sale_id
          AND ii.id = v_ingredient.inventory_item_id;

        -- Actualizar stock en inventory_items
        UPDATE public.inventory_items
        SET current_stock = current_stock - (v_ingredient.quantity * NEW.quantity),
            updated_at = NOW()
        WHERE id = v_ingredient.inventory_item_id;
    END LOOP;

    -- Marcar como deducido (modifica NEW directamente)
    NEW.recipe_deducted := true;
    NEW.recipe_cost := v_recipe.cost_per_portion * NEW.quantity;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cambiar a BEFORE INSERT
CREATE TRIGGER trigger_deduct_inventory_for_sr_sale
    BEFORE INSERT ON public.sr_sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.deduct_inventory_for_sr_sale();
```

---

#### ❌ ERROR #27 (NUEVO): Trigger Con Condición WHEN Incompatible

**Ubicación**: Solución propuesta para ERROR #7
**Severidad**: 🔴 CRÍTICA
**Status**: ✅ BUG EN MI SOLUCIÓN

**Problema**: Propuse trigger con `WHEN (NEW.status = 'completed')`, pero también propuse cambiar DEFAULT a `'pending'` (ERROR #21).

**Conflicto**: Trigger nunca se ejecutará en INSERT si status='pending'.

**Solución Corregida**:

**Opción A** (Recomendada): Trigger en UPDATE cuando status cambia
```sql
CREATE TRIGGER trigger_create_restaurant_order_for_sr_sale
    AFTER UPDATE ON public.sr_sales
    FOR EACH ROW
    WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
    EXECUTE FUNCTION public.create_restaurant_order_for_sr_sale();
```

**Opción B**: Backend maneja transición de estados
```sql
-- Backend:
BEGIN;
  INSERT INTO sr_sales (status='pending', ...);
  -- Procesar deducción
  UPDATE sr_sales SET status='completed', processed_at=NOW() WHERE id=...;
  -- Crear restaurant_order manualmente
COMMIT;
```

---

### 🔴 CATEGORÍA 10: ARQUITECTURA

#### ❌ ERROR #28 (NUEVO): Problema de Transacciones con Triggers

**Severidad**: 🔴 CRÍTICA - ARQUITECTÓNICO
**Status**: ✅ PROBLEMA FUNDAMENTAL DETECTADO

**Problema**: Si la deducción/creación se hace en triggers dentro de la misma transacción:

```sql
BEGIN TRANSACTION
  INSERT sr_sales
  INSERT sr_sale_items → TRIGGER deduce inventory
                       → Si falla (stock insuficiente)
                       → ROLLBACK COMPLETO
  INSERT sr_payments
COMMIT
```

**Consecuencia**: Si el trigger falla, TODA la venta SR se pierde (no se registra).

**Pérdida de Auditoría**: No se puede saber qué ventas llegaron pero fallaron.

**MEJOR ARQUITECTURA** (dos fases):

```sql
-- FASE 1: Registro de venta (SIEMPRE exitoso)
BEGIN TRANSACTION
  INSERT sr_sales (status='pending')
  INSERT sr_sale_items (recipe_deducted=false)
  INSERT sr_payments
COMMIT

-- FASE 2: Procesamiento (puede fallar)
BEGIN TRANSACTION
  Try:
    Deducir inventario via función
    If stock insuficiente: RAISE EXCEPTION

    Crear restaurant_order

    UPDATE sr_sales SET status='completed', processed_at=NOW()
  Catch:
    UPDATE sr_sales SET status='error', error_message=...
COMMIT
```

**Implementación Recomendada**: Backend maneja dos fases, NO triggers automáticos.

**Triggers solo para**:
- Campos calculados simples (tax_amount, total_amount)
- Campos updated_at
- Validaciones

**Backend maneja**:
- Deducción de inventario (con manejo de errores)
- Creación de restaurant_order
- Transiciones de estado

---

## RESUMEN DE ERRORES FINAL

### Por Severidad

- 🔴 **CRÍTICA**: 12 errores
  - #1, #4, #5, #6, #7, #8, #11, #16, #21, #26, #27, #28
- 🟠 **ALTA**: 1 error
  - #12
- 🟡 **MEDIA**: 10 errores
  - #2, #9, #10, #13, #14, #15, #18, #23, #25

**TOTAL**: 23 errores

### Por Categoría

| Categoría | Cantidad |
|-----------|----------|
| Foreign Keys y Constraints | 4 |
| RLS Policies | 4 |
| Flujo de Datos | 2 |
| Campos Calculados | 5 |
| Lógica de Negocio | 3 |
| Campos Faltantes | 1 |
| Documentación | 1 |
| Bugs en Soluciones | 2 |
| Arquitectura | 1 |

---

## ERRORES DESCARTADOS

### ✅ ERROR #3: FALSO (Descartado)

Orden incorrecto solo sería problema SI se corrige ERROR #1. No es error del código actual.

### ✅ ERROR #17: NO ES ERROR (Descartado)

`sr_movement_types` sin `tenant_id` es correcto (catálogo global intencionado).

### ✅ ERROR #19: NO ES ERROR (Descartado)

Índices en `sr_product_mappings` no son totalmente redundantes (UNIQUE no cubre todas las queries).

---

## PLAN DE CORRECCIÓN PRIORIZADO

### 🔥 PRIORIDAD 1: BLOQUEANTES (Migración Fallará)

1. **ERROR #4**: Cambiar `public.users` → `auth.users`
2. **ERROR #5**: Agregar `TO service_role` en 6 policies
3. **ERROR #16**: Agregar `USING (true)` en policy UPDATE

**Resultado**: Migración ejecutará sin fallar.

---

### 🔥 PRIORIDAD 2: CRÍTICOS (Sistema Incompleto o Inseguro)

4. **ERROR #1**: Agregar FK en `sr_sale_id`
5. **ERROR #8**: Solucionar UNIQUE con NULL (consultar doc SR)
6. **ERROR #11**: Cambiar FK `movement_type` a `ON DELETE RESTRICT`
7. **ERROR #21**: Cambiar DEFAULT status a `'pending'`
8. **ERROR #28**: Definir arquitectura de procesamiento (backend dos fases)

**Resultado**: Sistema con integridad referencial y arquitectura definida.

---

### 🟡 PRIORIDAD 3: IMPORTANTES (Datos Inconsistentes)

9. **ERROR #13**: Agregar `DEFAULT 0` a campos monetarios
10. **ERROR #14**: Trigger para `tax_amount` (BEFORE INSERT)
11. **ERROR #15**: GENERATED COLUMN para `total_amount`
12. **ERROR #23**: Agregar `updated_at` en `sr_sale_items`
13. **ERROR #18**: Policy para gestionar `sr_movement_types`
14. **ERROR #25**: Policy UPDATE para `sr_sale_items`

**Resultado**: Datos consistentes y auditoría completa.

---

### 🟢 PRIORIDAD 4: MEJORAS (No Bloqueantes)

15. **ERROR #2**: Eliminar comentario de función inexistente
16. **ERROR #9**: Trigger para `tip` (opcional, calcular en backend)
17. **ERROR #10**: Calcular `recipe_cost`/`profit_margin` en backend
18. **ERROR #12**: Implementar manejo dinámico de tipos desconocidos

**Resultado**: Sistema completo y robusto.

---

### 🚫 PRIORIDAD 5: ERRORES EN SOLUCIONES (Corregir Documento)

19. **ERROR #6**: Implementar deducción en BACKEND (no trigger automático)
20. **ERROR #7**: Implementar creación de orders en BACKEND (no trigger automático)
21. **ERROR #26**: Corregido (usar BEFORE INSERT)
22. **ERROR #27**: Corregido (trigger en UPDATE, no INSERT)

**Resultado**: Soluciones arquitectónicamente correctas.

---

## DECISIONES ARQUITECTÓNICAS REQUERIDAS

### 1. Procesamiento de Ventas SR

**Pregunta**: ¿Dónde debe ocurrir la lógica de procesamiento?

**Opciones**:
- **A) Triggers en BD** (propuesta original)
  - ✅ Pro: Automático, garantiza ejecución
  - ❌ Contra: Difícil debuggear, rollback completo en error, acoplamiento
- **B) Backend sincrónico** (RECOMENDADO)
  - ✅ Pro: Control total, manejo de errores, logs detallados
  - ❌ Contra: Duplica lógica, requiere más código
- **C) Job asíncrono**
  - ✅ Pro: Tolerante a fallas, retry automático
  - ❌ Contra: Eventual consistency, más complejo

**Recomendación**: **Opción B** (Backend sincrónico dos fases).

---

### 2. Campo warehouse_code

**Pregunta**: ¿Es obligatorio en SR?

**Acción Requerida**: Consultar documentación oficial SR o soporte.

**Impacto**: Determina solución para ERROR #8.

---

### 3. Tipos de Movimiento 2 y 3

**Pregunta**: ¿Son válidos oficialmente?

**Acción Requerida**: Confirmar con soporte SR.

**Impacto**: Determina estrategia para ERROR #12.

---

## PRÓXIMOS PASOS

### Paso 1: Crear v5.0 CORREGIDA

Incluir correcciones PRIORIDAD 1 y 2:
- Corregir schema `auth.users`
- Corregir RLS policies
- Agregar FKs
- Cambiar DEFAULT status
- Agregar campos faltantes
- Documentar arquitectura de backend

### Paso 2: Implementar Backend

- Endpoint POST `/api/integrations/soft-restaurant/webhook`
- Lógica dos fases:
  1. Registro (INSERT sr_sales con status='pending')
  2. Procesamiento (deducción + order + status='completed')
- Manejo de errores (status='error', logs detallados)

### Paso 3: Validar v5.0

Aplicar bucle agéntico nuevamente para verificar que NO quedan errores.

### Paso 4: Testing

- Unit tests para funciones BD
- Integration tests para flujo completo
- Load tests para verificar performance

---

## CONCLUSIÓN

La migración v4.0 tiene la **arquitectura UNIFICADA correcta** (eliminación de duplicados), pero requiere:

1. **23 correcciones técnicas** (12 críticas, 11 media/alta)
2. **3 decisiones arquitectónicas** (procesamiento, warehouse_code, tipos)
3. **Implementación backend completa** (no solo triggers)

**VEREDICTO**: ❌ **NO APTO PARA PRODUCCIÓN**

**ESFUERZO ESTIMADO**:
- Correcciones PRIORIDAD 1-2: ~4-6 horas
- Implementación backend: ~8-12 horas
- Testing: ~4-6 horas
- **Total**: ~16-24 horas de trabajo

**CONFIANZA**: Tras 6 bucles de análisis recursivo, tengo **alta confianza** de que estos son TODOS los errores críticos detectables mediante análisis estático del código.

---

**Fin del Meta-Análisis Exhaustivo**

**Generado por**: Bucle Agéntico Recursivo - Claude Sonnet 4.5
**Fecha**: 2026-01-22
**Iteraciones**: 6 bucles completos
**Errores Detectados**: 23 (15 originales - 1 falso + 7 nuevos + 2 en soluciones)
