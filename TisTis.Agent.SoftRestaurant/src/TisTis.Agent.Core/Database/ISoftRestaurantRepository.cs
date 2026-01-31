// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Repository Interface
// Contract for reading data from SR database
// =====================================================

using TisTis.Agent.Core.Database.Models;

namespace TisTis.Agent.Core.Database;

/// <summary>
/// Interface for reading data from Soft Restaurant database.
/// Supports multi-branch filtering via StoreCode (CodigoTienda).
/// </summary>
public interface ISoftRestaurantRepository
{
    /// <summary>
    /// The store code used for filtering queries in multi-branch setups.
    /// Empty string means no filtering (single-store mode).
    /// </summary>
    string StoreCode { get; }

    /// <summary>
    /// Test the database connection
    /// </summary>
    Task<bool> TestConnectionAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get new/modified sales since last sync
    /// </summary>
    /// <param name="sinceId">Get sales with ID greater than this</param>
    /// <param name="limit">Maximum number of sales to return</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<List<SRVenta>> GetNewVentasAsync(long sinceId = 0, int limit = 100, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all products/menu items
    /// </summary>
    /// <param name="includeInactive">Include inactive products</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<List<SRProducto>> GetProductosAsync(bool includeInactive = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get products modified since a specific date
    /// </summary>
    Task<List<SRProducto>> GetModifiedProductosAsync(DateTime since, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all inventory items
    /// </summary>
    Task<List<SRInventario>> GetInventarioAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get inventory items with low stock
    /// </summary>
    Task<List<SRInventario>> GetLowStockItemsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all tables with current status
    /// </summary>
    Task<List<SRMesa>> GetMesasAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get the highest synced venta ID
    /// </summary>
    Task<long> GetMaxVentaIdAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get database statistics
    /// </summary>
    Task<DatabaseStats> GetStatsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Update the last synced timestamp/ID
    /// </summary>
    void UpdateSyncPosition(long lastVentaId);
}

/// <summary>
/// Statistics about the SR database
/// </summary>
public class DatabaseStats
{
    public int TotalProductos { get; set; }
    public int ProductosActivos { get; set; }
    public int TotalInventario { get; set; }
    public int ItemsBajoStock { get; set; }
    public int TotalMesas { get; set; }
    public int MesasOcupadas { get; set; }
    public long TotalVentas { get; set; }
    public decimal VentasHoy { get; set; }
    public DateTime? UltimaVenta { get; set; }
}
