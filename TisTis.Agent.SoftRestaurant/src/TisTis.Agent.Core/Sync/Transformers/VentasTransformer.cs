// =====================================================
// TIS TIS PLATFORM - Ventas Transformer
// Transforms SR sales to TIS TIS format
// =====================================================

using TisTis.Agent.Core.Database.Models;

namespace TisTis.Agent.Core.Sync.Transformers;

/// <summary>
/// Transforms Soft Restaurant sales to TIS TIS format
/// </summary>
public class VentasTransformer : IDataTransformer<SRVenta, TisTisSale>
{
    /// <inheritdoc />
    public TisTisSale Transform(SRVenta source)
    {
        return new TisTisSale
        {
            ExternalId = $"sr-{source.IdVenta}",
            OrderNumber = source.NumeroOrden,
            ReceiptNumber = source.FolioVenta,
            OrderDate = source.FechaApertura,
            ClosedAt = source.FechaCierre,
            Status = GetStatus(source),
            OrderType = GetOrderType(source.TipoOrden),

            // Location
            TableNumber = source.NumeroMesa,
            StationId = source.Estacion,
            LocationCode = source.Almacen,

            // Customer
            CustomerId = source.CodigoCliente,
            CustomerName = source.NombreCliente,

            // Staff
            ServerId = source.CodigoMesero,
            ServerName = source.NombreMesero,

            // Totals
            Subtotal = source.SubtotalSinImpuestos,
            TaxTotal = source.TotalImpuestos,
            DiscountTotal = source.TotalDescuentos,
            TipTotal = source.TotalPropinas,
            GrandTotal = source.Total,
            Currency = source.Moneda,

            // Details
            GuestCount = source.NumeroComensales,
            Notes = source.Observaciones,

            // Items (with null safety)
            Items = (source.Detalles ?? new List<SRVentaDetalle>()).Select(d => new TisTisSaleItem
            {
                ProductCode = d.Codigo,
                ProductName = d.Descripcion,
                Quantity = d.Cantidad,
                UnitPrice = d.PrecioUnitario,
                LineTotal = d.Importe,
                Discount = d.Descuento,
                Tax = d.Impuesto,
                Modifiers = d.Modificadores,
                Notes = d.Notas,
                CategoryCode = d.CodigoCategoria,
                IsVoided = d.Cancelado
            }).ToList(),

            // Payments (with null safety)
            Payments = (source.Pagos ?? new List<SRPago>()).Select(p => new TisTisPayment
            {
                Method = MapPaymentMethod(p.FormaPago),
                Amount = p.Monto,
                Tip = p.Propina,
                Reference = p.Referencia,
                Currency = p.Moneda,
                CardBrand = p.MarcaTarjeta,
                LastFourDigits = p.Ultimos4Digitos
            }).ToList(),

            // Metadata
            Metadata = new Dictionary<string, object>
            {
                ["source"] = "soft_restaurant",
                ["sr_id_venta"] = source.IdVenta,
                ["sr_folio"] = source.FolioVenta
            }
        };
    }

    /// <inheritdoc />
    public IEnumerable<TisTisSale> TransformMany(IEnumerable<SRVenta> sources)
    {
        return sources.Select(Transform);
    }

    private static string GetStatus(SRVenta venta)
    {
        if (venta.Cancelada) return "cancelled";
        if (venta.Pagada) return "completed";
        if (venta.FechaCierre.HasValue) return "closed";
        return "open";
    }

    private static string GetOrderType(int tipoOrden)
    {
        return tipoOrden switch
        {
            1 => "dine_in",
            2 => "takeout",
            3 => "delivery",
            4 => "drive_thru",
            _ => "dine_in"
        };
    }

    private static string MapPaymentMethod(string? srMethod)
    {
        // FIX S6: Handle null or empty payment method
        if (string.IsNullOrWhiteSpace(srMethod))
            return "other";

        var normalizedMethod = srMethod.ToLowerInvariant().Trim();

        return normalizedMethod switch
        {
            "efectivo" or "cash" => "cash",
            "tarjeta" or "tarjeta de credito" or "tarjeta de debito" or "credit" or "debit" => "card",
            "transferencia" or "transfer" => "bank_transfer",
            "vales" or "voucher" => "voucher",
            "cortesia" or "courtesy" => "courtesy",
            "credito" or "fiado" => "credit",
            _ => "other"
        };
    }
}
