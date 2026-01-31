// =====================================================
// TIS TIS PLATFORM - Health Check Service
// FASE 7: Comprehensive health monitoring for all subsystems
// =====================================================

using System.Diagnostics;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Api;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Database;
using TisTis.Agent.Core.Monitoring.Types;
using TisTis.Agent.Core.Security;
using TisTis.Agent.Core.Sync;

namespace TisTis.Agent.Core.Monitoring.HealthCheck;

/// <summary>
/// Interface for health check service.
/// </summary>
public interface IHealthCheckService
{
    /// <summary>
    /// Performs comprehensive health check of all subsystems.
    /// </summary>
    Task<AgentHealthReport> CheckHealthAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks health of a specific subsystem.
    /// </summary>
    Task<SubsystemHealthResult> CheckSubsystemAsync(SubsystemType subsystem, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the last cached health report (without performing new checks).
    /// </summary>
    AgentHealthReport? GetLastHealthReport();

    /// <summary>
    /// Agent start time for uptime calculation.
    /// </summary>
    DateTime StartTime { get; }
}

/// <summary>
/// Comprehensive health check service for the TIS TIS Agent.
/// Checks all subsystems and provides aggregated health status.
/// </summary>
public class HealthCheckService : IHealthCheckService
{
    private readonly ILogger<HealthCheckService> _logger;
    private readonly AgentConfiguration _config;
    private readonly ISyncEngine? _syncEngine;
    private readonly ITisTisApiClient? _apiClient;
    private readonly ISoftRestaurantRepository? _repository;
    private readonly CredentialStore? _credentialStore;
    private readonly MonitoringThresholds _thresholds;

    private readonly object _reportLock = new();
    private AgentHealthReport? _lastReport;

    /// <summary>
    /// FIX ITER2-E1: Use SemaphoreSlim to prevent concurrent health checks.
    /// </summary>
    private readonly SemaphoreSlim _checkSemaphore = new(1, 1);

    /// <inheritdoc />
    public DateTime StartTime { get; } = DateTime.UtcNow;

    /// <summary>
    /// Cache duration for health reports.
    /// </summary>
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(30);
    private DateTime _lastCheckTime = DateTime.MinValue;

    public HealthCheckService(
        ILogger<HealthCheckService> logger,
        AgentConfiguration config,
        MonitoringThresholds? thresholds = null,
        ISyncEngine? syncEngine = null,
        ITisTisApiClient? apiClient = null,
        ISoftRestaurantRepository? repository = null,
        CredentialStore? credentialStore = null)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _thresholds = thresholds ?? new MonitoringThresholds();
        _syncEngine = syncEngine;
        _apiClient = apiClient;
        _repository = repository;
        _credentialStore = credentialStore;
    }

    /// <inheritdoc />
    public async Task<AgentHealthReport> CheckHealthAsync(CancellationToken cancellationToken = default)
    {
        // FIX ITER2-E2: Quick cache check before acquiring semaphore (read is safe without lock)
        var cachedReport = GetCachedReportIfValid();
        if (cachedReport != null)
        {
            return cachedReport;
        }

        // FIX ITER2-E3: Use semaphore to prevent concurrent health checks
        await _checkSemaphore.WaitAsync(cancellationToken);
        try
        {
            // Double-check cache after acquiring semaphore (another thread may have updated it)
            cachedReport = GetCachedReportIfValid();
            if (cachedReport != null)
            {
                return cachedReport;
            }

            _logger.LogDebug("Performing comprehensive health check");

            var stopwatch = Stopwatch.StartNew();
            var subsystemResults = new List<SubsystemHealthResult>();
            var issues = new List<string>();

            // Check each subsystem
            var subsystems = new[]
            {
                SubsystemType.Agent,
                SubsystemType.SyncEngine,
                SubsystemType.Database,
                SubsystemType.ApiClient,
                SubsystemType.CredentialStore,
                SubsystemType.Security
            };

            foreach (var subsystem in subsystems)
            {
                try
                {
                    var result = await CheckSubsystemAsync(subsystem, cancellationToken);
                    subsystemResults.Add(result);

                    if (result.Status == HealthStatus.Unhealthy)
                    {
                        issues.Add($"[CRITICAL] {subsystem}: {result.Message}");
                    }
                    else if (result.Status == HealthStatus.Degraded)
                    {
                        issues.Add($"[WARNING] {subsystem}: {result.Message}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Health check failed for {Subsystem}", subsystem);
                    subsystemResults.Add(new SubsystemHealthResult
                    {
                        Subsystem = subsystem,
                        Status = HealthStatus.Unknown,
                        Message = "Health check failed",
                        ErrorDetails = ex.Message,
                        CheckDuration = TimeSpan.Zero
                    });
                    issues.Add($"[ERROR] {subsystem}: Check failed - {ex.Message}");
                }
            }

            // Determine overall status
            var overallStatus = DetermineOverallStatus(subsystemResults);

            // Generate recommendation
            var recommendation = GenerateRecommendation(overallStatus, issues);

            var report = new AgentHealthReport
            {
                OverallStatus = overallStatus,
                Version = _config.Version,
                GeneratedAt = DateTime.UtcNow,
                Uptime = DateTime.UtcNow - StartTime,
                Subsystems = subsystemResults,
                Issues = issues,
                Recommendation = recommendation
            };

            stopwatch.Stop();
            _logger.LogDebug("Health check completed in {Duration}ms. Status: {Status}",
                stopwatch.ElapsedMilliseconds, overallStatus);

            // Cache the report
            lock (_reportLock)
            {
                _lastReport = report;
                _lastCheckTime = DateTime.UtcNow;
            }

            return report;
        }
        finally
        {
            _checkSemaphore.Release();
        }
    }

    /// <summary>
    /// FIX ITER2-E4: Helper method to check cache validity.
    /// </summary>
    private AgentHealthReport? GetCachedReportIfValid()
    {
        lock (_reportLock)
        {
            if (_lastReport != null && DateTime.UtcNow - _lastCheckTime < CacheDuration)
            {
                return _lastReport;
            }
            return null;
        }
    }

    /// <inheritdoc />
    public async Task<SubsystemHealthResult> CheckSubsystemAsync(
        SubsystemType subsystem,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            var result = subsystem switch
            {
                SubsystemType.Agent => await CheckAgentHealthAsync(cancellationToken),
                SubsystemType.SyncEngine => await CheckSyncEngineHealthAsync(cancellationToken),
                SubsystemType.Database => await CheckDatabaseHealthAsync(cancellationToken),
                SubsystemType.ApiClient => await CheckApiClientHealthAsync(cancellationToken),
                SubsystemType.CredentialStore => CheckCredentialStoreHealth(),
                SubsystemType.Security => CheckSecurityHealth(),
                _ => CreateUnknownResult(subsystem, "Unknown subsystem type")
            };

            stopwatch.Stop();
            return result with { CheckDuration = stopwatch.Elapsed };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogWarning(ex, "Error checking health of {Subsystem}", subsystem);

            return new SubsystemHealthResult
            {
                Subsystem = subsystem,
                Status = HealthStatus.Unknown,
                Message = "Check failed with exception",
                ErrorDetails = ex.Message,
                CheckDuration = stopwatch.Elapsed
            };
        }
    }

    /// <inheritdoc />
    public AgentHealthReport? GetLastHealthReport()
    {
        lock (_reportLock)
        {
            return _lastReport;
        }
    }

    #region Individual Subsystem Checks

    private Task<SubsystemHealthResult> CheckAgentHealthAsync(CancellationToken cancellationToken)
    {
        var metadata = new Dictionary<string, object>
        {
            ["uptime_seconds"] = (DateTime.UtcNow - StartTime).TotalSeconds,
            ["process_id"] = Environment.ProcessId,
            ["machine_name"] = Environment.MachineName,
            ["working_set_mb"] = Process.GetCurrentProcess().WorkingSet64 / 1024 / 1024
        };

        // Check memory usage
        var workingSetMb = Process.GetCurrentProcess().WorkingSet64 / 1024 / 1024;
        if (workingSetMb > _thresholds.MaxMemoryUsageMb)
        {
            return Task.FromResult(new SubsystemHealthResult
            {
                Subsystem = SubsystemType.Agent,
                Status = HealthStatus.Degraded,
                Message = $"High memory usage: {workingSetMb}MB (threshold: {_thresholds.MaxMemoryUsageMb}MB)",
                Metadata = metadata
            });
        }

        return Task.FromResult(new SubsystemHealthResult
        {
            Subsystem = SubsystemType.Agent,
            Status = HealthStatus.Healthy,
            Message = "Agent running normally",
            Metadata = metadata
        });
    }

    private Task<SubsystemHealthResult> CheckSyncEngineHealthAsync(CancellationToken cancellationToken)
    {
        if (_syncEngine == null)
        {
            return Task.FromResult(CreateUnknownResult(SubsystemType.SyncEngine, "Sync engine not available"));
        }

        var state = _syncEngine.State;
        var stats = _syncEngine.GetStatistics();

        var metadata = new Dictionary<string, object>
        {
            ["state"] = state.ToString(),
            ["total_syncs"] = stats.TotalSyncs,
            ["successful_syncs"] = stats.SuccessfulSyncs,
            ["failed_syncs"] = stats.FailedSyncs,
            ["consecutive_errors"] = stats.ConsecutiveErrors,
            ["total_records"] = stats.TotalRecordsSynced
        };

        if (stats.LastSyncAt.HasValue)
        {
            metadata["last_sync_at"] = stats.LastSyncAt.Value.ToString("O");
        }

        // Check for error state
        if (state == SyncEngineState.Error)
        {
            return Task.FromResult(new SubsystemHealthResult
            {
                Subsystem = SubsystemType.SyncEngine,
                Status = HealthStatus.Unhealthy,
                Message = $"Sync engine in error state: {stats.LastError ?? "Unknown error"}",
                ErrorDetails = stats.LastError,
                Metadata = metadata
            });
        }

        // Check consecutive errors
        if (stats.ConsecutiveErrors >= _thresholds.MaxConsecutiveErrors)
        {
            return Task.FromResult(new SubsystemHealthResult
            {
                Subsystem = SubsystemType.SyncEngine,
                Status = HealthStatus.Unhealthy,
                Message = $"Too many consecutive errors: {stats.ConsecutiveErrors}",
                ErrorDetails = stats.LastError,
                Metadata = metadata
            });
        }

        if (stats.ConsecutiveErrors > 0)
        {
            return Task.FromResult(new SubsystemHealthResult
            {
                Subsystem = SubsystemType.SyncEngine,
                Status = HealthStatus.Degraded,
                Message = $"Recent errors detected: {stats.ConsecutiveErrors} consecutive errors",
                Metadata = metadata
            });
        }

        // Check time since last sync
        if (stats.LastSuccessfulSyncAt.HasValue)
        {
            var timeSinceLastSync = DateTime.UtcNow - stats.LastSuccessfulSyncAt.Value;
            if (timeSinceLastSync.TotalMinutes > _thresholds.MaxTimeSinceLastSyncMinutes)
            {
                return Task.FromResult(new SubsystemHealthResult
                {
                    Subsystem = SubsystemType.SyncEngine,
                    Status = HealthStatus.Degraded,
                    Message = $"No successful sync in {timeSinceLastSync.TotalMinutes:F1} minutes",
                    Metadata = metadata
                });
            }
        }

        return Task.FromResult(new SubsystemHealthResult
        {
            Subsystem = SubsystemType.SyncEngine,
            Status = HealthStatus.Healthy,
            Message = $"Sync engine operational (state: {state})",
            Metadata = metadata
        });
    }

    private async Task<SubsystemHealthResult> CheckDatabaseHealthAsync(CancellationToken cancellationToken)
    {
        if (_repository == null)
        {
            return CreateUnknownResult(SubsystemType.Database, "Database repository not available");
        }

        var stopwatch = Stopwatch.StartNew();

        try
        {
            // Attempt a simple connectivity test
            var isConnected = await _repository.TestConnectionAsync(cancellationToken);
            stopwatch.Stop();

            var metadata = new Dictionary<string, object>
            {
                ["response_time_ms"] = stopwatch.ElapsedMilliseconds,
                ["connection_string_hash"] = SecureUtilities.ComputeHashPrefix(_config.SoftRestaurant.ConnectionString)
            };

            if (!isConnected)
            {
                return new SubsystemHealthResult
                {
                    Subsystem = SubsystemType.Database,
                    Status = HealthStatus.Unhealthy,
                    Message = "Database connection failed",
                    Metadata = metadata
                };
            }

            // Check response time
            if (stopwatch.ElapsedMilliseconds > _thresholds.MaxDbQueryTimeMs)
            {
                return new SubsystemHealthResult
                {
                    Subsystem = SubsystemType.Database,
                    Status = HealthStatus.Degraded,
                    Message = $"Slow database response: {stopwatch.ElapsedMilliseconds}ms",
                    Metadata = metadata
                };
            }

            return new SubsystemHealthResult
            {
                Subsystem = SubsystemType.Database,
                Status = HealthStatus.Healthy,
                Message = $"Database connected (response: {stopwatch.ElapsedMilliseconds}ms)",
                Metadata = metadata
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            return new SubsystemHealthResult
            {
                Subsystem = SubsystemType.Database,
                Status = HealthStatus.Unhealthy,
                Message = "Database connection error",
                ErrorDetails = ex.Message,
                Metadata = new Dictionary<string, object>
                {
                    ["response_time_ms"] = stopwatch.ElapsedMilliseconds
                }
            };
        }
    }

    private async Task<SubsystemHealthResult> CheckApiClientHealthAsync(CancellationToken cancellationToken)
    {
        if (_apiClient == null)
        {
            return CreateUnknownResult(SubsystemType.ApiClient, "API client not available");
        }

        var stopwatch = Stopwatch.StartNew();

        try
        {
            var isReachable = await _apiClient.PingAsync(cancellationToken);
            stopwatch.Stop();

            var metadata = new Dictionary<string, object>
            {
                ["response_time_ms"] = stopwatch.ElapsedMilliseconds,
                ["base_url_hash"] = SecureUtilities.ComputeHashPrefix(_config.Api.BaseUrl)
            };

            if (!isReachable)
            {
                return new SubsystemHealthResult
                {
                    Subsystem = SubsystemType.ApiClient,
                    Status = HealthStatus.Unhealthy,
                    Message = "TIS TIS API not reachable",
                    Metadata = metadata
                };
            }

            if (stopwatch.ElapsedMilliseconds > _thresholds.MaxApiResponseTimeMs)
            {
                return new SubsystemHealthResult
                {
                    Subsystem = SubsystemType.ApiClient,
                    Status = HealthStatus.Degraded,
                    Message = $"Slow API response: {stopwatch.ElapsedMilliseconds}ms",
                    Metadata = metadata
                };
            }

            return new SubsystemHealthResult
            {
                Subsystem = SubsystemType.ApiClient,
                Status = HealthStatus.Healthy,
                Message = $"API connected (response: {stopwatch.ElapsedMilliseconds}ms)",
                Metadata = metadata
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            return new SubsystemHealthResult
            {
                Subsystem = SubsystemType.ApiClient,
                Status = HealthStatus.Unhealthy,
                Message = "API connection error",
                ErrorDetails = ex.Message,
                Metadata = new Dictionary<string, object>
                {
                    ["response_time_ms"] = stopwatch.ElapsedMilliseconds
                }
            };
        }
    }

    private SubsystemHealthResult CheckCredentialStoreHealth()
    {
        if (_credentialStore == null)
        {
            return CreateUnknownResult(SubsystemType.CredentialStore, "Credential store not available");
        }

        try
        {
            var exists = _credentialStore.Exists();

            if (!exists)
            {
                return new SubsystemHealthResult
                {
                    Subsystem = SubsystemType.CredentialStore,
                    Status = HealthStatus.Degraded,
                    Message = "No credentials stored",
                    Metadata = new Dictionary<string, object>
                    {
                        ["credentials_exist"] = false
                    }
                };
            }

            return new SubsystemHealthResult
            {
                Subsystem = SubsystemType.CredentialStore,
                Status = HealthStatus.Healthy,
                Message = "Credentials available",
                Metadata = new Dictionary<string, object>
                {
                    ["credentials_exist"] = true,
                    ["dpapi_enabled"] = _config.Security.UseDataProtection
                }
            };
        }
        catch (Exception ex)
        {
            return new SubsystemHealthResult
            {
                Subsystem = SubsystemType.CredentialStore,
                Status = HealthStatus.Unhealthy,
                Message = "Error accessing credential store",
                ErrorDetails = ex.Message
            };
        }
    }

    private SubsystemHealthResult CheckSecurityHealth()
    {
        var metadata = new Dictionary<string, object>
        {
            ["certificate_pinning"] = _config.Security.UseCertificatePinning,
            ["dpapi_enabled"] = _config.Security.UseDataProtection,
            ["min_tls_version"] = _config.Security.MinTlsVersion.ToString()
        };

        // Check if SSL validation is disabled (development mode)
        if (!_config.Api.ValidateSsl)
        {
            return new SubsystemHealthResult
            {
                Subsystem = SubsystemType.Security,
                Status = HealthStatus.Degraded,
                Message = "SSL validation disabled (development mode)",
                Metadata = metadata
            };
        }

        return new SubsystemHealthResult
        {
            Subsystem = SubsystemType.Security,
            Status = HealthStatus.Healthy,
            Message = "Security configuration valid",
            Metadata = metadata
        };
    }

    #endregion

    #region Helper Methods

    private static SubsystemHealthResult CreateUnknownResult(SubsystemType subsystem, string message)
    {
        return new SubsystemHealthResult
        {
            Subsystem = subsystem,
            Status = HealthStatus.Unknown,
            Message = message
        };
    }

    private static HealthStatus DetermineOverallStatus(List<SubsystemHealthResult> results)
    {
        if (results.Any(r => r.Status == HealthStatus.Unhealthy))
            return HealthStatus.Unhealthy;

        if (results.Any(r => r.Status == HealthStatus.Degraded))
            return HealthStatus.Degraded;

        if (results.Any(r => r.Status == HealthStatus.Unknown))
            return HealthStatus.Degraded;

        return HealthStatus.Healthy;
    }

    private static string? GenerateRecommendation(HealthStatus status, List<string> issues)
    {
        return status switch
        {
            HealthStatus.Healthy => null,
            HealthStatus.Degraded => issues.Count > 0
                ? $"Review {issues.Count} warning(s) and monitor for escalation"
                : "Some subsystems need attention",
            HealthStatus.Unhealthy => issues.Count > 0
                ? $"Immediate attention required: {issues.Count} critical issue(s) detected"
                : "Critical issues detected - check logs for details",
            _ => "Unable to determine health status - check agent logs"
        };
    }

    #endregion
}
