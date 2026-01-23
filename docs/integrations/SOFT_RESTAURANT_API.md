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

### 2. Asynchronous Processing (TODO: Implement trigger)

```
Background Job
  ↓
Get Pending Sales
  ↓
For Each Sale:
  ├── Map Products (fuzzy matching)
  ├── Explode Recipes
  ├── Deduct Inventory
  ├── Create Restaurant Order
  └── Update Status → 'processed'
```

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

### 4. Inventory Deduction (Recipe Explosion)

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
