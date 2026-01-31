// =====================================================
// TIS TIS PLATFORM - API Response Models
// Response models from TIS TIS API
// =====================================================

using System.Text.Json.Serialization;

namespace TisTis.Agent.Core.Api.Responses;

/// <summary>
/// Base response from TIS TIS API
/// </summary>
public class ApiResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("error")]
    public string? ErrorMessage { get; set; }

    [JsonPropertyName("errorCode")]
    public string? ErrorCode { get; set; }
}

/// <summary>
/// Response from agent registration
/// </summary>
public class RegisterResponse : ApiResponse
{
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("sync_config")]
    public SyncConfigResponse? SyncConfig { get; set; }

    [JsonPropertyName("tenant_name")]
    public string? TenantName { get; set; }
}

/// <summary>
/// Sync configuration from server
/// </summary>
public class SyncConfigResponse
{
    [JsonPropertyName("sync_interval_seconds")]
    public int SyncIntervalSeconds { get; set; }

    [JsonPropertyName("sync_menu")]
    public bool SyncMenu { get; set; }

    [JsonPropertyName("sync_inventory")]
    public bool SyncInventory { get; set; }

    [JsonPropertyName("sync_sales")]
    public bool SyncSales { get; set; }

    [JsonPropertyName("sync_tables")]
    public bool SyncTables { get; set; }
}

/// <summary>
/// Response from heartbeat
/// </summary>
public class HeartbeatResponse : ApiResponse
{
    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }

    [JsonPropertyName("sync_config")]
    public SyncConfigResponse? SyncConfig { get; set; }
}

/// <summary>
/// Response from sync data
/// </summary>
public class SyncResponse : ApiResponse
{
    [JsonPropertyName("sync_type")]
    public string? SyncType { get; set; }

    [JsonPropertyName("batch_id")]
    public string? BatchId { get; set; }

    [JsonPropertyName("records_processed")]
    public int RecordsProcessed { get; set; }

    [JsonPropertyName("records_created")]
    public int RecordsCreated { get; set; }

    [JsonPropertyName("records_updated")]
    public int RecordsUpdated { get; set; }

    [JsonPropertyName("records_skipped")]
    public int RecordsSkipped { get; set; }

    [JsonPropertyName("records_failed")]
    public int RecordsFailed { get; set; }

    [JsonPropertyName("duration_ms")]
    public int DurationMs { get; set; }
}
