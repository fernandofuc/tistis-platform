// =====================================================
// TIS TIS PLATFORM - Monitoring Orchestrator
// FASE 7: Coordinates all monitoring services
// Background service with periodic checks
// =====================================================

using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Monitoring.Alerting;
using TisTis.Agent.Core.Monitoring.Diagnostics;
using TisTis.Agent.Core.Monitoring.HealthCheck;
using TisTis.Agent.Core.Monitoring.Metrics;
using TisTis.Agent.Core.Monitoring.Types;

namespace TisTis.Agent.Core.Monitoring;

/// <summary>
/// Interface for monitoring orchestrator.
/// </summary>
public interface IMonitoringOrchestrator : IHostedService, IDisposable
{
    /// <summary>
    /// Gets the current health status.
    /// </summary>
    HealthStatus CurrentHealthStatus { get; }

    /// <summary>
    /// Gets the health check service.
    /// </summary>
    IHealthCheckService HealthChecks { get; }

    /// <summary>
    /// Gets the metrics collector.
    /// </summary>
    IMetricsCollector Metrics { get; }

    /// <summary>
    /// Gets the alerting service.
    /// </summary>
    IAlertingService Alerts { get; }

    /// <summary>
    /// Gets the diagnostics service.
    /// </summary>
    IDiagnosticsService Diagnostics { get; }

    /// <summary>
    /// Forces an immediate health check.
    /// </summary>
    Task<AgentHealthReport> ForceHealthCheckAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Records a sync operation metric.
    /// </summary>
    void RecordSyncOperation(bool success, TimeSpan duration, int recordCount = 0);

    /// <summary>
    /// Records an API call metric.
    /// </summary>
    void RecordApiCall(bool success, TimeSpan duration, string? endpoint = null);

    /// <summary>
    /// Records a database query metric.
    /// </summary>
    void RecordDbQuery(bool success, TimeSpan duration, string? queryType = null);

    /// <summary>
    /// Updates consecutive error count.
    /// </summary>
    void UpdateConsecutiveErrors(int count);

    /// <summary>
    /// Records last successful sync time.
    /// </summary>
    void RecordLastSuccessfulSync();

    /// <summary>
    /// Event raised when health status changes.
    /// </summary>
    event EventHandler<HealthStatusChangedEventArgs>? HealthStatusChanged;
}

/// <summary>
/// Event arguments for health status change.
/// </summary>
public class HealthStatusChangedEventArgs : EventArgs
{
    public HealthStatus PreviousStatus { get; }
    public HealthStatus NewStatus { get; }
    public string? Reason { get; }

    public HealthStatusChangedEventArgs(HealthStatus previousStatus, HealthStatus newStatus, string? reason = null)
    {
        PreviousStatus = previousStatus;
        NewStatus = newStatus;
        Reason = reason;
    }
}

/// <summary>
/// Orchestrates all monitoring services with periodic checks.
/// Runs as a background hosted service.
/// </summary>
public class MonitoringOrchestrator : BackgroundService, IMonitoringOrchestrator
{
    private readonly IHealthCheckService _healthCheckService;
    private readonly IMetricsCollector _metricsCollector;
    private readonly IAlertingService _alertingService;
    private readonly IDiagnosticsService _diagnosticsService;
    private readonly ILogger<MonitoringOrchestrator> _logger;

    // FIX ITER1-A1: Use dedicated lock for thread-safe health status access
    private readonly object _healthStatusLock = new();
    private HealthStatus _currentHealthStatus = HealthStatus.Unknown;
    private DateTime _lastHealthCheck = DateTime.MinValue;
    private DateTime _lastAlertCleanup = DateTime.MinValue;
    private volatile bool _disposed;

    /// <summary>
    /// Interval between health checks.
    /// </summary>
    private static readonly TimeSpan HealthCheckInterval = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Interval between alert evaluations.
    /// </summary>
    private static readonly TimeSpan AlertEvaluationInterval = TimeSpan.FromSeconds(15);

    /// <summary>
    /// Interval between metric snapshots (for process metrics).
    /// </summary>
    private static readonly TimeSpan MetricSnapshotInterval = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Interval for cleaning up old alerts.
    /// </summary>
    private static readonly TimeSpan AlertCleanupInterval = TimeSpan.FromHours(1);

    /// <summary>
    /// Maximum age for acknowledged alerts before cleanup.
    /// </summary>
    private static readonly TimeSpan MaxAlertAge = TimeSpan.FromDays(7);

    /// <inheritdoc />
    public event EventHandler<HealthStatusChangedEventArgs>? HealthStatusChanged;

    /// <inheritdoc />
    /// FIX ITER1-A2: Thread-safe health status with atomic check-and-set
    public HealthStatus CurrentHealthStatus
    {
        get
        {
            lock (_healthStatusLock)
            {
                return _currentHealthStatus;
            }
        }
        private set
        {
            HealthStatus previous;
            bool changed = false;

            lock (_healthStatusLock)
            {
                if (_currentHealthStatus != value)
                {
                    previous = _currentHealthStatus;
                    _currentHealthStatus = value;
                    changed = true;
                }
                else
                {
                    previous = value; // Just to satisfy compiler
                }
            }

            // Invoke event outside lock to prevent deadlock
            if (changed)
            {
                OnHealthStatusChanged(previous, value);
            }
        }
    }

    /// <inheritdoc />
    public IHealthCheckService HealthChecks => _healthCheckService;

    /// <inheritdoc />
    public IMetricsCollector Metrics => _metricsCollector;

    /// <inheritdoc />
    public IAlertingService Alerts => _alertingService;

    /// <inheritdoc />
    public IDiagnosticsService Diagnostics => _diagnosticsService;

    public MonitoringOrchestrator(
        IHealthCheckService healthCheckService,
        IMetricsCollector metricsCollector,
        IAlertingService alertingService,
        IDiagnosticsService diagnosticsService,
        ILogger<MonitoringOrchestrator> logger)
    {
        _healthCheckService = healthCheckService ?? throw new ArgumentNullException(nameof(healthCheckService));
        _metricsCollector = metricsCollector ?? throw new ArgumentNullException(nameof(metricsCollector));
        _alertingService = alertingService ?? throw new ArgumentNullException(nameof(alertingService));
        _diagnosticsService = diagnosticsService ?? throw new ArgumentNullException(nameof(diagnosticsService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Subscribe to alert events
        _alertingService.AlertRaised += OnAlertRaised;
        _alertingService.AlertAcknowledged += OnAlertAcknowledged;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Monitoring orchestrator starting...");

        try
        {
            // Initial health check
            await PerformHealthCheckAsync(stoppingToken);

            // Main monitoring loop
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.UtcNow;

                    // Periodic health check
                    if (now - _lastHealthCheck >= HealthCheckInterval)
                    {
                        await PerformHealthCheckAsync(stoppingToken);
                    }

                    // Record process metrics
                    RecordProcessMetrics();

                    // Evaluate alerts
                    await _alertingService.EvaluateAsync(stoppingToken);

                    // Periodic alert cleanup
                    if (now - _lastAlertCleanup >= AlertCleanupInterval)
                    {
                        PerformAlertCleanup();
                    }

                    // Wait for next iteration
                    await Task.Delay(AlertEvaluationInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in monitoring loop");
                    // Continue the loop, don't crash
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                }
            }
        }
        finally
        {
            _logger.LogInformation("Monitoring orchestrator stopped");
        }
    }

    /// <inheritdoc />
    public async Task<AgentHealthReport> ForceHealthCheckAsync(CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        return await PerformHealthCheckAsync(cancellationToken);
    }

    /// <inheritdoc />
    public void RecordSyncOperation(bool success, TimeSpan duration, int recordCount = 0)
    {
        ThrowIfDisposed();

        // Record counters
        _metricsCollector.IncrementCounter(MetricsCollector.MetricNames.SyncTotal);
        if (success)
        {
            _metricsCollector.IncrementCounter(MetricsCollector.MetricNames.SyncSuccessful);
            if (recordCount > 0)
            {
                _metricsCollector.IncrementCounter(
                    MetricsCollector.MetricNames.RecordsSynced,
                    recordCount);
            }
        }
        else
        {
            _metricsCollector.IncrementCounter(MetricsCollector.MetricNames.SyncFailed);
        }

        // Record duration histogram
        _metricsCollector.RecordHistogram(
            MetricsCollector.MetricNames.SyncDurationMs,
            duration.TotalMilliseconds,
            "ms");

        // Log to diagnostics
        var logEntry = success
            ? $"Sync completed: {recordCount} records in {duration.TotalSeconds:F1}s"
            : $"Sync failed after {duration.TotalSeconds:F1}s";
        _diagnosticsService.AddLogEntry(logEntry);
    }

    /// <inheritdoc />
    public void RecordApiCall(bool success, TimeSpan duration, string? endpoint = null)
    {
        ThrowIfDisposed();

        var tags = endpoint != null ? new Dictionary<string, string> { { "endpoint", endpoint } } : null;

        _metricsCollector.IncrementCounter(
            MetricsCollector.MetricNames.ApiRequestsTotal,
            1,
            tags);

        if (!success)
        {
            _metricsCollector.IncrementCounter(
                MetricsCollector.MetricNames.ApiErrors,
                1,
                tags);
        }

        _metricsCollector.RecordHistogram(
            MetricsCollector.MetricNames.ApiRequestDurationMs,
            duration.TotalMilliseconds,
            "ms",
            tags);
    }

    /// <inheritdoc />
    public void RecordDbQuery(bool success, TimeSpan duration, string? queryType = null)
    {
        ThrowIfDisposed();

        var tags = queryType != null ? new Dictionary<string, string> { { "query_type", queryType } } : null;

        _metricsCollector.IncrementCounter(
            MetricsCollector.MetricNames.DbQueriesTotal,
            1,
            tags);

        if (!success)
        {
            _metricsCollector.IncrementCounter(
                MetricsCollector.MetricNames.DbErrors,
                1,
                tags);
        }

        _metricsCollector.RecordHistogram(
            MetricsCollector.MetricNames.DbQueryDurationMs,
            duration.TotalMilliseconds,
            "ms",
            tags);
    }

    /// <inheritdoc />
    public void UpdateConsecutiveErrors(int count)
    {
        ThrowIfDisposed();

        _metricsCollector.RecordGauge(
            MetricsCollector.MetricNames.ConsecutiveErrors,
            count);

        if (count > 0)
        {
            _metricsCollector.IncrementCounter(MetricsCollector.MetricNames.ErrorsTotal);
        }
    }

    /// <inheritdoc />
    public void RecordLastSuccessfulSync()
    {
        ThrowIfDisposed();

        // Record as gauge with timestamp value (epoch seconds)
        var epochSeconds = new DateTimeOffset(DateTime.UtcNow).ToUnixTimeSeconds();
        _metricsCollector.RecordGauge(
            "agent.sync.last_successful",
            epochSeconds,
            "epoch_seconds");

        // Also record minutes since last sync (useful for alerts)
        _metricsCollector.RecordGauge(
            "agent.sync.last_sync_minutes_ago",
            0,
            "minutes");
    }

    #region Private Methods

    private async Task<AgentHealthReport> PerformHealthCheckAsync(CancellationToken cancellationToken)
    {
        _lastHealthCheck = DateTime.UtcNow;

        try
        {
            var report = await _healthCheckService.CheckHealthAsync(cancellationToken);
            CurrentHealthStatus = report.OverallStatus;

            _logger.LogDebug(
                "Health check completed: {Status} ({IssueCount} issues)",
                report.OverallStatus,
                report.Issues.Count);

            // Raise alerts for unhealthy subsystems
            foreach (var subsystem in report.Subsystems.Where(s => s.Status == HealthStatus.Unhealthy))
            {
                _alertingService.RaiseAlert(
                    AlertSeverity.Error,
                    subsystem.Subsystem,
                    $"{subsystem.Subsystem} is unhealthy",
                    subsystem.ErrorDetails ?? subsystem.Message);
            }

            return report;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check failed");
            CurrentHealthStatus = HealthStatus.Unknown;
            throw;
        }
    }

    private void RecordProcessMetrics()
    {
        try
        {
            using var process = System.Diagnostics.Process.GetCurrentProcess();

            _metricsCollector.RecordGauge(
                MetricsCollector.MetricNames.MemoryUsageMb,
                process.WorkingSet64 / 1024.0 / 1024.0,
                "MB");

            _metricsCollector.RecordGauge(
                MetricsCollector.MetricNames.ThreadCount,
                process.Threads.Count);

            _metricsCollector.RecordGauge(
                MetricsCollector.MetricNames.UptimeSeconds,
                (DateTime.UtcNow - _healthCheckService.StartTime).TotalSeconds,
                "seconds");
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to record process metrics");
        }
    }

    private void PerformAlertCleanup()
    {
        _lastAlertCleanup = DateTime.UtcNow;
        var cleaned = _alertingService.ClearOldAlerts(MaxAlertAge);
        if (cleaned > 0)
        {
            _logger.LogDebug("Cleaned up {Count} old alerts", cleaned);
        }
    }

    /// FIX ITER1-A3: Added disposal check to event handler
    private void OnAlertRaised(object? sender, AlertEventArgs e)
    {
        if (_disposed) return;

        try
        {
            var alert = e.Alert;
            _diagnosticsService.AddLogEntry(
                $"[ALERT:{alert.Severity}] {alert.Title}: {alert.Message}");

            // Log critical and error alerts more prominently
            if (alert.Severity == AlertSeverity.Critical)
            {
                _logger.LogCritical(
                    "Critical alert raised: {Title} - {Message}",
                    alert.Title,
                    alert.Message);
            }
        }
        catch (ObjectDisposedException)
        {
            // Service disposed during event handling - ignore
        }
    }

    /// FIX ITER1-A3: Added disposal check to event handler
    private void OnAlertAcknowledged(object? sender, AlertEventArgs e)
    {
        if (_disposed) return;

        try
        {
            _diagnosticsService.AddLogEntry(
                $"[ALERT:Acknowledged] {e.Alert.Title}");
        }
        catch (ObjectDisposedException)
        {
            // Service disposed during event handling - ignore
        }
    }

    /// FIX ITER1-A4: Fixed unsafe event invocation pattern
    private void OnHealthStatusChanged(HealthStatus previous, HealthStatus current)
    {
        if (_disposed) return;

        var reason = current switch
        {
            HealthStatus.Healthy => "All systems operational",
            HealthStatus.Degraded => "Some issues detected",
            HealthStatus.Unhealthy => "Critical issues present",
            _ => "Status unknown"
        };

        _logger.LogInformation(
            "Health status changed: {Previous} -> {Current} ({Reason})",
            previous,
            current,
            reason);

        // Raise alert on transition to unhealthy
        if (current == HealthStatus.Unhealthy && previous != HealthStatus.Unhealthy)
        {
            try
            {
                _alertingService.RaiseAlert(
                    AlertSeverity.Critical,
                    SubsystemType.Agent,
                    "Agent health critical",
                    "Agent health status has changed to Unhealthy");
            }
            catch (ObjectDisposedException)
            {
                // Service disposed - ignore
            }
        }

        // FIX ITER1-A4: Copy event delegate to prevent race condition
        var handler = HealthStatusChanged;
        handler?.Invoke(this, new HealthStatusChangedEventArgs(previous, current, reason));
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(MonitoringOrchestrator));
    }

    #endregion

    #region IDisposable

    /// FIX ITER1-A5: Proper dispose pattern for BackgroundService inheritance
    public override void Dispose()
    {
        if (_disposed) return;

        Dispose(true);
        GC.SuppressFinalize(this);
        base.Dispose(); // Cancel stopping CTS in BackgroundService
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        // Set disposed flag first to stop event handlers
        _disposed = true;

        if (disposing)
        {
            // FIX ITER1-A6: Null-safe event unsubscription
            if (_alertingService != null)
            {
                _alertingService.AlertRaised -= OnAlertRaised;
                _alertingService.AlertAcknowledged -= OnAlertAcknowledged;
            }

            // FIX ITER2-D1: DO NOT dispose injected dependencies
            // The DI container is responsible for disposing singletons.
            // Disposing them here could cause double-dispose exceptions or
            // break other services that depend on them.
            // We only unsubscribe from events (which we subscribed to in constructor).

            _logger.LogDebug("MonitoringOrchestrator disposed");
        }
    }

    #endregion
}
