// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Producto Model
// Represents a menu item from Soft Restaurant
// =====================================================

namespace TisTis.Agent.Core.Database.Models;

/// <summary>
/// Represents a menu item/product from Soft Restaurant
/// Mapped from: dbo.Productos + dbo.Categorias
/// </summary>
public class SRProducto
{
    /// <summary>
    /// Product code (SKU)
    /// </summary>
    public string Codigo { get; set; } = string.Empty;

    /// <summary>
    /// Product name/description
    /// </summary>
    public string Descripcion { get; set; } = string.Empty;

    /// <summary>
    /// Regular price
    /// </summary>
    public decimal Precio { get; set; }

    /// <summary>
    /// Wholesale/second price tier
    /// </summary>
    public decimal? PrecioMayoreo { get; set; }

    /// <summary>
    /// Happy hour/promotional price
    /// </summary>
    public decimal? PrecioPromocion { get; set; }

    /// <summary>
    /// Cost price (for margin calculation)
    /// </summary>
    public decimal? Costo { get; set; }

    /// <summary>
    /// Category name
    /// </summary>
    public string? Categoria { get; set; }

    /// <summary>
    /// Category code
    /// </summary>
    public string? CodigoCategoria { get; set; }

    /// <summary>
    /// Subcategory name
    /// </summary>
    public string? SubCategoria { get; set; }

    /// <summary>
    /// Whether product is active
    /// </summary>
    public bool Activo { get; set; } = true;

    /// <summary>
    /// Whether this is a recipe (composed of other items)
    /// </summary>
    public bool EsReceta { get; set; }

    /// <summary>
    /// Whether this is a modifier group
    /// </summary>
    public bool EsModificador { get; set; }

    /// <summary>
    /// Preparation time in minutes
    /// </summary>
    public int? TiempoPreparacion { get; set; }

    /// <summary>
    /// Calorie count
    /// </summary>
    public int? Calorias { get; set; }

    /// <summary>
    /// Allergen information
    /// </summary>
    public string? Alergenos { get; set; }

    /// <summary>
    /// Product description for menu display
    /// </summary>
    public string? DescripcionMenu { get; set; }

    /// <summary>
    /// Image path or URL
    /// </summary>
    public string? Imagen { get; set; }

    /// <summary>
    /// Barcode/UPC
    /// </summary>
    public string? CodigoBarras { get; set; }

    /// <summary>
    /// Unit of measure (pieza, kg, lt, etc.)
    /// </summary>
    public string UnidadMedida { get; set; } = "PZA";

    /// <summary>
    /// Tax rate percentage
    /// </summary>
    public decimal TasaImpuesto { get; set; }

    /// <summary>
    /// Whether price includes tax
    /// </summary>
    public bool PrecioIncluyeImpuesto { get; set; }

    /// <summary>
    /// Display order in category
    /// </summary>
    public int Orden { get; set; }

    /// <summary>
    /// Printer/station to send orders to
    /// </summary>
    public string? Impresora { get; set; }

    /// <summary>
    /// Last modified date
    /// </summary>
    public DateTime? FechaModificacion { get; set; }

    /// <summary>
    /// Available modifiers for this product
    /// </summary>
    public List<SRModificador> Modificadores { get; set; } = new();

    /// <summary>
    /// Recipe components (if EsReceta = true)
    /// </summary>
    public List<SRRecetaItem> Receta { get; set; } = new();
}

/// <summary>
/// Modifier option for a product
/// </summary>
public class SRModificador
{
    /// <summary>
    /// Modifier group code
    /// </summary>
    public string CodigoGrupo { get; set; } = string.Empty;

    /// <summary>
    /// Modifier group name
    /// </summary>
    public string NombreGrupo { get; set; } = string.Empty;

    /// <summary>
    /// Modifier code
    /// </summary>
    public string Codigo { get; set; } = string.Empty;

    /// <summary>
    /// Modifier description
    /// </summary>
    public string Descripcion { get; set; } = string.Empty;

    /// <summary>
    /// Additional price for this modifier
    /// </summary>
    public decimal PrecioAdicional { get; set; }

    /// <summary>
    /// Whether this modifier is selected by default
    /// </summary>
    public bool PorDefecto { get; set; }

    /// <summary>
    /// Minimum selections required
    /// </summary>
    public int MinimoSelecciones { get; set; }

    /// <summary>
    /// Maximum selections allowed
    /// </summary>
    public int MaximoSelecciones { get; set; }
}

/// <summary>
/// Recipe component (for composed products)
/// </summary>
public class SRRecetaItem
{
    /// <summary>
    /// Inventory item code
    /// </summary>
    public string CodigoInsumo { get; set; } = string.Empty;

    /// <summary>
    /// Inventory item description
    /// </summary>
    public string DescripcionInsumo { get; set; } = string.Empty;

    /// <summary>
    /// Quantity required per unit of product
    /// </summary>
    public decimal Cantidad { get; set; }

    /// <summary>
    /// Unit of measure
    /// </summary>
    public string UnidadMedida { get; set; } = string.Empty;
}
