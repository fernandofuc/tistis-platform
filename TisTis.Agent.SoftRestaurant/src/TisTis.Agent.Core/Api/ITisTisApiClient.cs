// =====================================================
// TIS TIS PLATFORM - API Client Interface
// Contract for communicating with TIS TIS API
// =====================================================

using TisTis.Agent.Core.Api.Requests;
using TisTis.Agent.Core.Api.Responses;

namespace TisTis.Agent.Core.Api;

/// <summary>
/// Interface for TIS TIS API client
/// </summary>
public interface ITisTisApiClient
{
    /// <summary>
    /// Register the agent with TIS TIS
    /// </summary>
    Task<RegisterResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Send heartbeat to TIS TIS
    /// </summary>
    Task<HeartbeatResponse> SendHeartbeatAsync(string status, string? errorMessage = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Send sync data to TIS TIS
    /// </summary>
    Task<SyncResponse> SendSyncDataAsync<T>(string syncType, IEnumerable<T> records, int totalCount, CancellationToken cancellationToken = default);

    /// <summary>
    /// Check if the API is reachable
    /// </summary>
    Task<bool> PingAsync(CancellationToken cancellationToken = default);
}
