// =====================================================
// TIS TIS PLATFORM - Productos Transformer
// Transforms SR products to TIS TIS format
// =====================================================

using TisTis.Agent.Core.Database.Models;

namespace TisTis.Agent.Core.Sync.Transformers;

/// <summary>
/// Transforms Soft Restaurant products to TIS TIS format
/// </summary>
public class ProductosTransformer : IDataTransformer<SRProducto, TisTisMenuItem>
{
    /// <inheritdoc />
    public TisTisMenuItem Transform(SRProducto source)
    {
        return new TisTisMenuItem
        {
            ExternalId = $"sr-{source.Codigo}",
            Name = source.Descripcion,
            Description = source.DescripcionMenu,
            Price = source.Precio,
            SecondaryPrice = source.PrecioMayoreo,
            Cost = source.Costo,
            Category = source.Categoria,
            CategoryCode = source.CodigoCategoria,
            IsActive = source.Activo,
            IsComposite = source.EsReceta,
            IsModifier = source.EsModificador,
            PrepTimeMinutes = source.TiempoPreparacion,
            Calories = source.Calorias,
            Allergens = source.Alergenos,
            ImageUrl = source.Imagen,
            Barcode = source.CodigoBarras,
            Unit = MapUnit(source.UnidadMedida),
            TaxRate = source.TasaImpuesto,
            SortOrder = source.Orden,

            Metadata = new Dictionary<string, object>
            {
                ["source"] = "soft_restaurant",
                ["sr_codigo"] = source.Codigo,
                ["price_includes_tax"] = source.PrecioIncluyeImpuesto,
                ["printer"] = source.Impresora ?? ""
            }
        };
    }

    /// <inheritdoc />
    public IEnumerable<TisTisMenuItem> TransformMany(IEnumerable<SRProducto> sources)
    {
        return sources.Select(Transform);
    }

    // FIX S17: Added null/empty check for consistency with other transformers
    private static string MapUnit(string? srUnit)
    {
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
            "PORCION" or "PORCIONES" => "portion",
            _ => "unit"
        };
    }
}
