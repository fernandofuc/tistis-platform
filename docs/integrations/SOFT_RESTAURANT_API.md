# SoftRestaurant Integration API Documentation

**Version:** 1.0.0
**Date:** 2026-01-22
**Integration Type:** One-way (SR → TIS TIS)
**Status:** Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Webhook Payload Structure](#webhook-payload-structure)
6. [Processing Flow](#processing-flow)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Monitoring](#monitoring)

---

## Overview

The SoftRestaurant integration allows TIS TIS Platform to receive real-time sale data from SoftRestaurant POS systems. Sales are automatically processed to:

- Map products to TIS TIS menu items
- Deduce inventory using recipe explosion ("explosión de insumos")
- Create restaurant orders for reporting and KDS

### Key Features

- ✅ Real-time webhook receiver
- ✅ Two-phase processing (registration → processing)
- ✅ Automatic product mapping with fuzzy matching
- ✅ Recipe-based inventory deduction
- ✅ Multi-tenant and branch isolation
- ✅ Duplicate detection
- ✅ Comprehensive error handling and logging

---

## Architecture

### Two-Phase Processing

**PHASE 1: Registration**
- Receive webhook POST from SoftRestaurant
- Validate payload structure
- Store raw data in `sr_sales` table
- Status: `pending`
- No data loss on processing errors

**PHASE 2: Processing** (Asynchronous)
- Map SR products to TIS TIS menu items
- Explode recipes to get ingredient requirements
- Deduct inventory automatically
- Create restaurant order
- Status: `processed` or `failed`

### Database Tables

```
sr_sales              Main sale record
sr_sale_items         Individual items sold
sr_payments           Payment breakdown
sr_product_mappings   SR product ↔ TIS TIS menu item mapping
sr_sync_logs          Integration logs
inventory_movements   Inventory deductions (existing table)
restaurant_orders     Orders created from SR sales (existing table)
```

---

## Authentication

### API Key Authentication

SoftRestaurant webhooks use API key authentication. The API key is configured in the Integration Hub and must be sent with every webhook request.

**Methods:**

1. **Authorization Header (Recommended)**
   ```
   Authorization: Bearer YOUR_API_KEY_HERE
   ```

2. **X-API-Key Header (Alternative)**
   ```
   x-api-key: YOUR_API_KEY_HERE
   ```

### Getting Your API Key

1. Login to TIS TIS Platform
2. Navigate to **Settings** → **Integrations**
3. Create or select SoftRestaurant integration
4. Copy the API Key
5. Configure in SoftRestaurant webhook settings

**Security:**
- API keys are tenant-specific and branch-specific
- Each branch requires a separate integration connection
- Keys are validated against `integration_connections` table
- Integration must be in `connected` status

---

## API Endpoints

### 1. POST /api/soft-restaurant/webhook

**Purpose:** Receive sale data from SoftRestaurant POS

**Authentication:** API Key (required)

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY_HERE
```

**Request Body:** See [Webhook Payload Structure](#webhook-payload-structure)

**Response (201 Created):**
```json
{
  "success": true,
  "saleId": "uuid-of-created-sale",
  "phase": "registration",
  "details": {
    "itemsRegistered": 3,
    "paymentsRegistered": 1,
    "itemsMapped": 0,
    "inventoryDeducted": false
  }
}
```

**Response (200 OK - Duplicate):**
```json
{
  "success": true,
  "saleId": "uuid-of-existing-sale",
  "phase": "registration",
  "message": "Duplicate sale detected. Sale already registered.",
  "isDuplicate": true,
  "details": {
    "itemsRegistered": 3,
    "paymentsRegistered": 1,
    "itemsMapped": 0,
    "inventoryDeducted": false
  }
}
```

**Response (400 Bad Request - Validation Error):**
```json
{
  "error": "Validation failed",
  "validationErrors": [
    "FolioVenta (ticket number) is required and must be a string",
    "Productos (items) must be a non-empty array"
  ],
  "warnings": [
    "No server/waiter information provided (CodigoMesero/NombreMesero)"
  ]
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid API key or integration not found"
}
```

---

### 2. GET /api/soft-restaurant/process

**Purpose:** Process all pending SR sales for tenant/branch

**Authentication:** User JWT (Admin/Owner only)

**Headers:**
```
Authorization: Bearer USER_JWT_TOKEN
```

**Query Parameters:**
- `branch_id` (optional): Filter by specific branch
- `limit` (optional, default: 10, max: 50): Number of sales to process

**Response (200 OK):**
```json
{
  "message": "Processed 5 sales",
  "processed": 5,
  "successful": 4,
  "failed": 1,
  "results": [
    {
      "saleId": "uuid-1",
      "success": true,
      "restaurantOrderId": "uuid-order-1",
      "error": null
    },
    {
      "saleId": "uuid-2",
      "success": false,
      "restaurantOrderId": null,
      "error": "No active recipe found for Pizza Margarita"
    }
  ]
}
```

**Response (200 OK - No pending sales):**
```json
{
  "message": "No pending sales to process",
  "processed": 0,
  "successful": 0,
  "failed": 0,
  "results": []
}
```

---

### 3. POST /api/soft-restaurant/process

**Purpose:** Process a specific SR sale by ID

**Authentication:** User JWT (Admin/Owner only)

**Headers:**
```
Content-Type: application/json
Authorization: Bearer USER_JWT_TOKEN
```

**Request Body:**
```json
{
  "sale_id": "uuid-of-sale-to-process"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "saleId": "uuid-of-sale",
  "restaurantOrderId": "uuid-of-created-order",
  "inventoryDeducted": true,
  "details": {
    "itemsMapped": 3,
    "itemsUnmapped": 0,
    "inventoryMovements": 12
  }
}
```

**Response (500 Internal Server Error):**
```json
{
  "error": "Processing failed",
  "message": "No active recipe found for Hamburguesa Clásica",
  "details": {
    "itemsMapped": 2,
    "itemsUnmapped": 1,
    "inventoryMovements": 0
  }
}
```

---

## Webhook Payload Structure

### Complete Example

```json
{
  "FolioVenta": "TICKET-001234",
  "CodigoTienda": "POLANCO",
  "CodigoCliente": "CLI-001",
  "NombreCliente": "Juan Pérez",
  "CodigoMesero": "MESERO-05",
  "NombreMesero": "María González",
  "NumeroMesa": "12",
  "FechaApertura": "2026-01-22T14:30:00.000Z",
  "FechaCierre": "2026-01-22T15:45:00.000Z",
  "Productos": [
    {
      "Codigo": "PROD-001",
      "Descripcion": "Hamburguesa Clásica",
      "Cantidad": 2,
      "Precio": 150.0,
      "Importe": 300.0,
      "Descuento": 0,
      "Impuestos": [
        {
          "CodigoImpuesto": "IVA",
          "NombreImpuesto": "IVA 16%",
          "Tasa": 16.0,
          "Importe": 48.0
        }
      ],
      "Modificadores": ["Sin cebolla", "Extra queso"],
      "Notas": "Término medio",
      "Timestamp": "2026-01-22T14:35:00.000Z",
      "CodigoMesero": "MESERO-05"
    }
  ],
  "SubtotalSinImpuestos": 445.0,
  "TotalImpuestos": 71.2,
  "TotalDescuentos": 0,
  "TotalPropinas": 50.0,
  "Total": 566.2,
  "Moneda": "MXN",
  "Pagos": [
    {
      "FormaPago": "Tarjeta",
      "Monto": 566.2,
      "Moneda": "MXN",
      "Referencia": "AUTH-123456",
      "NumeroTarjeta": "4242",
      "Propina": 50.0,
      "Timestamp": "2026-01-22T15:45:00.000Z"
    }
  ],
  "TipoVenta": "Mesa",
  "NumeroComensales": 4,
  "Observaciones": "Cliente frecuente - VIP",
  "Metadata": {
    "pos_version": "SR v10.2",
    "cashier_id": "CAJERO-03"
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `FolioVenta` | string | Unique ticket/sale number |
| `FechaApertura` | string (ISO 8601) | Sale opened timestamp |
| `Productos` | array | Array of sale items (min 1) |
| `Productos[].Codigo` | string | Product code in SR |
| `Productos[].Descripcion` | string | Product name |
| `Productos[].Cantidad` | number | Quantity sold (> 0) |
| `Productos[].Precio` | number | Unit price |
| `Productos[].Importe` | number | Subtotal without tax |
| `SubtotalSinImpuestos` | number | Total subtotal before tax |
| `TotalImpuestos` | number | Total tax amount |
| `Total` | number | Grand total |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `CodigoTienda` | string | Store/branch code |
| `CodigoCliente` | string | Customer code |
| `NombreCliente` | string | Customer name |
| `CodigoMesero` | string | Waiter/server code |
| `NombreMesero` | string | Waiter/server name |
| `NumeroMesa` | string | Table number |
| `FechaCierre` | string (ISO 8601) | Sale closed timestamp |
| `TotalDescuentos` | number | Total discounts |
| `TotalPropinas` | number | Total tips |
| `Moneda` | string | Currency (default: MXN) |
| `Pagos` | array | Payment breakdown |
| `TipoVenta` | string | Sale type (Mesa, Para Llevar, Domicilio) |
| `NumeroComensales` | number | Guest count |
| `Observaciones` | string | General notes |
| `Metadata` | object | Custom fields |

---

## Processing Flow

### 1. Webhook Reception

```
POST /api/soft-restaurant/webhook
  ↓
Authenticate API Key
  ↓
Validate Payload
  ↓
Check Duplicate (5-min window)
  ↓
Register Sale (PHASE 1)
  ├── Insert sr_sales
  ├── Insert sr_sale_items
  └── Insert sr_payments
  ↓
Create Sync Log
  ↓
Return 201 Created
```

### 2. Automatic Background Processing (v4.8.5+)

When sales are received via `/api/agent/sync`, they are automatically processed in the background:

```
POST /api/agent/sync (receives sales from TIS TIS Local Agent)
  ↓
Insert into sr_sales (status: pending)
  ↓
Return 200 OK to agent (non-blocking)
  ↓
processCreatedSalesInBackground() fires asynchronously
  ↓
For Each Sale:
  ├── SoftRestaurantProcessor.processSale()
  │     ├── ProductMappingService.mapSaleItems()
  │     │     ├── Fuzzy match SR products to menu items
  │     │     └── Create/update sr_product_mappings
  │     ├── RecipeDeductionService.deduceForSale()
  │     │     ├── Get recipe ingredients for each mapped item
  │     │     ├── Calculate deductions (quantity * portions_sold)
  │     │     ├── Update inventory_items.current_stock
  │     │     └── Create inventory_movements records
  │     ├── LowStockAlertService.checkAfterDeduction()
  │     │     └── Generate alerts for items below minimum_stock
  │     └── RestaurantOrderService.createOrderFromSale()
  │           ├── Map SR sale fields to restaurant_orders schema
  │           │     ├── table_id (UUID lookup from table_number)
  │           │     ├── order_type (mapped via mapSRSaleTypeToOrderType)
  │           │     └── SR-specific data → metadata JSONB
  │           └── Create restaurant_order_items (mapped + unmapped)
  └── Update sr_sales.status → 'processed'
```

**Key Architecture Points:**

1. **Fire-and-forget processing**: The sync endpoint returns immediately after inserting sales, background processing doesn't block the agent response.

2. **Cron fallback**: A cron job runs every 5 minutes to process any sales that may have been missed.

3. **Schema mapping**: The `RestaurantOrderService` correctly maps SR fields to TIS TIS `restaurant_orders` schema:
   - `table_number` (string) → `table_id` (UUID via lookup)
   - SR `sale_type` → `order_type` via `mapSRSaleTypeToOrderType()`
   - Financial fields: `tax_amount`, `discount_amount`, `tip_amount`
   - SR metadata preserved in `metadata` JSONB column

4. **Unmapped item handling**: Items without menu mappings are still created with `[SR]` prefix in name for visibility.

### 2b. Manual Processing Endpoint

For manual processing of pending sales:

### 2c. Internal Processing Endpoint

```
POST /api/internal/sr-process
```

**Purpose:** Internal endpoint for cron-triggered processing of pending sales.

**Authentication:** Internal CRON_SECRET header

**Response (200 OK):**
```json
{
  "success": true,
  "processed": 5,
  "succeeded": 4,
  "failed": 1,
  "processingTimeMs": 1234
}
```

---

### 3. Product Mapping Strategy

```
For Each SR Product:
  ↓
Check sr_product_mappings (exact code match)
  ├── Found? → Use mapped menu_item_id
  └── Not Found? → Fuzzy match by name
        ├── Exact match? → Create mapping (high confidence)
        ├── Partial match? → Create mapping (medium confidence)
        └── No match? → Create unmapped entry (manual review needed)
```

### 4. SR Sale Type to Order Type Mapping

The `mapSRSaleTypeToOrderType()` function translates SR sale types to TIS TIS order types:

| SR Sale Type | TIS TIS Order Type | Notes |
|--------------|-------------------|-------|
| `mesa`, `comedor`, `restaurante`, `local`, `1` | `dine_in` | Default |
| `llevar`, `para llevar`, `takeout`, `pll`, `2` | `takeout` | |
| `domicilio`, `delivery`, `envio`, `reparto`, `3` | `delivery` | |
| `autoservicio`, `drive`, `drive_thru`, `4` | `drive_thru` | |
| `catering`, `evento`, `banquete`, `5` | `catering` | |
| Any other value | `dine_in` | Fallback |

### 5. Restaurant Order Schema Mapping

The `RestaurantOrderService` maps SR sales to `restaurant_orders` with these considerations:

**Column Mappings:**

| SR Field | restaurant_orders Column | Notes |
|----------|-------------------------|-------|
| `table_number` | `table_id` (UUID) | Looked up via `findTableIdByNumber()` |
| `sale_type` | `order_type` | Mapped via `mapSRSaleTypeToOrderType()` |
| `subtotal_without_tax` | `subtotal` | |
| `total_tax` | `tax_amount` | Not `tax` |
| `total_discounts` | `discount_amount` | Not `discount` |
| `total_tips` | `tip_amount` | Not `tip` |
| `total` | `total` | |
| `currency` | `currency` | Default: MXN |
| `notes` | `customer_notes` | |

**Metadata JSONB Contents:**

```json
{
  "source": "softrestaurant",
  "sr_sale_id": "uuid",
  "sr_folio": "TICKET-001234",
  "sr_store_code": "POLANCO",
  "sr_customer_code": "CLI-001",
  "sr_user_code": "MESERO-05",
  "sr_table_number": "12",
  "sr_guest_count": 4,
  "sr_opened_at": "2026-01-22T14:30:00.000Z",
  "sr_closed_at": "2026-01-22T15:45:00.000Z",
  "sr_sale_type": "Mesa",
  "items_mapped": 3,
  "items_unmapped": 1,
  "total_items": 4
}
```

**Auto-generated Fields:**

- `order_number` - SERIAL, auto-incremented
- `display_number` - Generated by trigger based on order_type (e.g., "DI-001234")
- `status` - Set to `completed` for SR sales
- `payment_status` - Set to `paid` for SR sales

---

### 6. Inventory Deduction (Recipe Explosion)

```
For Each Mapped Item:
  ↓
Get Recipe (menu_item_recipes)
  ↓
Get Ingredients (recipe_ingredients)
  ↓
For Each Ingredient:
  ├── Calculate Total Deduction = recipe_quantity × portions_sold
  ├── Update inventory_items.current_stock
  └── Create inventory_movements record
```

---

## Error Handling

### Validation Errors (400)

- Missing required fields
- Invalid data types
- Invalid date formats
- Empty products array
- Negative quantities

**Action:** Fix payload and retry

### Authentication Errors (401)

- Missing API key
- Invalid API key
- Integration not found

**Action:** Verify API key configuration

### Authorization Errors (403)

- Integration status not 'connected'
- Integration missing branch_id

**Action:** Check integration configuration in TIS TIS

### Processing Errors (500)

- Database connection issues
- Unmapped products
- Missing recipes
- Inventory item not found

**Action:** Check logs, review product mappings

### Retry Strategy

- **Retryable Errors:** Network timeouts, database deadlocks
- **Non-Retryable:** Validation errors, missing data
- **Max Retries:** 3
- **Backoff:** Exponential (1s, 2s, 4s, ...)

---

## Testing

### Test Files

```
src/features/integrations/tests/soft-restaurant-webhook.test.json
```

### cURL Examples

**1. Send Complete Sale:**

```bash
curl -X POST https://tistis.app/api/soft-restaurant/webhook \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sr_test_key_abc123xyz' \
  -d '{
    "FolioVenta": "TEST-001",
    "FechaApertura": "2026-01-22T12:00:00.000Z",
    "Productos": [
      {
        "Codigo": "PROD-001",
        "Descripcion": "Test Product",
        "Cantidad": 1,
        "Precio": 100.0,
        "Importe": 100.0
      }
    ],
    "SubtotalSinImpuestos": 100.0,
    "TotalImpuestos": 16.0,
    "Total": 116.0
  }'
```

**2. Process Pending Sales:**

```bash
curl -X GET 'https://tistis.app/api/soft-restaurant/process?limit=5' \
  -H 'Authorization: Bearer eyJhbGc...'
```

**3. Process Specific Sale:**

```bash
curl -X POST https://tistis.app/api/soft-restaurant/process \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGc...' \
  -d '{"sale_id": "550e8400-e29b-41d4-a716-446655440000"}'
```

### Expected Responses

See [API Endpoints](#api-endpoints) section for detailed response schemas.

---

## Monitoring

### Key Metrics

- **Sales Received:** Count of webhook POSTs
- **Sales Registered:** Successful PHASE 1 completions
- **Sales Processed:** Successful PHASE 2 completions
- **Processing Rate:** processed / registered
- **Duplicate Rate:** duplicates / total
- **Error Rate:** failed / total

### Database Queries

**Pending Sales:**
```sql
SELECT COUNT(*) FROM sr_sales WHERE status = 'pending';
```

**Failed Sales:**
```sql
SELECT * FROM sr_sales
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

**Unmapped Products:**
```sql
SELECT sr_product_code, sr_product_name, times_sold
FROM sr_product_mappings
WHERE menu_item_id IS NULL
ORDER BY times_sold DESC
LIMIT 20;
```

**Sync Logs (Last 24h):**
```sql
SELECT *
FROM sr_sync_logs
WHERE started_at >= NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;
```

### Alerts

- ⚠️ **High Error Rate:** > 10% failed sales
- ⚠️ **Unmapped Products:** > 20% items unmapped
- ⚠️ **Processing Backlog:** > 100 pending sales
- ⚠️ **Low Stock:** Inventory below minimum after deduction

---

## Support

For integration issues:

1. Check `sr_sync_logs` table for error details
2. Review `sr_sales.error_message` for failed sales
3. Verify product mappings in Integration Hub
4. Contact support: support@tistis.app

**End of Documentation**
