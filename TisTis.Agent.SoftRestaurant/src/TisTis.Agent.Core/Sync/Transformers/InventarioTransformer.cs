// =====================================================
// TIS TIS PLATFORM - Inventario Transformer
// Transforms SR inventory to TIS TIS format
// =====================================================

using TisTis.Agent.Core.Database.Models;

namespace TisTis.Agent.Core.Sync.Transformers;

/// <summary>
/// Transforms Soft Restaurant inventory to TIS TIS format
/// </summary>
public class InventarioTransformer : IDataTransformer<SRInventario, TisTisInventoryItem>
{
    /// <inheritdoc />
    public TisTisInventoryItem Transform(SRInventario source)
    {
        return new TisTisInventoryItem
        {
            ExternalId = $"sr-inv-{source.Codigo}",
            Name = source.Descripcion,
            Unit = MapUnit(source.UnidadMedida),
            CurrentStock = source.ExistenciaActual,
            MinStock = source.ExistenciaMinima,
            MaxStock = source.ExistenciaMaxima,
            AverageCost = source.CostoPromedio,
            LastCost = source.UltimoCosto,
            LastPurchase = source.UltimaCompra,
            Category = source.Categoria,
            CategoryCode = source.CodigoCategoria,
            IsActive = source.Activo,
            LocationCode = source.Almacen,
            SupplierId = source.CodigoProveedor,
            SupplierName = source.NombreProveedor,
            Barcode = source.CodigoBarras,
            IsPerishable = source.EsPerecedero,
            ShelfLifeDays = source.DiasVigencia,
            IsLowStock = source.StockBajo,
            StockValue = source.ValorInventario,

            Metadata = new Dictionary<string, object>
            {
                ["source"] = "soft_restaurant",
                ["sr_codigo"] = source.Codigo,
                ["temperature_requirements"] = source.Temperatura ?? "",
                ["last_count_date"] = source.UltimoConteo?.ToString("O") ?? ""
            }
        };
    }

    /// <inheritdoc />
    public IEnumerable<TisTisInventoryItem> TransformMany(IEnumerable<SRInventario> sources)
    {
        return sources.Select(Transform);
    }

    private static string MapUnit(string? srUnit)
    {
        // FIX S7: Handle null or empty unit
        if (string.IsNullOrWhiteSpace(srUnit))
            return "unit";

        var normalizedUnit = srUnit.ToUpperInvariant().Trim();

        return normalizedUnit switch
        {
            "PZA" or "PIEZA" or "PIEZAS" => "unit",
            "KG" or "KILOGRAMO" or "KILOGRAMOS" => "kg",
            "GR" or "G" or "GRAMO" or "GRAMOS" => "g",
            "LT" or "L" or "LITRO" or "LITROS" => "l",
            "ML" or "MILILITRO" or "MILILITROS" => "ml",
            "OZ" or "ONZA" or "ONZAS" => "oz",
            "LB" or "LIBRA" or "LIBRAS" => "lb",
            "CAJA" or "CAJAS" => "box",
            "BOLSA" or "BOLSAS" => "bag",
            "BOTELLA" or "BOTELLAS" => "bottle",
            "LATA" or "LATAS" => "can",
            _ => srUnit.ToLowerInvariant()
        };
    }
}

/// <summary>
/// Transforms Soft Restaurant tables to TIS TIS format
/// </summary>
public class MesasTransformer : IDataTransformer<SRMesa, TisTisTable>
{
    /// <inheritdoc />
    public TisTisTable Transform(SRMesa source)
    {
        return new TisTisTable
        {
            ExternalId = $"sr-table-{source.Numero}",
            Number = source.Numero,
            Name = source.Nombre,
            Capacity = source.Capacidad,
            Section = source.Seccion,
            Status = MapStatus(source.Estado),
            CurrentOrderNumber = source.OrdenActual,
            AssignedServer = source.MeseroAsignado,
            OccupiedAt = source.HoraOcupacion,
            GuestCount = source.NumeroComensales,
            IsActive = source.Activo,
            SortOrder = source.Orden,
            PositionX = source.PosicionX,
            PositionY = source.PosicionY,
            Shape = source.Forma?.ToLowerInvariant()
        };
    }

    /// <inheritdoc />
    public IEnumerable<TisTisTable> TransformMany(IEnumerable<SRMesa> sources)
    {
        return sources.Select(Transform);
    }

    private static string MapStatus(string? srStatus)
    {
        // FIX S7: Handle null or empty status
        if (string.IsNullOrWhiteSpace(srStatus))
            return "available";

        var normalizedStatus = srStatus.ToLowerInvariant().Trim();

        return normalizedStatus switch
        {
            "libre" or "available" or "disponible" => "available",
            "ocupada" or "occupied" or "ocupado" => "occupied",
            "reservada" or "reserved" or "reservado" => "reserved",
            "cuenta" or "bill" or "esperando pago" => "waiting_payment",
            "bloqueada" or "blocked" or "no disponible" => "blocked",
            _ => "available"
        };
    }
}
