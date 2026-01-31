# TIS TIS Agent - Data Transformers Documentation

## Version: 1.0.0

This document describes the data transformation layer that converts Soft Restaurant data models to the TIS TIS Platform format.

---

## Table of Contents

1. [Overview](#overview)
2. [Transformer Interface](#transformer-interface)
3. [Implemented Transformers](#implemented-transformers)
   - [VentasTransformer](#ventastransformer)
   - [ProductosTransformer](#productostransformer)
   - [InventarioTransformer](#inventariotransformer)
   - [MesasTransformer](#mesastransformer)
4. [Mapping Reference](#mapping-reference)
5. [Unit Mappings](#unit-mappings)
6. [Status Mappings](#status-mappings)
7. [Target Models](#target-models)
8. [Usage](#usage)
9. [Testing](#testing)

---

## Overview

The transformation layer converts Soft Restaurant (SR) data models to TIS TIS format. Transformers are:

- **Stateless**: No internal state, safe for reuse
- **Thread-Safe**: Can be called from multiple threads
- **Testable**: Comprehensive unit tests (410+ tests)
- **Efficient**: Use lazy evaluation where appropriate

### Design Pattern

The transformers implement the Strategy pattern via `IDataTransformer<TSource, TTarget>`:

```
┌─────────────────────────────────────────────────────────────────┐
│                   IDataTransformer<TSource, TTarget>             │
├─────────────────────────────────────────────────────────────────┤
│  + Transform(source: TSource): TTarget                          │
│  + TransformMany(sources: IEnumerable<TSource>): IEnumerable<T> │
└─────────────────────────────────────────────────────────────────┘
                              ▲
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────┴────────┐ ┌─────────┴────────┐ ┌────────┴─────────┐
│ VentasTransformer│ │ProductosTransformer│ │InventarioTransformer│
│                 │ │                   │ │                  │
│ SRVenta →       │ │ SRProducto →      │ │ SRInventario →   │
│ TisTisSale      │ │ TisTisMenuItem    │ │ TisTisInventoryItem│
└─────────────────┘ └───────────────────┘ └──────────────────┘
```

---

## Transformer Interface

```csharp
public interface IDataTransformer<TSource, TTarget>
{
    /// <summary>
    /// Transform a single source object to target format
    /// </summary>
    TTarget Transform(TSource source);

    /// <summary>
    /// Transform a collection of source objects
    /// Uses lazy evaluation via yield return
    /// </summary>
    IEnumerable<TTarget> TransformMany(IEnumerable<TSource> sources);
}
```

### Key Characteristics

| Characteristic | Implementation |
|----------------|----------------|
| **Null Safety** | Handles null/empty collections gracefully |
| **Lazy Evaluation** | `TransformMany` uses LINQ `Select` |
| **Consistent Prefixes** | External IDs use `sr-` prefix |
| **Metadata Injection** | Adds source system metadata |

---

## Implemented Transformers

### VentasTransformer

Transforms sales/orders from Soft Restaurant to TIS TIS format.

**Source → Target:** `SRVenta` → `TisTisSale`

**Key Mappings:**

| SR Field | TIS TIS Field | Notes |
|----------|---------------|-------|
| `IdVenta` | `ExternalId` | Prefixed: `sr-{IdVenta}` |
| `NumeroOrden` | `OrderNumber` | Direct mapping |
| `FolioVenta` | `ReceiptNumber` | Direct mapping |
| `FechaApertura` | `OrderDate` | Direct mapping |
| `FechaCierre` | `ClosedAt` | Nullable |
| `TipoOrden` | `OrderType` | Mapped via `GetOrderType()` |
| `Cancelada/Pagada` | `Status` | Mapped via `GetStatus()` |
| `Detalles` | `Items` | Nested transformation |
| `Pagos` | `Payments` | Nested transformation |

**Order Type Mapping:**

| SR TipoOrden | TIS TIS OrderType |
|--------------|-------------------|
| 1 | `dine_in` |
| 2 | `takeout` |
| 3 | `delivery` |
| 4 | `drive_thru` |
| default | `dine_in` |

**Status Logic:**

```csharp
if (Cancelada) return "cancelled";
if (Pagada) return "completed";
if (FechaCierre.HasValue) return "closed";
return "open";
```

**Payment Method Mapping:**

| SR FormaPago | TIS TIS Method |
|--------------|----------------|
| `efectivo`, `cash` | `cash` |
| `tarjeta`, `credit`, `debit` | `card` |
| `transferencia`, `transfer` | `bank_transfer` |
| `vales`, `voucher` | `voucher` |
| `cortesia`, `courtesy` | `courtesy` |
| `credito`, `fiado` | `credit` |
| default | `other` |

---

### ProductosTransformer

Transforms menu items/products from Soft Restaurant to TIS TIS format.

**Source → Target:** `SRProducto` → `TisTisMenuItem`

**Key Mappings:**

| SR Field | TIS TIS Field | Notes |
|----------|---------------|-------|
| `Codigo` | `ExternalId` | Prefixed: `sr-{Codigo}` |
| `Descripcion` | `Name` | Direct mapping |
| `DescripcionMenu` | `Description` | Menu display text |
| `Precio` | `Price` | Main price |
| `PrecioMayoreo` | `SecondaryPrice` | Wholesale price |
| `Costo` | `Cost` | Cost price |
| `Categoria` | `Category` | Category name |
| `CodigoCategoria` | `CategoryCode` | Category code |
| `Activo` | `IsActive` | Active flag |
| `EsReceta` | `IsComposite` | Is recipe/composed |
| `EsModificador` | `IsModifier` | Is modifier |
| `TiempoPreparacion` | `PrepTimeMinutes` | Prep time |
| `Calorias` | `Calories` | Calorie count |
| `UnidadMedida` | `Unit` | Mapped via `MapUnit()` |

**Unit Mapping:**

| SR UnidadMedida | TIS TIS Unit |
|-----------------|--------------|
| `PZA`, `PIEZA`, `PIEZAS` | `unit` |
| `KG`, `KILOGRAMO`, `KILOGRAMOS` | `kg` |
| `GR`, `G`, `GRAMO`, `GRAMOS` | `g` |
| `LT`, `L`, `LITRO`, `LITROS` | `l` |
| `ML`, `MILILITRO`, `MILILITROS` | `ml` |
| `OZ`, `ONZA`, `ONZAS` | `oz` |
| `LB`, `LIBRA`, `LIBRAS` | `lb` |
| `PORCION`, `PORCIONES` | `portion` |
| null/empty/unknown | `unit` (default) |

---

### InventarioTransformer

Transforms inventory items from Soft Restaurant to TIS TIS format.

**Source → Target:** `SRInventario` → `TisTisInventoryItem`

**Key Mappings:**

| SR Field | TIS TIS Field | Notes |
|----------|---------------|-------|
| `Codigo` | `ExternalId` | Prefixed: `sr-inv-{Codigo}` |
| `Descripcion` | `Name` | Item name |
| `UnidadMedida` | `Unit` | Mapped via `MapUnit()` |
| `ExistenciaActual` | `CurrentStock` | Current qty |
| `ExistenciaMinima` | `MinStock` | Reorder point |
| `ExistenciaMaxima` | `MaxStock` | Max stock level |
| `CostoPromedio` | `AverageCost` | Avg cost |
| `UltimoCosto` | `LastCost` | Last purchase cost |
| `UltimaCompra` | `LastPurchase` | Last purchase date |
| `Almacen` | `LocationCode` | Warehouse code |
| `CodigoProveedor` | `SupplierId` | Supplier code |
| `NombreProveedor` | `SupplierName` | Supplier name |
| `EsPerecedero` | `IsPerishable` | Perishable flag |
| `DiasVigencia` | `ShelfLifeDays` | Shelf life |
| `StockBajo` | `IsLowStock` | Computed property |
| `ValorInventario` | `StockValue` | Computed property |

**Computed Properties:**

```csharp
IsLowStock = ExistenciaActual <= ExistenciaMinima
StockValue = ExistenciaActual * CostoPromedio
```

**Metadata:**

```json
{
  "source": "soft_restaurant",
  "sr_codigo": "INV-001",
  "temperature_requirements": "Refrigerado",
  "last_count_date": "2026-01-15T10:30:00Z"
}
```

---

### MesasTransformer

Transforms table status from Soft Restaurant to TIS TIS format.

**Source → Target:** `SRMesa` → `TisTisTable`

**Key Mappings:**

| SR Field | TIS TIS Field | Notes |
|----------|---------------|-------|
| `Numero` | `ExternalId` | Prefixed: `sr-table-{Numero}` |
| `Numero` | `Number` | Table number |
| `Nombre` | `Name` | Display name |
| `Capacidad` | `Capacity` | Seating capacity |
| `Seccion` | `Section` | Area/section |
| `Estado` | `Status` | Mapped via `MapStatus()` |
| `OrdenActual` | `CurrentOrderNumber` | If occupied |
| `MeseroAsignado` | `AssignedServer` | Server name |
| `HoraOcupacion` | `OccupiedAt` | Occupation time |
| `NumeroComensales` | `GuestCount` | Guest count |
| `Activo` | `IsActive` | Active flag |
| `Orden` | `SortOrder` | Display order |
| `PosicionX` | `PositionX` | Floor map X |
| `PosicionY` | `PositionY` | Floor map Y |
| `Forma` | `Shape` | Table shape |

**Status Mapping:**

| SR Estado | TIS TIS Status |
|-----------|----------------|
| `libre`, `available`, `disponible` | `available` |
| `ocupada`, `occupied`, `ocupado` | `occupied` |
| `reservada`, `reserved`, `reservado` | `reserved` |
| `cuenta`, `bill`, `esperando pago` | `waiting_payment` |
| `bloqueada`, `blocked`, `no disponible` | `blocked` |
| null/empty/unknown | `available` (default) |

---

## Mapping Reference

### External ID Prefixes

| Data Type | Prefix Pattern | Example |
|-----------|----------------|---------|
| Sales | `sr-{IdVenta}` | `sr-12345` |
| Products | `sr-{Codigo}` | `sr-PROD-001` |
| Inventory | `sr-inv-{Codigo}` | `sr-inv-INV-001` |
| Tables | `sr-table-{Numero}` | `sr-table-10` |

### Currency

All monetary values use `MXN` (Mexican Peso) by default.

---

## Unit Mappings

### Product Units (ProductosTransformer)

| Spanish | TIS TIS | Description |
|---------|---------|-------------|
| PZA, PIEZA, PIEZAS | `unit` | Pieces |
| KG, KILOGRAMO, KILOGRAMOS | `kg` | Kilograms |
| GR, G, GRAMO, GRAMOS | `g` | Grams |
| LT, L, LITRO, LITROS | `l` | Liters |
| ML, MILILITRO, MILILITROS | `ml` | Milliliters |
| OZ, ONZA, ONZAS | `oz` | Ounces |
| LB, LIBRA, LIBRAS | `lb` | Pounds |
| PORCION, PORCIONES | `portion` | Portions |

### Inventory Units (InventarioTransformer)

Same as products, plus:

| Spanish | TIS TIS | Description |
|---------|---------|-------------|
| CAJA, CAJAS | `box` | Boxes |
| BOLSA, BOLSAS | `bag` | Bags |
| BOTELLA, BOTELLAS | `bottle` | Bottles |
| LATA, LATAS | `can` | Cans |

### Unknown Units

- If unit is `null`, empty, or whitespace → `unit`
- If unit is unknown → lowercase original value

---

## Status Mappings

### Table Status

| SR Estado (case-insensitive) | TIS TIS Status |
|------------------------------|----------------|
| libre, available, disponible | `available` |
| ocupada, occupied, ocupado | `occupied` |
| reservada, reserved, reservado | `reserved` |
| cuenta, bill, esperando pago | `waiting_payment` |
| bloqueada, blocked, no disponible | `blocked` |
| (unknown) | `available` |

### Order Status

| Condition | TIS TIS Status |
|-----------|----------------|
| `Cancelada = true` | `cancelled` |
| `Pagada = true` | `completed` |
| `FechaCierre != null` | `closed` |
| (default) | `open` |

---

## Target Models

### TisTisSale

```csharp
public class TisTisSale
{
    public string ExternalId { get; set; }
    public string OrderNumber { get; set; }
    public string? ReceiptNumber { get; set; }
    public DateTime OrderDate { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string Status { get; set; }
    public string OrderType { get; set; }
    public string? TableNumber { get; set; }
    public string? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string? ServerId { get; set; }
    public string? ServerName { get; set; }
    public decimal Subtotal { get; set; }
    public decimal TaxTotal { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal TipTotal { get; set; }
    public decimal GrandTotal { get; set; }
    public string Currency { get; set; }
    public int GuestCount { get; set; }
    public List<TisTisSaleItem> Items { get; set; }
    public List<TisTisPayment> Payments { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
}
```

### TisTisMenuItem

```csharp
public class TisTisMenuItem
{
    public string ExternalId { get; set; }
    public string Name { get; set; }
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public decimal? SecondaryPrice { get; set; }
    public decimal? Cost { get; set; }
    public string? Category { get; set; }
    public string? CategoryCode { get; set; }
    public bool IsActive { get; set; }
    public bool IsComposite { get; set; }
    public bool IsModifier { get; set; }
    public int? PrepTimeMinutes { get; set; }
    public int? Calories { get; set; }
    public string? Allergens { get; set; }
    public string? ImageUrl { get; set; }
    public string? Barcode { get; set; }
    public string Unit { get; set; }
    public decimal TaxRate { get; set; }
    public int SortOrder { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
}
```

### TisTisInventoryItem

```csharp
public class TisTisInventoryItem
{
    public string ExternalId { get; set; }
    public string Name { get; set; }
    public string Unit { get; set; }
    public decimal CurrentStock { get; set; }
    public decimal MinStock { get; set; }
    public decimal? MaxStock { get; set; }
    public decimal AverageCost { get; set; }
    public decimal? LastCost { get; set; }
    public DateTime? LastPurchase { get; set; }
    public string? Category { get; set; }
    public bool IsActive { get; set; }
    public string? LocationCode { get; set; }
    public string? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public string? Barcode { get; set; }
    public bool IsPerishable { get; set; }
    public int? ShelfLifeDays { get; set; }
    public bool IsLowStock { get; set; }
    public decimal StockValue { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
}
```

### TisTisTable

```csharp
public class TisTisTable
{
    public string ExternalId { get; set; }
    public string Number { get; set; }
    public string Name { get; set; }
    public int Capacity { get; set; }
    public string? Section { get; set; }
    public string Status { get; set; }
    public string? CurrentOrderNumber { get; set; }
    public string? AssignedServer { get; set; }
    public DateTime? OccupiedAt { get; set; }
    public int? GuestCount { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public int? PositionX { get; set; }
    public int? PositionY { get; set; }
    public string? Shape { get; set; }
}
```

---

## Usage

### Single Transform

```csharp
var transformer = new VentasTransformer();
var srVenta = await repository.GetVentaByIdAsync(12345);
var tisTisSale = transformer.Transform(srVenta);
```

### Batch Transform

```csharp
var transformer = new ProductosTransformer();
var srProductos = await repository.GetProductosAsync();
var menuItems = transformer.TransformMany(srProductos).ToList();
```

### In SyncEngine

```csharp
// Transformers are static readonly for efficiency
private static readonly VentasTransformer VentasTransformer = new();

// Usage
var ventas = await _repository.GetNewVentasAsync(lastSyncedId);
var transformed = VentasTransformer.TransformMany(ventas);
await _apiClient.SendSyncDataAsync("sales", transformed, ventas.Count);
```

---

## Testing

### Test Coverage

| Transformer | Test Count | Coverage |
|-------------|------------|----------|
| VentasTransformer | 35 | 100% |
| ProductosTransformer | 32 | 100% |
| InventarioTransformer | 35 | 100% |
| MesasTransformer | 25 | 100% |

### Test Patterns

```csharp
// Basic transformation
[Fact]
public void Transform_ValidProduct_TransformsCorrectly()
{
    var source = CreateValidSRProducto();
    var result = _transformer.Transform(source);
    result.Should().NotBeNull();
    result.ExternalId.Should().Be("sr-PROD-001");
}

// Unit mapping (parameterized)
[Theory]
[InlineData("KG", "kg")]
[InlineData("KILOGRAMO", "kg")]
[InlineData("kilogramo", "kg")]
public void Transform_UnitMapping_MapsCorrectly(string input, string expected)
{
    var source = new SRProducto { Codigo = "PROD", UnidadMedida = input };
    var result = _transformer.Transform(source);
    result.Unit.Should().Be(expected);
}

// Edge cases
[Fact]
public void Transform_DefaultValues_HandlesGracefully()
{
    var source = new SRProducto(); // All defaults
    var result = _transformer.Transform(source);
    result.Should().NotBeNull();
    result.ExternalId.Should().Be("sr-");
    result.IsActive.Should().BeTrue();
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-30 | Initial transformers documentation |

---

*For additional support, contact: soporte@tistis.com*
