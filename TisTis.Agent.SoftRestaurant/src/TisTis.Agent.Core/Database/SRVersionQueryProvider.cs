// =====================================================
// TIS TIS PLATFORM - SR Version Query Provider
// Provides version-specific SQL queries for Soft Restaurant
// =====================================================

namespace TisTis.Agent.Core.Database;

/// <summary>
/// Soft Restaurant version identifiers
/// Based on actual SR versions: 12, 11, 10 (and legacy)
/// </summary>
public enum SRVersion
{
    /// <summary>SR 12.x - Latest version with full feature set</summary>
    V12,

    /// <summary>SR 11.x - Previous major version, widely used</summary>
    V11,

    /// <summary>SR 10.x - Older version but still supported</summary>
    V10,

    /// <summary>SR 9.x or earlier - Legacy version, limited features</summary>
    Legacy,

    /// <summary>Unknown version - use safest queries</summary>
    Unknown
}

/// <summary>
/// Version-specific schema capabilities
/// </summary>
public class SRVersionCapabilities
{
    public SRVersion Version { get; init; }
    public bool HasMonedaColumn { get; init; }
    public bool HasTipoOrdenColumn { get; init; }
    public bool HasNumeroComensalesColumn { get; init; }
    public bool HasDetalleVentasTable { get; init; }
    public bool HasPagosVentaTable { get; init; }
    public bool HasInventarioTable { get; init; }
    public bool HasCategoriasTable { get; init; }
    public bool HasMesasTable { get; init; }
    public bool IsSupported { get; init; }
    public string Notes { get; init; } = string.Empty;
}

/// <summary>
/// Provides version-specific SQL queries for Soft Restaurant databases.
/// Automatically adapts queries based on detected version capabilities.
/// </summary>
public class SRVersionQueryProvider
{
    private readonly SRVersionCapabilities _capabilities;
    private readonly string _storeCode;

    /// <summary>
    /// Known version capabilities
    /// Based on actual Soft Restaurant versions: 12, 11, 10
    /// </summary>
    public static readonly Dictionary<SRVersion, SRVersionCapabilities> KnownVersions = new()
    {
        [SRVersion.V12] = new SRVersionCapabilities
        {
            Version = SRVersion.V12,
            HasMonedaColumn = true,
            HasTipoOrdenColumn = true,
            HasNumeroComensalesColumn = true,
            HasDetalleVentasTable = true,
            HasPagosVentaTable = true,
            HasInventarioTable = true,
            HasCategoriasTable = true,
            HasMesasTable = true,
            IsSupported = true,
            Notes = "Versión más reciente - soporte completo"
        },
        [SRVersion.V11] = new SRVersionCapabilities
        {
            Version = SRVersion.V11,
            HasMonedaColumn = true,
            HasTipoOrdenColumn = true,
            HasNumeroComensalesColumn = true,
            HasDetalleVentasTable = true,
            HasPagosVentaTable = true,
            HasInventarioTable = true,
            HasCategoriasTable = true,
            HasMesasTable = true,
            IsSupported = true,
            Notes = "Versión estable muy utilizada"
        },
        [SRVersion.V10] = new SRVersionCapabilities
        {
            Version = SRVersion.V10,
            HasMonedaColumn = true,
            HasTipoOrdenColumn = true,
            HasNumeroComensalesColumn = true,
            HasDetalleVentasTable = true,
            HasPagosVentaTable = true,
            HasInventarioTable = true,
            HasCategoriasTable = true,
            HasMesasTable = true,
            IsSupported = true,
            Notes = "Versión anterior soportada"
        },
        [SRVersion.Legacy] = new SRVersionCapabilities
        {
            Version = SRVersion.Legacy,
            HasMonedaColumn = false,
            HasTipoOrdenColumn = false,
            HasNumeroComensalesColumn = false,
            HasDetalleVentasTable = true,
            HasPagosVentaTable = false,
            HasInventarioTable = true,
            HasCategoriasTable = true,
            HasMesasTable = true,
            IsSupported = false,
            Notes = "Versión legacy (SR 9.x o anterior) - funcionalidad limitada"
        },
        [SRVersion.Unknown] = new SRVersionCapabilities
        {
            Version = SRVersion.Unknown,
            HasMonedaColumn = false,
            HasTipoOrdenColumn = false,
            HasNumeroComensalesColumn = false,
            HasDetalleVentasTable = true,
            HasPagosVentaTable = false,
            HasInventarioTable = false,
            HasCategoriasTable = true,
            HasMesasTable = false,
            IsSupported = true,
            Notes = "Versión no detectada - usando queries conservadoras"
        }
    };

    public SRVersionQueryProvider(SRVersion version, string? storeCode = null)
    {
        _capabilities = KnownVersions[version];
        _storeCode = storeCode ?? string.Empty;
    }

    public SRVersionQueryProvider(SRVersionCapabilities capabilities, string? storeCode = null)
    {
        _capabilities = capabilities;
        _storeCode = storeCode ?? string.Empty;
    }

    /// <summary>
    /// Current version capabilities
    /// </summary>
    public SRVersionCapabilities Capabilities => _capabilities;

    /// <summary>
    /// Detects SR version based on available columns in schema validation result.
    /// SR 12, 11, and 10 have similar schemas with all modern columns.
    /// We detect "modern" (V10+) vs "legacy" (V9 and earlier) based on column presence.
    /// For exact version detection, additional metadata would be needed.
    /// </summary>
    public static SRVersion DetectVersion(
        bool hasMoneda,
        bool hasTipoOrden,
        bool hasNumeroComensales,
        bool hasPagosVenta)
    {
        // Modern versions (V10, V11, V12): Have all modern columns
        // We default to V11 as it's the most common modern version
        if (hasMoneda && hasTipoOrden && hasNumeroComensales && hasPagosVenta)
        {
            return SRVersion.V11; // Default to V11 for modern schemas
        }

        // Partial modern: Has some but not all columns - likely V10
        if ((hasMoneda || hasTipoOrden) && hasNumeroComensales && hasPagosVenta)
        {
            return SRVersion.V10;
        }

        // Legacy: Missing most modern columns (V9 and earlier)
        if (!hasMoneda && !hasTipoOrden && !hasNumeroComensales)
        {
            return SRVersion.Legacy;
        }

        // Has NumeroComensales but missing other columns - transitional version
        if (hasNumeroComensales && hasPagosVenta)
        {
            return SRVersion.V10;
        }

        return SRVersion.Unknown;
    }

    /// <summary>
    /// Gets the store code filter for multi-branch queries
    /// </summary>
    private string GetStoreCodeFilter(string columnName = "Almacen")
    {
        return string.IsNullOrEmpty(_storeCode)
            ? string.Empty
            : $"AND {columnName} = @StoreCode";
    }

    /// <summary>
    /// Gets the ventas query optimized for the current version
    /// </summary>
    public string GetVentasQuery()
    {
        var storeCodeFilter = GetStoreCodeFilter("v.Almacen");

        // Build column list based on version capabilities
        var monedaColumn = _capabilities.HasMonedaColumn
            ? "ISNULL(v.Moneda, 'MXN') AS Moneda"
            : "'MXN' AS Moneda";

        var tipoOrdenColumn = _capabilities.HasTipoOrdenColumn
            ? "ISNULL(v.TipoOrden, 1) AS TipoOrden"
            : "1 AS TipoOrden";

        var comensalesColumn = _capabilities.HasNumeroComensalesColumn
            ? "ISNULL(v.NumeroComensales, 1) AS NumeroComensales"
            : "1 AS NumeroComensales";

        return $@"
            SELECT TOP (@Limit)
                v.IdVenta,
                v.NumeroOrden,
                v.Folio AS FolioVenta,
                ISNULL(v.Estacion, '') AS Estacion,
                ISNULL(v.Almacen, '') AS Almacen,
                v.FechaApertura,
                v.FechaCierre,
                v.NumeroMesa,
                v.CodigoCliente,
                c.Nombre AS NombreCliente,
                v.CodigoEmpleado AS CodigoMesero,
                e.Nombre AS NombreMesero,
                v.Observaciones,
                ISNULL(v.Subtotal, 0) AS SubtotalSinImpuestos,
                ISNULL(v.Impuestos, 0) AS TotalImpuestos,
                ISNULL(v.Descuento, 0) AS TotalDescuentos,
                ISNULL(v.Propina, 0) AS TotalPropinas,
                ISNULL(v.Total, 0) AS Total,
                {monedaColumn},
                ISNULL(v.Cancelada, 0) AS Cancelada,
                ISNULL(v.Pagada, 0) AS Pagada,
                {tipoOrdenColumn},
                {comensalesColumn}
            FROM dbo.Ventas v
            LEFT JOIN dbo.Clientes c ON v.CodigoCliente = c.Codigo
            LEFT JOIN dbo.Empleados e ON v.CodigoEmpleado = e.Codigo
            WHERE v.IdVenta > @LastId
              AND v.FechaCierre IS NOT NULL
              {storeCodeFilter}
            ORDER BY v.IdVenta ASC";
    }

    /// <summary>
    /// Gets the ventas query without joins (for versions without reference tables)
    /// </summary>
    public string GetVentasQuerySimplified()
    {
        var storeCodeFilter = GetStoreCodeFilter("v.Almacen");

        return $@"
            SELECT TOP (@Limit)
                v.IdVenta,
                v.NumeroOrden,
                v.Folio AS FolioVenta,
                ISNULL(v.Estacion, '') AS Estacion,
                ISNULL(v.Almacen, '') AS Almacen,
                v.FechaApertura,
                v.FechaCierre,
                v.NumeroMesa,
                v.CodigoCliente,
                NULL AS NombreCliente,
                v.CodigoEmpleado AS CodigoMesero,
                NULL AS NombreMesero,
                v.Observaciones,
                ISNULL(v.Subtotal, 0) AS SubtotalSinImpuestos,
                ISNULL(v.Impuestos, 0) AS TotalImpuestos,
                ISNULL(v.Descuento, 0) AS TotalDescuentos,
                ISNULL(v.Propina, 0) AS TotalPropinas,
                ISNULL(v.Total, 0) AS Total,
                'MXN' AS Moneda,
                ISNULL(v.Cancelada, 0) AS Cancelada,
                ISNULL(v.Pagada, 0) AS Pagada,
                1 AS TipoOrden,
                1 AS NumeroComensales
            FROM dbo.Ventas v
            WHERE v.IdVenta > @LastId
              AND v.FechaCierre IS NOT NULL
              {storeCodeFilter}
            ORDER BY v.IdVenta ASC";
    }

    /// <summary>
    /// Gets the productos query
    /// </summary>
    public string GetProductosQuery(bool includeInactive = false)
    {
        var activeFilter = includeInactive
            ? "1=1"
            : "ISNULL(p.Activo, 1) = 1";

        if (_capabilities.HasCategoriasTable)
        {
            return $@"
                SELECT
                    p.Codigo,
                    p.Descripcion,
                    ISNULL(p.Precio, 0) AS Precio,
                    p.PrecioMayoreo,
                    p.Costo,
                    c.Descripcion AS Categoria,
                    p.CodigoCategoria,
                    ISNULL(p.Activo, 1) AS Activo,
                    ISNULL(p.EsReceta, 0) AS EsReceta,
                    ISNULL(p.EsModificador, 0) AS EsModificador,
                    p.TiempoPreparacion,
                    p.Calorias,
                    p.Alergenos,
                    p.DescripcionMenu,
                    p.Imagen,
                    p.CodigoBarras,
                    ISNULL(p.UnidadMedida, 'PZA') AS UnidadMedida,
                    ISNULL(p.TasaImpuesto, 0) AS TasaImpuesto,
                    ISNULL(p.PrecioIncluyeImpuesto, 0) AS PrecioIncluyeImpuesto,
                    ISNULL(p.Orden, 0) AS Orden,
                    p.Impresora,
                    p.FechaModificacion
                FROM dbo.Productos p
                LEFT JOIN dbo.Categorias c ON p.CodigoCategoria = c.Codigo
                WHERE {activeFilter}
                ORDER BY c.Descripcion, p.Descripcion";
        }

        // Fallback: no Categorias table
        return $@"
            SELECT
                p.Codigo,
                p.Descripcion,
                ISNULL(p.Precio, 0) AS Precio,
                p.PrecioMayoreo,
                p.Costo,
                p.CodigoCategoria AS Categoria,
                p.CodigoCategoria,
                ISNULL(p.Activo, 1) AS Activo,
                ISNULL(p.EsReceta, 0) AS EsReceta,
                ISNULL(p.EsModificador, 0) AS EsModificador,
                p.TiempoPreparacion,
                p.Calorias,
                p.Alergenos,
                p.DescripcionMenu,
                p.Imagen,
                p.CodigoBarras,
                ISNULL(p.UnidadMedida, 'PZA') AS UnidadMedida,
                ISNULL(p.TasaImpuesto, 0) AS TasaImpuesto,
                ISNULL(p.PrecioIncluyeImpuesto, 0) AS PrecioIncluyeImpuesto,
                ISNULL(p.Orden, 0) AS Orden,
                p.Impresora,
                p.FechaModificacion
            FROM dbo.Productos p
            WHERE {activeFilter}
            ORDER BY p.CodigoCategoria, p.Descripcion";
    }

    /// <summary>
    /// Gets the inventario query if supported
    /// </summary>
    public string? GetInventarioQuery()
    {
        if (!_capabilities.HasInventarioTable)
        {
            return null;
        }

        var storeCodeFilter = GetStoreCodeFilter("i.Almacen");

        return $@"
            SELECT
                i.Codigo,
                i.Descripcion,
                ISNULL(i.UnidadMedida, 'PZA') AS UnidadMedida,
                ISNULL(i.ExistenciaActual, 0) AS ExistenciaActual,
                ISNULL(i.ExistenciaMinima, 0) AS ExistenciaMinima,
                i.ExistenciaMaxima,
                ISNULL(i.CostoPromedio, 0) AS CostoPromedio,
                i.UltimoCosto,
                i.UltimaCompra,
                c.Descripcion AS Categoria,
                i.CodigoCategoria,
                ISNULL(i.Activo, 1) AS Activo,
                i.Almacen,
                i.CodigoProveedor,
                p.Nombre AS NombreProveedor,
                i.CodigoBarras,
                ISNULL(i.EsPerecedero, 0) AS EsPerecedero,
                i.DiasVigencia,
                i.UltimoConteo
            FROM dbo.Inventario i
            LEFT JOIN dbo.CategoriasInventario c ON i.CodigoCategoria = c.Codigo
            LEFT JOIN dbo.Proveedores p ON i.CodigoProveedor = p.Codigo
            WHERE ISNULL(i.Activo, 1) = 1
            {storeCodeFilter}
            ORDER BY c.Descripcion, i.Descripcion";
    }

    /// <summary>
    /// Gets the mesas query if supported
    /// </summary>
    public string? GetMesasQuery()
    {
        if (!_capabilities.HasMesasTable)
        {
            return null;
        }

        var comensalesColumn = _capabilities.HasNumeroComensalesColumn
            ? "v.NumeroComensales"
            : "1 AS NumeroComensales";

        return $@"
            SELECT
                m.Numero,
                ISNULL(m.Nombre, m.Numero) AS Nombre,
                ISNULL(m.Capacidad, 4) AS Capacidad,
                m.Seccion,
                CASE
                    WHEN v.IdVenta IS NOT NULL THEN 'Ocupada'
                    ELSE 'Libre'
                END AS Estado,
                v.NumeroOrden AS OrdenActual,
                e.Nombre AS MeseroAsignado,
                v.FechaApertura AS HoraOcupacion,
                {comensalesColumn},
                ISNULL(m.Activo, 1) AS Activo,
                ISNULL(m.Orden, 0) AS Orden,
                m.PosicionX,
                m.PosicionY,
                m.Forma
            FROM dbo.Mesas m
            LEFT JOIN dbo.Ventas v ON m.Numero = v.NumeroMesa AND v.FechaCierre IS NULL AND ISNULL(v.Cancelada, 0) = 0
            LEFT JOIN dbo.Empleados e ON v.CodigoEmpleado = e.Codigo
            WHERE ISNULL(m.Activo, 1) = 1
            ORDER BY m.Seccion, m.Orden, m.Numero";
    }

    /// <summary>
    /// Gets the pagos query if supported
    /// </summary>
    public string? GetPagosQuery()
    {
        if (!_capabilities.HasPagosVentaTable)
        {
            return null;
        }

        return @"
            SELECT
                pv.NumeroOrden,
                fp.Descripcion AS FormaPago,
                pv.Monto,
                pv.Referencia,
                ISNULL(pv.Propina, 0) AS Propina,
                ISNULL(pv.Moneda, 'MXN') AS Moneda,
                ISNULL(pv.TipoCambio, 1) AS TipoCambio,
                pv.Ultimos4Digitos,
                pv.MarcaTarjeta
            FROM dbo.PagosVenta pv
            LEFT JOIN dbo.FormasPago fp ON pv.FormaPago = fp.Codigo
            WHERE pv.NumeroOrden IN ({0})
            ORDER BY pv.NumeroOrden";
    }

    /// <summary>
    /// Gets the detalles query
    /// </summary>
    public string GetDetallesQuery()
    {
        return @"
            SELECT
                d.NumeroOrden,
                d.CodigoProducto AS Codigo,
                ISNULL(p.Descripcion, d.Descripcion) AS Descripcion,
                d.Cantidad,
                d.PrecioUnitario,
                d.Importe,
                ISNULL(d.Descuento, 0) AS Descuento,
                ISNULL(d.Impuesto, 0) AS Impuesto,
                d.Modificadores,
                d.Notas,
                p.CodigoCategoria,
                ISNULL(d.Cancelado, 0) AS Cancelado,
                d.HoraEnvio,
                d.HoraServido
            FROM dbo.DetalleVentas d
            LEFT JOIN dbo.Productos p ON d.CodigoProducto = p.Codigo
            WHERE d.NumeroOrden IN ({0})
            ORDER BY d.NumeroOrden, d.IdDetalle";
    }

    /// <summary>
    /// Gets the detalles query without product join (fallback)
    /// </summary>
    public string GetDetallesQuerySimplified()
    {
        return @"
            SELECT
                d.NumeroOrden,
                d.CodigoProducto AS Codigo,
                d.Descripcion,
                d.Cantidad,
                d.PrecioUnitario,
                d.Importe,
                ISNULL(d.Descuento, 0) AS Descuento,
                ISNULL(d.Impuesto, 0) AS Impuesto,
                d.Modificadores,
                d.Notas,
                NULL AS CodigoCategoria,
                ISNULL(d.Cancelado, 0) AS Cancelado,
                d.HoraEnvio,
                d.HoraServido
            FROM dbo.DetalleVentas d
            WHERE d.NumeroOrden IN ({0})
            ORDER BY d.NumeroOrden, d.IdDetalle";
    }
}
