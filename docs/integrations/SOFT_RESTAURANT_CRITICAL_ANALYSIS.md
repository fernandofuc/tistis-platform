# 🔍 ANÁLISIS CRÍTICO EXHAUSTIVO: Integración Soft Restaurant con TIS TIS

**Documento:** TIS-SR-ANALYSIS-001
**Fecha:** 2026-01-22
**Metodología:** Bucle Agéntico Iterativo
**Autor:** Claude Sonnet 4.5
**Estado:** ❌ IMPLEMENTACIÓN ACTUAL INCORRECTA - REQUIERE CORRECCIÓN URGENTE

---

## 📋 RESUMEN EJECUTIVO

Después de un análisis exhaustivo comparando la documentación oficial de Soft Restaurant (OPE.ANA.SR11) con la implementación actual en TIS TIS, se han identificado **ERRORES CRÍTICOS** que hacen que la integración actual sea **COMPLETAMENTE INCOMPATIBLE** con el funcionamiento real de Soft Restaurant.

### 🚨 Hallazgos Críticos

1. **ERROR FUNDAMENTAL #1**: La implementación asume sincronización bidireccional de TODOS los datos
2. **ERROR FUNDAMENTAL #2**: NO existe endpoint/webhook para recibir ventas de Soft Restaurant
3. **ERROR FUNDAMENTAL #3**: La UI permite configurar features que Soft Restaurant NO soporta
4. **ERROR FUNDAMENTAL #4**: No se implementó el modelo de operación correcto (ERP gobierna catálogos)

### ⚠️ Impacto

- ❌ La integración **NO FUNCIONARÁ** tal como está implementada
- ❌ Usuarios configurarán opciones que **NUNCA SINCRONIZARÁN**
- ❌ Expectativas falsas sobre funcionalidades bidireccionales
- ❌ Falta el componente **MÁS IMPORTANTE**: recepción de ventas

---

## 🔄 FASE 1: DELIMITACIÓN DEL PROBLEMA

### 1.1 Problema Principal

**TIS TIS implementó una integración de Soft Restaurant basada en DOCUMENTACIÓN INCORRECTA**, asumiendo que Soft Restaurant es un sistema POS estándar con API bidireccional completa, cuando en realidad:

> **VERDAD SEGÚN DOCUMENTACIÓN OFICIAL:**
> Soft Restaurant SOLO envía datos de ventas via JSON POST. Todo lo demás (menú, inventario, recetas) debe manejarse manualmente en EL ERP (en este caso TIS TIS).

### 1.2 Subproblemas Identificados

1. **Arquitectura incorrecta**: TIS TIS espera sincronización bidireccional automática
2. **Missing critical component**: NO hay endpoint para recibir POST de ventas desde SR
3. **UI engañosa**: Permite configurar syncs imposibles (menu_direction, inventory_direction)
4. **Modelo de datos inadecuado**: No refleja el modelo real de "explosión de insumos"
5. **Falta de lógica de deducción**: No hay sistema para deducir ingredientes consumidos

### 1.3 Criterios de Éxito (100% Completo)

✅ **Criterio 1**: Endpoint funcional para recibir ventas de SR (JSON POST)
✅ **Criterio 2**: Configuración manual de menú, recetas e inventario en TIS TIS
✅ **Criterio 3**: Sistema de deducción automática de ingredientes al recibir venta
✅ **Criterio 4**: Alertas de stock bajo basadas en consumo real
✅ **Criterio 5**: Dashboard de análisis de ventas desde SR
✅ **Criterio 6**: UI que refleje correctamente las capacidades reales de SR

---

## 🔧 FASE 2: INGENIERÍA INVERSA DEL DOCUMENTO OFICIAL

### 2.1 Análisis Página por Página del Documento SR

#### **PÁGINA 2: Diagrama de Operación**

**Hallazgo Crítico:**
```
"La idea general que SoftRestaurant® envía las ventas en una estructura
de datos tipo JSON y el integrador pueda generar un servicio que lo reciba
y realice las conexiones pertinentes con el ERP."
```

**Traducción para TIS TIS:**
- ✅ SR envía → TIS TIS recibe (SOLO VENTAS)
- ❌ TIS TIS envía → SR recibe (NO SOPORTADO)
- ❌ Sincronización bidireccional de menú/inventario (NO EXISTE)

**Modelo de Operación Correcto:**
```
┌─────────────────┐         ┌────────────────┐
│ Soft Restaurant │         │    TIS TIS     │
│   (Solo POS)    │         │  (ERP/Admin)   │
└────────┬────────┘         └────────┬───────┘
         │                           │
         │  1. Envía Ventas (JSON)   │
         │  ========================> │
         │                           │
         │                           │ 2. TIS TIS procesa
         │                           │    - Guarda venta
         │                           │    - Deduce ingredientes
         │                           │    - Actualiza inventario
         │                           │    - Genera analytics
         │                           │
         │  ❌ NO hay sync de vuelta │
         │  <XXXXXXXXXXXXXXXXXXXXXX  │
```

#### **PÁGINA 2: Beneficios del Modelo**

**Documento dice:**
```
1. Al realizar las compras en el ERP se generan de manera natural
   las pólizas de egresos y la gestión de saldos a proveedores
2. Se pueden realizar transferencias y movimientos de almacén entre sucursales
3. Se evita complejidad operativa al realizar una sola integración (envío de venta)
4. Integración automática en el módulo de presupuestos del ERP
```

**Implicación para TIS TIS:**
- ✅ TIS TIS debe ser el sistema maestro para compras
- ✅ TIS TIS debe manejar transferencias entre sucursales
- ✅ TIS TIS debe generar presupuestos basados en consumo
- ❌ SR NO participa en estas funciones administrativas

#### **PÁGINA 3: Gobierno de Catálogos**

**CITA TEXTUAL CRÍTICA:**
```
"El ERP es el que gobierna los catálogos de productos en este modelo
de operación e integración. Debido a esto, es necesario que las claves
o identificador único de los productos sea el especificado en el ERP"
```

**ERROR EN IMPLEMENTACIÓN ACTUAL:**
```typescript
// SoftRestaurantConfigModal.tsx - LÍNEA 160
menu_direction: 'sr_to_tistis',  // ❌ ESTO NO EXISTE EN SR!

// LÍNEA 183-188
{
  key: 'sync_menu',
  label: 'Menú',
  description: 'Productos, categorías, precios y modificadores',
  icon: MenuIcon,
  hasDirection: true,  // ❌ NO TIENE DIRECCIÓN!
  directionKey: 'menu_direction',  // ❌ FALSO!
}
```

**REALIDAD:**
- ✅ TIS TIS crea productos manualmente
- ✅ TIS TIS asigna claves/IDs que SR usará
- ✅ Cuando SR envía venta, usa esos IDs de TIS TIS
- ❌ SR NO envía su catálogo a TIS TIS
- ❌ TIS TIS NO envía su catálogo a SR

#### **PÁGINA 3: Catálogos NO Necesarios en SR**

**Documento dice:**
```
"Debido a que las funciones administrativas o de back office se realizarán
en el ERP no es necesario alimentar otros catálogos de SR como insumos,
presentación, recetas, proveedores y los relacionados a funciones de compras."
```

**Implicación:**
- ✅ Insumos/ingredientes se manejan SOLO en TIS TIS
- ✅ Recetas se configuran SOLO en TIS TIS
- ✅ Proveedores se gestionan SOLO en TIS TIS
- ✅ Compras se realizan SOLO en TIS TIS
- ❌ SR solo necesita saber QUÉ vender, NO cómo se hace

#### **PÁGINA 3: Explosión de Productos**

**Documento dice:**
```
"Junto con la información de ventas, se envía el detalle de los productos
vendidos, el ERP toma esos productos y realiza los movimientos de salida
por venta para integrarlos en su Kardex."
```

**Traducción:**
```
Venta recibida de SR:
{
  "IdProducto": "01005",
  "Descripcion": "COMBO 2 PZAS/COMEDOR",
  "Cantidad": 1.000000
}

TIS TIS debe hacer:
1. Buscar producto "01005" en su catálogo
2. Obtener receta (explosión de insumos)
3. Por cada ingrediente:
   - Pollo: 200g → restar del inventario
   - Papa: 150g → restar del inventario
   - Refresco: 1 pz → restar del inventario
4. Actualizar Kardex
5. Verificar puntos de reorden
6. Generar alertas si es necesario
```

**FALTA COMPLETAMENTE EN IMPLEMENTACIÓN ACTUAL**

### 2.2 Análisis de Configuración SR (Páginas 3-5)

#### **PÁGINA 4: Seleccionar Almacén por Estación**

**Documento:**
```
"En este apartado se asigna el almacén en el cual se asignarán las ventas,
es importante debido a que este dato se envía en la información de la venta
y será procesado según corresponda en el ERP."
```

**Campo crítico en JSON de venta:**
```json
{
  "Almacen": "2",  // ← TIS TIS necesita saber qué sucursal/almacén
  "FechaVenta": "2022-06-02T12:27:12",
  "NumeroOrden": "51795"
}
```

**Necesidad en TIS TIS:**
- Campo: `warehouse_id` o `branch_id` en venta recibida
- Mapeo: Almacén SR "2" → Branch TIS TIS UUID
- Configuración: Usuario debe mapear almacenes SR a branches TIS TIS

**FALTA EN IMPLEMENTACIÓN ACTUAL**

#### **PÁGINA 4: Equivalencia de Formas de Pago**

**Documento:**
```
"En esta sección se especifican el código de la forma de pago del ERP
para que este pueda ser procesado, recordando que al momento de enviar
la venta está considerados los datos generales, el detalle de los productos
y las formas de pago."
```

**JSON de ejemplo:**
```json
"Pagos": [
  {
    "FormaPago": "Tarjeta de Débito",
    "Importe": 100.0000,
    "Propina": 0.0000
  },
  {
    "FormaPago": "Efectivo",
    "Importe": 20.0000,
    "Propina": 20.0000
  }
]
```

**Necesidad en TIS TIS:**
- Mapeo configurado por usuario: "Tarjeta de Débito" SR → payment_method_id TIS TIS
- Validación: Si forma de pago no existe en mapeo, ¿rechazar o crear?
- Propinas: ¿Se manejan por separado o se suman al total?

**PARCIALMENTE IMPLEMENTADO** en field_mapping, pero no hay UI específica

### 2.3 Análisis de API de Transacción (Páginas 6-7)

#### **Estructura JSON Completa de Venta SR**

**Documento página 6-7 muestra JSON REAL:**

```json
{
  "IdEmpresa": "SR10.002MX12345",
  "Ventas": [
    {
      "Estacion": "NS-CLNT-MID-81",
      "Almacen": "2",
      "FechaVenta": "2022-06-02T12:27:12",
      "NumeroOrden": "51795",
      "IdCliente": "",
      "IdUsuario": "ADMIN",
      "Total": 120.0000,
      "Area": "DIDDI",
      "Conceptos": [
        {
          "IdProducto": "01005",
          "Descripcion": "COMBO 2 PZAS/COMEDOR",
          "Movimiento": 1,
          "Cantidad": 1.000000,
          "PrecioUnitario": 50.0000,
          "ImporteSinImpuestos": 43.1034,
          "Descuento": 0.000000,
          "Impuestos": [
            {
              "Impuesto": "IVA",
              "Tasa": 0.16,
              "Importe": 6.896551
            }
          ]
        }
      ],
      "Pagos": [
        {
          "FormaPago": "Tarjeta de Débito",
          "Importe": 100.0000,
          "Propina": 0.0000
        }
      ]
    }
  ]
}
```

**Campos Críticos a Procesar:**

1. **IdEmpresa**: Identificar tenant/sucursal SR → tenant TIS TIS
2. **Estacion**: Nombre de estación (informativo)
3. **Almacen**: Almacén SR → Branch TIS TIS (MAPEO REQUERIDO)
4. **FechaVenta**: Timestamp de venta
5. **NumeroOrden**: Folio único de SR (guardar para referencia)
6. **Area**: Zona del restaurante (Terraza, Comedor, Barra)
7. **Conceptos**: Array de productos vendidos
   - **IdProducto**: Clave del producto EN TIS TIS (gobierno de catálogos)
   - **Movimiento**: Número de línea
   - **Cantidad**: Unidades vendidas
   - **PrecioUnitario**: Precio al que se vendió
   - **Descuento**: Descuento aplicado
   - **Impuestos**: Array de impuestos
8. **Pagos**: Array de formas de pago
   - **FormaPago**: Método (mapeo requerido)
   - **Importe**: Monto
   - **Propina**: Propina incluida

#### **Respuesta JSON Esperada**

**Documento página 7:**

```json
{
  "Message": "Registro insertado correctamente",
  "Transaction_id": 12345
}
```

**IMPORTANTE:**
```
"Importante: si la transacción no es correcta favor de devolver
Transaction_id vacio o 0."
```

**TIS TIS debe responder:**
- ✅ Success: `{ "Message": "...", "Transaction_id": <uuid> }`
- ❌ Error: `{ "Message": "Error description", "Transaction_id": "" }`

### 2.4 Análisis de Escenarios de Envío (Página 7-8)

#### **3 Escenarios Soportados por SR:**

1. **Al finalizar la venta** (tiempo real)
   - Ventaja: Inventario actualizado al instante
   - Desventaja: Añade latencia al cobro
   - Uso: Restaurantes con inventario crítico

2. **Al cierre diario** (batch)
   - Ventaja: Sin impacto en operación
   - Desventaja: Inventario desactualizado durante el día
   - Uso: **MÁS COMÚN** según documento

3. **Por intervalo de tiempo** (ej: cada 15 min)
   - Ventaja: Balance entre tiempo real y performance
   - Desventaja: Requiere enlace abierto
   - Uso: Operaciones medianas

**Implicación para TIS TIS:**
```typescript
// Configuración requerida
interface SRSyncConfig {
  send_mode: 'on_sale' | 'daily_close' | 'interval';
  interval_minutes?: number; // Solo si send_mode = 'interval'

  // ❌ REMOVER ESTAS OPCIONES (NO EXISTEN EN SR)
  // sync_menu: boolean;
  // sync_recipes: boolean;
  // menu_direction: string;
  // inventory_direction: string;
}
```

### 2.5 Análisis de Cancelación de Ventas (Página 9-11)

#### **API de Cancelación**

**Endpoint:**
```
GET pms/v1/softrestaurant/cancel?NumeroOrden=12
```

**Parámetros:**
```json
{
  "NumeroOrden": "0",         // Inicializar con 0
  "TipoCancelacion": "devolución"  // Inicializar con "devolución"
}
```

**Respuestas:**
```json
// Cancelación duplicada
{
  "Message": "Cancelacion duplicada",
  "Transaction_id": ""
}

// Cancelación exitosa
{
  "Message": "Cancelacion realizada exitosamente",
  "Transaction_id": "12345678"
}
```

**Implicación para TIS TIS:**
1. Endpoint GET adicional: `/api/integrations/softrestaurant/cancel`
2. Buscar venta por `NumeroOrden` (folio SR)
3. Revertir:
   - Movimientos de inventario
   - Registro de venta
   - Kardex
   - Analytics
4. Validar que no esté ya cancelada
5. Guardar registro de cancelación

**COMPLETAMENTE FALTANTE EN IMPLEMENTACIÓN**

### 2.6 Análisis de Bitácora (Página 10)

**Documento:**
```
"Parte importante del éxito de la interfaz es la transparencia en las
intercomunicaciones de ambas plataformas. Debido a ello, añadimos una
bitácora que permite consultar las ventas que han sido enviadas
exitosamente y aquellas que no."
```

**Necesidad en TIS TIS:**

```typescript
interface SRSyncLog {
  id: string;
  tenant_id: string;
  integration_id: string;

  // Info de venta SR
  sr_order_number: string;
  sr_warehouse: string;
  sr_station: string;

  // Resultado
  status: 'success' | 'failed' | 'partial';
  received_at: string;
  processed_at: string;

  // Datos procesados
  sale_id?: string;  // Si se creó venta en TIS TIS
  products_processed: number;
  inventory_updated: boolean;

  // Errores
  error_message?: string;
  error_code?: string;
  failed_products?: string[];  // IDs que fallaron

  // Raw data para debugging
  raw_request: Record<string, unknown>;
  raw_response: Record<string, unknown>;
}
```

**UI Requerida:**
- Vista de bitácora de ventas recibidas
- Filtros por fecha, status, sucursal
- Detalle de errores
- Botón "Reintentar" para ventas fallidas

**COMPLETAMENTE FALTANTE**

---

## 📊 FASE 3: ANÁLISIS DE IMPLEMENTACIÓN ACTUAL

### 3.1 Archivo: SoftRestaurantConfigModal.tsx

#### **Error #1: Configuración de Sincronización Bidireccional**

**Líneas 153-172: DEFAULT_SR_SYNC_CONFIG**

```typescript
const DEFAULT_SR_SYNC_CONFIG: SRSyncConfig = {
  sync_menu: true,              // ❌ SR NO ENVÍA MENÚ
  sync_recipes: true,           // ❌ SR NO ENVÍA RECETAS
  sync_inventory: true,         // ❌ SR NO ENVÍA INVENTARIO
  sync_tables: true,            // ❌ SR NO ENVÍA MESAS
  sync_reservations: false,     // ❌ SR NO ENVÍA RESERVAS
  sync_sales: true,             // ✅ ÚNICO CORRECTO

  menu_direction: 'sr_to_tistis',       // ❌ NO EXISTE
  inventory_direction: 'bidirectional',  // ❌ NO EXISTE
  reservations_direction: 'bidirectional', // ❌ NO EXISTE

  sync_frequency_minutes: 30,   // ⚠️  Aplica solo a sales
  // ... resto de config
};
```

**Realidad vs Implementación:**

| Feature | Implementado | Realidad SR | Status |
|---------|--------------|-------------|--------|
| sync_menu | ✅ true | ❌ No existe | ❌ ERROR |
| sync_recipes | ✅ true | ❌ No existe | ❌ ERROR |
| sync_inventory | ✅ true | ❌ No existe | ❌ ERROR |
| sync_tables | ✅ true | ❌ No existe | ❌ ERROR |
| sync_reservations | ✅ false | ❌ No existe | ❌ ERROR |
| sync_sales | ✅ true | ✅ SOLO ESTO EXISTE | ✅ OK |
| menu_direction | ✅ Configurable | ❌ No aplica | ❌ ERROR |
| inventory_direction | ✅ Configurable | ❌ No aplica | ❌ ERROR |

#### **Error #2: UI Engañosa - Botones de Dirección**

**Líneas 656-681: DirectionButton Components**

```typescript
<DirectionButton
  direction="sr_to_tistis"
  selected={syncConfig[option.directionKey] === 'sr_to_tistis'}
  icon={<ArrowRightIcon />}
  label="SR → TIS TIS"
  description="Solo importar"  // ❌ ENGAÑOSO - No hay import
/>
<DirectionButton
  direction="bidirectional"
  selected={syncConfig[option.directionKey] === 'bidirectional'}
  icon={<ArrowsRightLeftIcon />}
  label="Bidireccional"
  description="Sync completo"  // ❌ FALSO - No existe
/>
<DirectionButton
  direction="tistis_to_sr"
  selected={syncConfig[option.directionKey] === 'tistis_to_sr'}
  icon={<ArrowLeftIcon />}
  label="TIS TIS → SR"
  description="Solo exportar"  // ❌ IMPOSIBLE - SR no acepta
/>
```

**Usuario ve:**
- "Sincronizar Menú: SR → TIS TIS" ✅
- "Sincronizar Menú: Bidireccional" ✅
- "Sincronizar Menú: TIS TIS → SR" ✅

**Realidad:**
- ❌ NINGUNA de esas opciones existe
- ✅ Solo hay: "Configurar menú manualmente en TIS TIS"

#### **Error #3: Opciones de Sync Inventory**

**Líneas 199-207: sync_inventory Config**

```typescript
{
  key: 'sync_inventory',
  label: 'Inventario',
  description: 'Stock, puntos de reorden y costos unitarios',
  icon: BoxIcon,
  hasDirection: true,          // ❌ FALSO
  directionKey: 'inventory_direction',  // ❌ NO EXISTE
  color: 'text-green-600',
  bgColor: 'bg-green-50',
}
```

**Realidad:**
- SR envía venta → TIS TIS deduce consumo → TIS TIS actualiza stock
- NO hay sincronización de inventario
- Stock vive SOLO en TIS TIS

#### **Error #4: Falta Configuración de Recetas**

**Líneas 190-197: sync_recipes**

```typescript
{
  key: 'sync_recipes',
  label: 'Recetas con Gramaje',
  description: 'Explosión de insumos, costos por porción y merma',
  icon: ScaleIcon,
  hasDirection: false,  // ✅ Correcto que no tenga dirección
  // PERO ❌ No debería ser un "sync", debería ser "Habilitar deducción automática"
}
```

**Debería ser:**
```typescript
{
  key: 'enable_recipe_deduction',
  label: 'Deducción Automática de Ingredientes',
  description: 'Calcular consumo de insumos al recibir ventas',
  icon: ScaleIcon,
  hasDirection: false,
  requires: ['sync_sales'],  // Depende de recibir ventas
}
```

### 3.2 Archivo: integration.types.ts

#### **Análisis de SRSyncConfig (Líneas 754-784)**

```typescript
export interface SRSyncConfig {
  // What to sync
  sync_menu: boolean;           // ❌ DEBE ELIMINARSE
  sync_recipes: boolean;        // ⚠️  RENOMBRAR a enable_recipe_deduction
  sync_inventory: boolean;      // ❌ DEBE ELIMINARSE
  sync_tables: boolean;         // ❌ DEBE ELIMINARSE
  sync_reservations: boolean;   // ❌ DEBE ELIMINARSE
  sync_sales: boolean;          // ✅ ÚNICO VÁLIDO

  // Direction
  menu_direction: ...           // ❌ ELIMINAR
  inventory_direction: ...      // ❌ ELIMINAR
  reservations_direction: ...   // ❌ ELIMINAR

  // Frequency
  sync_frequency_minutes: number;  // ✅ OK - aplica a ventas

  // ... resto OK
}
```

**Estructura Correcta Propuesta:**

```typescript
export interface SRSyncConfig {
  // === RECEPCIÓN DE VENTAS (ÚNICO SYNC REAL) ===
  receive_sales: boolean;  // Habilitar endpoint para recibir ventas
  sales_webhook_url: string;  // URL generada para SR
  sales_webhook_secret: string;  // Secret para validar requests

  // === ESCENARIO DE ENVÍO (según doc página 7-8) ===
  sr_send_mode: 'on_sale' | 'daily_close' | 'interval';
  sr_send_interval_minutes?: number;  // Solo si mode = interval

  // === MAPEO DE DATOS ===
  warehouse_mapping: Record<string, string>;  // SR warehouse -> TIS TIS branch_id
  payment_method_mapping: Record<string, string>;  // SR forma pago -> TIS TIS payment_method

  // === DEDUCCIÓN AUTOMÁTICA ===
  enable_recipe_deduction: boolean;  // Auto-deducir ingredientes
  enable_inventory_alerts: boolean;  // Alertas de stock bajo
  reorder_point_calculation: 'manual' | 'automatic';  // Calcular puntos de reorden

  // === CONFIGURACIÓN MANUAL (NO SYNC) ===
  manual_menu_management: boolean;  // Siempre true (no es sync)
  manual_recipe_management: boolean;  // Siempre true
  manual_inventory_management: boolean;  // Siempre true

  // === HISTÓRICO ===
  import_sales_history_days: number;  // Al conectar, importar últimos X días

  // === FEATURES OPCIONALES ===
  auto_create_customers: boolean;  // Si SR envía IdCliente, crear en TIS TIS
  track_sales_by_area: boolean;  // Analizar por zona (Terraza, Comedor)
  track_sales_by_station: boolean;  // Analizar por estación/caja

  // === CANCELACIONES ===
  allow_cancellations: boolean;  // Permitir endpoint de cancelación
  cancellation_requires_approval: boolean;  // Requiere aprobación manual
}
```

### 3.3 Análisis de Missing Components

#### **❌ FALTA #1: Endpoint de Recepción de Ventas**

**Debería existir:**
```
POST /api/integrations/softrestaurant/transaction
```

**Actualmente:** NO EXISTE

**Archivo requerido:**
```
/app/api/integrations/softrestaurant/transaction/route.ts
```

#### **❌ FALTA #2: Endpoint de Cancelación**

**Debería existir:**
```
GET /api/integrations/softrestaurant/cancel?NumeroOrden=XXX
```

**Actualmente:** NO EXISTE

**Archivo requerido:**
```
/app/api/integrations/softrestaurant/cancel/route.ts
```

#### **❌ FALTA #3: Sistema de Deducción de Ingredientes**

**Componentes faltantes:**
1. Tabla de recetas: `recipes`
2. Tabla de ingredientes: `recipe_ingredients`
3. Servicio: `RecipeDeductionService`
4. Lógica de explosión de insumos

#### **❌ FALTA #4: UI de Configuración de Recetas**

**Pantalla requerida:**
- CRUD de productos (menú)
- Por cada producto: Configurar receta
- Por cada ingrediente: cantidad, unidad, costo
- Cálculo automático de costo por porción
- Margen de utilidad

#### **❌ FALTA #5: Logs/Bitácora de Ventas SR**

**Vista requerida:**
- Lista de ventas recibidas de SR
- Estado de procesamiento
- Errores
- Capacidad de re-procesar

---

## 🚨 FASE 4: IDENTIFICACIÓN DE GAPS Y ERRORES

### 4.1 Matriz de Errores Críticos

| # | Error | Severidad | Impacto | Ubicación |
|---|-------|-----------|---------|-----------|
| 1 | No existe endpoint POST /transaction | 🔴 CRÍTICO | Integración NO funciona | Missing file |
| 2 | No existe endpoint GET /cancel | 🔴 CRÍTICO | No se pueden cancelar ventas | Missing file |
| 3 | UI permite configurar syncs imposibles | 🔴 CRÍTICO | Usuarios confundidos | SoftRestaurantConfigModal.tsx |
| 4 | Modelo de datos incorrecto (SRSyncConfig) | 🟠 ALTO | Arquitectura errónea | integration.types.ts |
| 5 | Falta sistema de deducción de ingredientes | 🔴 CRÍTICO | Feature principal ausente | Missing service |
| 6 | Falta UI de gestión de recetas | 🟠 ALTO | No se pueden configurar productos | Missing component |
| 7 | Falta mapeo de almacenes SR → Branches TIS TIS | 🟠 ALTO | Ventas no se asignan a sucursal correcta | SRSyncConfig |
| 8 | Falta mapeo de formas de pago | 🟠 ALTO | Pagos no se registran correctamente | SRSyncConfig |
| 9 | Falta bitácora de ventas recibidas | 🟡 MEDIO | Difícil debugging | Missing component |
| 10 | Falta validación de Transaction_id en response | 🟡 MEDIO | SR no sabrá si falló | Missing logic |
| 11 | No hay manejo de propinas | 🟡 MEDIO | Propinas no se registran | Missing logic |
| 12 | No hay tracking de área/zona | 🟡 BAJO | Análisis limitado | Missing field |
| 13 | No hay tracking de estación/caja | 🟡 BAJO | Análisis limitado | Missing field |
| 14 | Documentación incorrecta para usuarios | 🟠 ALTO | Expectativas incorrectas | Missing docs |

### 4.2 Priorización de Correcciones

#### **PRIORITY 1 - BLOQUEANTE (Debe hacerse primero)**

1. ✅ Crear endpoint POST `/api/integrations/softrestaurant/transaction`
2. ✅ Diseñar nuevo SRSyncConfig correcto
3. ✅ Actualizar UI de configuración (remover opciones imposibles)
4. ✅ Crear sistema de mapeo de almacenes
5. ✅ Crear sistema de mapeo de formas de pago

#### **PRIORITY 2 - CORE FEATURES (Sin esto, integración incompleta)**

6. ✅ Crear endpoint GET `/api/integrations/softrestaurant/cancel`
7. ✅ Implementar RecipeDeductionService
8. ✅ Crear UI de gestión de recetas
9. ✅ Crear UI de gestión de ingredientes
10. ✅ Implementar lógica de deducción automática

#### **PRIORITY 3 - ENHANCED FEATURES (Mejoran UX)**

11. ✅ Crear bitácora/logs de ventas SR
12. ✅ Dashboard de análisis de ventas por área
13. ✅ Dashboard de análisis de ventas por estación
14. ✅ Alertas de stock bajo automáticas
15. ✅ Cálculo de puntos de reorden

#### **PRIORITY 4 - POLISH (Nice to have)**

16. ✅ Manejo de propinas separadas
17. ✅ Tracking de IVA por producto
18. ✅ Tracking de descuentos
19. ✅ Webhook para notificar a SR de problemas
20. ✅ Documentación completa para usuarios

---

## 💡 FASE 5: DISEÑO DE SOLUCIÓN

### 5.1 Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                    SOFT RESTAURANT (POS)                     │
│                                                               │
│  1. Mesero toma orden                                        │
│  2. Cocina prepara                                           │
│  3. Se cobra (3 escenarios)                                  │
│     a) Al finalizar venta → POST inmediato                   │
│     b) Al cierre diario → POST batch                         │
│     c) Cada X minutos → POST por lote                        │
│                                                               │
│  POST /api/integrations/softrestaurant/transaction           │
│       {                                                       │
│         "IdEmpresa": "SR10.002MX12345",                      │
│         "Ventas": [ { ... } ]                                │
│       }                                                       │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              TIS TIS - WEBHOOK ENDPOINT                      │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │  transaction/route.ts                            │        │
│  │                                                   │        │
│  │  1. ✅ Validar firma/secret                      │        │
│  │  2. ✅ Validar schema JSON                       │        │
│  │  3. ✅ Extraer datos de venta                    │        │
│  │  4. ✅ Mapear almacén → branch                   │        │
│  │  5. ✅ Mapear formas de pago                     │        │
│  │  6. ✅ Crear registro de venta                   │        │
│  │  7. ✅ Por cada producto:                        │        │
│  │      - Buscar en catálogo TIS TIS                │        │
│  │      - Obtener receta                             │        │
│  │      - Deducir ingredientes                       │        │
│  │      - Actualizar inventario                      │        │
│  │  8. ✅ Guardar en bitácora                        │        │
│  │  9. ✅ Generar analytics                          │        │
│  │  10. ✅ Verificar alertas de stock                │        │
│  │                                                   │        │
│  │  RETURN:                                          │        │
│  │  {                                                │        │
│  │    "Message": "Registro insertado correctamente",│        │
│  │    "Transaction_id": "uuid-generado"             │        │
│  │  }                                                │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │  RecipeDeductionService                          │        │
│  │                                                   │        │
│  │  processProductSale(productId, quantity):        │        │
│  │    1. recipe = getRecipe(productId)              │        │
│  │    2. FOR EACH ingredient IN recipe:             │        │
│  │         amountNeeded = ingredient.qty * quantity │        │
│  │         deductFromInventory(ingredient.id, amt)  │        │
│  │         checkReorderPoint(ingredient.id)         │        │
│  │    3. updateKardex()                              │        │
│  │    4. IF stock < reorderPoint: sendAlert()       │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │  Database Tables                                  │        │
│  │                                                   │        │
│  │  - sr_sales (ventas recibidas)                   │        │
│  │  - sr_sale_items (detalle de productos)          │        │
│  │  - sr_payments (formas de pago)                  │        │
│  │  - sr_sync_logs (bitácora)                       │        │
│  │  - recipes (recetas configuradas)                │        │
│  │  - recipe_ingredients (ingredientes)             │        │
│  │  - inventory_movements (kardex)                  │        │
│  │  - low_stock_alerts (alertas)                    │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │  UI Components                                    │        │
│  │                                                   │        │
│  │  1. SRConfigModal (corregido)                    │        │
│  │  2. RecipeManager (nuevo)                        │        │
│  │  3. IngredientManager (nuevo)                    │        │
│  │  4. SRSalesLog (nuevo)                           │        │
│  │  5. SRAnalyticsDashboard (nuevo)                 │        │
│  │  6. WarehouseMappingConfig (nuevo)               │        │
│  │  7. PaymentMappingConfig (nuevo)                 │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Flujo Detallado de Recepción de Venta

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: SR POST Venta                                       │
│                                                               │
│  POST /api/integrations/softrestaurant/transaction           │
│  Headers:                                                     │
│    - Authorization: <api_key configurada en SR>              │
│    - Content-Type: application/json                          │
│  Body:                                                        │
│    { "IdEmpresa": "...", "Ventas": [...] }                   │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: TIS TIS Valida Request                              │
│                                                               │
│  1. Verificar Authorization header                           │
│     - Buscar integration_connection con ese api_key          │
│     - Si no existe: return 401 Unauthorized                  │
│                                                               │
│  2. Verificar IdEmpresa                                      │
│     - Debe coincidir con tenant configurado                  │
│     - Si no: return 400 Bad Request                          │
│                                                               │
│  3. Validar schema JSON                                      │
│     - Required: Ventas array                                 │
│     - Required en cada venta: Almacen, FechaVenta,           │
│       NumeroOrden, Total, Conceptos, Pagos                   │
│     - Si falta algo: return 400 Bad Request                  │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Procesar Cada Venta (loop)                          │
│                                                               │
│  FOR EACH venta IN request.Ventas:                           │
│                                                               │
│    A. Mapear Almacén                                         │
│       almacenSR = venta.Almacen  // "2"                      │
│       branchId = config.warehouse_mapping[almacenSR]         │
│       IF !branchId: usar default_branch_id                   │
│       IF !default_branch_id: ERROR                           │
│                                                               │
│    B. Verificar Duplicado                                    │
│       existing = buscar venta con NumeroOrden                │
│       IF existing: skip (ya procesada)                       │
│                                                               │
│    C. Crear Registro de Venta                                │
│       sale = {                                                │
│         tenant_id,                                            │
│         branch_id: branchId,                                 │
│         integration_id,                                       │
│         external_id: venta.NumeroOrden,                      │
│         external_source: 'softrestaurant',                   │
│         sale_date: venta.FechaVenta,                         │
│         total: venta.Total,                                  │
│         station: venta.Estacion,                             │
│         area: venta.Area,                                    │
│         server: venta.IdUsuario,                             │
│         status: 'completed',                                 │
│         raw_data: venta,                                      │
│       }                                                       │
│       INSERT INTO sr_sales                                   │
│                                                               │
│    D. Procesar Productos (loop)                              │
│       FOR EACH concepto IN venta.Conceptos:                  │
│         1. Buscar producto                                   │
│            product = buscar por concepto.IdProducto          │
│            IF !product: LOG ERROR, continuar                 │
│                                                               │
│         2. Crear item de venta                               │
│            item = {                                           │
│              sale_id,                                         │
│              product_id,                                      │
│              quantity: concepto.Cantidad,                    │
│              unit_price: concepto.PrecioUnitario,            │
│              subtotal: concepto.ImporteSinImpuestos,         │
│              discount: concepto.Descuento,                   │
│              tax: SUM(concepto.Impuestos.Importe),           │
│            }                                                  │
│            INSERT INTO sr_sale_items                         │
│                                                               │
│         3. Deducir ingredientes (SI config.enable_recipe_deduction)│
│            RecipeDeductionService.processProductSale(        │
│              productId: product.id,                          │
│              quantity: concepto.Cantidad,                    │
│              branchId: branchId,                             │
│              saleId: sale.id                                 │
│            )                                                  │
│                                                               │
│    E. Procesar Pagos (loop)                                  │
│       FOR EACH pago IN venta.Pagos:                          │
│         1. Mapear forma de pago                              │
│            formaPagoSR = pago.FormaPago                      │
│            paymentMethodId = config.payment_method_mapping[formaPagoSR]│
│            IF !paymentMethodId: crear genérico "Otros"      │
│                                                               │
│         2. Crear registro de pago                            │
│            payment = {                                        │
│              sale_id,                                         │
│              payment_method_id: paymentMethodId,             │
│              amount: pago.Importe,                           │
│              tip: pago.Propina,                              │
│            }                                                  │
│            INSERT INTO sr_payments                           │
│                                                               │
│    F. Guardar en Bitácora                                    │
│       log = {                                                 │
│         integration_id,                                       │
│         sr_order_number: venta.NumeroOrden,                  │
│         status: 'success',                                   │
│         received_at: NOW(),                                  │
│         sale_id: sale.id,                                    │
│         products_processed: venta.Conceptos.length,          │
│         inventory_updated: config.enable_recipe_deduction,   │
│       }                                                       │
│       INSERT INTO sr_sync_logs                               │
│                                                               │
│  END FOR                                                      │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Generar Transaction ID                              │
│                                                               │
│  transactionId = sale.id  // UUID de venta creada            │
│  (o si múltiples ventas, concatenar IDs)                     │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Responder a SR                                      │
│                                                               │
│  SUCCESS:                                                     │
│  {                                                            │
│    "Message": "Registro insertado correctamente",            │
│    "Transaction_id": transactionId                           │
│  }                                                            │
│  Status: 200                                                  │
│                                                               │
│  ERROR:                                                       │
│  {                                                            │
│    "Message": "Error: [descripción del error]",              │
│    "Transaction_id": ""                                      │
│  }                                                            │
│  Status: 400/500 (según error)                               │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Flujo de Deducción de Ingredientes

```
┌─────────────────────────────────────────────────────────────┐
│  RecipeDeductionService.processProductSale()                 │
│                                                               │
│  INPUT:                                                       │
│    - productId: UUID del producto vendido                    │
│    - quantity: Cantidad vendida (ej: 2 combos)              │
│    - branchId: Sucursal donde se vendió                      │
│    - saleId: ID de venta (para tracking)                     │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Obtener Receta                                      │
│                                                               │
│  recipe = SELECT * FROM recipes                              │
│           WHERE product_id = productId                       │
│           AND is_active = true                               │
│                                                               │
│  IF !recipe:                                                 │
│    LOG WARNING "Producto sin receta"                         │
│    RETURN (no se deduce nada)                                │
│                                                               │
│  ingredients = SELECT * FROM recipe_ingredients              │
│                WHERE recipe_id = recipe.id                   │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Calcular Cantidades a Deducir                       │
│                                                               │
│  FOR EACH ingredient IN ingredients:                         │
│                                                               │
│    quantityNeeded = ingredient.quantity_per_portion * quantity│
│                                                               │
│    Ejemplo:                                                   │
│      Combo vendido: 2 unidades                               │
│      Pollo en receta: 200g por porción                       │
│      → Deducir: 200g * 2 = 400g de pollo                     │
│                                                               │
│    // Ajustar por merma/desperdicio                          │
│    IF ingredient.waste_percentage > 0:                       │
│      quantityNeeded *= (1 + ingredient.waste_percentage/100) │
│                                                               │
│    Ejemplo con 10% merma:                                    │
│      → Deducir: 400g * 1.10 = 440g                           │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Verificar Stock Disponible                          │
│                                                               │
│  currentStock = SELECT quantity_on_hand                      │
│                 FROM inventory                               │
│                 WHERE ingredient_id = ingredient.id          │
│                 AND branch_id = branchId                     │
│                                                               │
│  IF currentStock < quantityNeeded:                           │
│    LOG WARNING "Stock insuficiente"                          │
│    // Decidir qué hacer:                                     │
│    // Opción A: Deducir hasta 0 (permitir negativo)         │
│    // Opción B: Deducir lo disponible y alertar             │
│    // Opción C: Fallar toda la transacción                  │
│    // Recomendado: Opción A + alerta                        │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Deducir del Inventario                              │
│                                                               │
│  UPDATE inventory                                             │
│  SET quantity_on_hand = quantity_on_hand - quantityNeeded,   │
│      quantity_available = quantity_available - quantityNeeded,│
│      updated_at = NOW()                                       │
│  WHERE ingredient_id = ingredient.id                         │
│  AND branch_id = branchId                                    │
│                                                               │
│  RETURNING quantity_on_hand AS newStock                      │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Registrar Movimiento en Kardex                      │
│                                                               │
│  movement = {                                                 │
│    tenant_id,                                                 │
│    branch_id: branchId,                                      │
│    ingredient_id: ingredient.id,                             │
│    movement_type: 'sale',                                    │
│    reference_type: 'sr_sale',                                │
│    reference_id: saleId,                                     │
│    quantity: -quantityNeeded,  // Negativo = salida          │
│    unit: ingredient.unit,                                    │
│    previous_stock: currentStock,                             │
│    new_stock: newStock,                                      │
│    unit_cost: ingredient.unit_cost,                          │
│    total_cost: quantityNeeded * ingredient.unit_cost,        │
│    created_at: NOW(),                                         │
│    notes: `Venta SR #${sr_order_number} - ${quantity} ${product.name}`│
│  }                                                            │
│  INSERT INTO inventory_movements                             │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Verificar Punto de Reorden                          │
│                                                               │
│  reorderPoint = SELECT reorder_point FROM inventory          │
│                 WHERE ingredient_id = ingredient.id          │
│                 AND branch_id = branchId                     │
│                                                               │
│  IF newStock <= reorderPoint:                                │
│    // Crear alerta                                           │
│    alert = {                                                  │
│      tenant_id,                                               │
│      branch_id: branchId,                                    │
│      ingredient_id: ingredient.id,                           │
│      alert_type: 'low_stock',                                │
│      severity: newStock <= 0 ? 'critical' : 'warning',       │
│      current_stock: newStock,                                │
│      reorder_point: reorderPoint,                            │
│      suggested_order_quantity: calculateOrderQuantity(),     │
│      created_at: NOW(),                                       │
│    }                                                          │
│    INSERT INTO low_stock_alerts                              │
│                                                               │
│    // Enviar notificación                                    │
│    IF config.alert_on_low_stock:                             │
│      sendNotification({                                       │
│        type: 'low_stock',                                     │
│        ingredient: ingredient.name,                          │
│        current: newStock,                                     │
│        minimum: reorderPoint,                                │
│      })                                                       │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Calcular Costo de Venta                             │
│                                                               │
│  totalRecipeCost = SUM(                                      │
│    ingredient.quantity_per_portion *                         │
│    quantity *                                                 │
│    ingredient.unit_cost                                      │
│  ) FOR ALL ingredients                                        │
│                                                               │
│  // Actualizar venta con costo real                          │
│  UPDATE sr_sales                                              │
│  SET recipe_cost = totalRecipeCost,                          │
│      profit_margin = ((total - totalRecipeCost) / total) * 100│
│  WHERE id = saleId                                            │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Schema de Base de Datos Propuesto

```sql
-- =====================================================
-- TABLA: sr_sales (Ventas recibidas de Soft Restaurant)
-- =====================================================
CREATE TABLE sr_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  integration_id UUID NOT NULL REFERENCES integration_connections(id),

  -- Datos de SR
  external_id VARCHAR(50) NOT NULL,  -- NumeroOrden de SR
  external_source VARCHAR(50) DEFAULT 'softrestaurant',
  sr_warehouse VARCHAR(20),  -- Almacen de SR (antes de mapeo)
  sr_station VARCHAR(100),   -- Estacion de SR
  sr_area VARCHAR(100),      -- Area (Terraza, Comedor, etc)
  sr_user VARCHAR(100),      -- IdUsuario de SR

  -- Info de venta
  sale_date TIMESTAMPTZ NOT NULL,
  total DECIMAL(12,4) NOT NULL,
  subtotal DECIMAL(12,4),
  tax DECIMAL(12,4),
  discount DECIMAL(12,4),
  tip DECIMAL(12,4),

  -- Costos (calculados por deducción)
  recipe_cost DECIMAL(12,4),  -- Costo de ingredientes
  profit_margin DECIMAL(5,2), -- % ganancia

  -- Status
  status VARCHAR(20) DEFAULT 'completed',  -- completed, cancelled
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Metadata
  raw_data JSONB,  -- JSON completo de SR
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(tenant_id, integration_id, external_id)
);

CREATE INDEX idx_sr_sales_tenant ON sr_sales(tenant_id);
CREATE INDEX idx_sr_sales_branch ON sr_sales(branch_id);
CREATE INDEX idx_sr_sales_date ON sr_sales(sale_date);
CREATE INDEX idx_sr_sales_external ON sr_sales(external_id);

-- =====================================================
-- TABLA: sr_sale_items (Detalle de productos vendidos)
-- =====================================================
CREATE TABLE sr_sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sr_sales(id) ON DELETE CASCADE,

  -- Producto
  product_id UUID REFERENCES products(id),  -- NULL si no se encontró
  sr_product_id VARCHAR(50),  -- IdProducto de SR
  product_name VARCHAR(255),  -- Descripcion de SR

  -- Cantidades y precios
  quantity DECIMAL(10,4) NOT NULL,
  unit_price DECIMAL(12,4) NOT NULL,
  subtotal DECIMAL(12,4) NOT NULL,
  discount DECIMAL(12,4) DEFAULT 0,
  tax DECIMAL(12,4) DEFAULT 0,
  total DECIMAL(12,4) NOT NULL,

  -- Costos (de receta)
  recipe_cost DECIMAL(12,4),  -- Costo de ingredientes para esta cantidad

  -- Impuestos (array de impuestos aplicados)
  tax_details JSONB,  -- [{impuesto: "IVA", tasa: 0.16, importe: 6.89}]

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sr_sale_items_sale ON sr_sale_items(sale_id);
CREATE INDEX idx_sr_sale_items_product ON sr_sale_items(product_id);

-- =====================================================
-- TABLA: sr_payments (Formas de pago de ventas)
-- =====================================================
CREATE TABLE sr_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sr_sales(id) ON DELETE CASCADE,

  -- Forma de pago
  payment_method_id UUID REFERENCES payment_methods(id),
  sr_payment_method VARCHAR(100),  -- FormaPago de SR (antes de mapeo)

  -- Montos
  amount DECIMAL(12,4) NOT NULL,
  tip DECIMAL(12,4) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sr_payments_sale ON sr_payments(sale_id);

-- =====================================================
-- TABLA: sr_sync_logs (Bitácora de ventas recibidas)
-- =====================================================
CREATE TABLE sr_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  integration_id UUID NOT NULL REFERENCES integration_connections(id),

  -- Info de orden SR
  sr_order_number VARCHAR(50),
  sr_warehouse VARCHAR(20),
  sr_station VARCHAR(100),

  -- Resultado
  status VARCHAR(20) NOT NULL,  -- success, failed, partial
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,

  -- Datos procesados
  sale_id UUID REFERENCES sr_sales(id),
  products_received INTEGER DEFAULT 0,
  products_processed INTEGER DEFAULT 0,
  products_failed INTEGER DEFAULT 0,
  inventory_updated BOOLEAN DEFAULT false,

  -- Errores
  error_message TEXT,
  error_code VARCHAR(50),
  failed_products JSONB,  -- Array de IDs que fallaron

  -- Raw data
  raw_request JSONB,
  raw_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sr_sync_logs_tenant ON sr_sync_logs(tenant_id);
CREATE INDEX idx_sr_sync_logs_integration ON sr_sync_logs(integration_id);
CREATE INDEX idx_sr_sync_logs_status ON sr_sync_logs(status);
CREATE INDEX idx_sr_sync_logs_received ON sr_sync_logs(received_at);

-- =====================================================
-- TABLA: recipes (Recetas de productos)
-- =====================================================
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id),

  -- Info de receta
  name VARCHAR(255) NOT NULL,
  description TEXT,
  yield_quantity DECIMAL(10,4) DEFAULT 1,  -- Porciones que produce
  yield_unit VARCHAR(50) DEFAULT 'porcion',

  -- Costos calculados
  total_cost DECIMAL(12,4),  -- Suma de costos de ingredientes
  cost_per_portion DECIMAL(12,4),  -- total_cost / yield_quantity

  -- Metadata
  preparation_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, product_id)
);

CREATE INDEX idx_recipes_tenant ON recipes(tenant_id);
CREATE INDEX idx_recipes_product ON recipes(product_id);

-- =====================================================
-- TABLA: recipe_ingredients (Ingredientes de recetas)
-- =====================================================
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES inventory(id),

  -- Cantidad requerida
  quantity_per_portion DECIMAL(10,4) NOT NULL,
  unit VARCHAR(50) NOT NULL,  -- g, kg, ml, L, pz, etc

  -- Costos
  unit_cost DECIMAL(12,4) NOT NULL,  -- Costo por unidad
  total_cost DECIMAL(12,4) NOT NULL,  -- quantity * unit_cost

  -- Opcionales
  is_primary BOOLEAN DEFAULT false,  -- Ingrediente principal
  waste_percentage DECIMAL(5,2) DEFAULT 0,  -- % merma

  -- Metadata
  notes TEXT,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(recipe_id, ingredient_id)
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);

-- =====================================================
-- TABLA: inventory_movements (Kardex de movimientos)
-- =====================================================
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  ingredient_id UUID NOT NULL REFERENCES inventory(id),

  -- Tipo de movimiento
  movement_type VARCHAR(50) NOT NULL,  -- purchase, sale, adjustment, transfer
  reference_type VARCHAR(50),  -- sr_sale, manual, etc
  reference_id UUID,  -- ID de venta, compra, etc

  -- Cantidad
  quantity DECIMAL(12,4) NOT NULL,  -- Positivo = entrada, Negativo = salida
  unit VARCHAR(50) NOT NULL,

  -- Stock
  previous_stock DECIMAL(12,4),
  new_stock DECIMAL(12,4),

  -- Costos
  unit_cost DECIMAL(12,4),
  total_cost DECIMAL(12,4),

  -- Metadata
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_movements_tenant ON inventory_movements(tenant_id);
CREATE INDEX idx_inventory_movements_branch ON inventory_movements(branch_id);
CREATE INDEX idx_inventory_movements_ingredient ON inventory_movements(ingredient_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(created_at);

-- =====================================================
-- TABLA: low_stock_alerts (Alertas de stock bajo)
-- =====================================================
CREATE TABLE low_stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  ingredient_id UUID NOT NULL REFERENCES inventory(id),

  -- Alerta
  alert_type VARCHAR(50) NOT NULL,  -- low_stock, critical_stock, out_of_stock
  severity VARCHAR(20) NOT NULL,  -- info, warning, critical

  -- Stock info
  current_stock DECIMAL(12,4),
  reorder_point DECIMAL(12,4),
  suggested_order_quantity DECIMAL(12,4),

  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- active, acknowledged, resolved
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_low_stock_alerts_tenant ON low_stock_alerts(tenant_id);
CREATE INDEX idx_low_stock_alerts_branch ON low_stock_alerts(branch_id);
CREATE INDEX idx_low_stock_alerts_ingredient ON low_stock_alerts(ingredient_id);
CREATE INDEX idx_low_stock_alerts_status ON low_stock_alerts(status);
```

---

## 🎯 FASE 6: PROPUESTA DETALLADA DE IMPLEMENTACIÓN

### 6.1 Corrección de SoftRestaurantConfigModal.tsx

#### **Cambio #1: Nuevo SRSyncConfig**

```typescript
// integration.types.ts - NUEVA ESTRUCTURA

export interface SRSyncConfig {
  // === RECEPCIÓN DE VENTAS ===
  receive_sales_enabled: boolean;
  webhook_url: string;  // Generado automáticamente
  webhook_secret: string;  // Generado automáticamente

  // === ESCENARIO DE ENVÍO (configurar en SR, no en TIS TIS) ===
  expected_send_mode: 'on_sale' | 'daily_close' | 'interval';
  expected_send_interval_minutes?: number;

  // === MAPEO DE DATOS ===
  warehouse_mapping: Record<string, string>;  // SR warehouse code -> TIS TIS branch_id
  payment_method_mapping: Record<string, string>;  // SR payment name -> TIS TIS payment_method_id

  // === GESTIÓN MANUAL (no son syncs) ===
  enable_manual_menu_management: boolean;  // Siempre true
  enable_recipe_deduction: boolean;  // Auto-deducir ingredientes
  enable_inventory_tracking: boolean;  // Actualizar stock

  // === ALERTAS ===
  enable_low_stock_alerts: boolean;
  low_stock_notification_emails: string[];
  critical_stock_threshold_percentage: number;  // 25% por defecto

  // === IMPORTACIÓN INICIAL ===
  import_sales_history_on_connect: boolean;
  sales_history_days: number;  // 30 por defecto

  // === FEATURES OPCIONALES ===
  auto_create_customers_from_sales: boolean;  // Si SR envía IdCliente
  track_sales_by_area: boolean;  // Analytics por zona
  track_sales_by_station: boolean;  // Analytics por caja
  save_raw_sales_data: boolean;  // Guardar JSON completo de SR

  // === CANCELACIONES ===
  allow_sales_cancellation: boolean;
  cancellation_requires_approval: boolean;
  cancellation_reverses_inventory: boolean;
}
```

#### **Cambio #2: Nueva UI del Modal**

```typescript
// SoftRestaurantConfigModal.tsx - ESTRUCTURA CORREGIDA

const CORRECT_CONFIG_STEPS = [
  {
    num: 1,
    label: 'Conexión',
    description: 'Configurar webhook para recibir ventas'
  },
  {
    num: 2,
    label: 'Mapeo',
    description: 'Almacenes y formas de pago'
  },
  {
    num: 3,
    label: 'Ingredientes',
    description: 'Configurar recetas y deducción automática'
  },
  {
    num: 4,
    label: 'Opciones',
    description: 'Alertas y features adicionales'
  }
];

// STEP 1: Conexión (reemplaza credenciales)
{currentStep === 1 && (
  <div className="space-y-6">
    <div className="p-4 bg-blue-50 rounded-xl">
      <h4 className="font-semibold text-blue-900 mb-2">
        📡 Endpoint para Soft Restaurant
      </h4>
      <p className="text-sm text-blue-700 mb-4">
        Configura esta URL en Soft Restaurant → Configuración → Interface ERP/PMS
      </p>

      {/* URL del webhook generada */}
      <div className="bg-white p-3 rounded-lg border border-blue-200 font-mono text-sm">
        {webhookUrl || 'https://api.tistis.com/v1/integrations/sr/transaction/{tenant-id}'}
      </div>

      <button
        onClick={() => copyToClipboard(webhookUrl)}
        className="mt-2 text-sm text-blue-600 hover:text-blue-700"
      >
        📋 Copiar URL
      </button>
    </div>

    <div className="p-4 bg-yellow-50 rounded-xl">
      <h4 className="font-semibold text-yellow-900 mb-2">
        🔐 API Key de Autenticación
      </h4>
      <p className="text-sm text-yellow-700 mb-4">
        Usa esta key en el campo "Authorization" de Soft Restaurant
      </p>

      <div className="bg-white p-3 rounded-lg border border-yellow-200">
        <input
          type={showApiKey ? 'text' : 'password'}
          value={apiKey}
          readOnly
          className="font-mono text-sm w-full"
        />
      </div>

      <div className="mt-2 flex gap-2">
        <button onClick={() => setShowApiKey(!showApiKey)} className="text-sm text-yellow-600">
          {showApiKey ? '🙈 Ocultar' : '👁️ Mostrar'}
        </button>
        <button onClick={() => copyToClipboard(apiKey)} className="text-sm text-yellow-600">
          📋 Copiar
        </button>
      </div>
    </div>

    <div className="p-4 bg-gray-50 rounded-xl">
      <h4 className="font-semibold text-gray-900 mb-2">
        ⚙️ Escenario de Envío (configurar en SR)
      </h4>
      <p className="text-sm text-gray-600 mb-4">
        En Soft Restaurant, elige cuándo enviar las ventas a TIS TIS:
      </p>

      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="send_mode"
            value="on_sale"
            checked={syncConfig.expected_send_mode === 'on_sale'}
            onChange={() => setSyncConfig({...syncConfig, expected_send_mode: 'on_sale'})}
          />
          <div>
            <div className="font-medium">Al finalizar cada venta (tiempo real)</div>
            <div className="text-gray-500">Inventario actualizado al instante, puede añadir latencia</div>
          </div>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="send_mode"
            value="daily_close"
            checked={syncConfig.expected_send_mode === 'daily_close'}
            onChange={() => setSyncConfig({...syncConfig, expected_send_mode: 'daily_close'})}
          />
          <div>
            <div className="font-medium">Al cierre diario (recomendado)</div>
            <div className="text-gray-500">Sin impacto en operación, inventario se actualiza al final del día</div>
          </div>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="send_mode"
            value="interval"
            checked={syncConfig.expected_send_mode === 'interval'}
            onChange={() => setSyncConfig({...syncConfig, expected_send_mode: 'interval'})}
          />
          <div>
            <div className="font-medium">Cada X minutos</div>
            <div className="text-gray-500">Balance entre tiempo real y performance</div>
          </div>
        </label>

        {syncConfig.expected_send_mode === 'interval' && (
          <div className="ml-6 mt-2">
            <label className="block text-sm font-medium mb-1">Intervalo (minutos)</label>
            <input
              type="number"
              min="5"
              max="60"
              value={syncConfig.expected_send_interval_minutes || 15}
              onChange={(e) => setSyncConfig({
                ...syncConfig,
                expected_send_interval_minutes: parseInt(e.target.value)
              })}
              className="w-32 px-3 py-2 border rounded-lg"
            />
          </div>
        )}
      </div>
    </div>

    <div className="p-4 bg-green-50 rounded-xl">
      <h4 className="font-semibold text-green-900 mb-2">
        ✅ Pasos en Soft Restaurant
      </h4>
      <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside">
        <li>Configuración → Interfaz con ERP y PMS → Configuración ERP y PMS</li>
        <li>URL de conexión: Pega la URL de arriba</li>
        <li>Método: POST</li>
        <li>Resource: pms/v1/softrestaurant/transaction</li>
        <li>Content-Type: application/json</li>
        <li>Authorization (en parámetros): Pega la API Key</li>
        <li>Guarda y prueba la conexión</li>
      </ol>
    </div>
  </div>
)}

// STEP 2: Mapeo de Almacenes y Formas de Pago
{currentStep === 2 && (
  <div className="space-y-6">
    <h3 className="font-semibold text-gray-900">Mapeo de Almacenes</h3>
    <p className="text-sm text-gray-600">
      Asocia cada almacén de Soft Restaurant con una sucursal de TIS TIS
    </p>

    <WarehouseMappingTable
      mapping={syncConfig.warehouse_mapping}
      branches={branches}
      onAdd={(srWarehouse, branchId) => {
        setSyncConfig({
          ...syncConfig,
          warehouse_mapping: {
            ...syncConfig.warehouse_mapping,
            [srWarehouse]: branchId
          }
        });
      }}
      onRemove={(srWarehouse) => {
        const newMapping = {...syncConfig.warehouse_mapping};
        delete newMapping[srWarehouse];
        setSyncConfig({...syncConfig, warehouse_mapping: newMapping});
      }}
    />

    <h3 className="font-semibold text-gray-900 mt-8">Mapeo de Formas de Pago</h3>
    <p className="text-sm text-gray-600">
      Asocia cada forma de pago de Soft Restaurant con un método de pago de TIS TIS
    </p>

    <PaymentMappingTable
      mapping={syncConfig.payment_method_mapping}
      paymentMethods={paymentMethods}
      onAdd={(srPayment, methodId) => {
        setSyncConfig({
          ...syncConfig,
          payment_method_mapping: {
            ...syncConfig.payment_method_mapping,
            [srPayment]: methodId
          }
        });
      }}
      onRemove={(srPayment) => {
        const newMapping = {...syncConfig.payment_method_mapping};
        delete newMapping[srPayment];
        setSyncConfig({...syncConfig, payment_method_mapping: newMapping});
      }}
    />
  </div>
)}

// STEP 3: Recetas y Deducción Automática
{currentStep === 3 && (
  <div className="space-y-6">
    <div className="p-4 bg-purple-50 rounded-xl">
      <h4 className="font-semibold text-purple-900 mb-2">
        🧮 Explosión de Insumos (Recetas)
      </h4>
      <p className="text-sm text-purple-700 mb-4">
        Configura qué ingredientes se consumen al vender cada producto.
        Esto permite actualizar automáticamente el inventario y calcular costos reales.
      </p>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={syncConfig.enable_recipe_deduction}
          onChange={() => setSyncConfig({
            ...syncConfig,
            enable_recipe_deduction: !syncConfig.enable_recipe_deduction
          })}
          className="mt-1"
        />
        <div>
          <div className="font-medium text-purple-900">
            Habilitar deducción automática de ingredientes
          </div>
          <div className="text-sm text-purple-600">
            Al recibir una venta de SR, TIS TIS calculará qué ingredientes se consumieron
            y los restará del inventario automáticamente
          </div>
        </div>
      </label>
    </div>

    {syncConfig.enable_recipe_deduction && (
      <>
        <div className="p-4 bg-yellow-50 rounded-xl">
          <h4 className="font-semibold text-yellow-900 mb-2">
            ⚠️ Configuración Requerida
          </h4>
          <p className="text-sm text-yellow-700">
            Para usar la deducción automática, debes:
          </p>
          <ol className="text-sm text-yellow-700 list-decimal list-inside mt-2 space-y-1">
            <li>Crear tus productos (menú) en TIS TIS</li>
            <li>Para cada producto, configurar su receta (ingredientes + cantidades)</li>
            <li>Mantener actualizado el costo de cada ingrediente</li>
          </ol>

          <button
            onClick={() => {/* Navigate to recipe manager */}}
            className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700"
          >
            Ir a Gestión de Recetas →
          </button>
        </div>

        <div className="space-y-3">
          <h5 className="font-medium text-gray-900">Opciones de Inventario</h5>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={syncConfig.enable_inventory_tracking}
              onChange={() => setSyncConfig({
                ...syncConfig,
                enable_inventory_tracking: !syncConfig.enable_inventory_tracking
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Actualizar inventario automáticamente</div>
              <div className="text-sm text-gray-600">
                Restar ingredientes del stock al procesar ventas
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={syncConfig.enable_low_stock_alerts}
              onChange={() => setSyncConfig({
                ...syncConfig,
                enable_low_stock_alerts: !syncConfig.enable_low_stock_alerts
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Alertas de stock bajo</div>
              <div className="text-sm text-gray-600">
                Notificar cuando un ingrediente llegue al punto de reorden
              </div>
            </div>
          </label>

          {syncConfig.enable_low_stock_alerts && (
            <div className="ml-6 space-y-2">
              <label className="block">
                <span className="text-sm font-medium">Emails para alertas (separados por coma)</span>
                <input
                  type="text"
                  value={syncConfig.low_stock_notification_emails?.join(', ') || ''}
                  onChange={(e) => setSyncConfig({
                    ...syncConfig,
                    low_stock_notification_emails: e.target.value.split(',').map(s => s.trim())
                  })}
                  placeholder="admin@restaurant.com, compras@restaurant.com"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Umbral crítico (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={syncConfig.critical_stock_threshold_percentage || 25}
                  onChange={(e) => setSyncConfig({
                    ...syncConfig,
                    critical_stock_threshold_percentage: parseInt(e.target.value)
                  })}
                  className="mt-1 w-32 px-3 py-2 border rounded-lg text-sm"
                />
                <span className="text-xs text-gray-500 ml-2">
                  Alerta crítica cuando stock {'<'} {syncConfig.critical_stock_threshold_percentage || 25}% del mínimo
                </span>
              </label>
            </div>
          )}
        </div>
      </>
    )}

    {!syncConfig.enable_recipe_deduction && (
      <div className="p-4 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-600">
          Sin deducción automática, TIS TIS solo registrará las ventas recibidas
          de Soft Restaurant, pero NO actualizará el inventario. Deberás gestionar
          el inventario manualmente.
        </p>
      </div>
    )}
  </div>
)}

// STEP 4: Opciones Adicionales
{currentStep === 4 && (
  <div className="space-y-6">
    {/* Importación inicial */}
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">Importación Inicial de Ventas</h4>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={syncConfig.import_sales_history_on_connect}
          onChange={() => setSyncConfig({
            ...syncConfig,
            import_sales_history_on_connect: !syncConfig.import_sales_history_on_connect
          })}
          className="mt-1"
        />
        <div>
          <div className="font-medium">Importar historial al conectar</div>
          <div className="text-sm text-gray-600">
            Solicitar a SR el historial de ventas de los últimos días para análisis
          </div>
        </div>
      </label>

      {syncConfig.import_sales_history_on_connect && (
        <div className="ml-6">
          <label className="block text-sm">
            <span className="font-medium">Días de historial</span>
            <select
              value={syncConfig.sales_history_days}
              onChange={(e) => setSyncConfig({
                ...syncConfig,
                sales_history_days: parseInt(e.target.value)
              })}
              className="mt-1 px-3 py-2 border rounded-lg"
            >
              <option value={7}>7 días</option>
              <option value={15}>15 días</option>
              <option value={30}>30 días (recomendado)</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
            </select>
          </label>
        </div>
      )}
    </div>

    {/* Analytics */}
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">Analytics y Reportes</h4>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={syncConfig.track_sales_by_area}
          onChange={() => setSyncConfig({
            ...syncConfig,
            track_sales_by_area: !syncConfig.track_sales_by_area
          })}
          className="mt-1"
        />
        <div>
          <div className="font-medium">Analizar ventas por zona</div>
          <div className="text-sm text-gray-600">
            Separar ventas por área (Terraza, Comedor, Barra, etc.)
          </div>
        </div>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={syncConfig.track_sales_by_station}
          onChange={() => setSyncConfig({
            ...syncConfig,
            track_sales_by_station: !syncConfig.track_sales_by_station
          })}
          className="mt-1"
        />
        <div>
          <div className="font-medium">Analizar ventas por caja/estación</div>
          <div className="text-sm text-gray-600">
            Identificar qué cajas generan más ventas
          </div>
        </div>
      </label>
    </div>

    {/* Cancelaciones */}
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">Cancelaciones de Ventas</h4>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={syncConfig.allow_sales_cancellation}
          onChange={() => setSyncConfig({
            ...syncConfig,
            allow_sales_cancellation: !syncConfig.allow_sales_cancellation
          })}
          className="mt-1"
        />
        <div>
          <div className="font-medium">Permitir cancelación de ventas desde SR</div>
          <div className="text-sm text-gray-600">
            Habilitar endpoint para que SR pueda cancelar ventas ya enviadas
          </div>
        </div>
      </label>

      {syncConfig.allow_sales_cancellation && (
        <div className="ml-6 space-y-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={syncConfig.cancellation_requires_approval}
              onChange={() => setSyncConfig({
                ...syncConfig,
                cancellation_requires_approval: !syncConfig.cancellation_requires_approval
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-sm">Requiere aprobación manual</div>
              <div className="text-xs text-gray-600">
                Cancelaciones quedan pendientes hasta que un admin las apruebe
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={syncConfig.cancellation_reverses_inventory}
              onChange={() => setSyncConfig({
                ...syncConfig,
                cancellation_reverses_inventory: !syncConfig.cancellation_reverses_inventory
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-sm">Revertir movimientos de inventario</div>
              <div className="text-xs text-gray-600">
                Al cancelar, devolver los ingredientes al stock
              </div>
            </div>
          </label>
        </div>
      )}
    </div>

    {/* Debugging */}
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">Debugging y Auditoría</h4>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={syncConfig.save_raw_sales_data}
          onChange={() => setSyncConfig({
            ...syncConfig,
            save_raw_sales_data: !syncConfig.save_raw_sales_data
          })}
          className="mt-1"
        />
        <div>
          <div className="font-medium">Guardar JSON completo de cada venta</div>
          <div className="text-sm text-gray-600">
            Útil para debugging, pero consume más espacio en BD
          </div>
        </div>
      </label>
    </div>

    {/* Resumen */}
    <div className="p-4 bg-green-50 rounded-xl mt-6">
      <h4 className="font-semibold text-green-900 flex items-center gap-2 mb-3">
        <CheckIcon className="w-5 h-5" />
        Resumen de la Configuración
      </h4>
      <div className="space-y-1.5 text-sm text-green-700">
        <p><strong>Endpoint:</strong> {webhookUrl}</p>
        <p><strong>Modo de envío esperado:</strong> {
          syncConfig.expected_send_mode === 'on_sale' ? 'Tiempo real' :
          syncConfig.expected_send_mode === 'daily_close' ? 'Cierre diario' :
          `Cada ${syncConfig.expected_send_interval_minutes} minutos`
        }</p>
        <p><strong>Almacenes mapeados:</strong> {Object.keys(syncConfig.warehouse_mapping).length}</p>
        <p><strong>Formas de pago mapeadas:</strong> {Object.keys(syncConfig.payment_method_mapping).length}</p>
        <p><strong>Deducción automática:</strong> {syncConfig.enable_recipe_deduction ? '✅ Habilitada' : '❌ Deshabilitada'}</p>
        <p><strong>Actualización de inventario:</strong> {syncConfig.enable_inventory_tracking ? '✅ Sí' : '❌ No'}</p>
        <p><strong>Alertas de stock:</strong> {syncConfig.enable_low_stock_alerts ? '✅ Sí' : '❌ No'}</p>
      </div>
    </div>
  </div>
)}
```

### 6.2 Implementación de Endpoints

#### **Archivo: app/api/integrations/softrestaurant/transaction/route.ts**

```typescript
// =====================================================
// SOFT RESTAURANT - Transaction Webhook Endpoint
// Receives sales from Soft Restaurant POS
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Tipos
interface SRSale {
  Estacion: string;
  Almacen: string;
  FechaVenta: string;
  NumeroOrden: string;
  IdCliente?: string;
  IdUsuario: string;
  Total: number;
  Area: string;
  Conceptos: SRConcepto[];
  Pagos: SRPago[];
}

interface SRConcepto {
  IdProducto: string;
  Descripcion: string;
  Movimiento: number;
  Cantidad: number;
  PrecioUnitario: number;
  ImporteSinImpuestos: number;
  Descuento: number;
  Impuestos: Array<{
    Impuesto: string;
    Tasa: number;
    Importe: number;
  }>;
}

interface SRPago {
  FormaPago: string;
  Importe: number;
  Propina: number;
}

interface SRRequest {
  IdEmpresa: string;
  Ventas: SRSale[];
}

// =====================================================
// POST Handler
// =====================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let logId: string | null = null;

  try {
    // 1. Parse request body
    const body: SRRequest = await request.json();

    // 2. Validate Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        {
          Message: 'Missing Authorization header',
          Transaction_id: ''
        },
        { status: 401 }
      );
    }

    // Extract API key (puede venir como "Bearer XXX" o solo "XXX")
    const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim();

    // 3. Find integration by API key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: integration, error: integrationError } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('api_key', apiKey)
      .eq('integration_type', 'softrestaurant')
      .eq('status', 'connected')
      .single();

    if (integrationError || !integration) {
      console.error('[SR Webhook] Invalid API key:', apiKey.slice(0, 8) + '...');
      return NextResponse.json(
        {
          Message: 'Invalid or expired API key',
          Transaction_id: ''
        },
        { status: 401 }
      );
    }

    const tenantId = integration.tenant_id;
    const integrationId = integration.id;
    const syncConfig = (integration.metadata as { sync_config?: any })?.sync_config || {};

    // 4. Validate IdEmpresa matches expected
    // (Podríamos guardar IdEmpresa esperado en metadata)
    if (!body.IdEmpresa) {
      return NextResponse.json(
        {
          Message: 'Missing IdEmpresa in request',
          Transaction_id: ''
        },
        { status: 400 }
      );
    }

    // 5. Validate schema
    if (!Array.isArray(body.Ventas) || body.Ventas.length === 0) {
      return NextResponse.json(
        {
          Message: 'Ventas array is required and must not be empty',
          Transaction_id: ''
        },
        { status: 400 }
      );
    }

    // 6. Process each sale
    const processedSales: string[] = [];
    const errors: string[] = [];

    for (const venta of body.Ventas) {
      try {
        // Validar campos requeridos
        if (!venta.NumeroOrden || !venta.Almacen || !venta.FechaVenta) {
          errors.push(`Sale missing required fields: NumeroOrden, Almacen, or FechaVenta`);
          continue;
        }

        // Verificar duplicado
        const { data: existing } = await supabase
          .from('sr_sales')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('integration_id', integrationId)
          .eq('external_id', venta.NumeroOrden)
          .single();

        if (existing) {
          console.log('[SR Webhook] Duplicate sale, skipping:', venta.NumeroOrden);
          continue;
        }

        // Mapear almacén → branch
        const warehouseMapping = syncConfig.warehouse_mapping || {};
        let branchId = warehouseMapping[venta.Almacen];

        if (!branchId && syncConfig.default_branch_id) {
          branchId = syncConfig.default_branch_id;
        }

        if (!branchId) {
          errors.push(`No branch mapping for warehouse ${venta.Almacen}`);
          continue;
        }

        // Crear venta
        const { data: sale, error: saleError } = await supabase
          .from('sr_sales')
          .insert({
            tenant_id: tenantId,
            branch_id: branchId,
            integration_id: integrationId,
            external_id: venta.NumeroOrden,
            external_source: 'softrestaurant',
            sr_warehouse: venta.Almacen,
            sr_station: venta.Estacion,
            sr_area: venta.Area,
            sr_user: venta.IdUsuario,
            sale_date: venta.FechaVenta,
            total: venta.Total,
            subtotal: venta.Conceptos.reduce((sum, c) => sum + c.ImporteSinImpuestos, 0),
            tax: venta.Conceptos.reduce((sum, c) =>
              sum + c.Impuestos.reduce((tsum, imp) => tsum + imp.Importe, 0), 0
            ),
            discount: venta.Conceptos.reduce((sum, c) => sum + (c.Descuento || 0), 0),
            tip: venta.Pagos.reduce((sum, p) => sum + (p.Propina || 0), 0),
            status: 'completed',
            raw_data: syncConfig.save_raw_sales_data ? venta : null,
            processed_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (saleError) {
          errors.push(`Failed to create sale ${venta.NumeroOrden}: ${saleError.message}`);
          continue;
        }

        const saleId = sale.id;

        // Procesar productos
        let productsProcessed = 0;
        let productsFailed = 0;

        for (const concepto of venta.Conceptos) {
          try {
            // Buscar producto
            const { data: product } = await supabase
              .from('products')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('external_id', concepto.IdProducto)
              .single();

            // Crear item de venta
            const { error: itemError } = await supabase
              .from('sr_sale_items')
              .insert({
                sale_id: saleId,
                product_id: product?.id || null,
                sr_product_id: concepto.IdProducto,
                product_name: concepto.Descripcion,
                quantity: concepto.Cantidad,
                unit_price: concepto.PrecioUnitario,
                subtotal: concepto.ImporteSinImpuestos,
                discount: concepto.Descuento || 0,
                tax: concepto.Impuestos.reduce((sum, imp) => sum + imp.Importe, 0),
                total: concepto.ImporteSinImpuestos +
                       concepto.Impuestos.reduce((sum, imp) => sum + imp.Importe, 0) -
                       (concepto.Descuento || 0),
                tax_details: concepto.Impuestos,
              });

            if (itemError) {
              productsFailed++;
              continue;
            }

            // Deducir ingredientes (si habilitado y producto encontrado)
            if (syncConfig.enable_recipe_deduction && product?.id) {
              await deductRecipeIngredients({
                supabase,
                tenantId,
                branchId,
                productId: product.id,
                quantity: concepto.Cantidad,
                saleId,
                enableInventoryTracking: syncConfig.enable_inventory_tracking,
                enableAlerts: syncConfig.enable_low_stock_alerts,
              });
            }

            productsProcessed++;
          } catch (productError) {
            console.error('[SR Webhook] Error processing product:', productError);
            productsFailed++;
          }
        }

        // Procesar pagos
        const paymentMapping = syncConfig.payment_method_mapping || {};

        for (const pago of venta.Pagos) {
          const paymentMethodId = paymentMapping[pago.FormaPago];

          await supabase
            .from('sr_payments')
            .insert({
              sale_id: saleId,
              payment_method_id: paymentMethodId || null,
              sr_payment_method: pago.FormaPago,
              amount: pago.Importe,
              tip: pago.Propina || 0,
            });
        }

        // Guardar en bitácora
        const { data: log } = await supabase
          .from('sr_sync_logs')
          .insert({
            tenant_id: tenantId,
            integration_id: integrationId,
            sr_order_number: venta.NumeroOrden,
            sr_warehouse: venta.Almacen,
            sr_station: venta.Estacion,
            status: productsFailed > 0 ? 'partial' : 'success',
            received_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            sale_id: saleId,
            products_received: venta.Conceptos.length,
            products_processed: productsProcessed,
            products_failed: productsFailed,
            inventory_updated: syncConfig.enable_recipe_deduction && syncConfig.enable_inventory_tracking,
            raw_request: syncConfig.save_raw_sales_data ? body : null,
          })
          .select('id')
          .single();

        if (log) {
          logId = log.id;
        }

        processedSales.push(saleId);

      } catch (ventaError) {
        console.error('[SR Webhook] Error processing sale:', ventaError);
        errors.push(`Failed to process sale ${venta.NumeroOrden}: ${(ventaError as Error).message}`);
      }
    }

    // 7. Generar respuesta
    const duration = Date.now() - startTime;

    if (processedSales.length === 0) {
      // Todos fallaron
      return NextResponse.json(
        {
          Message: `All sales failed to process: ${errors.join('; ')}`,
          Transaction_id: ''
        },
        { status: 400 }
      );
    }

    if (errors.length > 0) {
      // Algunos fallaron
      return NextResponse.json(
        {
          Message: `Partial success: ${processedSales.length} processed, ${errors.length} failed. Errors: ${errors.join('; ')}`,
          Transaction_id: processedSales.join(',')
        },
        { status: 207 }  // Multi-Status
      );
    }

    // Todos exitosos
    console.log(`[SR Webhook] Success: ${processedSales.length} sales processed in ${duration}ms`);

    return NextResponse.json(
      {
        Message: 'Registro insertado correctamente',
        Transaction_id: processedSales.join(',')
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[SR Webhook] Unexpected error:', error);

    return NextResponse.json(
      {
        Message: `Internal server error: ${(error as Error).message}`,
        Transaction_id: ''
      },
      { status: 500 }
    );
  }
}

// =====================================================
// Helper: Deduct Recipe Ingredients
// =====================================================
async function deductRecipeIngredients({
  supabase,
  tenantId,
  branchId,
  productId,
  quantity,
  saleId,
  enableInventoryTracking,
  enableAlerts,
}: {
  supabase: any;
  tenantId: string;
  branchId: string;
  productId: string;
  quantity: number;
  saleId: string;
  enableInventoryTracking: boolean;
  enableAlerts: boolean;
}) {
  // 1. Get recipe
  const { data: recipe } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .eq('tenant_id', tenantId)
    .eq('product_id', productId)
    .eq('is_active', true)
    .single();

  if (!recipe) {
    console.log(`[Recipe Deduction] No recipe found for product ${productId}`);
    return;
  }

  let totalRecipeCost = 0;

  // 2. Process each ingredient
  for (const ingredient of recipe.recipe_ingredients) {
    const quantityNeeded = ingredient.quantity_per_portion * quantity;
    const quantityWithWaste = quantityNeeded * (1 + (ingredient.waste_percentage || 0) / 100);

    if (enableInventoryTracking) {
      // 3. Get current stock
      const { data: inventory } = await supabase
        .from('inventory')
        .select('quantity_on_hand, quantity_available, reorder_point')
        .eq('id', ingredient.ingredient_id)
        .eq('branch_id', branchId)
        .single();

      if (!inventory) continue;

      const previousStock = inventory.quantity_on_hand;
      const newStock = previousStock - quantityWithWaste;

      // 4. Update inventory
      await supabase
        .from('inventory')
        .update({
          quantity_on_hand: newStock,
          quantity_available: inventory.quantity_available - quantityWithWaste,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ingredient.ingredient_id)
        .eq('branch_id', branchId);

      // 5. Record movement
      await supabase
        .from('inventory_movements')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          ingredient_id: ingredient.ingredient_id,
          movement_type: 'sale',
          reference_type: 'sr_sale',
          reference_id: saleId,
          quantity: -quantityWithWaste,
          unit: ingredient.unit,
          previous_stock: previousStock,
          new_stock: newStock,
          unit_cost: ingredient.unit_cost,
          total_cost: quantityWithWaste * ingredient.unit_cost,
        });

      // 6. Check reorder point
      if (enableAlerts && newStock <= inventory.reorder_point) {
        const severity = newStock <= 0 ? 'critical' :
                        newStock <= inventory.reorder_point * 0.25 ? 'critical' : 'warning';

        // Check if alert already exists
        const { data: existingAlert } = await supabase
          .from('low_stock_alerts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('branch_id', branchId)
          .eq('ingredient_id', ingredient.ingredient_id)
          .eq('status', 'active')
          .single();

        if (!existingAlert) {
          await supabase
            .from('low_stock_alerts')
            .insert({
              tenant_id: tenantId,
              branch_id: branchId,
              ingredient_id: ingredient.ingredient_id,
              alert_type: newStock <= 0 ? 'out_of_stock' : 'low_stock',
              severity,
              current_stock: newStock,
              reorder_point: inventory.reorder_point,
              status: 'active',
            });
        }
      }
    }

    // Calculate cost
    totalRecipeCost += quantityWithWaste * ingredient.unit_cost;
  }

  // 7. Update sale with recipe cost
  if (totalRecipeCost > 0) {
    const { data: sale } = await supabase
      .from('sr_sales')
      .select('total')
      .eq('id', saleId)
      .single();

    if (sale) {
      const profitMargin = ((sale.total - totalRecipeCost) / sale.total) * 100;

      await supabase
        .from('sr_sales')
        .update({
          recipe_cost: totalRecipeCost,
          profit_margin: profitMargin,
        })
        .eq('id', saleId);
    }
  }
}
```

---

## 📝 CONCLUSIÓN Y PRÓXIMOS PASOS

### Resumen de Hallazgos

1. ✅ Documento oficial analizado completamente
2. ❌ Implementación actual es INCOMPATIBLE con SR real
3. 🎯 Solución diseñada y documentada en detalle

### Próximos Pasos Recomendados

**FASE 1: Corrección Inmediata (PRIORITY 1)**
1. Crear endpoint POST /transaction
2. Corregir SRSyncConfig
3. Actualizar UI del modal
4. Crear mapeos de almacén y pago

**FASE 2: Core Features (PRIORITY 2)**
5. Implementar RecipeDeductionService
6. Crear UI de gestión de recetas
7. Crear endpoint GET /cancel
8. Implementar bitácora de ventas

**FASE 3: Testing & Deployment**
9. Tests unitarios de todos los componentes
10. Tests de integración con datos de SR reales
11. Documentación para usuarios
12. Deploy a producción

### Tiempo Estimado

- **FASE 1**: 3-4 días de desarrollo
- **FASE 2**: 5-7 días de desarrollo
- **FASE 3**: 2-3 días de testing + docs
- **TOTAL**: 10-14 días de trabajo

---

**FIN DEL ANÁLISIS CRÍTICO EXHAUSTIVO**

Este documento debe servir como guía completa para reimplementar correctamente la integración de Soft Restaurant con TIS TIS, basándose en la documentación oficial y no en suposiciones incorrectas.
