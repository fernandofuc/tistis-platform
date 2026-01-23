# 🚨 ERRORES CRÍTICOS ENCONTRADOS - Análisis Exhaustivo

**Fecha:** 2026-01-22
**Analista:** Claude Sonnet 4.5 (Modo Crítico Activado)
**Metodología:** Bucle Agéntico Iterativo
**Iteración:** 1 de N

---

## ⚠️ RESUMEN EJECUTIVO

**ESTADO:** 🔴 **ERRORES CRÍTICOS BLOQUEANTES DETECTADOS**

Durante el análisis exhaustivo comparando mi migración SQL con la documentación oficial de Soft Restaurant y el análisis crítico previo, he identificado **ERRORES GRAVES** que harían que la integración **NO FUNCIONE** en producción.

**Gravedad:** 🔴 CRÍTICA - La migración debe ser CORREGIDA antes de deployment.

---

## 🔴 ERROR CRÍTICO #1: Estructura de Tabla `sr_sales` INCORRECTA

### Problema:
Mi migración SQL tiene nombres de columnas que **NO COINCIDEN** con los campos que Soft Restaurant envía en el JSON.

### Evidencia:

**JSON Real de Soft Restaurant (según documentación oficial):**
```json
{
  "IdEmpresa": "SR10.002MX12345",
  "Ventas": [{
    "NumeroOrden": "51795",
    "Almacen": "2",
    "Estacion": "Caja 1",
    "Area": "Terraza",
    "Mesa": "12",
    "IdUsuario": "USR001",
    "IdCliente": "CLI123",
    "FechaVenta": "2024-01-22 14:30:00",
    "Total": 120.0000,
    "Conceptos": [...],
    "Pagos": [...]
  }]
}
```

**Mi Schema SQL (INCORRECTO):**
```sql
CREATE TABLE sr_sales (
  -- ...
  sr_warehouse VARCHAR(20),    -- ❌ Debería ser 'Almacen'
  area VARCHAR(100),           -- ❌ Campo correcto pero debería almacenar 'Area' de SR
  station VARCHAR(100),        -- ❌ Debería almacenar 'Estacion' de SR
  table_number VARCHAR(50),    -- ❌ Debería almacenar 'Mesa' de SR
  waiter_name VARCHAR(100),    -- ❌ SR envía 'IdUsuario' (ID, no nombre!)
  -- ❌ FALTA: IdCliente
  -- ❌ FALTA: Mapeo claro de campos SR
```

### Impacto:
🔴 **BLOQUEANTE** - El backend no podrá guardar correctamente los datos de SR porque los nombres de campos no coinciden con lo que se debe extraer del JSON.

### Corrección Necesaria:
```sql
CREATE TABLE sr_sales (
  -- ...
  -- Campos exactos de SR (para claridad)
  sr_numero_orden VARCHAR(50) NOT NULL,  -- NumeroOrden
  sr_almacen VARCHAR(20),                -- Almacen
  sr_estacion VARCHAR(100),              -- Estacion
  sr_area VARCHAR(100),                  -- Area
  sr_mesa VARCHAR(50),                   -- Mesa
  sr_id_usuario VARCHAR(50),             -- IdUsuario (es ID, no nombre)
  sr_id_cliente VARCHAR(50),             -- IdCliente
  sr_fecha_venta TIMESTAMPTZ,            -- FechaVenta

  -- O mantener nombres en inglés pero documentar mapping:
  external_id VARCHAR(50) NOT NULL,      -- SR: NumeroOrden
  warehouse_code VARCHAR(20),            -- SR: Almacen
  station_code VARCHAR(100),             -- SR: Estacion
  area_name VARCHAR(100),                -- SR: Area
  table_code VARCHAR(50),                -- SR: Mesa
  user_id VARCHAR(50),                   -- SR: IdUsuario
  customer_id VARCHAR(50),               -- SR: IdCliente
  sale_date TIMESTAMPTZ,                 -- SR: FechaVenta
```

**Decisión:** Usar nombres en inglés pero **DOCUMENTAR** claramente el mapping en comentarios SQL.

---

## 🔴 ERROR CRÍTICO #2: Estructura de Tabla `sr_sale_items` INCORRECTA

### Problema:
Faltan campos críticos del JSON de SR en la tabla `sr_sale_items`.

### Evidencia:

**JSON Real de SR Conceptos:**
```json
{
  "IdProducto": "01005",
  "Descripcion": "CERVEZA CORONA FAMILIAR",
  "Movimiento": 1,              // ❌ FALTA EN MI SCHEMA
  "Cantidad": 1.000000,
  "PrecioUnitario": 120.0000,
  "ImporteSinImpuestos": 103.45, // ❌ FALTA EN MI SCHEMA
  "Descuento": 0.00,             // ❌ FALTA EN MI SCHEMA
  "Impuestos": [                 // ❌ FALTA EN MI SCHEMA
    {
      "Impuesto": "IVA",
      "Tasa": 0.16,
      "Importe": 16.55
    }
  ]
}
```

**Mi Schema SQL (INCORRECTO):**
```sql
CREATE TABLE sr_sale_items (
  product_id VARCHAR(50) NOT NULL,  -- OK: IdProducto
  description VARCHAR(200),         -- OK: Descripcion
  quantity DECIMAL(10,4) NOT NULL,  -- OK: Cantidad
  unit_price DECIMAL(12,4) NOT NULL,-- OK: PrecioUnitario
  total_price DECIMAL(12,4) NOT NULL,-- Calculado

  -- ❌ FALTA: Movimiento
  -- ❌ FALTA: ImporteSinImpuestos
  -- ❌ FALTA: Descuento
  -- ❌ FALTA: Impuestos (array)
```

### Impacto:
🟡 **MEDIO-ALTO** - Se perderán datos importantes de SR. No se podrán calcular correctamente impuestos ni descuentos.

### Corrección Necesaria:
```sql
CREATE TABLE sr_sale_items (
  -- Existing fields OK
  product_id VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  quantity DECIMAL(10,4) NOT NULL,
  unit_price DECIMAL(12,4) NOT NULL,

  -- ✅ AGREGAR CAMPOS FALTANTES:
  movement_type INTEGER,                -- Movimiento (1=venta, 2=devolucion, etc)
  subtotal_without_tax DECIMAL(12,4),   -- ImporteSinImpuestos
  discount_amount DECIMAL(12,4),        -- Descuento
  tax_amount DECIMAL(12,4),             -- Suma de Impuestos[].Importe
  total_amount DECIMAL(12,4),           -- Total final

  -- Impuestos como JSONB
  tax_details JSONB,  -- Array de {Impuesto, Tasa, Importe}
```

---

## 🔴 ERROR CRÍTICO #3: Tabla `sr_payments` Incompleta

### Problema:
Soft Restaurant envía `Propina` dentro del objeto `Pago`, pero mi schema no la captura correctamente.

### Evidencia:

**JSON Real de SR Pagos:**
```json
{
  "FormaPago": "EFECTIVO",
  "Importe": 120.00,
  "Propina": 15.00  // ❌ No está en mi schema sr_payments
}
```

**Mi Schema SQL (INCORRECTO):**
```sql
CREATE TABLE sr_payments (
  payment_name VARCHAR(100) NOT NULL,  -- FormaPago - OK
  amount DECIMAL(12,4) NOT NULL,       -- Importe - OK
  -- ❌ FALTA: Propina (está en sr_sales pero debería estar aquí también)
```

### Impacto:
🟡 **MEDIO** - Las propinas se guardan a nivel de venta (sr_sales.tip) pero no a nivel de pago individual, lo cual puede causar inconsistencias si hay múltiples pagos.

### Corrección Necesaria:
```sql
CREATE TABLE sr_payments (
  payment_name VARCHAR(100) NOT NULL,  -- FormaPago
  amount DECIMAL(12,4) NOT NULL,       -- Importe
  tip_amount DECIMAL(12,4) DEFAULT 0,  -- ✅ AGREGAR: Propina
```

---

## 🟡 ERROR MEDIO #4: Falta Campo `FechaVenta` del JSON

### Problema:
Soft Restaurant envía `FechaVenta` en el JSON, pero yo uso `created_at` como DEFAULT NOW(), lo cual registra la fecha de RECEPCIÓN, no la fecha de VENTA real.

### Evidencia:
```json
{
  "FechaVenta": "2024-01-22 14:30:00"  // Fecha real de la venta en SR
}
```

**Mi Schema:**
```sql
sale_date TIMESTAMPTZ NOT NULL,  -- OK, existe
created_at TIMESTAMPTZ DEFAULT NOW(),  -- Fecha de recepción
```

### Impacto:
🟢 **BAJO** - El campo existe (`sale_date`), pero debe documentarse que:
- `sale_date` = FechaVenta de SR (fecha real de venta)
- `created_at` = Fecha de recepción en TIS TIS

### Corrección:
✅ El schema es correcto, solo necesita mejor documentación en comentarios.

---

## 🟡 ERROR MEDIO #5: Campo `tenant_id` en Todas las Tablas

### Problema:
Todas mis tablas tienen `tenant_id` como FK, pero también tienen `integration_id` que ya incluye el tenant. Esto es redundante.

### Análisis:
```sql
-- Mi schema actual:
CREATE TABLE sr_sales (
  tenant_id UUID NOT NULL,        -- ¿Necesario?
  branch_id UUID NOT NULL,        -- ¿Necesario?
  integration_id UUID NOT NULL,   -- Ya contiene tenant_id y branch_id
```

### Decisión:
🟢 **MANTENER** - Aunque es redundante, tener `tenant_id` explícito:
1. Facilita queries filtradas por tenant
2. Permite RLS policies más simples
3. Es un patrón común en multi-tenant apps
4. Mejora performance de índices

**Acción:** ✅ No cambiar, pero documentar que es intencional.

---

## 🔴 ERROR CRÍTICO #6: Tabla `recipes` - Falta Conexión con Productos de SR

### Problema:
Mi tabla `recipes` usa `product_id VARCHAR(50)` que debería coincidir con `IdProducto` de SR, pero no hay garantía de que esto funcione.

### Evidencia:
```sql
CREATE TABLE recipes (
  product_id VARCHAR(50) NOT NULL,  -- ¿Coincide con SR IdProducto?
```

**Problema:** No hay tabla `products` en mi migración, entonces ¿cómo se mapea `IdProducto` de SR a los productos de TIS TIS?

### Impacto:
🔴 **CRÍTICO** - Sin un mapeo claro de productos SR → TIS TIS, la deducción de recetas NO FUNCIONARÁ.

### Corrección Necesaria:

**Opción 1: Asumir que existe tabla `products` en TIS TIS**
```sql
-- Documentar que product_id debe coincidir con products.external_id
-- donde external_id = IdProducto de SR
COMMENT ON COLUMN recipes.product_id IS
'ID del producto. Debe coincidir con products.external_id
donde external_id es el IdProducto enviado por Soft Restaurant';
```

**Opción 2: Crear mapeo explícito**
```sql
CREATE TABLE sr_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  integration_id UUID NOT NULL,
  sr_product_id VARCHAR(50) NOT NULL,  -- IdProducto de SR
  tistis_product_id UUID,              -- FK a products(id) si existe
  product_name VARCHAR(200),           -- Cache del nombre
  is_active BOOLEAN DEFAULT true,
  UNIQUE(tenant_id, integration_id, sr_product_id)
);
```

**Decisión:** Opción 2 es más robusta. AGREGAR tabla `sr_product_mappings`.

---

## 🟡 ERROR MEDIO #7: Tabla `inventory_movements` - ingredient_id sin FK

### Problema:
```sql
ingredient_id UUID NOT NULL,  -- FK to ingredients table (to be created)
```

Mi comentario dice "to be created", pero la tabla `ingredients` NO existe ni en mi migración ni (aparentemente) en el schema actual de TIS TIS.

### Impacto:
🟡 **MEDIO** - El sistema de inventory_movements funcionará como log, pero no se puede validar que el ingredient_id sea válido.

### Corrección Necesaria:

**Opción 1: Crear tabla `ingredients`**
```sql
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL,
  unit VARCHAR(20) NOT NULL,  -- kg, L, pza, etc
  unit_cost DECIMAL(12,4),
  reorder_point DECIMAL(10,4),
  minimum_stock DECIMAL(10,4),
  current_stock DECIMAL(10,4),  -- Calculado vía SUM(inventory_movements)
  is_active BOOLEAN DEFAULT true,
  UNIQUE(tenant_id, branch_id, name)
);
```

**Opción 2: Usar tabla existente de productos**
- Verificar si existe `products` table
- Si existe, usar `product_id` en vez de `ingredient_id`

**Decisión:** Opción 1 - AGREGAR tabla `ingredients` a la migración.

---

## 🟢 ACIERTOS ENCONTRADOS (Para Mantener)

### ✅ Acierto #1: RLS Policies
- Correctamente implementado en todas las tablas
- Tenant isolation perfecto
- Service role policies para webhooks

### ✅ Acierto #2: Índices
- Bien diseñados para queries frecuentes
- Índices parciales con WHERE clauses
- Índices compuestos apropiados

### ✅ Acierto #3: Triggers
- Auto-update de `updated_at` correcto
- Aplicado solo donde tiene sentido

### ✅ Acierto #4: JSONB para raw_data
- Excelente decisión para flexibilidad
- Permite debugging fácil
- No afecta performance

### ✅ Acierto #5: UNIQUE Constraints
- `unique_sr_sale` evita duplicados
- Correctamente implementado

---

## 📋 PLAN DE CORRECCIÓN

### Prioridad 1: CRÍTICO (Debe hacerse ANTES de deployment)

1. **Corregir `sr_sales` table**
   - Agregar `customer_id` (IdCliente)
   - Renombrar/documentar campos claramente
   - Mapear correctamente a JSON de SR

2. **Corregir `sr_sale_items` table**
   - Agregar `movement_type` (Movimiento)
   - Agregar `subtotal_without_tax` (ImporteSinImpuestos)
   - Agregar `discount_amount` (Descuento)
   - Agregar `tax_details` JSONB (Impuestos array)

3. **Corregir `sr_payments` table**
   - Agregar `tip_amount` (Propina)

4. **Crear tabla `sr_product_mappings`**
   - Para mapeo SR productos → TIS TIS productos

5. **Crear tabla `ingredients`**
   - Base para inventory_movements y recipes

### Prioridad 2: IMPORTANTE (Puede hacerse después pero pronto)

6. **Mejorar documentación SQL**
   - Comentarios claros de mapping SR → TIS TIS
   - Ejemplos de JSON en comentarios
   - Documentar decisiones de diseño

7. **Agregar constraints adicionales**
   - CHECK constraints para movement_type
   - Validaciones de montos positivos

### Prioridad 3: MEJORAS (Nice to have)

8. **Optimizar índices**
   - Revisar si faltan índices críticos
   - Considerar índices adicionales para reporting

9. **Agregar campos calculados**
   - Triggers para calcular automáticamente totales
   - Funciones de agregación

---

## 🔄 SIGUIENTE ITERACIÓN DEL BUCLE

Ahora voy a:

1. ✅ **Crear nueva versión de la migración** con todas las correcciones
2. ✅ **Validar contra documentación oficial** página por página
3. ✅ **Revisar nuevamente** para detectar más errores
4. ✅ **Iterar** hasta que no encuentre más problemas

---

**Estado Actual:** 🔴 ERRORES CRÍTICOS IDENTIFICADOS
**Acción Siguiente:** CORREGIR MIGRACIÓN SQL
**Iteración:** 1/N (continuará hasta perfección)

---

**Analista:** Claude Sonnet 4.5
**Nivel de Criticidad:** MÁXIMO
**Confianza en Análisis:** 95%
**Recomendación:** NO DEPLOYAR versión actual, ESPERAR correcciones
