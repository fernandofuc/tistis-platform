// =====================================================
// TIS TIS PLATFORM - Alerting Service
// FASE 7: Monitors metrics and generates alerts
// Thread-safe implementation with deduplication
// =====================================================

using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Monitoring.Metrics;
using TisTis.Agent.Core.Monitoring.Types;

namespace TisTis.Agent.Core.Monitoring.Alerting;

/// <summary>
/// Interface for alerting service.
/// </summary>
public interface IAlertingService : IDisposable
{
    /// <summary>
    /// Evaluates current metrics against thresholds and generates alerts.
    /// </summary>
    Task<IReadOnlyList<MonitoringAlert>> EvaluateAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all active (unacknowledged) alerts.
    /// </summary>
    IReadOnlyList<MonitoringAlert> GetActiveAlerts();

    /// <summary>
    /// Gets all alerts including acknowledged ones.
    /// </summary>
    IReadOnlyList<MonitoringAlert> GetAllAlerts();

    /// <summary>
    /// Acknowledges an alert by ID.
    /// </summary>
    bool AcknowledgeAlert(string alertId);

    /// <summary>
    /// Clears resolved alerts older than specified age.
    /// </summary>
    int ClearOldAlerts(TimeSpan maxAge);

    /// <summary>
    /// Raises a custom alert programmatically.
    /// </summary>
    MonitoringAlert RaiseAlert(
        AlertSeverity severity,
        SubsystemType source,
        string title,
        string message,
        string? metricName = null,
        double? threshold = null,
        double? actualValue = null);

    /// <summary>
    /// Gets alert statistics.
    /// </summary>
    AlertStatistics GetStatistics();

    /// <summary>
    /// Event raised when a new alert is generated.
    /// </summary>
    event EventHandler<AlertEventArgs>? AlertRaised;

    /// <summary>
    /// Event raised when an alert is acknowledged.
    /// </summary>
    event EventHandler<AlertEventArgs>? AlertAcknowledged;
}

/// <summary>
/// Event arguments for alert events.
/// </summary>
public class AlertEventArgs : EventArgs
{
    public MonitoringAlert Alert { get; }

    public AlertEventArgs(MonitoringAlert alert)
    {
        Alert = alert;
    }
}

/// <summary>
/// Statistics about alerts.
/// </summary>
public class AlertStatistics
{
    public int TotalAlerts { get; init; }
    public int ActiveAlerts { get; init; }
    public int AcknowledgedAlerts { get; init; }
    public int CriticalAlerts { get; init; }
    public int ErrorAlerts { get; init; }
    public int WarningAlerts { get; init; }
    public int InfoAlerts { get; init; }
    public DateTime? LastAlertTime { get; init; }
    public DateTime? LastCriticalAlertTime { get; init; }
}

/// <summary>
/// Service that monitors metrics against thresholds and generates alerts.
/// Thread-safe with alert deduplication to prevent spam.
/// </summary>
public class AlertingService : IAlertingService
{
    private readonly IMetricsCollector _metricsCollector;
    private readonly MonitoringThresholds _thresholds;
    private readonly ILogger<AlertingService> _logger;

    private readonly ConcurrentDictionary<string, MonitoringAlert> _alerts = new();
    private readonly ConcurrentDictionary<string, DateTime> _alertCooldowns = new();

    private readonly object _evaluationLock = new();
    private DateTime _lastEvaluation = DateTime.MinValue;
    private bool _disposed;

    /// <summary>
    /// Minimum interval between evaluations to prevent excessive processing.
    /// </summary>
    private static readonly TimeSpan MinEvaluationInterval = TimeSpan.FromSeconds(10);

    /// <summary>
    /// Cooldown period before re-raising the same alert type.
    /// </summary>
    private static readonly TimeSpan AlertCooldownPeriod = TimeSpan.FromMinutes(5);

    /// <summary>
    /// FIX ITER2-A1: Maximum number of alerts to prevent memory leak.
    /// </summary>
    private const int MaxAlerts = 500;

    /// <summary>
    /// FIX ITER2-A2: Absolute TTL for alerts (independent of acknowledgment).
    /// Alerts older than this will be evicted regardless of their state.
    /// </summary>
    private static readonly TimeSpan AbsoluteAlertTtl = TimeSpan.FromDays(3);

    /// <inheritdoc />
    public event EventHandler<AlertEventArgs>? AlertRaised;

    /// <inheritdoc />
    public event EventHandler<AlertEventArgs>? AlertAcknowledged;

    public AlertingService(
        IMetricsCollector metricsCollector,
        MonitoringThresholds thresholds,
        ILogger<AlertingService> logger)
    {
        _metricsCollector = metricsCollector ?? throw new ArgumentNullException(nameof(metricsCollector));
        _thresholds = thresholds ?? throw new ArgumentNullException(nameof(thresholds));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<MonitoringAlert>> EvaluateAsync(CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();

        // Rate limit evaluations
        lock (_evaluationLock)
        {
            var elapsed = DateTime.UtcNow - _lastEvaluation;
            if (elapsed < MinEvaluationInterval)
            {
                _logger.LogDebug(
                    "Skipping evaluation, last run {Elapsed}ms ago (min: {Min}ms)",
                    elapsed.TotalMilliseconds,
                    MinEvaluationInterval.TotalMilliseconds);
                return Array.Empty<MonitoringAlert>();
            }
            _lastEvaluation = DateTime.UtcNow;
        }

        var newAlerts = new List<MonitoringAlert>();

        try
        {
            // FIX ITER1-C1: Cache metrics once per evaluation to avoid repeated GetMetrics() calls
            var cachedMetrics = _metricsCollector.GetMetrics();

            // Evaluate each threshold with cached metrics
            await Task.Run(() =>
            {
                EvaluateConsecutiveErrors(newAlerts, cachedMetrics);
                EvaluateSyncDuration(newAlerts);
                EvaluateApiResponseTime(newAlerts);
                EvaluateDbQueryTime(newAlerts);
                EvaluateMemoryUsage(newAlerts, cachedMetrics);
                EvaluateTimeSinceLastSync(newAlerts, cachedMetrics);
            }, cancellationToken);

            if (newAlerts.Count > 0)
            {
                _logger.LogInformation(
                    "Alert evaluation completed: {NewAlerts} new alerts generated",
                    newAlerts.Count);
            }
            else
            {
                _logger.LogDebug("Alert evaluation completed: no new alerts");
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogDebug("Alert evaluation cancelled");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during alert evaluation");
        }

        return newAlerts;
    }

    /// <inheritdoc />
    public IReadOnlyList<MonitoringAlert> GetActiveAlerts()
    {
        ThrowIfDisposed();

        return _alerts.Values
            .Where(a => !a.Acknowledged)
            .OrderByDescending(a => a.Severity)
            .ThenByDescending(a => a.RaisedAt)
            .ToList();
    }

    /// <inheritdoc />
    public IReadOnlyList<MonitoringAlert> GetAllAlerts()
    {
        ThrowIfDisposed();

        return _alerts.Values
            .OrderByDescending(a => a.RaisedAt)
            .ToList();
    }

    /// <inheritdoc />
    public bool AcknowledgeAlert(string alertId)
    {
        ThrowIfDisposed();

        if (string.IsNullOrEmpty(alertId))
            return false;

        if (_alerts.TryGetValue(alertId, out var alert))
        {
            alert.Acknowledged = true;
            alert.AcknowledgedAt = DateTime.UtcNow;

            _logger.LogInformation(
                "Alert acknowledged: {AlertId} ({Title})",
                alertId,
                alert.Title);

            OnAlertAcknowledged(alert);
            return true;
        }

        return false;
    }

    /// <inheritdoc />
    public int ClearOldAlerts(TimeSpan maxAge)
    {
        ThrowIfDisposed();

        var now = DateTime.UtcNow;
        var cutoff = now - maxAge;
        var absoluteCutoff = now - AbsoluteAlertTtl;
        var removedCount = 0;

        foreach (var kvp in _alerts)
        {
            var alert = kvp.Value;
            var shouldRemove = false;

            // FIX ITER2-A3: Remove alerts that exceed absolute TTL (regardless of acknowledgment)
            if (alert.RaisedAt < absoluteCutoff)
            {
                shouldRemove = true;
            }
            // FIX ITER2-A4: Add null check for AcknowledgedAt
            else if (alert.Acknowledged && alert.AcknowledgedAt.HasValue && alert.AcknowledgedAt.Value < cutoff)
            {
                shouldRemove = true;
            }

            if (shouldRemove && _alerts.TryRemove(kvp.Key, out _))
            {
                removedCount++;
            }
        }

        // FIX ITER2-A5: Enforce maximum alerts limit (LRU eviction)
        if (_alerts.Count > MaxAlerts)
        {
            var alertsToRemove = _alerts
                .OrderBy(a => a.Value.RaisedAt)
                .Take(_alerts.Count - MaxAlerts)
                .Select(a => a.Key)
                .ToList();

            foreach (var key in alertsToRemove)
            {
                if (_alerts.TryRemove(key, out _))
                {
                    removedCount++;
                }
            }

            _logger.LogWarning(
                "Alert limit exceeded. Evicted {Count} oldest alerts to maintain maximum of {Max}",
                alertsToRemove.Count,
                MaxAlerts);
        }

        // Also clean up old cooldowns
        foreach (var kvp in _alertCooldowns)
        {
            if (kvp.Value < cutoff)
            {
                _alertCooldowns.TryRemove(kvp.Key, out _);
            }
        }

        if (removedCount > 0)
        {
            _logger.LogDebug("Cleared {Count} old alerts", removedCount);
        }

        return removedCount;
    }

    /// <inheritdoc />
    public MonitoringAlert RaiseAlert(
        AlertSeverity severity,
        SubsystemType source,
        string title,
        string message,
        string? metricName = null,
        double? threshold = null,
        double? actualValue = null)
    {
        ThrowIfDisposed();

        var alert = new MonitoringAlert
        {
            Severity = severity,
            Source = source,
            Title = title,
            Message = message,
            MetricName = metricName,
            Threshold = threshold,
            ActualValue = actualValue
        };

        // Store the alert
        _alerts[alert.Id] = alert;

        // Log based on severity
        LogAlert(alert);

        // Raise event
        OnAlertRaised(alert);

        return alert;
    }

    /// <inheritdoc />
    public AlertStatistics GetStatistics()
    {
        ThrowIfDisposed();

        var alerts = _alerts.Values.ToList();

        return new AlertStatistics
        {
            TotalAlerts = alerts.Count,
            ActiveAlerts = alerts.Count(a => !a.Acknowledged),
            AcknowledgedAlerts = alerts.Count(a => a.Acknowledged),
            CriticalAlerts = alerts.Count(a => a.Severity == AlertSeverity.Critical),
            ErrorAlerts = alerts.Count(a => a.Severity == AlertSeverity.Error),
            WarningAlerts = alerts.Count(a => a.Severity == AlertSeverity.Warning),
            InfoAlerts = alerts.Count(a => a.Severity == AlertSeverity.Info),
            LastAlertTime = alerts.Any() ? alerts.Max(a => a.RaisedAt) : null,
            // FIX ITER3-A3: Use DefaultIfEmpty to explicitly handle empty sequences
            LastCriticalAlertTime = alerts
                .Where(a => a.Severity == AlertSeverity.Critical)
                .Select(a => (DateTime?)a.RaisedAt)
                .DefaultIfEmpty(null)
                .Max()
        };
    }

    #region Threshold Evaluators

    /// FIX ITER1-C2: Accept cached metrics to avoid repeated GetMetrics() calls
    private void EvaluateConsecutiveErrors(List<MonitoringAlert> newAlerts, IReadOnlyList<MetricDataPoint> cachedMetrics)
    {
        var consecutiveErrorsMetric = cachedMetrics.FirstOrDefault(
            m => m.Name == MetricsCollector.MetricNames.ConsecutiveErrors);

        if (consecutiveErrorsMetric == null)
            return;

        var value = consecutiveErrorsMetric.Value;

        if (value >= _thresholds.MaxConsecutiveErrors)
        {
            var alert = TryRaiseThresholdAlert(
                "consecutive_errors",
                AlertSeverity.Critical,
                SubsystemType.Agent,
                "High consecutive error count",
                $"Agent has experienced {value} consecutive errors (threshold: {_thresholds.MaxConsecutiveErrors})",
                MetricsCollector.MetricNames.ConsecutiveErrors,
                _thresholds.MaxConsecutiveErrors,
                value);

            if (alert != null)
                newAlerts.Add(alert);
        }
        else if (value >= _thresholds.MaxConsecutiveErrors / 2.0)
        {
            var alert = TryRaiseThresholdAlert(
                "consecutive_errors_warning",
                AlertSeverity.Warning,
                SubsystemType.Agent,
                "Elevated consecutive error count",
                $"Agent has experienced {value} consecutive errors (threshold: {_thresholds.MaxConsecutiveErrors})",
                MetricsCollector.MetricNames.ConsecutiveErrors,
                _thresholds.MaxConsecutiveErrors,
                value);

            if (alert != null)
                newAlerts.Add(alert);
        }
    }

    private void EvaluateSyncDuration(List<MonitoringAlert> newAlerts)
    {
        var histogram = _metricsCollector.GetHistogram(MetricsCollector.MetricNames.SyncDurationMs);
        if (histogram == null || histogram.Count == 0)
            return;

        var thresholdMs = _thresholds.MaxSyncDurationSeconds * 1000.0;

        // Use P90 for threshold check (to catch consistently slow syncs)
        if (histogram.P90 > thresholdMs)
        {
            var alert = TryRaiseThresholdAlert(
                "sync_duration_slow",
                AlertSeverity.Warning,
                SubsystemType.SyncEngine,
                "Sync operations are slow",
                $"Sync P90 duration is {histogram.P90 / 1000.0:F1}s (threshold: {_thresholds.MaxSyncDurationSeconds}s)",
                MetricsCollector.MetricNames.SyncDurationMs,
                thresholdMs,
                histogram.P90);

            if (alert != null)
                newAlerts.Add(alert);
        }

        // P99 is critical
        if (histogram.P99 > thresholdMs * 2)
        {
            var alert = TryRaiseThresholdAlert(
                "sync_duration_critical",
                AlertSeverity.Error,
                SubsystemType.SyncEngine,
                "Sync operations critically slow",
                $"Sync P99 duration is {histogram.P99 / 1000.0:F1}s (threshold: {_thresholds.MaxSyncDurationSeconds * 2}s)",
                MetricsCollector.MetricNames.SyncDurationMs,
                thresholdMs * 2,
                histogram.P99);

            if (alert != null)
                newAlerts.Add(alert);
        }
    }

    private void EvaluateApiResponseTime(List<MonitoringAlert> newAlerts)
    {
        var histogram = _metricsCollector.GetHistogram(MetricsCollector.MetricNames.ApiRequestDurationMs);
        if (histogram == null || histogram.Count == 0)
            return;

        var thresholdMs = _thresholds.MaxApiResponseTimeMs;

        if (histogram.P90 > thresholdMs)
        {
            var alert = TryRaiseThresholdAlert(
                "api_response_slow",
                AlertSeverity.Warning,
                SubsystemType.ApiClient,
                "API responses are slow",
                $"API P90 response time is {histogram.P90:F0}ms (threshold: {thresholdMs}ms)",
                MetricsCollector.MetricNames.ApiRequestDurationMs,
                thresholdMs,
                histogram.P90);

            if (alert != null)
                newAlerts.Add(alert);
        }

        if (histogram.P99 > thresholdMs * 2)
        {
            var alert = TryRaiseThresholdAlert(
                "api_response_critical",
                AlertSeverity.Error,
                SubsystemType.ApiClient,
                "API responses critically slow",
                $"API P99 response time is {histogram.P99:F0}ms (threshold: {thresholdMs * 2}ms)",
                MetricsCollector.MetricNames.ApiRequestDurationMs,
                thresholdMs * 2,
                histogram.P99);

            if (alert != null)
                newAlerts.Add(alert);
        }
    }

    private void EvaluateDbQueryTime(List<MonitoringAlert> newAlerts)
    {
        var histogram = _metricsCollector.GetHistogram(MetricsCollector.MetricNames.DbQueryDurationMs);
        if (histogram == null || histogram.Count == 0)
            return;

        var thresholdMs = _thresholds.MaxDbQueryTimeMs;

        if (histogram.P90 > thresholdMs)
        {
            var alert = TryRaiseThresholdAlert(
                "db_query_slow",
                AlertSeverity.Warning,
                SubsystemType.Database,
                "Database queries are slow",
                $"Database P90 query time is {histogram.P90:F0}ms (threshold: {thresholdMs}ms)",
                MetricsCollector.MetricNames.DbQueryDurationMs,
                thresholdMs,
                histogram.P90);

            if (alert != null)
                newAlerts.Add(alert);
        }

        if (histogram.P99 > thresholdMs * 2)
        {
            var alert = TryRaiseThresholdAlert(
                "db_query_critical",
                AlertSeverity.Error,
                SubsystemType.Database,
                "Database queries critically slow",
                $"Database P99 query time is {histogram.P99:F0}ms (threshold: {thresholdMs * 2}ms)",
                MetricsCollector.MetricNames.DbQueryDurationMs,
                thresholdMs * 2,
                histogram.P99);

            if (alert != null)
                newAlerts.Add(alert);
        }
    }

    /// FIX ITER1-C3: Accept cached metrics to avoid repeated GetMetrics() calls
    private void EvaluateMemoryUsage(List<MonitoringAlert> newAlerts, IReadOnlyList<MetricDataPoint> cachedMetrics)
    {
        var memoryMetric = cachedMetrics.FirstOrDefault(
            m => m.Name == MetricsCollector.MetricNames.MemoryUsageMb);

        if (memoryMetric == null)
            return;

        var value = memoryMetric.Value;
        var threshold = _thresholds.MaxMemoryUsageMb;

        if (value >= threshold)
        {
            var alert = TryRaiseThresholdAlert(
                "memory_high",
                AlertSeverity.Warning,
                SubsystemType.Agent,
                "High memory usage",
                $"Memory usage is {value:F0}MB (threshold: {threshold}MB)",
                MetricsCollector.MetricNames.MemoryUsageMb,
                threshold,
                value);

            if (alert != null)
                newAlerts.Add(alert);
        }

        // Critical at 90% of threshold
        if (value >= threshold * 1.5)
        {
            var alert = TryRaiseThresholdAlert(
                "memory_critical",
                AlertSeverity.Critical,
                SubsystemType.Agent,
                "Critical memory usage",
                $"Memory usage is {value:F0}MB (critical threshold: {threshold * 1.5:F0}MB)",
                MetricsCollector.MetricNames.MemoryUsageMb,
                threshold * 1.5,
                value);

            if (alert != null)
                newAlerts.Add(alert);
        }
    }

    /// FIX ITER1-C4: Accept cached metrics to avoid repeated GetMetrics() calls
    private void EvaluateTimeSinceLastSync(List<MonitoringAlert> newAlerts, IReadOnlyList<MetricDataPoint> cachedMetrics)
    {
        var lastSyncMetric = cachedMetrics.FirstOrDefault(
            m => m.Name == "agent.sync.last_sync_minutes_ago");

        if (lastSyncMetric == null)
            return;

        var value = lastSyncMetric.Value;
        var threshold = _thresholds.MaxTimeSinceLastSyncMinutes;

        if (value >= threshold)
        {
            var alert = TryRaiseThresholdAlert(
                "sync_stale",
                AlertSeverity.Warning,
                SubsystemType.SyncEngine,
                "Sync is stale",
                $"Last sync was {value:F0} minutes ago (threshold: {threshold} minutes)",
                "agent.sync.last_sync_minutes_ago",
                threshold,
                value);

            if (alert != null)
                newAlerts.Add(alert);
        }

        // Critical if double the threshold
        if (value >= threshold * 2)
        {
            var alert = TryRaiseThresholdAlert(
                "sync_stale_critical",
                AlertSeverity.Error,
                SubsystemType.SyncEngine,
                "Sync is critically stale",
                $"Last sync was {value:F0} minutes ago (critical threshold: {threshold * 2} minutes)",
                "agent.sync.last_sync_minutes_ago",
                threshold * 2,
                value);

            if (alert != null)
                newAlerts.Add(alert);
        }
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Tries to raise a threshold-based alert with cooldown support.
    /// Returns null if the alert is on cooldown.
    /// </summary>
    private MonitoringAlert? TryRaiseThresholdAlert(
        string alertKey,
        AlertSeverity severity,
        SubsystemType source,
        string title,
        string message,
        string metricName,
        double threshold,
        double actualValue)
    {
        // Check cooldown
        if (_alertCooldowns.TryGetValue(alertKey, out var lastRaised))
        {
            if (DateTime.UtcNow - lastRaised < AlertCooldownPeriod)
            {
                _logger.LogDebug(
                    "Alert {AlertKey} is on cooldown (last raised: {LastRaised})",
                    alertKey,
                    lastRaised);
                return null;
            }
        }

        // Update cooldown
        _alertCooldowns[alertKey] = DateTime.UtcNow;

        // Raise alert
        return RaiseAlert(severity, source, title, message, metricName, threshold, actualValue);
    }

    private void LogAlert(MonitoringAlert alert)
    {
        var logMessage = "[{Severity}] {Title}: {Message}";

        switch (alert.Severity)
        {
            case AlertSeverity.Critical:
                _logger.LogCritical(logMessage, alert.Severity, alert.Title, alert.Message);
                break;
            case AlertSeverity.Error:
                _logger.LogError(logMessage, alert.Severity, alert.Title, alert.Message);
                break;
            case AlertSeverity.Warning:
                _logger.LogWarning(logMessage, alert.Severity, alert.Title, alert.Message);
                break;
            case AlertSeverity.Info:
            default:
                _logger.LogInformation(logMessage, alert.Severity, alert.Title, alert.Message);
                break;
        }
    }

    /// FIX ITER1-C5: Safe event invocation with copied delegate reference
    private void OnAlertRaised(MonitoringAlert alert)
    {
        var handler = AlertRaised;
        handler?.Invoke(this, new AlertEventArgs(alert));
    }

    /// FIX ITER1-C5: Safe event invocation with copied delegate reference
    private void OnAlertAcknowledged(MonitoringAlert alert)
    {
        var handler = AlertAcknowledged;
        handler?.Invoke(this, new AlertEventArgs(alert));
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(AlertingService));
    }

    #endregion

    #region IDisposable

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        if (disposing)
        {
            _alerts.Clear();
            _alertCooldowns.Clear();
            _logger.LogDebug("AlertingService disposed");
        }

        _disposed = true;
    }

    #endregion
}
