// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Inventario Model
// Represents inventory items from Soft Restaurant
// =====================================================

namespace TisTis.Agent.Core.Database.Models;

/// <summary>
/// Represents an inventory item from Soft Restaurant
/// Mapped from: dbo.Inventario + dbo.CategoriasInventario
/// </summary>
public class SRInventario
{
    /// <summary>
    /// Item code
    /// </summary>
    public string Codigo { get; set; } = string.Empty;

    /// <summary>
    /// Item description
    /// </summary>
    public string Descripcion { get; set; } = string.Empty;

    /// <summary>
    /// Unit of measure (kg, lt, pza, etc.)
    /// </summary>
    public string UnidadMedida { get; set; } = string.Empty;

    /// <summary>
    /// Current stock quantity
    /// </summary>
    public decimal ExistenciaActual { get; set; }

    /// <summary>
    /// Minimum stock level (reorder point)
    /// </summary>
    public decimal ExistenciaMinima { get; set; }

    /// <summary>
    /// Maximum stock level
    /// </summary>
    public decimal? ExistenciaMaxima { get; set; }

    /// <summary>
    /// Average cost
    /// </summary>
    public decimal CostoPromedio { get; set; }

    /// <summary>
    /// Last purchase cost
    /// </summary>
    public decimal? UltimoCosto { get; set; }

    /// <summary>
    /// Last purchase date
    /// </summary>
    public DateTime? UltimaCompra { get; set; }

    /// <summary>
    /// Category name
    /// </summary>
    public string? Categoria { get; set; }

    /// <summary>
    /// Category code
    /// </summary>
    public string? CodigoCategoria { get; set; }

    /// <summary>
    /// Whether item is active
    /// </summary>
    public bool Activo { get; set; } = true;

    /// <summary>
    /// Warehouse/location code
    /// </summary>
    public string? Almacen { get; set; }

    /// <summary>
    /// Supplier/vendor code
    /// </summary>
    public string? CodigoProveedor { get; set; }

    /// <summary>
    /// Supplier/vendor name
    /// </summary>
    public string? NombreProveedor { get; set; }

    /// <summary>
    /// Barcode
    /// </summary>
    public string? CodigoBarras { get; set; }

    /// <summary>
    /// Whether this is a perishable item
    /// </summary>
    public bool EsPerecedero { get; set; }

    /// <summary>
    /// Shelf life in days
    /// </summary>
    public int? DiasVigencia { get; set; }

    /// <summary>
    /// Storage temperature requirements
    /// </summary>
    public string? Temperatura { get; set; }

    /// <summary>
    /// Last inventory count date
    /// </summary>
    public DateTime? UltimoConteo { get; set; }

    /// <summary>
    /// Whether item is below minimum stock
    /// </summary>
    public bool StockBajo => ExistenciaActual <= ExistenciaMinima;

    /// <summary>
    /// Stock value (ExistenciaActual * CostoPromedio)
    /// </summary>
    public decimal ValorInventario => ExistenciaActual * CostoPromedio;
}

/// <summary>
/// Represents a table/mesa from Soft Restaurant
/// </summary>
public class SRMesa
{
    /// <summary>
    /// Table number
    /// </summary>
    public string Numero { get; set; } = string.Empty;

    /// <summary>
    /// Table name/description
    /// </summary>
    public string Nombre { get; set; } = string.Empty;

    /// <summary>
    /// Seating capacity
    /// </summary>
    public int Capacidad { get; set; }

    /// <summary>
    /// Section/area code
    /// </summary>
    public string? Seccion { get; set; }

    /// <summary>
    /// Current status (Libre, Ocupada, Reservada, etc.)
    /// </summary>
    public string Estado { get; set; } = "Libre";

    /// <summary>
    /// Current order number if occupied
    /// </summary>
    public string? OrdenActual { get; set; }

    /// <summary>
    /// Current waiter/server assigned
    /// </summary>
    public string? MeseroAsignado { get; set; }

    /// <summary>
    /// Time when table was occupied
    /// </summary>
    public DateTime? HoraOcupacion { get; set; }

    /// <summary>
    /// Number of guests at table
    /// </summary>
    public int? NumeroComensales { get; set; }

    /// <summary>
    /// Whether table is active
    /// </summary>
    public bool Activo { get; set; } = true;

    /// <summary>
    /// Display order
    /// </summary>
    public int Orden { get; set; }

    /// <summary>
    /// X position for floor map
    /// </summary>
    public int? PosicionX { get; set; }

    /// <summary>
    /// Y position for floor map
    /// </summary>
    public int? PosicionY { get; set; }

    /// <summary>
    /// Table shape (Rectangular, Redonda, etc.)
    /// </summary>
    public string? Forma { get; set; }
}
