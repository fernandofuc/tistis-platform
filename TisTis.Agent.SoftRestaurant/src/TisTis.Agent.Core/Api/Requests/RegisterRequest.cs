// =====================================================
// TIS TIS PLATFORM - API Request Models
// Request models for TIS TIS API
// =====================================================

using System.Text.Json.Serialization;

namespace TisTis.Agent.Core.Api.Requests;

/// <summary>
/// Request to register the agent with TIS TIS
/// </summary>
public class RegisterRequest
{
    [JsonPropertyName("agent_id")]
    public string AgentId { get; set; } = string.Empty;

    [JsonPropertyName("auth_token")]
    public string AuthToken { get; set; } = string.Empty;

    [JsonPropertyName("agent_version")]
    public string AgentVersion { get; set; } = string.Empty;

    [JsonPropertyName("machine_name")]
    public string MachineName { get; set; } = string.Empty;

    [JsonPropertyName("sr_version")]
    public string? SrVersion { get; set; }

    [JsonPropertyName("sr_database_name")]
    public string? SrDatabaseName { get; set; }

    [JsonPropertyName("sr_sql_instance")]
    public string? SrSqlInstance { get; set; }

    [JsonPropertyName("sr_empresa_id")]
    public string? SrEmpresaId { get; set; }
}

/// <summary>
/// Request to send heartbeat
/// </summary>
public class HeartbeatRequest
{
    [JsonPropertyName("agent_id")]
    public string AgentId { get; set; } = string.Empty;

    [JsonPropertyName("auth_token")]
    public string AuthToken { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "connected";

    [JsonPropertyName("last_sync_at")]
    public string? LastSyncAt { get; set; }

    [JsonPropertyName("last_sync_records")]
    public int? LastSyncRecords { get; set; }

    [JsonPropertyName("error_message")]
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Request to send sync data
/// </summary>
public class SyncRequest<T>
{
    [JsonPropertyName("agent_id")]
    public string AgentId { get; set; } = string.Empty;

    [JsonPropertyName("auth_token")]
    public string AuthToken { get; set; } = string.Empty;

    [JsonPropertyName("sync_type")]
    public string SyncType { get; set; } = string.Empty;

    [JsonPropertyName("batch_id")]
    public string BatchId { get; set; } = string.Empty;

    [JsonPropertyName("batch_number")]
    public int BatchNumber { get; set; } = 1;

    [JsonPropertyName("total_batches")]
    public int TotalBatches { get; set; } = 1;

    [JsonPropertyName("records")]
    public IEnumerable<T> Records { get; set; } = Array.Empty<T>();
}
