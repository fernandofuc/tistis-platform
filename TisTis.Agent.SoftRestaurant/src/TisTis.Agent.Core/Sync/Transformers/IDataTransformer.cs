// =====================================================
// TIS TIS PLATFORM - Data Transformer Interface
// Transforms SR data to TIS TIS format
// =====================================================

namespace TisTis.Agent.Core.Sync.Transformers;

/// <summary>
/// Interface for transforming SR data to TIS TIS format
/// </summary>
public interface IDataTransformer<TSource, TTarget>
{
    /// <summary>
    /// Transform a single item
    /// </summary>
    TTarget Transform(TSource source);

    /// <summary>
    /// Transform a collection of items
    /// </summary>
    IEnumerable<TTarget> TransformMany(IEnumerable<TSource> sources);
}

/// <summary>
/// Base TIS TIS format for a sale/order
/// </summary>
public class TisTisSale
{
    public string ExternalId { get; set; } = string.Empty;
    public string OrderNumber { get; set; } = string.Empty;
    public string? ReceiptNumber { get; set; }
    public DateTime OrderDate { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string Status { get; set; } = "completed";
    public string OrderType { get; set; } = "dine_in";

    // Location
    public string? TableNumber { get; set; }
    public string? StationId { get; set; }
    public string? LocationCode { get; set; }

    // Customer
    public string? CustomerId { get; set; }
    public string? CustomerName { get; set; }

    // Staff
    public string? ServerId { get; set; }
    public string? ServerName { get; set; }

    // Totals
    public decimal Subtotal { get; set; }
    public decimal TaxTotal { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal TipTotal { get; set; }
    public decimal GrandTotal { get; set; }
    public string Currency { get; set; } = "MXN";

    // Details
    public int GuestCount { get; set; }
    public string? Notes { get; set; }

    // Items and Payments
    public List<TisTisSaleItem> Items { get; set; } = new();
    public List<TisTisPayment> Payments { get; set; } = new();

    // Metadata
    public Dictionary<string, object> Metadata { get; set; } = new();
}

/// <summary>
/// TIS TIS format for a sale line item
/// </summary>
public class TisTisSaleItem
{
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public string? Modifiers { get; set; }
    public string? Notes { get; set; }
    public string? CategoryCode { get; set; }
    public bool IsVoided { get; set; }
}

/// <summary>
/// TIS TIS format for a payment
/// </summary>
public class TisTisPayment
{
    public string Method { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal Tip { get; set; }
    public string? Reference { get; set; }
    public string Currency { get; set; } = "MXN";
    public string? CardBrand { get; set; }
    public string? LastFourDigits { get; set; }
}

/// <summary>
/// TIS TIS format for a menu item
/// </summary>
public class TisTisMenuItem
{
    public string ExternalId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
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
    public string Unit { get; set; } = "unit";
    public decimal TaxRate { get; set; }
    public int SortOrder { get; set; }
    public Dictionary<string, object> Metadata { get; set; } = new();
}

/// <summary>
/// TIS TIS format for an inventory item
/// </summary>
public class TisTisInventoryItem
{
    public string ExternalId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal CurrentStock { get; set; }
    public decimal MinStock { get; set; }
    public decimal? MaxStock { get; set; }
    public decimal AverageCost { get; set; }
    public decimal? LastCost { get; set; }
    public DateTime? LastPurchase { get; set; }
    public string? Category { get; set; }
    public string? CategoryCode { get; set; }
    public bool IsActive { get; set; }
    public string? LocationCode { get; set; }
    public string? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public string? Barcode { get; set; }
    public bool IsPerishable { get; set; }
    public int? ShelfLifeDays { get; set; }
    public bool IsLowStock { get; set; }
    public decimal StockValue { get; set; }
    public Dictionary<string, object> Metadata { get; set; } = new();
}

/// <summary>
/// TIS TIS format for a table
/// </summary>
public class TisTisTable
{
    public string ExternalId { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string? Section { get; set; }
    public string Status { get; set; } = "available";
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
