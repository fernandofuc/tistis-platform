# 🚨 BUCLE CRÍTICO 3 - ERRORES ADICIONALES EN v2.0

**Documento:** BUCLE3_ADDITIONAL_ERRORS_FOUND.md
**Fecha:** 2026-01-22
**Migración Analizada:** 153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql (v2.0)
**Metodología:** Revisión línea por línea contra documentación oficial SR

---

## 📊 RESUMEN DE HALLAZGOS

**Total de errores adicionales encontrados:** 8
**Severidad:**
- 🔴 CRÍTICOS: 3
- 🟡 MEDIOS: 3
- 🟢 MENORES: 2

---

## 🔴 ERROR CRÍTICO #8: Campo "Mesa" Falta en SR JSON

### Ubicación:
`153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql:199-200`

### Código Actual (v2.0):
```sql
-- MAPPING: Mesa (SR JSON) → table_code (TIS TIS) - NOTA: Campo "Mesa" puede venir en SR
table_code VARCHAR(50),                  -- SR: "Mesa" (opcional en JSON)
```

### Error Encontrado:
El comentario dice "Campo 'Mesa' puede venir en SR" pero **al revisar el JSON de ejemplo de la documentación oficial SR (páginas 6-7), NO EXISTE el campo "Mesa"**.

### JSON Real de SR (página 6-7):
```json
{
  "Estacion": "NS-CLNT-MID-81",
  "Almacen": "2",
  "FechaVenta": "2022-06-02T12:27:12",
  "NumeroOrden": "51795",
  "IdCliente": "",
  "IdUsuario": "ADMIN",
  "Total": 120.0000,
  "Area": "DIDDI",          // ✅ Este SÍ existe
  "Conceptos": [...],
  "Pagos": [...]
  // ❌ NO hay campo "Mesa"
}
```

### Análisis:
- SR envía "Area" (zona del restaurante: DIDDI, Terraza, Comedor, Barra)
- SR envía "Estacion" (estación POS: NS-CLNT-MID-81)
- **SR NO envía "Mesa"** como campo separado

### Posibles Interpretaciones:
1. **Opción A**: El campo "Mesa" no existe en SR, debemos eliminarlo
2. **Opción B**: El número de mesa puede venir dentro del campo "Area" (ej: "Mesa 12")
3. **Opción C**: SR tiene versiones diferentes y algunas SÍ envían "Mesa"

### Evidencia Adicional:
La documentación oficial (página 3, sección "Seleccionar Almacén por Estación") muestra:
- ✅ Almacén (warehouse)
- ✅ Estación (POS terminal)
- ✅ Area (zone)
- ❌ NO menciona "Mesa" (table)

### Impacto: 🔴 MEDIO-ALTO
- Si asumimos que "Mesa" existe y no existe, desperdiciamos espacio en DB
- Si "Mesa" SÍ existe en algunas versiones SR pero no la capturamos correctamente, perdemos datos

### Corrección Recomendada:
```sql
-- OPCIÓN 1: Eliminar campo table_code completamente
-- (Si confirmamos que SR NUNCA envía "Mesa")

-- OPCIÓN 2: Cambiar comentario para ser más preciso
-- MAPPING: Mesa (SR JSON) → table_code (TIS TIS)
-- IMPORTANTE: Campo "Mesa" NO aparece en doc oficial SR (v11).
-- Se incluye por compatibilidad con posibles versiones futuras.
-- Puede quedar NULL en la mayoría de casos.
table_code VARCHAR(50),

-- OPCIÓN 3: Extraer número de mesa del campo "Area" si viene en formato "Mesa 12"
-- (Requiere lógica en backend para parsear)
```

### Acción Requerida:
⚠️ **VERIFICAR CON CLIENTE/SR** si el campo "Mesa" existe en JSON de ventas reales, o si se debe extraer de "Area".

---

## 🔴 ERROR CRÍTICO #9: Falta Campo "TipoCancelacion" en sr_sales

### Ubicación:
`153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql:178-248` (tabla sr_sales)

### Error Encontrado:
La tabla `sr_sales` no incluye el campo `cancellation_type` para almacenar el "TipoCancelacion" que SR envía al cancelar una venta.

### Documentación SR (página 9):
```
GET pms/v1/softrestaurant/cancel?NumeroOrden=12
Parámetros:
{
  "NumeroOrden": "0",
  "TipoCancelacion": "devolución"  // ← Campo que falta
}
```

### Problema:
Cuando SR cancela una venta, envía:
- `NumeroOrden`: folio a cancelar
- `TipoCancelacion`: tipo de cancelación (ej: "devolución")

Pero nuestra tabla `sr_sales` solo tiene:
```sql
status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
    'completed',     -- Venta procesada exitosamente
    'cancelled',     -- Cancelada por SR (vía GET /cancel)  ← Solo status
    'error',
    'pending'
)),
```

**Falta:**
- Campo para almacenar el TIPO de cancelación
- Fecha de cuando se canceló
- Quién/qué sistema solicitó la cancelación

### Impacto: 🔴 ALTO
- No podemos distinguir entre tipos de cancelación (devolución, error, ajuste, etc.)
- Perdemos información crítica para auditoría
- No podemos generar reportes de cancelaciones por tipo

### Corrección Requerida:
```sql
-- En tabla sr_sales, AGREGAR:

-- Cancellation tracking
cancellation_type VARCHAR(50),           -- SR: "TipoCancelacion" (devolución, etc.)
cancelled_at TIMESTAMPTZ,                -- Fecha de cancelación
cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- Usuario que canceló (si fue manual)
cancellation_reason TEXT,                -- Razón de cancelación (free text)
```

---

## 🟡 ERROR MEDIO #10: Índice Faltante en sr_sales.cancellation

### Ubicación:
`153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql:250-274` (índices sr_sales)

### Error Encontrado:
Tenemos índice para `status`:
```sql
CREATE INDEX IF NOT EXISTS idx_sr_sales_status
    ON public.sr_sales(status) WHERE status != 'completed';
```

Pero si agregamos campos de cancelación (ERROR #9), necesitamos índices adicionales.

### Corrección Requerida:
```sql
-- Índice para buscar ventas canceladas por fecha
CREATE INDEX IF NOT EXISTS idx_sr_sales_cancelled_at
    ON public.sr_sales(cancelled_at DESC)
    WHERE cancelled_at IS NOT NULL;

-- Índice para buscar por tipo de cancelación
CREATE INDEX IF NOT EXISTS idx_sr_sales_cancellation_type
    ON public.sr_sales(cancellation_type)
    WHERE cancellation_type IS NOT NULL;
```

---

## 🟡 ERROR MEDIO #11: Falta Validación de Unicidad en external_id

### Ubicación:
`153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql:247`

### Código Actual:
```sql
CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, external_id)
```

### Problema:
Este constraint es CORRECTO para evitar duplicados de la misma venta.

**PERO** el comentario en línea 292-293 dice:
```sql
COMMENT ON COLUMN public.sr_sales.external_id IS
'NumeroOrden de Soft Restaurant. Valor exacto del campo JSON.NumeroOrden.
Único por tenant+integration para evitar duplicados.';
```

### Error Sutil:
El comentario dice "Único por tenant+integration" pero el `NumeroOrden` de SR podría **NO ser globalmente único** si:
- SR resetea folios (ej: cada año)
- Múltiples sucursales SR usan mismos folios
- SR tiene configuración de foliación por almacén

### Evidencia del Problema:
La documentación SR (página 6) muestra:
```json
{
  "Almacen": "2",           // ← Diferentes almacenes
  "NumeroOrden": "51795"    // ← ¿Es único solo dentro de Almacen?
}
```

### Pregunta Crítica:
¿Es `NumeroOrden` único por:
- a) Empresa SR (global)
- b) Almacén SR (por sucursal)
- c) Estación SR (por terminal POS)

### Impacto: 🟡 MEDIO
Si `NumeroOrden` NO es globalmente único, podríamos:
- Rechazar ventas legítimas como duplicadas
- Perder ventas de diferentes sucursales con mismo folio

### Corrección Recomendada:
```sql
-- OPCIÓN 1: Si NumeroOrden es único solo por Almacén
CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, warehouse_code, external_id)

-- OPCIÓN 2: Usar un composite ID más robusto
-- Crear campo: sr_sale_unique_key = MD5(IdEmpresa + Almacen + NumeroOrden + FechaVenta)
-- Y hacer unique constraint en ese campo
```

### Acción Requerida:
⚠️ **VERIFICAR CON SR** el scope de unicidad de `NumeroOrden`.

---

## 🔴 ERROR CRÍTICO #12: Falta Almacenar IdEmpresa de SR

### Ubicación:
`153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql:178-248` (tabla sr_sales)

### Error Encontrado:
El JSON completo de SR incluye:
```json
{
  "IdEmpresa": "SR10.002MX12345",  // ← Identificador de empresa SR
  "Ventas": [...]
}
```

Pero la tabla `sr_sales` **NO almacena** el campo `IdEmpresa`.

### Documentación SR (página 6):
El primer campo del JSON es `IdEmpresa`, que identifica la empresa/sucursal en SR.

### Problema:
- No podemos validar que la venta viene de la empresa SR correcta
- En un entorno multi-tenant, podríamos recibir ventas de diferentes empresas SR
- No tenemos forma de distinguir de qué instancia SR viene la venta
- Pérdida de información crítica para debugging

### Impacto: 🔴 ALTO
- Riesgo de seguridad: podrían enviarnos ventas de otra empresa SR
- Imposible detectar configuración incorrecta en SR
- Debugging complicado si hay problemas

### Corrección Requerida:
```sql
-- En tabla sr_sales, AGREGAR DESPUÉS de integration_id:

-- SR Company identifier
-- MAPPING: IdEmpresa (SR JSON root) → sr_company_id (TIS TIS)
sr_company_id VARCHAR(50),               -- SR: "IdEmpresa" (e.g., "SR10.002MX12345")
```

### Validación Adicional Necesaria:
En el backend (FASE 2), validar que:
```typescript
if (payload.IdEmpresa !== integration.metadata.expected_sr_company_id) {
  throw new Error('Invalid SR Company ID - potential security issue');
}
```

---

## 🟡 ERROR MEDIO #13: movement_type Solo Almacena Número

### Ubicación:
`153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql:338-340`

### Código Actual:
```sql
-- MAPPING: Movimiento (SR JSON Conceptos[]) → movement_type (TIS TIS)
-- IMPORTANTE: 1=venta, 2=devolución, etc.
movement_type INTEGER,                   -- SR: "Movimiento"
```

### Documentación Insuficiente:
El comentario dice "1=venta, 2=devolución, etc." pero:
- ¿Qué es "etc."?
- ¿Cuáles son TODOS los valores posibles?
- ¿Qué significa 3, 4, 5...?

### Problema:
SR envía un número (1, 2, 3...) pero no sabemos qué significan todos los valores posibles.

### Evidencia del Documento SR:
La documentación oficial SR (página 6-7) solo muestra:
```json
"Movimiento": 1
```

Pero no define qué valores son válidos ni qué significa cada uno.

### Impacto: 🟡 MEDIO
- No podemos validar correctamente el campo
- No podemos crear CHECK constraint con valores válidos
- Código futuro tendrá que adivinar qué significan los valores

### Corrección Recomendada:
```sql
-- OPCIÓN 1: Si conocemos TODOS los valores, agregar CHECK constraint
movement_type INTEGER CHECK (movement_type IN (1, 2, 3, 4)),

-- OPCIÓN 2: Mejorar comentario con TODOS los valores conocidos
COMMENT ON COLUMN public.sr_sale_items.movement_type IS
'Tipo de movimiento de Soft Restaurant:
1 = Venta normal
2 = Devolución
3 = Cortesía (sin cargo)
4 = Descuento especial
(Verificar documentación SR actualizada para valores completos)

IMPORTANTE: Documentación oficial SR solo documenta valor 1.
Si se reciben otros valores, investigar con soporte SR.';

-- OPCIÓN 3: Crear tabla de referencia
CREATE TABLE public.sr_movement_types (
  code INTEGER PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  affects_inventory BOOLEAN DEFAULT true
);

INSERT INTO public.sr_movement_types VALUES
  (1, 'venta', 'Venta normal', true),
  (2, 'devolucion', 'Devolución de producto', true),
  (3, 'cortesia', 'Cortesía sin cargo', true);
```

### Acción Requerida:
⚠️ **CONSULTAR con SR** la lista completa de valores de "Movimiento" y su significado.

---

## 🟢 ERROR MENOR #14: Comentario Impreciso en raw_data

### Ubicación:
`153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql:317-318`

### Código Actual:
```sql
COMMENT ON COLUMN public.sr_sales.raw_data IS
'JSON COMPLETO recibido de Soft Restaurant para auditoría y debugging.
Incluye IdEmpresa y el objeto Ventas completo.';
```

### Error Sutil:
El comentario dice "Incluye IdEmpresa y el objeto Ventas completo" pero es **impreciso**.

### Realidad:
La estructura que recibiremos es:
```json
{
  "IdEmpresa": "SR10.002MX12345",
  "Ventas": [
    { ... }  // ← Solo guardamos UNA venta por registro
  ]
}
```

Pero `raw_data` debería almacenar el objeto de UNA SOLA venta, no el array completo.

### Confusión:
- ¿Guardamos el JSON completo recibido (con array Ventas[])?
- ¿O solo guardamos el objeto individual de la venta?

### Corrección Recomendada:
```sql
COMMENT ON COLUMN public.sr_sales.raw_data IS
'JSON COMPLETO del objeto individual de venta recibido de SR.
Almacena el elemento Ventas[i] exacto, incluyendo Conceptos[] y Pagos[].
NO incluye el wrapper {IdEmpresa, Ventas:[]} para ahorrar espacio.
Usado para auditoría, debugging y reprocesamiento.';
```

---

## 🟢 ERROR MENOR #15: Falta DEFAULT en Algunos Campos DECIMAL

### Ubicación:
Múltiples tablas

### Código Actual:
```sql
-- En sr_sale_items
discount_amount DECIMAL(12,4) DEFAULT 0,  -- ✅ CORRECTO
tax_amount DECIMAL(12,4),                 -- ❌ Debería tener DEFAULT

-- En sr_payments
tip_amount DECIMAL(12,4) DEFAULT 0,       -- ✅ CORRECTO

-- En sr_sales
tip DECIMAL(12,4),                        -- ❌ Debería tener DEFAULT 0
recipe_cost DECIMAL(12,4),                -- ⚠️  NULL correcto (calculado después)
```

### Problema:
Campos que representan montos deberían tener `DEFAULT 0` para evitar NULL inesperados.

### Regla:
- Si el valor DEBE calcularse después → NULL es correcto
- Si el valor PUEDE ser 0 (ausencia de impuesto/propina) → DEFAULT 0

### Corrección Recomendada:
```sql
-- sr_sale_items
tax_amount DECIMAL(12,4) DEFAULT 0,       -- Si no hay impuestos = 0

-- sr_sales
tip DECIMAL(12,4) DEFAULT 0,              -- Si no hay propina = 0
recipe_cost DECIMAL(12,4),                -- NULL correcto (se calcula después)
profit_margin DECIMAL(12,4),              -- NULL correcto (se calcula después)
```

---

## 📋 RESUMEN DE CORRECCIONES REQUERIDAS

### Prioridad CRÍTICA (Implementar YA):

1. **ERROR #9**: Agregar campos de cancelación a sr_sales
   - `cancellation_type VARCHAR(50)`
   - `cancelled_at TIMESTAMPTZ`
   - `cancellation_reason TEXT`

2. **ERROR #12**: Agregar campo `sr_company_id` para almacenar IdEmpresa

3. **ERROR #8**: Clarificar existencia del campo "Mesa" (verificar con SR)

4. **ERROR #11**: Validar unicidad de NumeroOrden (¿es por almacén?)

### Prioridad MEDIA (Próxima iteración):

5. **ERROR #10**: Agregar índices para cancelación
6. **ERROR #13**: Documentar TODOS los valores de movement_type

### Prioridad BAJA (Mejoras de calidad):

7. **ERROR #14**: Corregir comentario de raw_data
8. **ERROR #15**: Agregar DEFAULT 0 a campos monetarios

---

## 🎯 ESTADO DESPUÉS DE BUCLE 3

**Errores encontrados en v1.0:** 7
**Errores encontrados en v2.0:** 8 (adicionales)
**Total de errores encontrados:** 15

**Siguiente paso:** Crear v3.0 con TODAS las correcciones.

---

**Generado por:** Bucle Agéntico - Iteración 3
**Fecha:** 2026-01-22
**Requiere:** Creación de 154_SOFT_RESTAURANT_INTEGRATION_V3.sql
