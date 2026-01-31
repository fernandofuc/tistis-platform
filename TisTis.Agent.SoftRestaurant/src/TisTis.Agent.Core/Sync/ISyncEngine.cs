// =====================================================
// TIS TIS PLATFORM - Sync Engine Interface
// Contract for synchronization engine
// =====================================================

namespace TisTis.Agent.Core.Sync;

/// <summary>
/// Interface for the synchronization engine
/// </summary>
public interface ISyncEngine : IDisposable
{
    /// <summary>
    /// Current state of the sync engine
    /// </summary>
    SyncEngineState State { get; }

    /// <summary>
    /// Start the sync engine
    /// </summary>
    Task StartAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Stop the sync engine
    /// </summary>
    Task StopAsync();

    /// <summary>
    /// Trigger an immediate sync
    /// </summary>
    Task<SyncResult> SyncNowAsync(SyncType syncType, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get sync statistics
    /// </summary>
    SyncStatistics GetStatistics();
}

/// <summary>
/// Sync engine state
/// </summary>
public enum SyncEngineState
{
    Stopped,
    Starting,
    Running,
    Syncing,
    Error,
    Stopping
}

/// <summary>
/// Type of sync to perform
/// </summary>
public enum SyncType
{
    Sales,
    Menu,
    Inventory,
    Tables,
    Full
}

/// <summary>
/// Result of a sync operation
/// </summary>
public class SyncResult
{
    public bool Success { get; set; }
    public SyncType SyncType { get; set; }
    public int RecordsProcessed { get; set; }
    public int RecordsCreated { get; set; }
    public int RecordsUpdated { get; set; }
    public int RecordsFailed { get; set; }
    public TimeSpan Duration { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CompletedAt { get; set; }

    public static SyncResult Successful(SyncType type, int processed, int created, int updated, TimeSpan duration)
    {
        return new SyncResult
        {
            Success = true,
            SyncType = type,
            RecordsProcessed = processed,
            RecordsCreated = created,
            RecordsUpdated = updated,
            Duration = duration,
            CompletedAt = DateTime.UtcNow
        };
    }

    public static SyncResult Failed(SyncType type, string error, TimeSpan duration)
    {
        return new SyncResult
        {
            Success = false,
            SyncType = type,
            ErrorMessage = error,
            Duration = duration,
            CompletedAt = DateTime.UtcNow
        };
    }
}

/// <summary>
/// Sync engine statistics
/// </summary>
public class SyncStatistics
{
    public DateTime StartedAt { get; set; }
    public TimeSpan Uptime => DateTime.UtcNow - StartedAt;
    public int TotalSyncs { get; set; }
    public int SuccessfulSyncs { get; set; }
    public int FailedSyncs { get; set; }
    public long TotalRecordsSynced { get; set; }
    public DateTime? LastSyncAt { get; set; }
    public DateTime? LastSuccessfulSyncAt { get; set; }
    public string? LastError { get; set; }
    public DateTime? LastErrorAt { get; set; }
    public int ConsecutiveErrors { get; set; }
}
