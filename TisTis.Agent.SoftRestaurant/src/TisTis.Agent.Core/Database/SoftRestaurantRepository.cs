// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Repository
// Reads data from SR SQL Server database
// =====================================================

using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Database.Models;
using TisTis.Agent.Core.Configuration;

namespace TisTis.Agent.Core.Database;

/// <summary>
/// Repository for reading data from Soft Restaurant SQL Server database.
/// Supports multi-branch filtering via StoreCode (CodigoTienda/Almacen).
/// </summary>
public class SoftRestaurantRepository : ISoftRestaurantRepository
{
    private readonly string _connectionString;
    private readonly ILogger<SoftRestaurantRepository> _logger;
    private readonly int _queryTimeout;
    private readonly string _storeCode;

    // Track last synced position for incremental sync (thread-safe access via Interlocked)
    private long _lastSyncedVentaId = 0;

    /// <inheritdoc />
    public string StoreCode => _storeCode;

    public SoftRestaurantRepository(
        SoftRestaurantOptions options,
        ILogger<SoftRestaurantRepository> logger)
    {
        _connectionString = options.ConnectionString;
        _logger = logger;
        _queryTimeout = options.QueryTimeoutSeconds;
        _storeCode = options.StoreCode ?? string.Empty;

        if (!string.IsNullOrEmpty(_storeCode))
        {
            _logger.LogInformation("Repository initialized with StoreCode filter: {StoreCode}", _storeCode);
        }
    }

    /// <inheritdoc />
    public async Task<bool> TestConnectionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand("SELECT 1", connection);
            command.CommandTimeout = 5;
            await command.ExecuteScalarAsync(cancellationToken);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Connection test failed");
            return false;
        }
    }

    /// <inheritdoc />
    public async Task<List<SRVenta>> GetNewVentasAsync(long sinceId = 0, int limit = 100, CancellationToken cancellationToken = default)
    {
        var ventas = new List<SRVenta>();
        var effectiveSinceId = sinceId > 0 ? sinceId : Interlocked.Read(ref _lastSyncedVentaId);

        // FIX S16: Added ISNULL(v.Moneda, 'MXN') AS Moneda to capture currency data
        // MULTI-BRANCH: Added optional StoreCode filter for multi-branch restaurants
        var storeCodeFilter = string.IsNullOrEmpty(_storeCode)
            ? string.Empty
            : "AND v.Almacen = @StoreCode";

        var query = $@"
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
                ISNULL(v.Moneda, 'MXN') AS Moneda,
                ISNULL(v.Cancelada, 0) AS Cancelada,
                ISNULL(v.Pagada, 0) AS Pagada,
                ISNULL(v.TipoOrden, 1) AS TipoOrden,
                ISNULL(v.NumeroComensales, 1) AS NumeroComensales
            FROM dbo.Ventas v
            LEFT JOIN dbo.Clientes c ON v.CodigoCliente = c.Codigo
            LEFT JOIN dbo.Empleados e ON v.CodigoEmpleado = e.Codigo
            WHERE v.IdVenta > @LastId
              AND v.FechaCierre IS NOT NULL
              {storeCodeFilter}
            ORDER BY v.IdVenta ASC";

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(query, connection);
            command.CommandTimeout = _queryTimeout;
            command.Parameters.AddWithValue("@Limit", limit);
            command.Parameters.AddWithValue("@LastId", effectiveSinceId);

            // Add StoreCode parameter if filtering by store
            if (!string.IsNullOrEmpty(_storeCode))
            {
                command.Parameters.AddWithValue("@StoreCode", _storeCode);
            }

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                var venta = MapVentaFromReader(reader);
                ventas.Add(venta);

                // Update tracking (thread-safe compare and exchange)
                long currentMax;
                do
                {
                    currentMax = Interlocked.Read(ref _lastSyncedVentaId);
                    if (venta.IdVenta <= currentMax) break;
                } while (Interlocked.CompareExchange(ref _lastSyncedVentaId, venta.IdVenta, currentMax) != currentMax);
            }

            await reader.CloseAsync();

            // FIX S2: Batch load details and payments (eliminates N+1 problem)
            // Instead of 2*N queries, we now do just 2 additional queries total
            if (ventas.Count > 0)
            {
                var orderNumbers = ventas.Select(v => v.NumeroOrden).ToList();
                var allDetalles = await GetVentaDetallesBatchAsync(orderNumbers, connection, cancellationToken);
                var allPagos = await GetVentaPagosBatchAsync(orderNumbers, connection, cancellationToken);

                // Distribute to each venta
                foreach (var venta in ventas)
                {
                    venta.Detalles = allDetalles.TryGetValue(venta.NumeroOrden, out var detalles)
                        ? detalles
                        : new List<SRVentaDetalle>();
                    venta.Pagos = allPagos.TryGetValue(venta.NumeroOrden, out var pagos)
                        ? pagos
                        : new List<SRPago>();
                }
            }

            var storeInfo = string.IsNullOrEmpty(_storeCode) ? "all stores" : $"store '{_storeCode}'";
            _logger.LogDebug("Retrieved {Count} new ventas since ID {LastId} for {StoreInfo} (batch loaded)",
                ventas.Count, effectiveSinceId, storeInfo);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching ventas");
            throw;
        }

        return ventas;
    }

    /// <inheritdoc />
    public async Task<List<SRProducto>> GetProductosAsync(bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        var productos = new List<SRProducto>();

        const string query = @"
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
            WHERE (@IncludeInactive = 1 OR ISNULL(p.Activo, 1) = 1)
            ORDER BY c.Descripcion, p.Descripcion";

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(query, connection);
            command.CommandTimeout = _queryTimeout;
            command.Parameters.AddWithValue("@IncludeInactive", includeInactive ? 1 : 0);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                productos.Add(MapProductoFromReader(reader));
            }

            _logger.LogDebug("Retrieved {Count} productos", productos.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching productos");
            throw;
        }

        return productos;
    }

    /// <inheritdoc />
    public async Task<List<SRProducto>> GetModifiedProductosAsync(DateTime since, CancellationToken cancellationToken = default)
    {
        var productos = new List<SRProducto>();

        const string query = @"
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
            WHERE p.FechaModificacion > @Since
            ORDER BY p.FechaModificacion";

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(query, connection);
            command.CommandTimeout = _queryTimeout;
            command.Parameters.AddWithValue("@Since", since);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                productos.Add(MapProductoFromReader(reader));
            }

            _logger.LogDebug("Retrieved {Count} modified productos since {Since}", productos.Count, since);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching modified productos");
            throw;
        }

        return productos;
    }

    /// <inheritdoc />
    public async Task<List<SRInventario>> GetInventarioAsync(CancellationToken cancellationToken = default)
    {
        var items = new List<SRInventario>();

        // MULTI-BRANCH: Added optional StoreCode filter for multi-branch restaurants
        var storeCodeFilter = string.IsNullOrEmpty(_storeCode)
            ? string.Empty
            : "AND i.Almacen = @StoreCode";

        var query = $@"
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

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(query, connection);
            command.CommandTimeout = _queryTimeout;

            // Add StoreCode parameter if filtering by store
            if (!string.IsNullOrEmpty(_storeCode))
            {
                command.Parameters.AddWithValue("@StoreCode", _storeCode);
            }

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(MapInventarioFromReader(reader));
            }

            var storeInfo = string.IsNullOrEmpty(_storeCode) ? "all stores" : $"store '{_storeCode}'";
            _logger.LogDebug("Retrieved {Count} inventory items for {StoreInfo}", items.Count, storeInfo);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching inventario");
            throw;
        }

        return items;
    }

    /// <inheritdoc />
    public async Task<List<SRInventario>> GetLowStockItemsAsync(CancellationToken cancellationToken = default)
    {
        var items = await GetInventarioAsync(cancellationToken);
        return items.Where(i => i.StockBajo).ToList();
    }

    /// <inheritdoc />
    public async Task<List<SRMesa>> GetMesasAsync(CancellationToken cancellationToken = default)
    {
        var mesas = new List<SRMesa>();

        const string query = @"
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
                v.NumeroComensales,
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

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(query, connection);
            command.CommandTimeout = _queryTimeout;

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                mesas.Add(MapMesaFromReader(reader));
            }

            _logger.LogDebug("Retrieved {Count} mesas", mesas.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching mesas");
            throw;
        }

        return mesas;
    }

    /// <inheritdoc />
    public async Task<long> GetMaxVentaIdAsync(CancellationToken cancellationToken = default)
    {
        const string query = "SELECT ISNULL(MAX(IdVenta), 0) FROM dbo.Ventas";

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(query, connection);
        command.CommandTimeout = _queryTimeout;

        // FIX S3: SQL Server may return int (when value fits in 32 bits) or long
        // Use Convert.ToInt64 which handles both int and long correctly
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result != null && result != DBNull.Value ? Convert.ToInt64(result) : 0L;
    }

    /// <inheritdoc />
    public async Task<DatabaseStats> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        var stats = new DatabaseStats();

        const string query = @"
            SELECT
                (SELECT COUNT(*) FROM dbo.Productos) AS TotalProductos,
                (SELECT COUNT(*) FROM dbo.Productos WHERE ISNULL(Activo, 1) = 1) AS ProductosActivos,
                (SELECT COUNT(*) FROM dbo.Inventario WHERE ISNULL(Activo, 1) = 1) AS TotalInventario,
                (SELECT COUNT(*) FROM dbo.Inventario WHERE ISNULL(Activo, 1) = 1 AND ExistenciaActual <= ExistenciaMinima) AS ItemsBajoStock,
                (SELECT COUNT(*) FROM dbo.Mesas WHERE ISNULL(Activo, 1) = 1) AS TotalMesas,
                (SELECT COUNT(*) FROM dbo.Mesas m WHERE ISNULL(m.Activo, 1) = 1 AND EXISTS(SELECT 1 FROM dbo.Ventas v WHERE v.NumeroMesa = m.Numero AND v.FechaCierre IS NULL)) AS MesasOcupadas,
                (SELECT COUNT(*) FROM dbo.Ventas) AS TotalVentas,
                (SELECT ISNULL(SUM(Total), 0) FROM dbo.Ventas WHERE CAST(FechaCierre AS DATE) = CAST(GETDATE() AS DATE) AND ISNULL(Cancelada, 0) = 0) AS VentasHoy,
                (SELECT MAX(FechaCierre) FROM dbo.Ventas) AS UltimaVenta";

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(query, connection);
            command.CommandTimeout = _queryTimeout;

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            if (await reader.ReadAsync(cancellationToken))
            {
                stats.TotalProductos = reader.GetInt32(0);
                stats.ProductosActivos = reader.GetInt32(1);
                stats.TotalInventario = reader.GetInt32(2);
                stats.ItemsBajoStock = reader.GetInt32(3);
                stats.TotalMesas = reader.GetInt32(4);
                stats.MesasOcupadas = reader.GetInt32(5);
                stats.TotalVentas = reader.GetInt64(6);
                stats.VentasHoy = reader.GetDecimal(7);
                stats.UltimaVenta = reader.IsDBNull(8) ? null : reader.GetDateTime(8);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error fetching stats (some tables may not exist)");
        }

        return stats;
    }

    /// <inheritdoc />
    public void UpdateSyncPosition(long lastVentaId)
    {
        Interlocked.Exchange(ref _lastSyncedVentaId, lastVentaId);
    }

    #region Private Helpers

    private async Task<List<SRVentaDetalle>> GetVentaDetallesAsync(string numeroOrden, SqlConnection connection, CancellationToken cancellationToken)
    {
        var detalles = new List<SRVentaDetalle>();

        const string query = @"
            SELECT
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
            WHERE d.NumeroOrden = @NumeroOrden
            ORDER BY d.IdDetalle";

        await using var command = new SqlCommand(query, connection);
        command.CommandTimeout = _queryTimeout;
        command.Parameters.AddWithValue("@NumeroOrden", numeroOrden);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            detalles.Add(new SRVentaDetalle
            {
                Codigo = reader.GetString(reader.GetOrdinal("Codigo")),
                Descripcion = reader.GetString(reader.GetOrdinal("Descripcion")),
                Cantidad = reader.GetDecimal(reader.GetOrdinal("Cantidad")),
                PrecioUnitario = reader.GetDecimal(reader.GetOrdinal("PrecioUnitario")),
                Importe = reader.GetDecimal(reader.GetOrdinal("Importe")),
                Descuento = reader.GetDecimal(reader.GetOrdinal("Descuento")),
                Impuesto = reader.GetDecimal(reader.GetOrdinal("Impuesto")),
                Modificadores = reader.IsDBNull(reader.GetOrdinal("Modificadores")) ? null : reader.GetString(reader.GetOrdinal("Modificadores")),
                Notas = reader.IsDBNull(reader.GetOrdinal("Notas")) ? null : reader.GetString(reader.GetOrdinal("Notas")),
                CodigoCategoria = reader.IsDBNull(reader.GetOrdinal("CodigoCategoria")) ? null : reader.GetString(reader.GetOrdinal("CodigoCategoria")),
                Cancelado = reader.GetBoolean(reader.GetOrdinal("Cancelado")),
                HoraEnvio = reader.IsDBNull(reader.GetOrdinal("HoraEnvio")) ? null : reader.GetDateTime(reader.GetOrdinal("HoraEnvio")),
                HoraServido = reader.IsDBNull(reader.GetOrdinal("HoraServido")) ? null : reader.GetDateTime(reader.GetOrdinal("HoraServido"))
            });
        }

        return detalles;
    }

    private async Task<List<SRPago>> GetVentaPagosAsync(string numeroOrden, SqlConnection connection, CancellationToken cancellationToken)
    {
        var pagos = new List<SRPago>();

        const string query = @"
            SELECT
                ISNULL(f.Descripcion, p.FormaPago) AS FormaPago,
                p.Monto,
                p.Referencia,
                ISNULL(p.Propina, 0) AS Propina,
                ISNULL(p.Moneda, 'MXN') AS Moneda,
                ISNULL(p.TipoCambio, 1) AS TipoCambio,
                p.Ultimos4Digitos,
                p.MarcaTarjeta
            FROM dbo.PagosVenta p
            LEFT JOIN dbo.FormasPago f ON p.FormaPago = f.Codigo
            WHERE p.NumeroOrden = @NumeroOrden";

        await using var command = new SqlCommand(query, connection);
        command.CommandTimeout = _queryTimeout;
        command.Parameters.AddWithValue("@NumeroOrden", numeroOrden);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            pagos.Add(new SRPago
            {
                FormaPago = reader.GetString(reader.GetOrdinal("FormaPago")),
                Monto = reader.GetDecimal(reader.GetOrdinal("Monto")),
                Referencia = reader.IsDBNull(reader.GetOrdinal("Referencia")) ? null : reader.GetString(reader.GetOrdinal("Referencia")),
                Propina = reader.GetDecimal(reader.GetOrdinal("Propina")),
                Moneda = reader.GetString(reader.GetOrdinal("Moneda")),
                TipoCambio = reader.GetDecimal(reader.GetOrdinal("TipoCambio")),
                Ultimos4Digitos = reader.IsDBNull(reader.GetOrdinal("Ultimos4Digitos")) ? null : reader.GetString(reader.GetOrdinal("Ultimos4Digitos")),
                MarcaTarjeta = reader.IsDBNull(reader.GetOrdinal("MarcaTarjeta")) ? null : reader.GetString(reader.GetOrdinal("MarcaTarjeta"))
            });
        }

        return pagos;
    }

    /// <summary>
    /// FIX S2: Batch load detalles for multiple orders in a single query.
    /// Uses parameterized IN clause to prevent SQL injection.
    /// </summary>
    private async Task<Dictionary<string, List<SRVentaDetalle>>> GetVentaDetallesBatchAsync(
        List<string> orderNumbers,
        SqlConnection connection,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, List<SRVentaDetalle>>();

        if (orderNumbers.Count == 0)
            return result;

        // Initialize empty lists for all orders
        foreach (var orderNumber in orderNumbers)
        {
            result[orderNumber] = new List<SRVentaDetalle>();
        }

        // Build parameterized query with IN clause
        var parameters = new List<SqlParameter>();
        var paramNames = new List<string>();

        for (int i = 0; i < orderNumbers.Count; i++)
        {
            var paramName = $"@p{i}";
            paramNames.Add(paramName);
            parameters.Add(new SqlParameter(paramName, orderNumbers[i]));
        }

        var query = $@"
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
            WHERE d.NumeroOrden IN ({string.Join(",", paramNames)})
            ORDER BY d.NumeroOrden, d.IdDetalle";

        await using var command = new SqlCommand(query, connection);
        command.CommandTimeout = _queryTimeout;
        command.Parameters.AddRange(parameters.ToArray());

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var numeroOrden = reader.GetString(reader.GetOrdinal("NumeroOrden"));

            var detalle = new SRVentaDetalle
            {
                Codigo = reader.GetString(reader.GetOrdinal("Codigo")),
                Descripcion = reader.GetString(reader.GetOrdinal("Descripcion")),
                Cantidad = reader.GetDecimal(reader.GetOrdinal("Cantidad")),
                PrecioUnitario = reader.GetDecimal(reader.GetOrdinal("PrecioUnitario")),
                Importe = reader.GetDecimal(reader.GetOrdinal("Importe")),
                Descuento = reader.GetDecimal(reader.GetOrdinal("Descuento")),
                Impuesto = reader.GetDecimal(reader.GetOrdinal("Impuesto")),
                Modificadores = reader.IsDBNull(reader.GetOrdinal("Modificadores")) ? null : reader.GetString(reader.GetOrdinal("Modificadores")),
                Notas = reader.IsDBNull(reader.GetOrdinal("Notas")) ? null : reader.GetString(reader.GetOrdinal("Notas")),
                CodigoCategoria = reader.IsDBNull(reader.GetOrdinal("CodigoCategoria")) ? null : reader.GetString(reader.GetOrdinal("CodigoCategoria")),
                Cancelado = reader.GetBoolean(reader.GetOrdinal("Cancelado")),
                HoraEnvio = reader.IsDBNull(reader.GetOrdinal("HoraEnvio")) ? null : reader.GetDateTime(reader.GetOrdinal("HoraEnvio")),
                HoraServido = reader.IsDBNull(reader.GetOrdinal("HoraServido")) ? null : reader.GetDateTime(reader.GetOrdinal("HoraServido"))
            };

            result[numeroOrden].Add(detalle);
        }

        return result;
    }

    /// <summary>
    /// FIX S2: Batch load pagos for multiple orders in a single query.
    /// Uses parameterized IN clause to prevent SQL injection.
    /// </summary>
    private async Task<Dictionary<string, List<SRPago>>> GetVentaPagosBatchAsync(
        List<string> orderNumbers,
        SqlConnection connection,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, List<SRPago>>();

        if (orderNumbers.Count == 0)
            return result;

        // Initialize empty lists for all orders
        foreach (var orderNumber in orderNumbers)
        {
            result[orderNumber] = new List<SRPago>();
        }

        // Build parameterized query with IN clause
        var parameters = new List<SqlParameter>();
        var paramNames = new List<string>();

        for (int i = 0; i < orderNumbers.Count; i++)
        {
            var paramName = $"@p{i}";
            paramNames.Add(paramName);
            parameters.Add(new SqlParameter(paramName, orderNumbers[i]));
        }

        var query = $@"
            SELECT
                p.NumeroOrden,
                ISNULL(f.Descripcion, p.FormaPago) AS FormaPago,
                p.Monto,
                p.Referencia,
                ISNULL(p.Propina, 0) AS Propina,
                ISNULL(p.Moneda, 'MXN') AS Moneda,
                ISNULL(p.TipoCambio, 1) AS TipoCambio,
                p.Ultimos4Digitos,
                p.MarcaTarjeta
            FROM dbo.PagosVenta p
            LEFT JOIN dbo.FormasPago f ON p.FormaPago = f.Codigo
            WHERE p.NumeroOrden IN ({string.Join(",", paramNames)})
            ORDER BY p.NumeroOrden";

        await using var command = new SqlCommand(query, connection);
        command.CommandTimeout = _queryTimeout;
        command.Parameters.AddRange(parameters.ToArray());

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var numeroOrden = reader.GetString(reader.GetOrdinal("NumeroOrden"));

            var pago = new SRPago
            {
                FormaPago = reader.GetString(reader.GetOrdinal("FormaPago")),
                Monto = reader.GetDecimal(reader.GetOrdinal("Monto")),
                Referencia = reader.IsDBNull(reader.GetOrdinal("Referencia")) ? null : reader.GetString(reader.GetOrdinal("Referencia")),
                Propina = reader.GetDecimal(reader.GetOrdinal("Propina")),
                Moneda = reader.GetString(reader.GetOrdinal("Moneda")),
                TipoCambio = reader.GetDecimal(reader.GetOrdinal("TipoCambio")),
                Ultimos4Digitos = reader.IsDBNull(reader.GetOrdinal("Ultimos4Digitos")) ? null : reader.GetString(reader.GetOrdinal("Ultimos4Digitos")),
                MarcaTarjeta = reader.IsDBNull(reader.GetOrdinal("MarcaTarjeta")) ? null : reader.GetString(reader.GetOrdinal("MarcaTarjeta"))
            };

            result[numeroOrden].Add(pago);
        }

        return result;
    }

    private SRVenta MapVentaFromReader(SqlDataReader reader)
    {
        return new SRVenta
        {
            IdVenta = reader.GetInt64(reader.GetOrdinal("IdVenta")),
            NumeroOrden = reader.GetString(reader.GetOrdinal("NumeroOrden")),
            FolioVenta = reader.GetString(reader.GetOrdinal("FolioVenta")),
            Estacion = reader.GetString(reader.GetOrdinal("Estacion")),
            Almacen = reader.GetString(reader.GetOrdinal("Almacen")),
            FechaApertura = reader.GetDateTime(reader.GetOrdinal("FechaApertura")),
            FechaCierre = reader.IsDBNull(reader.GetOrdinal("FechaCierre")) ? null : reader.GetDateTime(reader.GetOrdinal("FechaCierre")),
            NumeroMesa = reader.IsDBNull(reader.GetOrdinal("NumeroMesa")) ? null : reader.GetString(reader.GetOrdinal("NumeroMesa")),
            CodigoCliente = reader.IsDBNull(reader.GetOrdinal("CodigoCliente")) ? null : reader.GetString(reader.GetOrdinal("CodigoCliente")),
            NombreCliente = reader.IsDBNull(reader.GetOrdinal("NombreCliente")) ? null : reader.GetString(reader.GetOrdinal("NombreCliente")),
            CodigoMesero = reader.IsDBNull(reader.GetOrdinal("CodigoMesero")) ? null : reader.GetString(reader.GetOrdinal("CodigoMesero")),
            NombreMesero = reader.IsDBNull(reader.GetOrdinal("NombreMesero")) ? null : reader.GetString(reader.GetOrdinal("NombreMesero")),
            Observaciones = reader.IsDBNull(reader.GetOrdinal("Observaciones")) ? null : reader.GetString(reader.GetOrdinal("Observaciones")),
            SubtotalSinImpuestos = reader.GetDecimal(reader.GetOrdinal("SubtotalSinImpuestos")),
            TotalImpuestos = reader.GetDecimal(reader.GetOrdinal("TotalImpuestos")),
            TotalDescuentos = reader.GetDecimal(reader.GetOrdinal("TotalDescuentos")),
            TotalPropinas = reader.GetDecimal(reader.GetOrdinal("TotalPropinas")),
            Total = reader.GetDecimal(reader.GetOrdinal("Total")),
            Moneda = reader.GetString(reader.GetOrdinal("Moneda")), // FIX S16: Read currency from DB
            Cancelada = reader.GetBoolean(reader.GetOrdinal("Cancelada")),
            Pagada = reader.GetBoolean(reader.GetOrdinal("Pagada")),
            TipoOrden = reader.GetInt32(reader.GetOrdinal("TipoOrden")),
            NumeroComensales = reader.GetInt32(reader.GetOrdinal("NumeroComensales"))
        };
    }

    private SRProducto MapProductoFromReader(SqlDataReader reader)
    {
        return new SRProducto
        {
            Codigo = reader.GetString(reader.GetOrdinal("Codigo")),
            Descripcion = reader.GetString(reader.GetOrdinal("Descripcion")),
            Precio = reader.GetDecimal(reader.GetOrdinal("Precio")),
            PrecioMayoreo = reader.IsDBNull(reader.GetOrdinal("PrecioMayoreo")) ? null : reader.GetDecimal(reader.GetOrdinal("PrecioMayoreo")),
            Costo = reader.IsDBNull(reader.GetOrdinal("Costo")) ? null : reader.GetDecimal(reader.GetOrdinal("Costo")),
            Categoria = reader.IsDBNull(reader.GetOrdinal("Categoria")) ? null : reader.GetString(reader.GetOrdinal("Categoria")),
            CodigoCategoria = reader.IsDBNull(reader.GetOrdinal("CodigoCategoria")) ? null : reader.GetString(reader.GetOrdinal("CodigoCategoria")),
            Activo = reader.GetBoolean(reader.GetOrdinal("Activo")),
            EsReceta = reader.GetBoolean(reader.GetOrdinal("EsReceta")),
            EsModificador = reader.GetBoolean(reader.GetOrdinal("EsModificador")),
            TiempoPreparacion = reader.IsDBNull(reader.GetOrdinal("TiempoPreparacion")) ? null : reader.GetInt32(reader.GetOrdinal("TiempoPreparacion")),
            Calorias = reader.IsDBNull(reader.GetOrdinal("Calorias")) ? null : reader.GetInt32(reader.GetOrdinal("Calorias")),
            Alergenos = reader.IsDBNull(reader.GetOrdinal("Alergenos")) ? null : reader.GetString(reader.GetOrdinal("Alergenos")),
            DescripcionMenu = reader.IsDBNull(reader.GetOrdinal("DescripcionMenu")) ? null : reader.GetString(reader.GetOrdinal("DescripcionMenu")),
            Imagen = reader.IsDBNull(reader.GetOrdinal("Imagen")) ? null : reader.GetString(reader.GetOrdinal("Imagen")),
            CodigoBarras = reader.IsDBNull(reader.GetOrdinal("CodigoBarras")) ? null : reader.GetString(reader.GetOrdinal("CodigoBarras")),
            UnidadMedida = reader.GetString(reader.GetOrdinal("UnidadMedida")),
            TasaImpuesto = reader.GetDecimal(reader.GetOrdinal("TasaImpuesto")),
            PrecioIncluyeImpuesto = reader.GetBoolean(reader.GetOrdinal("PrecioIncluyeImpuesto")),
            Orden = reader.GetInt32(reader.GetOrdinal("Orden")),
            Impresora = reader.IsDBNull(reader.GetOrdinal("Impresora")) ? null : reader.GetString(reader.GetOrdinal("Impresora")),
            FechaModificacion = reader.IsDBNull(reader.GetOrdinal("FechaModificacion")) ? null : reader.GetDateTime(reader.GetOrdinal("FechaModificacion"))
        };
    }

    private SRInventario MapInventarioFromReader(SqlDataReader reader)
    {
        return new SRInventario
        {
            Codigo = reader.GetString(reader.GetOrdinal("Codigo")),
            Descripcion = reader.GetString(reader.GetOrdinal("Descripcion")),
            UnidadMedida = reader.GetString(reader.GetOrdinal("UnidadMedida")),
            ExistenciaActual = reader.GetDecimal(reader.GetOrdinal("ExistenciaActual")),
            ExistenciaMinima = reader.GetDecimal(reader.GetOrdinal("ExistenciaMinima")),
            ExistenciaMaxima = reader.IsDBNull(reader.GetOrdinal("ExistenciaMaxima")) ? null : reader.GetDecimal(reader.GetOrdinal("ExistenciaMaxima")),
            CostoPromedio = reader.GetDecimal(reader.GetOrdinal("CostoPromedio")),
            UltimoCosto = reader.IsDBNull(reader.GetOrdinal("UltimoCosto")) ? null : reader.GetDecimal(reader.GetOrdinal("UltimoCosto")),
            UltimaCompra = reader.IsDBNull(reader.GetOrdinal("UltimaCompra")) ? null : reader.GetDateTime(reader.GetOrdinal("UltimaCompra")),
            Categoria = reader.IsDBNull(reader.GetOrdinal("Categoria")) ? null : reader.GetString(reader.GetOrdinal("Categoria")),
            CodigoCategoria = reader.IsDBNull(reader.GetOrdinal("CodigoCategoria")) ? null : reader.GetString(reader.GetOrdinal("CodigoCategoria")),
            Activo = reader.GetBoolean(reader.GetOrdinal("Activo")),
            Almacen = reader.IsDBNull(reader.GetOrdinal("Almacen")) ? null : reader.GetString(reader.GetOrdinal("Almacen")),
            CodigoProveedor = reader.IsDBNull(reader.GetOrdinal("CodigoProveedor")) ? null : reader.GetString(reader.GetOrdinal("CodigoProveedor")),
            NombreProveedor = reader.IsDBNull(reader.GetOrdinal("NombreProveedor")) ? null : reader.GetString(reader.GetOrdinal("NombreProveedor")),
            CodigoBarras = reader.IsDBNull(reader.GetOrdinal("CodigoBarras")) ? null : reader.GetString(reader.GetOrdinal("CodigoBarras")),
            EsPerecedero = reader.GetBoolean(reader.GetOrdinal("EsPerecedero")),
            DiasVigencia = reader.IsDBNull(reader.GetOrdinal("DiasVigencia")) ? null : reader.GetInt32(reader.GetOrdinal("DiasVigencia")),
            UltimoConteo = reader.IsDBNull(reader.GetOrdinal("UltimoConteo")) ? null : reader.GetDateTime(reader.GetOrdinal("UltimoConteo"))
        };
    }

    private SRMesa MapMesaFromReader(SqlDataReader reader)
    {
        return new SRMesa
        {
            Numero = reader.GetString(reader.GetOrdinal("Numero")),
            Nombre = reader.GetString(reader.GetOrdinal("Nombre")),
            Capacidad = reader.GetInt32(reader.GetOrdinal("Capacidad")),
            Seccion = reader.IsDBNull(reader.GetOrdinal("Seccion")) ? null : reader.GetString(reader.GetOrdinal("Seccion")),
            Estado = reader.GetString(reader.GetOrdinal("Estado")),
            OrdenActual = reader.IsDBNull(reader.GetOrdinal("OrdenActual")) ? null : reader.GetString(reader.GetOrdinal("OrdenActual")),
            MeseroAsignado = reader.IsDBNull(reader.GetOrdinal("MeseroAsignado")) ? null : reader.GetString(reader.GetOrdinal("MeseroAsignado")),
            HoraOcupacion = reader.IsDBNull(reader.GetOrdinal("HoraOcupacion")) ? null : reader.GetDateTime(reader.GetOrdinal("HoraOcupacion")),
            NumeroComensales = reader.IsDBNull(reader.GetOrdinal("NumeroComensales")) ? null : reader.GetInt32(reader.GetOrdinal("NumeroComensales")),
            Activo = reader.GetBoolean(reader.GetOrdinal("Activo")),
            Orden = reader.GetInt32(reader.GetOrdinal("Orden")),
            PosicionX = reader.IsDBNull(reader.GetOrdinal("PosicionX")) ? null : reader.GetInt32(reader.GetOrdinal("PosicionX")),
            PosicionY = reader.IsDBNull(reader.GetOrdinal("PosicionY")) ? null : reader.GetInt32(reader.GetOrdinal("PosicionY")),
            Forma = reader.IsDBNull(reader.GetOrdinal("Forma")) ? null : reader.GetString(reader.GetOrdinal("Forma"))
        };
    }

    #endregion
}
