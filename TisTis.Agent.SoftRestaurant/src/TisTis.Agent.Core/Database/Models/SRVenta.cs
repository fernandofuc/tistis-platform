// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Venta Model
// Represents a sale ticket from Soft Restaurant
// =====================================================

namespace TisTis.Agent.Core.Database.Models;

/// <summary>
/// Represents a sale ticket from Soft Restaurant
/// Mapped from: dbo.Ventas + dbo.DetalleVentas + dbo.PagosVenta
/// </summary>
public class SRVenta
{
    /// <summary>
    /// Internal ID from SR database
    /// </summary>
    public long IdVenta { get; set; }

    /// <summary>
    /// Order number (ticket number)
    /// </summary>
    public string NumeroOrden { get; set; } = string.Empty;

    /// <summary>
    /// Folio/receipt number
    /// </summary>
    public string FolioVenta { get; set; } = string.Empty;

    /// <summary>
    /// POS station identifier
    /// </summary>
    public string Estacion { get; set; } = string.Empty;

    /// <summary>
    /// Warehouse/location code
    /// </summary>
    public string Almacen { get; set; } = string.Empty;

    /// <summary>
    /// When the order was opened
    /// </summary>
    public DateTime FechaApertura { get; set; }

    /// <summary>
    /// When the order was closed/paid
    /// </summary>
    public DateTime? FechaCierre { get; set; }

    /// <summary>
    /// Table number (for dine-in)
    /// </summary>
    public string? NumeroMesa { get; set; }

    /// <summary>
    /// Customer code from SR
    /// </summary>
    public string? CodigoCliente { get; set; }

    /// <summary>
    /// Customer name
    /// </summary>
    public string? NombreCliente { get; set; }

    /// <summary>
    /// Server/waiter code
    /// </summary>
    public string? CodigoMesero { get; set; }

    /// <summary>
    /// Server/waiter name
    /// </summary>
    public string? NombreMesero { get; set; }

    /// <summary>
    /// Order notes/comments
    /// </summary>
    public string? Observaciones { get; set; }

    /// <summary>
    /// Subtotal before taxes
    /// </summary>
    public decimal SubtotalSinImpuestos { get; set; }

    /// <summary>
    /// Total taxes
    /// </summary>
    public decimal TotalImpuestos { get; set; }

    /// <summary>
    /// Total discounts applied
    /// </summary>
    public decimal TotalDescuentos { get; set; }

    /// <summary>
    /// Total tips
    /// </summary>
    public decimal TotalPropinas { get; set; }

    /// <summary>
    /// Grand total
    /// </summary>
    public decimal Total { get; set; }

    /// <summary>
    /// Currency code (default MXN)
    /// </summary>
    public string Moneda { get; set; } = "MXN";

    /// <summary>
    /// Whether the order was cancelled
    /// </summary>
    public bool Cancelada { get; set; }

    /// <summary>
    /// Whether the order is fully paid
    /// </summary>
    public bool Pagada { get; set; }

    /// <summary>
    /// Order type (1=Dine-in, 2=Takeout, 3=Delivery, etc.)
    /// </summary>
    public int TipoOrden { get; set; }

    /// <summary>
    /// Number of guests
    /// </summary>
    public int NumeroComensales { get; set; }

    /// <summary>
    /// Line items in this order
    /// </summary>
    public List<SRVentaDetalle> Detalles { get; set; } = new();

    /// <summary>
    /// Payments applied to this order
    /// </summary>
    public List<SRPago> Pagos { get; set; } = new();
}

/// <summary>
/// Line item detail for a sale
/// </summary>
public class SRVentaDetalle
{
    /// <summary>
    /// Product code
    /// </summary>
    public string Codigo { get; set; } = string.Empty;

    /// <summary>
    /// Product description
    /// </summary>
    public string Descripcion { get; set; } = string.Empty;

    /// <summary>
    /// Quantity ordered
    /// </summary>
    public decimal Cantidad { get; set; }

    /// <summary>
    /// Unit price
    /// </summary>
    public decimal PrecioUnitario { get; set; }

    /// <summary>
    /// Line total (Cantidad * PrecioUnitario)
    /// </summary>
    public decimal Importe { get; set; }

    /// <summary>
    /// Discount amount
    /// </summary>
    public decimal Descuento { get; set; }

    /// <summary>
    /// Tax amount
    /// </summary>
    public decimal Impuesto { get; set; }

    /// <summary>
    /// Modifiers applied (e.g., "Sin cebolla, Extra queso")
    /// </summary>
    public string? Modificadores { get; set; }

    /// <summary>
    /// Item-level notes
    /// </summary>
    public string? Notas { get; set; }

    /// <summary>
    /// Category code
    /// </summary>
    public string? CodigoCategoria { get; set; }

    /// <summary>
    /// Whether this item was voided
    /// </summary>
    public bool Cancelado { get; set; }

    /// <summary>
    /// Time when item was sent to kitchen
    /// </summary>
    public DateTime? HoraEnvio { get; set; }

    /// <summary>
    /// Time when item was ready/served
    /// </summary>
    public DateTime? HoraServido { get; set; }
}

/// <summary>
/// Payment record for a sale
/// </summary>
public class SRPago
{
    /// <summary>
    /// Payment method (Efectivo, Tarjeta, etc.)
    /// </summary>
    public string FormaPago { get; set; } = string.Empty;

    /// <summary>
    /// Payment amount
    /// </summary>
    public decimal Monto { get; set; }

    /// <summary>
    /// Reference number (card auth, check number, etc.)
    /// </summary>
    public string? Referencia { get; set; }

    /// <summary>
    /// Tip amount included in this payment
    /// </summary>
    public decimal Propina { get; set; }

    /// <summary>
    /// Currency code
    /// </summary>
    public string Moneda { get; set; } = "MXN";

    /// <summary>
    /// Exchange rate (for non-MXN payments)
    /// </summary>
    public decimal TipoCambio { get; set; } = 1;

    /// <summary>
    /// Last 4 digits of card (if applicable)
    /// </summary>
    public string? Ultimos4Digitos { get; set; }

    /// <summary>
    /// Card brand (Visa, Mastercard, etc.)
    /// </summary>
    public string? MarcaTarjeta { get; set; }
}
