// =====================================================
// TIS TIS PLATFORM - Diagnostics Service
// FASE 7: Collects comprehensive diagnostic information
// Implements secure redaction of sensitive data
// =====================================================

using System.Diagnostics;
using System.Text;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Monitoring.Alerting;
using TisTis.Agent.Core.Monitoring.HealthCheck;
using TisTis.Agent.Core.Monitoring.Metrics;
using TisTis.Agent.Core.Monitoring.Types;
using TisTis.Agent.Core.Security;

namespace TisTis.Agent.Core.Monitoring.Diagnostics;

/// <summary>
/// Interface for diagnostics service.
/// </summary>
public interface IDiagnosticsService : IDisposable
{
    /// <summary>
    /// Collects comprehensive diagnostic information.
    /// </summary>
    Task<DiagnosticInfo> CollectDiagnosticsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates a diagnostic report as formatted text.
    /// </summary>
    Task<string> GenerateReportAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a quick diagnostic summary without full collection.
    /// </summary>
    DiagnosticQuickSummary GetQuickSummary();

    /// <summary>
    /// Gets recent log entries (redacted).
    /// </summary>
    IReadOnlyList<string> GetRecentLogs(int maxEntries = 50);

    /// <summary>
    /// Adds a log entry to the in-memory buffer.
    /// </summary>
    void AddLogEntry(string entry);
}

/// <summary>
/// Quick diagnostic summary for fast checks.
/// </summary>
public class DiagnosticQuickSummary
{
    public string AgentVersion { get; init; } = string.Empty;
    public TimeSpan Uptime { get; init; }
    public HealthStatus HealthStatus { get; init; }
    public long MemoryUsageMb { get; init; }
    public int ThreadCount { get; init; }
    public int ActiveAlerts { get; init; }
    public int ConsecutiveErrors { get; init; }
    public DateTime? LastSuccessfulSync { get; init; }
}

/// <summary>
/// Service that collects comprehensive diagnostic information.
/// Implements secure redaction of sensitive data.
/// </summary>
public class DiagnosticsService : IDiagnosticsService
{
    private readonly AgentConfiguration _config;
    private readonly IHealthCheckService _healthCheckService;
    private readonly IMetricsCollector _metricsCollector;
    private readonly IAlertingService _alertingService;
    private readonly ILogger<DiagnosticsService> _logger;

    private readonly CircularBuffer<string> _logBuffer;
    private readonly object _logLock = new();
    private readonly DateTime _startTime;
    private bool _disposed;

    /// <summary>
    /// Maximum number of log entries to keep in memory.
    /// </summary>
    private const int MaxLogEntries = 500;

    /// <summary>
    /// Configuration keys that should be redacted.
    /// </summary>
    private static readonly HashSet<string> SensitiveConfigKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "AuthToken",
        "Token",
        "Password",
        "Secret",
        "ApiKey",
        "ConnectionString",
        "Key",
        "Credential",
        "Certificate",
        "PrivateKey"
    };

    /// <summary>
    /// FIX ITER1-D1: Static patterns to avoid allocation on every AddLogEntry call
    /// </summary>
    private static readonly (string Pattern, string Replacement)[] SensitiveLogPatterns =
    {
        ("Bearer ", "Bearer [REDACTED]"),
        ("Authorization:", "Authorization: [REDACTED]"),
        ("auth_token=", "auth_token=[REDACTED]"),
        ("access_token=", "access_token=[REDACTED]"),
        ("password=", "password=[REDACTED]"),
        ("secret=", "secret=[REDACTED]"),
        ("api_key=", "api_key=[REDACTED]")
    };

    /// <summary>
    /// FIX ITER1-D2: Static array for value delimiters
    /// </summary>
    private static readonly char[] ValueDelimiters = { ' ', '\n', '\r', '&', '"', '\'' };

    public DiagnosticsService(
        AgentConfiguration config,
        IHealthCheckService healthCheckService,
        IMetricsCollector metricsCollector,
        IAlertingService alertingService,
        ILogger<DiagnosticsService> logger)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _healthCheckService = healthCheckService ?? throw new ArgumentNullException(nameof(healthCheckService));
        _metricsCollector = metricsCollector ?? throw new ArgumentNullException(nameof(metricsCollector));
        _alertingService = alertingService ?? throw new ArgumentNullException(nameof(alertingService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        _logBuffer = new CircularBuffer<string>(MaxLogEntries);
        _startTime = DateTime.UtcNow;
    }

    /// <inheritdoc />
    public async Task<DiagnosticInfo> CollectDiagnosticsAsync(CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();

        _logger.LogDebug("Collecting diagnostic information");

        try
        {
            var process = Process.GetCurrentProcess();
            var healthReport = await _healthCheckService.CheckHealthAsync(cancellationToken);
            var metricsSummary = _metricsCollector.GetSummary();
            var alertStats = _alertingService.GetStatistics();

            // Collect sync state from metrics
            var metrics = _metricsCollector.GetMetrics();
            var consecutiveErrors = (int)(metrics.FirstOrDefault(
                m => m.Name == MetricsCollector.MetricNames.ConsecutiveErrors)?.Value ?? 0);

            // Determine last successful sync
            DateTime? lastSuccessfulSync = null;
            var lastSyncMetric = metrics.FirstOrDefault(m => m.Name == "agent.sync.last_successful");
            if (lastSyncMetric != null)
            {
                lastSuccessfulSync = lastSyncMetric.RecordedAt;
            }

            // Collect recent logs
            List<string> recentLogs;
            lock (_logLock)
            {
                recentLogs = _logBuffer.ToList();
            }

            return new DiagnosticInfo
            {
                CollectedAt = DateTime.UtcNow,
                AgentVersion = _config.Version,
                MachineName = Environment.MachineName,
                OsVersion = Environment.OSVersion.ToString(),
                ProcessId = Environment.ProcessId,
                WorkingSetBytes = process.WorkingSet64,
                ThreadCount = process.Threads.Count,
                ProcessStartTime = process.StartTime.ToUniversalTime(),
                SyncEngineState = DetermineSyncState(healthReport),
                LastSuccessfulSync = lastSuccessfulSync,
                ConsecutiveErrors = consecutiveErrors,
                LastError = GetLastError(recentLogs),
                ConfigurationSummary = GetRedactedConfiguration(),
                RecentLogs = recentLogs.TakeLast(100).ToList()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error collecting diagnostics");
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<string> GenerateReportAsync(CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();

        var diagnostics = await CollectDiagnosticsAsync(cancellationToken);
        var healthReport = await _healthCheckService.CheckHealthAsync(cancellationToken);
        var alertStats = _alertingService.GetStatistics();
        var metricsSummary = _metricsCollector.GetSummary();

        var sb = new StringBuilder();
        sb.AppendLine("================================================================");
        sb.AppendLine("        TIS TIS AGENT - DIAGNOSTIC REPORT");
        sb.AppendLine("================================================================");
        sb.AppendLine();

        // Header
        sb.AppendLine($"Generated At:      {diagnostics.CollectedAt:yyyy-MM-dd HH:mm:ss} UTC");
        sb.AppendLine($"Agent Version:     {diagnostics.AgentVersion}");
        sb.AppendLine($"Machine Name:      {diagnostics.MachineName}");
        sb.AppendLine($"OS Version:        {diagnostics.OsVersion}");
        sb.AppendLine($"Process ID:        {diagnostics.ProcessId}");
        sb.AppendLine();

        // Health Summary
        sb.AppendLine("--- HEALTH SUMMARY ---");
        sb.AppendLine($"Overall Status:    {healthReport.OverallStatus}");
        sb.AppendLine($"Uptime:            {healthReport.Uptime}");
        sb.AppendLine();

        if (healthReport.Issues.Count > 0)
        {
            sb.AppendLine("Issues Detected:");
            foreach (var issue in healthReport.Issues)
            {
                sb.AppendLine($"  - {issue}");
            }
            sb.AppendLine();
        }

        // Subsystem Status
        sb.AppendLine("--- SUBSYSTEM STATUS ---");
        foreach (var subsystem in healthReport.Subsystems)
        {
            sb.AppendLine($"  {subsystem.Subsystem,-15} {subsystem.Status,-10} ({subsystem.CheckDuration.TotalMilliseconds:F0}ms)");
            if (!string.IsNullOrEmpty(subsystem.ErrorDetails))
            {
                sb.AppendLine($"    Error: {subsystem.ErrorDetails}");
            }
        }
        sb.AppendLine();

        // Resource Usage
        sb.AppendLine("--- RESOURCE USAGE ---");
        sb.AppendLine($"Memory (Working Set): {diagnostics.WorkingSetBytes / 1024 / 1024:F1} MB");
        sb.AppendLine($"Thread Count:         {diagnostics.ThreadCount}");
        sb.AppendLine($"Process Start:        {diagnostics.ProcessStartTime:yyyy-MM-dd HH:mm:ss} UTC");
        sb.AppendLine();

        // Sync Status
        sb.AppendLine("--- SYNC STATUS ---");
        sb.AppendLine($"Sync Engine State:    {diagnostics.SyncEngineState ?? "Unknown"}");
        sb.AppendLine($"Last Successful Sync: {FormatNullableDateTime(diagnostics.LastSuccessfulSync)}");
        sb.AppendLine($"Consecutive Errors:   {diagnostics.ConsecutiveErrors}");
        if (!string.IsNullOrEmpty(diagnostics.LastError))
        {
            sb.AppendLine($"Last Error:           {diagnostics.LastError}");
        }
        sb.AppendLine();

        // Alert Statistics
        sb.AppendLine("--- ALERT STATISTICS ---");
        sb.AppendLine($"Total Alerts:     {alertStats.TotalAlerts}");
        sb.AppendLine($"Active Alerts:    {alertStats.ActiveAlerts}");
        sb.AppendLine($"Critical:         {alertStats.CriticalAlerts}");
        sb.AppendLine($"Errors:           {alertStats.ErrorAlerts}");
        sb.AppendLine($"Warnings:         {alertStats.WarningAlerts}");
        sb.AppendLine($"Last Alert:       {FormatNullableDateTime(alertStats.LastAlertTime)}");
        sb.AppendLine();

        // Metrics Summary
        sb.AppendLine("--- METRICS SUMMARY ---");
        sb.AppendLine($"Collection Period:  {metricsSummary.CollectionPeriod}");
        sb.AppendLine($"Total Metrics:      {metricsSummary.TotalMetrics}");
        sb.AppendLine($"  Counters:         {metricsSummary.CounterCount}");
        sb.AppendLine($"  Gauges:           {metricsSummary.GaugeCount}");
        sb.AppendLine($"  Histograms:       {metricsSummary.HistogramCount}");
        sb.AppendLine();

        if (metricsSummary.KeyMetrics.Count > 0)
        {
            sb.AppendLine("Key Metrics:");
            foreach (var kvp in metricsSummary.KeyMetrics)
            {
                sb.AppendLine($"  {kvp.Key}: {kvp.Value:F2}");
            }
            sb.AppendLine();
        }

        // Configuration (Redacted)
        sb.AppendLine("--- CONFIGURATION (REDACTED) ---");
        foreach (var kvp in diagnostics.ConfigurationSummary)
        {
            sb.AppendLine($"  {kvp.Key}: {kvp.Value}");
        }
        sb.AppendLine();

        // Recent Logs (Last 20)
        sb.AppendLine("--- RECENT LOG ENTRIES (Last 20) ---");
        foreach (var log in diagnostics.RecentLogs.TakeLast(20))
        {
            sb.AppendLine($"  {log}");
        }
        sb.AppendLine();

        sb.AppendLine("================================================================");
        sb.AppendLine("                    END OF REPORT");
        sb.AppendLine("================================================================");

        return sb.ToString();
    }

    /// <inheritdoc />
    public DiagnosticQuickSummary GetQuickSummary()
    {
        ThrowIfDisposed();

        var process = Process.GetCurrentProcess();
        var lastHealthReport = _healthCheckService.GetLastHealthReport();
        var alertStats = _alertingService.GetStatistics();
        var metrics = _metricsCollector.GetMetrics();

        var consecutiveErrors = (int)(metrics.FirstOrDefault(
            m => m.Name == MetricsCollector.MetricNames.ConsecutiveErrors)?.Value ?? 0);

        DateTime? lastSuccessfulSync = null;
        var lastSyncMetric = metrics.FirstOrDefault(m => m.Name == "agent.sync.last_successful");
        if (lastSyncMetric != null)
        {
            lastSuccessfulSync = lastSyncMetric.RecordedAt;
        }

        return new DiagnosticQuickSummary
        {
            AgentVersion = _config.Version,
            Uptime = DateTime.UtcNow - _startTime,
            HealthStatus = lastHealthReport?.OverallStatus ?? HealthStatus.Unknown,
            MemoryUsageMb = process.WorkingSet64 / 1024 / 1024,
            ThreadCount = process.Threads.Count,
            ActiveAlerts = alertStats.ActiveAlerts,
            ConsecutiveErrors = consecutiveErrors,
            LastSuccessfulSync = lastSuccessfulSync
        };
    }

    /// <inheritdoc />
    public IReadOnlyList<string> GetRecentLogs(int maxEntries = 50)
    {
        ThrowIfDisposed();

        lock (_logLock)
        {
            return _logBuffer.TakeLast(Math.Min(maxEntries, MaxLogEntries)).ToList();
        }
    }

    /// <inheritdoc />
    public void AddLogEntry(string entry)
    {
        if (_disposed) return;
        if (string.IsNullOrWhiteSpace(entry)) return;

        // Redact sensitive data from log entry
        var redactedEntry = RedactLogEntry(entry);

        lock (_logLock)
        {
            _logBuffer.Add($"[{DateTime.UtcNow:HH:mm:ss.fff}] {redactedEntry}");
        }
    }

    #region Helper Methods

    private string DetermineSyncState(AgentHealthReport healthReport)
    {
        var syncSubsystem = healthReport.Subsystems
            .FirstOrDefault(s => s.Subsystem == SubsystemType.SyncEngine);

        if (syncSubsystem == null)
            return "Unknown";

        return syncSubsystem.Status switch
        {
            HealthStatus.Healthy => "Running",
            HealthStatus.Degraded => "Degraded",
            HealthStatus.Unhealthy => "Error",
            _ => "Unknown"
        };
    }

    private string? GetLastError(List<string> recentLogs)
    {
        // Find the last error log entry
        var errorPatterns = new[] { "[Error]", "[Critical]", "ERROR:", "CRITICAL:", "Exception:" };

        return recentLogs
            .LastOrDefault(log => errorPatterns.Any(p =>
                log.Contains(p, StringComparison.OrdinalIgnoreCase)));
    }

    private Dictionary<string, string> GetRedactedConfiguration()
    {
        var result = new Dictionary<string, string>();

        // Basic agent info (safe to expose)
        result["AgentId"] = SecureUtilities.Redact(_config.AgentId, 8);
        result["TenantId"] = SecureUtilities.Redact(_config.TenantId, 8);
        result["BranchId"] = !string.IsNullOrEmpty(_config.BranchId)
            ? SecureUtilities.Redact(_config.BranchId, 8)
            : "(not set)";
        result["Version"] = _config.Version;

        // Server configuration (FIX: use correct property paths from AgentConfiguration)
        result["ServerUrl"] = RedactUrl(_config.Api.BaseUrl);
        result["SyncIntervalSeconds"] = _config.Sync.IntervalSeconds.ToString();
        result["HeartbeatIntervalSeconds"] = _config.Sync.HeartbeatIntervalSeconds.ToString();

        // SoftRestaurant configuration (redacted)
        result["SR.SqlInstance"] = SecureUtilities.Redact(_config.SoftRestaurant.SqlInstance, 8);
        result["SR.DatabaseName"] = SecureUtilities.Redact(_config.SoftRestaurant.DatabaseName, 8);
        result["SR.Version"] = _config.SoftRestaurant.Version ?? "(not set)";
        result["SR.EmpresaId"] = _config.SoftRestaurant.EmpresaId?.ToString() ?? "(not set)";

        // Auth token status (never expose the actual token)
        result["AuthToken"] = !string.IsNullOrEmpty(_config.AuthToken)
            ? $"[SET - Hash: {SecureUtilities.ComputeHashPrefix(_config.AuthToken)}]"
            : "[NOT SET]";

        return result;
    }

    private static string RedactUrl(string url)
    {
        if (string.IsNullOrEmpty(url))
            return "(not set)";

        try
        {
            var uri = new Uri(url);
            // Keep scheme and host, redact path if contains IDs
            return $"{uri.Scheme}://{uri.Host}{(uri.Port != 80 && uri.Port != 443 ? $":{uri.Port}" : "")}/*";
        }
        catch
        {
            return "[INVALID URL]";
        }
    }

    /// FIX ITER1-D3: Use static patterns to avoid allocation on every call
    private static string RedactLogEntry(string entry)
    {
        var result = entry;

        foreach (var (pattern, replacement) in SensitiveLogPatterns)
        {
            var index = result.IndexOf(pattern, StringComparison.OrdinalIgnoreCase);
            if (index >= 0)
            {
                // Find the end of the value (space, newline, or end of string)
                var valueStart = index + pattern.Length;
                var valueEnd = result.IndexOfAny(ValueDelimiters, valueStart);
                if (valueEnd < 0) valueEnd = result.Length;

                result = result[..index] + replacement + result[valueEnd..];
            }
        }

        return result;
    }

    private static string FormatNullableDateTime(DateTime? dateTime)
    {
        return dateTime.HasValue
            ? $"{dateTime.Value:yyyy-MM-dd HH:mm:ss} UTC"
            : "N/A";
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(DiagnosticsService));
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
            lock (_logLock)
            {
                _logBuffer.Clear();
            }
            _logger.LogDebug("DiagnosticsService disposed");
        }

        _disposed = true;
    }

    #endregion
}

/// <summary>
/// Thread-safe circular buffer for log entries.
/// </summary>
internal class CircularBuffer<T>
{
    private readonly T[] _buffer;
    private readonly object _lock = new();
    private int _head;
    private int _tail;
    private int _count;

    public CircularBuffer(int capacity)
    {
        if (capacity <= 0)
            throw new ArgumentOutOfRangeException(nameof(capacity), "Capacity must be positive");

        _buffer = new T[capacity];
        _head = 0;
        _tail = 0;
        _count = 0;
    }

    public int Count
    {
        get
        {
            lock (_lock)
            {
                return _count;
            }
        }
    }

    public int Capacity => _buffer.Length;

    public void Add(T item)
    {
        lock (_lock)
        {
            _buffer[_head] = item;
            _head = (_head + 1) % _buffer.Length;

            if (_count == _buffer.Length)
            {
                // Buffer is full, move tail
                _tail = (_tail + 1) % _buffer.Length;
            }
            else
            {
                _count++;
            }
        }
    }

    public List<T> ToList()
    {
        lock (_lock)
        {
            var result = new List<T>(_count);
            var index = _tail;

            for (int i = 0; i < _count; i++)
            {
                result.Add(_buffer[index]);
                index = (index + 1) % _buffer.Length;
            }

            return result;
        }
    }

    public IEnumerable<T> TakeLast(int count)
    {
        lock (_lock)
        {
            var takeCount = Math.Min(count, _count);
            var startIndex = (_tail + _count - takeCount + _buffer.Length) % _buffer.Length;

            var result = new List<T>(takeCount);
            var index = startIndex;

            for (int i = 0; i < takeCount; i++)
            {
                result.Add(_buffer[index]);
                index = (index + 1) % _buffer.Length;
            }

            return result;
        }
    }

    public void Clear()
    {
        lock (_lock)
        {
            Array.Clear(_buffer, 0, _buffer.Length);
            _head = 0;
            _tail = 0;
            _count = 0;
        }
    }
}
