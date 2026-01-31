// =====================================================
// TIS TIS PLATFORM - Sync Engine
// Main synchronization orchestrator
// =====================================================

using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Api;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Database;
using TisTis.Agent.Core.Sync.Transformers;

namespace TisTis.Agent.Core.Sync;

/// <summary>
/// Main synchronization engine that coordinates data flow from SR to TIS TIS
/// </summary>
public class SyncEngine : ISyncEngine, IDisposable
{
    private readonly ISoftRestaurantRepository _repository;
    private readonly ITisTisApiClient _apiClient;
    private readonly ISyncStateService _stateService;
    private readonly ILogger<SyncEngine> _logger;
    private readonly SyncOptions _options;

    // Transformers are stateless - use static readonly instances for efficiency
    private static readonly VentasTransformer VentasTransformer = new();
    private static readonly ProductosTransformer ProductosTransformer = new();
    private static readonly InventarioTransformer InventarioTransformer = new();
    private static readonly MesasTransformer MesasTransformer = new();

    private readonly SyncStatistics _statistics;
    private readonly object _stateLock = new();
    private CancellationTokenSource? _cts;
    private Task? _syncTask;
    private DateTime? _lastFullSyncAt;
    private long _lastSyncedSaleId; // Track last synced sale ID for incremental sync (FIX S1)
    private volatile SyncEngineState _state = SyncEngineState.Stopped;
    private bool _disposed;

    /// <inheritdoc />
    public SyncEngineState State
    {
        get => _state;
        private set
        {
            lock (_stateLock)
            {
                _state = value;
            }
        }
    }

    public SyncEngine(
        ISoftRestaurantRepository repository,
        ITisTisApiClient apiClient,
        ISyncStateService stateService,
        SyncOptions options,
        ILogger<SyncEngine> logger)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _apiClient = apiClient ?? throw new ArgumentNullException(nameof(apiClient));
        _stateService = stateService ?? throw new ArgumentNullException(nameof(stateService));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        _statistics = new SyncStatistics { StartedAt = DateTime.UtcNow };
    }

    /// <inheritdoc />
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (State == SyncEngineState.Running)
        {
            _logger.LogWarning("Sync engine is already running");
            return;
        }

        State = SyncEngineState.Starting;
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _statistics.StartedAt = DateTime.UtcNow;

        _logger.LogInformation(
            "Starting sync engine. Interval: {Interval}s, Sales: {Sales}, Menu: {Menu}, Inventory: {Inv}, Tables: {Tables}",
            _options.IntervalSeconds,
            _options.SyncSales,
            _options.SyncMenu,
            _options.SyncInventory,
            _options.SyncTables);

        // Load persisted sync state (FIX S1 + M1: survive restarts)
        try
        {
            _lastSyncedSaleId = await _stateService.GetLastSyncPositionAsync(SyncType.Sales, cancellationToken);
            var state = await _stateService.GetStateAsync(cancellationToken);
            _lastFullSyncAt = state.LastFullSyncAt;

            _logger.LogInformation(
                "Loaded sync state. LastSyncedSaleId: {LastId}, LastFullSync: {LastFull}",
                _lastSyncedSaleId,
                _lastFullSyncAt?.ToString("O") ?? "never");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load sync state, starting fresh");
            _lastSyncedSaleId = 0;
        }

        // Test database connection
        if (!await _repository.TestConnectionAsync(cancellationToken))
        {
            State = SyncEngineState.Error;
            _logger.LogError("Failed to connect to Soft Restaurant database");
            throw new InvalidOperationException("Database connection failed");
        }

        State = SyncEngineState.Running;

        // Start the sync loop
        _syncTask = RunSyncLoopAsync(_cts.Token);
    }

    /// <inheritdoc />
    public async Task StopAsync()
    {
        if (State == SyncEngineState.Stopped)
        {
            return;
        }

        State = SyncEngineState.Stopping;
        _logger.LogInformation("Stopping sync engine...");

        try
        {
            _cts?.Cancel();
        }
        catch (ObjectDisposedException)
        {
            // Already disposed
        }

        if (_syncTask != null)
        {
            try
            {
                await _syncTask.WaitAsync(TimeSpan.FromSeconds(30));
            }
            catch (OperationCanceledException)
            {
                // Expected
            }
            catch (TimeoutException)
            {
                _logger.LogWarning("Sync engine did not stop gracefully within timeout");
            }
        }

        // Dispose CancellationTokenSource to prevent memory leak
        DisposeCts();

        State = SyncEngineState.Stopped;
        _logger.LogInformation("Sync engine stopped");
    }

    private void DisposeCts()
    {
        if (_cts != null)
        {
            try
            {
                _cts.Dispose();
            }
            catch (ObjectDisposedException)
            {
                // Already disposed
            }
            finally
            {
                _cts = null;
            }
        }
    }

    /// <summary>
    /// Dispose resources
    /// </summary>
    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Dispose pattern implementation
    /// </summary>
    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        if (disposing)
        {
            // Stop the engine if running
            if (State != SyncEngineState.Stopped)
            {
                try
                {
                    StopAsync().GetAwaiter().GetResult();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error stopping sync engine during disposal");
                }
            }

            DisposeCts();
        }

        _disposed = true;
    }

    /// <inheritdoc />
    public async Task<SyncResult> SyncNowAsync(SyncType syncType, CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;

        try
        {
            return syncType switch
            {
                SyncType.Sales => await SyncSalesAsync(cancellationToken),
                SyncType.Menu => await SyncMenuAsync(cancellationToken),
                SyncType.Inventory => await SyncInventoryAsync(cancellationToken),
                SyncType.Tables => await SyncTablesAsync(cancellationToken),
                SyncType.Full => await SyncFullAsync(cancellationToken),
                _ => SyncResult.Failed(syncType, $"Unknown sync type: {syncType}", DateTime.UtcNow - startTime)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync failed for type: {SyncType}", syncType);
            return SyncResult.Failed(syncType, ex.Message, DateTime.UtcNow - startTime);
        }
    }

    /// <inheritdoc />
    public SyncStatistics GetStatistics() => _statistics;

    private async Task RunSyncLoopAsync(CancellationToken cancellationToken)
    {
        // Initial full sync
        try
        {
            await PerformFullSyncAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Initial full sync failed");
        }

        // Periodic sync loop
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(_options.IntervalSeconds), cancellationToken);
                await PerformIncrementalSyncAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in sync loop");
                _statistics.ConsecutiveErrors++;
                _statistics.LastError = ex.Message;
                _statistics.LastErrorAt = DateTime.UtcNow;

                // Send error heartbeat
                try
                {
                    await _apiClient.SendHeartbeatAsync("error", ex.Message, cancellationToken);
                }
                catch { /* Ignore heartbeat errors */ }

                // Pause if too many errors
                if (_statistics.ConsecutiveErrors >= _options.MaxConsecutiveErrors)
                {
                    _logger.LogWarning("Max consecutive errors reached ({Count}), pausing for {Pause}s",
                        _statistics.ConsecutiveErrors, _options.ErrorPauseSeconds);
                    await Task.Delay(TimeSpan.FromSeconds(_options.ErrorPauseSeconds), cancellationToken);
                }
                else
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
                }
            }
        }
    }

    private async Task PerformFullSyncAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting full sync...");
        State = SyncEngineState.Syncing;

        if (_options.SyncMenu)
        {
            await SyncMenuAsync(cancellationToken);
        }

        if (_options.SyncInventory)
        {
            await SyncInventoryAsync(cancellationToken);
        }

        if (_options.SyncSales)
        {
            await SyncSalesAsync(cancellationToken);
        }

        if (_options.SyncTables)
        {
            await SyncTablesAsync(cancellationToken);
        }

        _lastFullSyncAt = DateTime.UtcNow;

        // Persist full sync timestamp (M1)
        try
        {
            await _stateService.UpdateSyncPositionAsync(SyncType.Full, 0, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to persist full sync state");
        }

        State = SyncEngineState.Running;
        _logger.LogInformation("Full sync completed");
    }

    private async Task PerformIncrementalSyncAsync(CancellationToken cancellationToken)
    {
        State = SyncEngineState.Syncing;

        // Always sync sales incrementally
        if (_options.SyncSales)
        {
            await SyncSalesAsync(cancellationToken);
        }

        // Periodic full sync of menu/inventory
        if (_options.FullSyncIntervalMinutes > 0 &&
            _lastFullSyncAt.HasValue &&
            DateTime.UtcNow - _lastFullSyncAt.Value > TimeSpan.FromMinutes(_options.FullSyncIntervalMinutes))
        {
            _logger.LogDebug("Triggering periodic full sync");
            await PerformFullSyncAsync(cancellationToken);
        }
        else
        {
            // Send heartbeat
            await _apiClient.SendHeartbeatAsync("connected", null, cancellationToken);
        }

        State = SyncEngineState.Running;
    }

    private async Task<SyncResult> SyncSalesAsync(CancellationToken cancellationToken)
    {
        var startTime = DateTime.UtcNow;

        try
        {
            // FIX S1: Use persisted position for incremental sync
            var ventas = await _repository.GetNewVentasAsync(
                _lastSyncedSaleId,
                _options.MaxRecordsPerQuery,
                cancellationToken);

            if (ventas.Count == 0)
            {
                _logger.LogDebug("No new sales to sync since ID {LastId}", _lastSyncedSaleId);
                return SyncResult.Successful(SyncType.Sales, 0, 0, 0, DateTime.UtcNow - startTime);
            }

            var transformed = VentasTransformer.TransformMany(ventas).ToList();

            var response = await _apiClient.SendSyncDataAsync(
                "sales",
                transformed,
                ventas.Count,
                cancellationToken);

            UpdateStatistics(response);

            // FIX S1 + M1: Update and persist the last synced position
            if (response.Success && ventas.Count > 0)
            {
                var maxId = ventas.Max(v => v.IdVenta);
                if (maxId > _lastSyncedSaleId)
                {
                    _lastSyncedSaleId = maxId;

                    // Persist to survive restarts
                    try
                    {
                        await _stateService.UpdateSyncPositionAsync(SyncType.Sales, maxId, cancellationToken);
                        _logger.LogDebug("Updated last synced sale ID to {LastId}", maxId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to persist sync state, will retry on next sync");
                    }
                }
            }

            return SyncResult.Successful(
                SyncType.Sales,
                response.RecordsProcessed,
                response.RecordsCreated,
                response.RecordsUpdated,
                DateTime.UtcNow - startTime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sales sync failed");
            return SyncResult.Failed(SyncType.Sales, ex.Message, DateTime.UtcNow - startTime);
        }
    }

    private async Task<SyncResult> SyncMenuAsync(CancellationToken cancellationToken)
    {
        var startTime = DateTime.UtcNow;

        try
        {
            var productos = await _repository.GetProductosAsync(false, cancellationToken);
            var transformed = ProductosTransformer.TransformMany(productos).ToList();

            var response = await _apiClient.SendSyncDataAsync(
                "menu",
                transformed,
                productos.Count,
                cancellationToken);

            UpdateStatistics(response);

            return SyncResult.Successful(
                SyncType.Menu,
                response.RecordsProcessed,
                response.RecordsCreated,
                response.RecordsUpdated,
                DateTime.UtcNow - startTime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Menu sync failed");
            return SyncResult.Failed(SyncType.Menu, ex.Message, DateTime.UtcNow - startTime);
        }
    }

    private async Task<SyncResult> SyncInventoryAsync(CancellationToken cancellationToken)
    {
        var startTime = DateTime.UtcNow;

        try
        {
            var inventario = await _repository.GetInventarioAsync(cancellationToken);
            var transformed = InventarioTransformer.TransformMany(inventario).ToList();

            var response = await _apiClient.SendSyncDataAsync(
                "inventory",
                transformed,
                inventario.Count,
                cancellationToken);

            UpdateStatistics(response);

            return SyncResult.Successful(
                SyncType.Inventory,
                response.RecordsProcessed,
                response.RecordsCreated,
                response.RecordsUpdated,
                DateTime.UtcNow - startTime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Inventory sync failed");
            return SyncResult.Failed(SyncType.Inventory, ex.Message, DateTime.UtcNow - startTime);
        }
    }

    private async Task<SyncResult> SyncTablesAsync(CancellationToken cancellationToken)
    {
        var startTime = DateTime.UtcNow;

        try
        {
            var mesas = await _repository.GetMesasAsync(cancellationToken);
            var transformed = MesasTransformer.TransformMany(mesas).ToList();

            var response = await _apiClient.SendSyncDataAsync(
                "tables",
                transformed,
                mesas.Count,
                cancellationToken);

            UpdateStatistics(response);

            return SyncResult.Successful(
                SyncType.Tables,
                response.RecordsProcessed,
                response.RecordsCreated,
                response.RecordsUpdated,
                DateTime.UtcNow - startTime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tables sync failed");
            return SyncResult.Failed(SyncType.Tables, ex.Message, DateTime.UtcNow - startTime);
        }
    }

    private async Task<SyncResult> SyncFullAsync(CancellationToken cancellationToken)
    {
        var startTime = DateTime.UtcNow;
        var totalProcessed = 0;
        var totalCreated = 0;
        var totalUpdated = 0;

        try
        {
            if (_options.SyncMenu)
            {
                var menuResult = await SyncMenuAsync(cancellationToken);
                totalProcessed += menuResult.RecordsProcessed;
                totalCreated += menuResult.RecordsCreated;
                totalUpdated += menuResult.RecordsUpdated;
            }

            if (_options.SyncInventory)
            {
                var invResult = await SyncInventoryAsync(cancellationToken);
                totalProcessed += invResult.RecordsProcessed;
                totalCreated += invResult.RecordsCreated;
                totalUpdated += invResult.RecordsUpdated;
            }

            if (_options.SyncSales)
            {
                var salesResult = await SyncSalesAsync(cancellationToken);
                totalProcessed += salesResult.RecordsProcessed;
                totalCreated += salesResult.RecordsCreated;
                totalUpdated += salesResult.RecordsUpdated;
            }

            if (_options.SyncTables)
            {
                var tablesResult = await SyncTablesAsync(cancellationToken);
                totalProcessed += tablesResult.RecordsProcessed;
                totalCreated += tablesResult.RecordsCreated;
                totalUpdated += tablesResult.RecordsUpdated;
            }

            return SyncResult.Successful(SyncType.Full, totalProcessed, totalCreated, totalUpdated, DateTime.UtcNow - startTime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Full sync failed");
            return SyncResult.Failed(SyncType.Full, ex.Message, DateTime.UtcNow - startTime);
        }
    }

    private void UpdateStatistics(Api.Responses.SyncResponse response)
    {
        _statistics.TotalSyncs++;
        _statistics.LastSyncAt = DateTime.UtcNow;

        if (response.Success)
        {
            _statistics.SuccessfulSyncs++;
            _statistics.LastSuccessfulSyncAt = DateTime.UtcNow;
            _statistics.TotalRecordsSynced += response.RecordsProcessed;
            _statistics.ConsecutiveErrors = 0;
        }
        else
        {
            _statistics.FailedSyncs++;
            _statistics.ConsecutiveErrors++;
            _statistics.LastError = response.ErrorMessage;
            _statistics.LastErrorAt = DateTime.UtcNow;
        }
    }
}
