// =====================================================
// TIS TIS PLATFORM - Sync State Service
// Persists sync state across restarts
// =====================================================

using System.Text.Json;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Configuration;

namespace TisTis.Agent.Core.Sync;

/// <summary>
/// Service for persisting and retrieving sync state across service restarts.
/// Uses a JSON file to store sync positions and metadata.
/// </summary>
public interface ISyncStateService
{
    /// <summary>
    /// Get the last synced position for a specific sync type
    /// </summary>
    Task<long> GetLastSyncPositionAsync(SyncType syncType, CancellationToken cancellationToken = default);

    /// <summary>
    /// Update the sync position for a specific sync type
    /// </summary>
    Task UpdateSyncPositionAsync(SyncType syncType, long position, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get the full sync state
    /// </summary>
    Task<SyncState> GetStateAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Save the full sync state
    /// </summary>
    Task SaveStateAsync(SyncState state, CancellationToken cancellationToken = default);
}

/// <summary>
/// Represents the persisted sync state
/// </summary>
public class SyncState
{
    /// <summary>
    /// Last synced sale ID for incremental sync
    /// </summary>
    public long LastSyncedSaleId { get; set; }

    /// <summary>
    /// Last time menu was fully synced
    /// </summary>
    public DateTime? LastMenuSyncAt { get; set; }

    /// <summary>
    /// Last time inventory was fully synced
    /// </summary>
    public DateTime? LastInventorySyncAt { get; set; }

    /// <summary>
    /// Last time tables were synced
    /// </summary>
    public DateTime? LastTablesSyncAt { get; set; }

    /// <summary>
    /// Last time a full sync was performed
    /// </summary>
    public DateTime? LastFullSyncAt { get; set; }

    /// <summary>
    /// Total records synced since service start
    /// </summary>
    public long TotalRecordsSynced { get; set; }

    /// <summary>
    /// Total successful syncs since service start
    /// </summary>
    public int SuccessfulSyncs { get; set; }

    /// <summary>
    /// Total failed syncs since service start
    /// </summary>
    public int FailedSyncs { get; set; }

    /// <summary>
    /// When this state was last updated
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Agent version that created this state (for migration support)
    /// </summary>
    public string AgentVersion { get; set; } = "1.0.0";
}

/// <summary>
/// File-based implementation of ISyncStateService
/// FIX S19: Implements IDisposable to properly dispose SemaphoreSlim
/// </summary>
public class SyncStateService : ISyncStateService, IDisposable
{
    private readonly string _stateFilePath;
    private readonly ILogger<SyncStateService> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly string _agentVersion;
    private SyncState? _cachedState;
    private bool _disposed;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public SyncStateService(
        LoggingOptions loggingOptions,
        ILogger<SyncStateService> logger,
        string? agentVersion = null)
    {
        _logger = logger;
        _agentVersion = agentVersion ?? "1.0.0"; // FIX: Use the provided version

        // Store state file in the same directory as logs
        var stateDir = Path.GetDirectoryName(loggingOptions.LogDirectory) ?? @"C:\ProgramData\TisTis\Agent";
        _stateFilePath = Path.Combine(stateDir, "sync-state.json");

        // Ensure directory exists
        var directory = Path.GetDirectoryName(_stateFilePath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
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
            _lock.Dispose();
        }

        _disposed = true;
    }

    /// <inheritdoc />
    public async Task<long> GetLastSyncPositionAsync(SyncType syncType, CancellationToken cancellationToken = default)
    {
        var state = await GetStateAsync(cancellationToken);

        return syncType switch
        {
            SyncType.Sales => state.LastSyncedSaleId,
            _ => 0 // Other types don't use position-based tracking
        };
    }

    /// <inheritdoc />
    public async Task UpdateSyncPositionAsync(SyncType syncType, long position, CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            var state = await GetStateInternalAsync(cancellationToken);

            switch (syncType)
            {
                case SyncType.Sales:
                    if (position > state.LastSyncedSaleId)
                    {
                        state.LastSyncedSaleId = position;
                    }
                    break;
                case SyncType.Menu:
                    state.LastMenuSyncAt = DateTime.UtcNow;
                    break;
                case SyncType.Inventory:
                    state.LastInventorySyncAt = DateTime.UtcNow;
                    break;
                case SyncType.Tables:
                    state.LastTablesSyncAt = DateTime.UtcNow;
                    break;
                case SyncType.Full:
                    state.LastFullSyncAt = DateTime.UtcNow;
                    break;
            }

            state.UpdatedAt = DateTime.UtcNow;
            await SaveStateInternalAsync(state, cancellationToken);
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <inheritdoc />
    public async Task<SyncState> GetStateAsync(CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            return await GetStateInternalAsync(cancellationToken);
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <inheritdoc />
    public async Task SaveStateAsync(SyncState state, CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            state.UpdatedAt = DateTime.UtcNow;
            await SaveStateInternalAsync(state, cancellationToken);
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <summary>
    /// Internal method to get state without locking (caller must hold lock)
    /// </summary>
    private async Task<SyncState> GetStateInternalAsync(CancellationToken cancellationToken)
    {
        // Return cached state if available
        if (_cachedState != null)
        {
            return _cachedState;
        }

        // Try to load from file
        if (File.Exists(_stateFilePath))
        {
            try
            {
                var json = await File.ReadAllTextAsync(_stateFilePath, cancellationToken);
                var state = JsonSerializer.Deserialize<SyncState>(json, JsonOptions);

                if (state != null)
                {
                    _cachedState = state;
                    _logger.LogDebug("Loaded sync state from file. LastSyncedSaleId: {LastId}", state.LastSyncedSaleId);
                    return state;
                }
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Failed to parse sync state file, creating new state");
            }
            catch (IOException ex)
            {
                _logger.LogWarning(ex, "Failed to read sync state file, creating new state");
            }
        }

        // Create new state with agent version
        _cachedState = new SyncState { AgentVersion = _agentVersion };
        _logger.LogInformation("Created new sync state for agent version {Version}", _agentVersion);
        return _cachedState;
    }

    /// <summary>
    /// Internal method to save state without locking (caller must hold lock)
    /// </summary>
    private async Task SaveStateInternalAsync(SyncState state, CancellationToken cancellationToken)
    {
        try
        {
            var json = JsonSerializer.Serialize(state, JsonOptions);

            // Write to temp file first, then rename (atomic operation)
            var tempPath = _stateFilePath + ".tmp";
            await File.WriteAllTextAsync(tempPath, json, cancellationToken);
            File.Move(tempPath, _stateFilePath, overwrite: true);

            _cachedState = state;
            _logger.LogDebug("Saved sync state. LastSyncedSaleId: {LastId}", state.LastSyncedSaleId);
        }
        catch (IOException ex)
        {
            _logger.LogError(ex, "Failed to save sync state to file");
            throw;
        }
    }
}
