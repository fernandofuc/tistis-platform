// =====================================================
// TIS TIS PLATFORM - API Client Implementation
// HTTP client for TIS TIS API
// FIX SEC-04: Certificate pinning integration
// FIX SEC-02: Secure logging
// =====================================================

using System.Net.Http.Json;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.Extensions.Http;
using TisTis.Agent.Core.Api.Requests;
using TisTis.Agent.Core.Api.Responses;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Security;

namespace TisTis.Agent.Core.Api;

/// <summary>
/// HTTP client for communicating with TIS TIS API.
/// FIX SEC-04: Supports certificate pinning for enhanced security.
/// FIX SEC-02: Uses secure logging practices.
/// </summary>
public class TisTisApiClient : ITisTisApiClient, IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<TisTisApiClient> _logger;
    private readonly AgentConfiguration _config;
    private readonly IAsyncPolicy<HttpResponseMessage> _retryPolicy;
    private readonly CertificateValidator? _certificateValidator;
    private bool _disposed;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false
    };

    // Header names for authentication (use headers instead of body for security)
    private const string AgentIdHeader = "X-TisTis-Agent-Id";
    private const string AuthorizationHeader = "Authorization";

    /// <summary>
    /// Creates API client with optional certificate validator.
    /// FIX SEC-04: Certificate pinning support.
    /// </summary>
    public TisTisApiClient(
        AgentConfiguration config,
        ILogger<TisTisApiClient> logger,
        CertificateValidator? certificateValidator = null,
        HttpClient? httpClient = null)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _certificateValidator = certificateValidator;

        _httpClient = httpClient ?? CreateHttpClient();
        _retryPolicy = CreateRetryPolicy();

        // FIX SEC-02: Log startup without sensitive details
        _logger.LogDebug(
            "API client initialized. BaseUrl: {BaseUrl}, Pinning: {Pinning}",
            SecureUtilities.Redact(_config.Api.BaseUrl, 20),
            _certificateValidator?.IsPinningEnabled ?? false);
    }

    /// <summary>
    /// Creates HttpClient with security configuration.
    /// FIX SEC-04: Uses CertificateValidator when available.
    /// </summary>
    private HttpClient CreateHttpClient()
    {
        var handler = new HttpClientHandler();

        if (!_config.Api.ValidateSsl)
        {
            // Development mode only - bypasses SSL validation
            _logger.LogWarning("SSL validation disabled - DEVELOPMENT MODE ONLY");
            handler.ServerCertificateCustomValidationCallback = (_, _, _, _) => true;
        }
        else if (_certificateValidator != null)
        {
            // FIX SEC-04: Use certificate pinning
            // FIX: Use HttpClientHandler-compatible callback signature
            handler.ServerCertificateCustomValidationCallback = _certificateValidator.GetHttpClientValidationCallback();
            _logger.LogDebug("Certificate pinning enabled");
        }
        // else: Use default .NET certificate validation

        var client = new HttpClient(handler)
        {
            BaseAddress = new Uri(_config.Api.BaseUrl),
            Timeout = TimeSpan.FromSeconds(_config.Api.TimeoutSeconds)
        };

        client.DefaultRequestHeaders.Add("User-Agent", $"TisTis-Agent/{_config.Version}");
        client.DefaultRequestHeaders.Add("Accept", "application/json");

        return client;
    }

    private IAsyncPolicy<HttpResponseMessage> CreateRetryPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .OrResult(msg => msg.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            .WaitAndRetryAsync(
                _config.Api.MaxRetries,
                retryAttempt => TimeSpan.FromMilliseconds(_config.Api.RetryDelayMs * Math.Pow(2, retryAttempt)),
                (outcome, timespan, retryAttempt, _) =>
                {
                    _logger.LogWarning(
                        "Request failed. Waiting {Delay}ms before retry {Attempt}/{Max}. Status: {Status}",
                        timespan.TotalMilliseconds,
                        retryAttempt,
                        _config.Api.MaxRetries,
                        outcome.Result?.StatusCode);
                });
    }

    /// <summary>
    /// FIX S4: Creates an HTTP request with authentication headers.
    /// This method adds auth via headers (more secure as headers aren't typically logged).
    /// For backwards compatibility, the body may still contain credentials until the backend
    /// is updated to read exclusively from headers.
    /// </summary>
    private HttpRequestMessage CreateAuthenticatedRequest(HttpMethod method, string endpoint, object? body = null)
    {
        var request = new HttpRequestMessage(method, endpoint);

        // Add auth headers (headers are typically not logged in access logs)
        request.Headers.Add(AgentIdHeader, _config.AgentId);
        request.Headers.Add(AuthorizationHeader, $"Bearer {_config.AuthToken}");

        if (body != null)
        {
            var json = JsonSerializer.Serialize(body, JsonOptions);
            request.Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
        }

        return request;
    }

    /// <summary>
    /// FIX S4: Executes an authenticated request using headers for auth.
    /// Wraps the retry policy and handles common response patterns.
    /// </summary>
    private async Task<HttpResponseMessage> ExecuteAuthenticatedRequestAsync(
        HttpMethod method,
        string endpoint,
        object? body,
        CancellationToken cancellationToken)
    {
        return await _retryPolicy.ExecuteAsync(async () =>
        {
            // Create new request for each retry (requests can't be reused)
            var request = CreateAuthenticatedRequest(method, endpoint, body);
            return await _httpClient.SendAsync(request, cancellationToken);
        });
    }

    /// <inheritdoc />
    public async Task<RegisterResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Registering agent with TIS TIS...");

        try
        {
            var response = await _retryPolicy.ExecuteAsync(async () =>
            {
                var httpResponse = await _httpClient.PostAsJsonAsync(
                    _config.Api.RegisterEndpoint,
                    request,
                    JsonOptions,
                    cancellationToken);

                return httpResponse;
            });

            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<RegisterResponse>(JsonOptions, cancellationToken);
                _logger.LogInformation("Agent registration successful");
                return result ?? new RegisterResponse { Success = false, ErrorMessage = "Empty response" };
            }
            else
            {
                var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                // FIX SEC-02: Truncate error body to prevent sensitive data exposure
                var safeErrorContent = errorContent.Length > 500
                    ? errorContent[..500] + "...[truncated]"
                    : errorContent;
                _logger.LogError("Agent registration failed. Status: {Status}, Body: {Body}",
                    response.StatusCode, safeErrorContent);

                try
                {
                    return JsonSerializer.Deserialize<RegisterResponse>(errorContent, JsonOptions)
                           ?? new RegisterResponse { Success = false, ErrorMessage = errorContent };
                }
                catch
                {
                    return new RegisterResponse { Success = false, ErrorMessage = errorContent };
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Agent registration failed");
            return new RegisterResponse { Success = false, ErrorMessage = ex.Message };
        }
    }

    /// <inheritdoc />
    public async Task<HeartbeatResponse> SendHeartbeatAsync(string status, string? errorMessage = null, CancellationToken cancellationToken = default)
    {
        // FIX S5: Removed AuthToken from body - now sent via headers only
        // AgentId kept in body for backwards compatibility until backend is updated
        var requestBody = new
        {
            agent_id = _config.AgentId,
            status,
            error_message = errorMessage
        };

        try
        {
            // FIX S4: Use authenticated request with headers
            var response = await ExecuteAuthenticatedRequestAsync(
                HttpMethod.Post,
                _config.Api.HeartbeatEndpoint,
                requestBody,
                cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<HeartbeatResponse>(JsonOptions, cancellationToken)
                       ?? new HeartbeatResponse { Success = true };
            }
            else
            {
                var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Heartbeat failed. Status: {Status}", response.StatusCode);
                return new HeartbeatResponse { Success = false, ErrorMessage = errorContent };
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Heartbeat failed");
            return new HeartbeatResponse { Success = false, ErrorMessage = ex.Message };
        }
    }

    /// <inheritdoc />
    public async Task<SyncResponse> SendSyncDataAsync<T>(
        string syncType,
        IEnumerable<T> records,
        int totalCount,
        CancellationToken cancellationToken = default)
    {
        var recordsList = records.ToList();
        var batchId = Guid.NewGuid().ToString("N")[..16];
        var batchSize = _config.Sync.BatchSize;
        var batches = recordsList.Chunk(batchSize).ToList();
        var totalBatches = batches.Count;

        _logger.LogDebug("Sending {Type} sync: {Count} records in {Batches} batches",
            syncType, recordsList.Count, totalBatches);

        var aggregateResponse = new SyncResponse { Success = true, SyncType = syncType };

        for (int i = 0; i < batches.Count; i++)
        {
            var batch = batches[i];

            // FIX S5: AuthToken moved to headers - keeping agent_id in body for backwards compatibility
            var requestBody = new
            {
                agent_id = _config.AgentId,
                sync_type = syncType,
                batch_id = batchId,
                batch_number = i + 1,
                total_batches = totalBatches,
                records = batch
            };

            try
            {
                // FIX S4: Use authenticated request with headers
                var response = await ExecuteAuthenticatedRequestAsync(
                    HttpMethod.Post,
                    _config.Api.SyncEndpoint,
                    requestBody,
                    cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<SyncResponse>(JsonOptions, cancellationToken);
                    if (result != null)
                    {
                        aggregateResponse.RecordsProcessed += result.RecordsProcessed;
                        aggregateResponse.RecordsCreated += result.RecordsCreated;
                        aggregateResponse.RecordsUpdated += result.RecordsUpdated;
                        aggregateResponse.RecordsSkipped += result.RecordsSkipped;
                        aggregateResponse.RecordsFailed += result.RecordsFailed;
                        aggregateResponse.DurationMs += result.DurationMs;
                    }

                    _logger.LogDebug("Batch {Batch}/{Total} completed: {Processed} records",
                        i + 1, totalBatches, result?.RecordsProcessed ?? 0);
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                    // FIX SEC-02: Truncate error body for secure logging
                    var safeErrorContent = errorContent.Length > 500
                        ? errorContent[..500] + "...[truncated]"
                        : errorContent;
                    _logger.LogError("Sync batch {Batch}/{Total} failed. Status: {Status}, Error: {Error}",
                        i + 1, totalBatches, response.StatusCode, safeErrorContent);

                    aggregateResponse.Success = false;
                    aggregateResponse.ErrorMessage = errorContent;
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Sync batch {Batch}/{Total} failed", i + 1, totalBatches);
                aggregateResponse.Success = false;
                aggregateResponse.ErrorMessage = ex.Message;
                break;
            }
        }

        aggregateResponse.BatchId = batchId;
        return aggregateResponse;
    }

    /// <inheritdoc />
    public async Task<bool> PingAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/health", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
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
            _httpClient.Dispose();
        }

        _disposed = true;
    }
}
