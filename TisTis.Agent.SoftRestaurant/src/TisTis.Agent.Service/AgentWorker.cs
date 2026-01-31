// =====================================================
// TIS TIS PLATFORM - Agent Worker
// Main background service for the agent
// =====================================================

using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Api;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Database;
using TisTis.Agent.Core.Detection;
using TisTis.Agent.Core.Monitoring;
using TisTis.Agent.Core.Security;
using TisTis.Agent.Core.Sync;

namespace TisTis.Agent.Service;

/// <summary>
/// Main background service that orchestrates the agent lifecycle
/// </summary>
public class AgentWorker : BackgroundService
{
    private readonly ILogger<AgentWorker> _logger;
    private readonly AgentConfiguration _config;
    private readonly ISoftRestaurantDetector _detector;
    private readonly ITisTisApiClient _apiClient;
    private readonly ISyncEngine _syncEngine;
    private readonly TokenManager _tokenManager;
    private readonly CredentialStore _credentialStore;
    private readonly ISchemaValidator? _schemaValidator;
    private readonly IMonitoringOrchestrator? _monitoring;

    // Volatile for thread-safe access from multiple threads (ExecuteAsync and StopAsync)
    private volatile bool _isRegistered = false;
    private volatile bool _schemaValidated = false;

    public AgentWorker(
        ILogger<AgentWorker> logger,
        AgentConfiguration config,
        ISoftRestaurantDetector detector,
        ITisTisApiClient apiClient,
        ISyncEngine syncEngine,
        TokenManager tokenManager,
        CredentialStore credentialStore,
        ISchemaValidator? schemaValidator = null,
        IMonitoringOrchestrator? monitoring = null)
    {
        _logger = logger;
        _config = config;
        _detector = detector;
        _apiClient = apiClient;
        _syncEngine = syncEngine;
        _tokenManager = tokenManager;
        _credentialStore = credentialStore;
        _schemaValidator = schemaValidator;
        _monitoring = monitoring;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Agent worker starting...");

        // FASE 7: Log monitoring system status
        if (_monitoring != null)
        {
            _logger.LogInformation("Monitoring system active: Health={Health}", _monitoring.CurrentHealthStatus);
        }
        else
        {
            _logger.LogWarning("Monitoring system not available - metrics will not be collected");
        }

        try
        {
            // Step 1: Load credentials from store
            await LoadCredentialsAsync(stoppingToken);

            // Step 2: Detect Soft Restaurant if connection string not configured
            if (string.IsNullOrEmpty(_config.SoftRestaurant.ConnectionString))
            {
                await DetectSoftRestaurantAsync(stoppingToken);
            }

            // Step 3: Validate database schema (critical for first sync)
            await ValidateSchemaAsync(stoppingToken);

            // Step 4: Register with TIS TIS
            await RegisterWithTisTisAsync(stoppingToken);

            // Step 5: Start sync engine
            _logger.LogInformation("Starting sync engine...");
            await _syncEngine.StartAsync(stoppingToken);

            // Step 6: Run heartbeat loop
            await RunHeartbeatLoopAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Agent worker stopping (cancellation requested)");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Agent worker encountered a fatal error");
            throw;
        }
        finally
        {
            await _syncEngine.StopAsync();
            _logger.LogInformation("Agent worker stopped");
        }
    }

    private async Task LoadCredentialsAsync(CancellationToken cancellationToken)
    {
        _logger.LogDebug("Loading credentials from store...");

        if (_credentialStore.Exists())
        {
            _tokenManager.LoadFromStore();
            _logger.LogInformation("Credentials loaded successfully");
        }
        else
        {
            _logger.LogInformation("No stored credentials found, will use configuration");
        }

        await Task.CompletedTask;
    }

    private async Task DetectSoftRestaurantAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Detecting Soft Restaurant installation...");

        var result = await _detector.DetectAsync(cancellationToken);

        if (!result.Success)
        {
            _logger.LogError("Failed to detect Soft Restaurant: {Summary}", result.GetSummary());
            throw new InvalidOperationException(
                $"Soft Restaurant not found. Please ensure SQL Server is running and the SR database exists. " +
                $"Checked instances: {string.Join(", ", result.Methods.Select(m => m.Name))}");
        }

        _logger.LogInformation("Soft Restaurant detected: {Summary}", result.GetSummary());

        // Update configuration with detected values
        _config.SoftRestaurant.ConnectionString = result.ConnectionString!;
        _config.SoftRestaurant.SqlInstance = result.SqlInstance!;
        _config.SoftRestaurant.DatabaseName = result.DatabaseName!;
        _config.SoftRestaurant.Version = result.Version ?? "Unknown";
        _config.SoftRestaurant.EmpresaId = result.EmpresaId ?? "";

        // Save to credential store
        _tokenManager.SaveToStore();
    }

    private async Task ValidateSchemaAsync(CancellationToken cancellationToken)
    {
        if (_schemaValidator == null)
        {
            _logger.LogWarning("Schema validator not available, skipping validation");
            return;
        }

        _logger.LogInformation("Validating Soft Restaurant database schema...");

        try
        {
            var schemaStopwatch = Stopwatch.StartNew();
            var result = await _schemaValidator.ValidateSchemaAsync(cancellationToken);
            schemaStopwatch.Stop();

            if (!result.Success)
            {
                _logger.LogError(
                    "Schema validation FAILED! Missing required tables: {MissingTables}. " +
                    "Errors: {Errors}. Duration: {Duration}ms",
                    string.Join(", ", result.MissingRequiredTables),
                    string.Join("; ", result.Errors),
                    schemaStopwatch.ElapsedMilliseconds);

                // Send validation results to API even on failure
                var apiResponse = await _schemaValidator.SendValidationToApiAsync(result, cancellationToken);

                if (apiResponse.Recommendations?.Count > 0)
                {
                    _logger.LogWarning("Recommendations from TIS TIS: {Recommendations}",
                        string.Join("; ", apiResponse.Recommendations));
                }

                // Throw to prevent starting with invalid schema
                throw new InvalidOperationException(
                    $"Database schema validation failed. Missing tables: {string.Join(", ", result.MissingRequiredTables)}. " +
                    "Please ensure you are connected to a valid Soft Restaurant database.");
            }

            _schemaValidated = true;

            // Save detected SR version to configuration for use by other services
            _config.SoftRestaurant.DetectedVersion = result.DetectedVersion;

            _logger.LogInformation(
                "Schema validation PASSED! Database: {Database}, Tables: {Found}/{Expected}, " +
                "Features: Sales={Sales}, Menu={Menu}, Inventory={Inventory}, Tables={Tables}. " +
                "SR Version: {SRVersion}. SQL Server: {SqlVersion}. Duration: {Duration}ms",
                result.DatabaseName,
                result.TablesFound,
                result.TablesExpected,
                result.CanSyncSales,
                result.CanSyncMenu,
                result.CanSyncInventory,
                result.CanSyncTables,
                result.DetectedVersionDisplay,
                result.SqlServerVersion?.Split('\n').FirstOrDefault()?.Substring(0, Math.Min(50, result.SqlServerVersion?.Split('\n').FirstOrDefault()?.Length ?? 0)) ?? "Unknown",
                schemaStopwatch.ElapsedMilliseconds);

            // Send validation results to API
            var sendResult = await _schemaValidator.SendValidationToApiAsync(result, cancellationToken);

            if (sendResult.Success)
            {
                _logger.LogDebug("Schema validation results sent to TIS TIS API successfully");
            }
            else
            {
                _logger.LogWarning("Failed to send schema validation to API: {Error}", sendResult.ErrorMessage);
            }

            // Update sync configuration based on schema availability
            if (!result.CanSyncSales && _config.Sync.SyncSales)
            {
                _logger.LogWarning("Disabling sales sync - required tables not found");
                _config.Sync.SyncSales = false;
            }
            if (!result.CanSyncMenu && _config.Sync.SyncMenu)
            {
                _logger.LogWarning("Disabling menu sync - required tables not found");
                _config.Sync.SyncMenu = false;
            }
            if (!result.CanSyncInventory && _config.Sync.SyncInventory)
            {
                _logger.LogWarning("Disabling inventory sync - required tables not found");
                _config.Sync.SyncInventory = false;
            }
            if (!result.CanSyncTables && _config.Sync.SyncTables)
            {
                _logger.LogWarning("Disabling tables sync - required tables not found");
                _config.Sync.SyncTables = false;
            }
        }
        catch (InvalidOperationException)
        {
            throw; // Re-throw validation failures
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Schema validation encountered an unexpected error");

            // Don't fail startup on validation errors, just log and continue
            _logger.LogWarning("Continuing without schema validation due to error");
        }
    }

    private async Task RegisterWithTisTisAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Registering agent with TIS TIS...");

        var request = _tokenManager.BuildRegisterRequest();

        // FASE 7: Time the registration API call
        var registerStopwatch = Stopwatch.StartNew();
        var response = await _apiClient.RegisterAsync(request, cancellationToken);
        registerStopwatch.Stop();

        if (!response.Success)
        {
            _logger.LogError("Failed to register agent: {Error} (Code: {ErrorCode})",
                response.ErrorMessage, response.ErrorCode);

            // FASE 7: Record failed registration
            _monitoring?.RecordApiCall(false, registerStopwatch.Elapsed, "register");

            // If token expired, throw specific error
            if (response.ErrorCode == "TOKEN_EXPIRED")
            {
                throw new InvalidOperationException(
                    "Authentication token has expired. Please regenerate credentials from the TIS TIS dashboard.");
            }

            throw new InvalidOperationException($"Agent registration failed: {response.ErrorMessage}");
        }

        _isRegistered = true;
        _logger.LogInformation("Agent registered successfully. Tenant: {Tenant}, Status: {Status}",
            response.TenantName, response.Status);

        // FASE 7: Record successful registration
        _monitoring?.RecordApiCall(true, registerStopwatch.Elapsed, "register");

        // Update sync configuration from server
        if (response.SyncConfig != null)
        {
            _config.Sync.IntervalSeconds = response.SyncConfig.SyncIntervalSeconds;
            _config.Sync.SyncMenu = response.SyncConfig.SyncMenu;
            _config.Sync.SyncInventory = response.SyncConfig.SyncInventory;
            _config.Sync.SyncSales = response.SyncConfig.SyncSales;
            _config.Sync.SyncTables = response.SyncConfig.SyncTables;

            _logger.LogDebug("Sync config updated from server. Interval: {Interval}s",
                response.SyncConfig.SyncIntervalSeconds);
        }
    }

    private async Task RunHeartbeatLoopAsync(CancellationToken cancellationToken)
    {
        var heartbeatInterval = TimeSpan.FromSeconds(_config.Sync.HeartbeatIntervalSeconds);
        _logger.LogDebug("Starting heartbeat loop with interval: {Interval}s", heartbeatInterval.TotalSeconds);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(heartbeatInterval, cancellationToken);

                // Get current state from sync engine
                var state = _syncEngine.State;
                var status = state switch
                {
                    SyncEngineState.Syncing => "syncing",
                    SyncEngineState.Error => "error",
                    SyncEngineState.Running => "connected",
                    _ => "connected"
                };

                var stats = _syncEngine.GetStatistics();
                string? errorMessage = stats.ConsecutiveErrors > 0 ? stats.LastError : null;

                // FASE 7: Update monitoring metrics
                _monitoring?.UpdateConsecutiveErrors(stats.ConsecutiveErrors);
                _monitoring?.Metrics.IncrementCounter(
                    Core.Monitoring.Metrics.MetricsCollector.MetricNames.HeartbeatsTotal);

                var heartbeatStopwatch = Stopwatch.StartNew();
                var response = await _apiClient.SendHeartbeatAsync(status, errorMessage, cancellationToken);
                heartbeatStopwatch.Stop();

                // FASE 7: Record heartbeat duration
                _monitoring?.Metrics.RecordHistogram(
                    Core.Monitoring.Metrics.MetricsCollector.MetricNames.HeartbeatDurationMs,
                    heartbeatStopwatch.Elapsed.TotalMilliseconds,
                    "ms");

                if (!response.Success)
                {
                    _logger.LogWarning("Heartbeat failed: {Error}", response.ErrorMessage);
                    _monitoring?.RecordApiCall(false, heartbeatStopwatch.Elapsed, "heartbeat");
                }
                else
                {
                    _logger.LogDebug("Heartbeat sent. Status: {Status}", status);
                    _monitoring?.RecordApiCall(true, heartbeatStopwatch.Elapsed, "heartbeat");

                    // Check for config updates from server
                    if (response.SyncConfig != null)
                    {
                        if (response.SyncConfig.SyncIntervalSeconds != _config.Sync.IntervalSeconds)
                        {
                            _logger.LogInformation("Sync interval updated from server: {OldInterval}s -> {NewInterval}s",
                                _config.Sync.IntervalSeconds, response.SyncConfig.SyncIntervalSeconds);
                            _config.Sync.IntervalSeconds = response.SyncConfig.SyncIntervalSeconds;
                        }
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error in heartbeat loop");
                // Continue the loop, don't crash the service
                await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Agent worker stop requested");

        // FASE 7: Log final diagnostic summary
        if (_monitoring != null)
        {
            try
            {
                var summary = _monitoring.Diagnostics.GetQuickSummary();
                _logger.LogInformation(
                    "Final diagnostics - Uptime: {Uptime}, Health: {Health}, Alerts: {Alerts}, Errors: {Errors}",
                    summary.Uptime,
                    summary.HealthStatus,
                    summary.ActiveAlerts,
                    summary.ConsecutiveErrors);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to collect final diagnostics");
            }
        }

        // Send final heartbeat to indicate we're going offline
        try
        {
            if (_isRegistered)
            {
                await _apiClient.SendHeartbeatAsync("offline", "Service stopping", cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send offline heartbeat");
        }

        await base.StopAsync(cancellationToken);
    }
}
