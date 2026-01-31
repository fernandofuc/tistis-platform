// =====================================================
// TIS TIS PLATFORM - Monitoring Types
// FASE 7: Core types for agent monitoring system
// =====================================================

namespace TisTis.Agent.Core.Monitoring.Types;

/// <summary>
/// Overall health status of the agent.
/// </summary>
public enum HealthStatus
{
    /// <summary>All systems operational</summary>
    Healthy,

    /// <summary>Some issues detected but agent is functional</summary>
    Degraded,

    /// <summary>Critical issues preventing normal operation</summary>
    Unhealthy,

    /// <summary>Status unknown (check failed)</summary>
    Unknown
}

/// <summary>
/// Severity level for alerts and issues.
/// </summary>
public enum AlertSeverity
{
    /// <summary>Informational - no action required</summary>
    Info,

    /// <summary>Warning - should be investigated</summary>
    Warning,

    /// <summary>Error - requires attention</summary>
    Error,

    /// <summary>Critical - immediate action required</summary>
    Critical
}

/// <summary>
/// Type of metric being recorded.
/// </summary>
public enum MetricType
{
    /// <summary>Counter that only increases (e.g., total syncs)</summary>
    Counter,

    /// <summary>Value that can go up or down (e.g., queue size)</summary>
    Gauge,

    /// <summary>Distribution of values (e.g., response times)</summary>
    Histogram,

    /// <summary>Rate per time period (e.g., syncs per minute)</summary>
    Rate
}

/// <summary>
/// Categories of subsystems that can be monitored.
/// </summary>
public enum SubsystemType
{
    /// <summary>Core agent service</summary>
    Agent,

    /// <summary>Synchronization engine</summary>
    SyncEngine,

    /// <summary>Database connection</summary>
    Database,

    /// <summary>API client for TIS TIS server</summary>
    ApiClient,

    /// <summary>Credential storage</summary>
    CredentialStore,

    /// <summary>Logging subsystem</summary>
    Logging,

    /// <summary>SSL/TLS validation</summary>
    Security
}

/// <summary>
/// Health check result for a single subsystem.
/// Uses record type to support 'with' expressions for immutable modifications.
/// </summary>
public record SubsystemHealthResult
{
    /// <summary>Name of the subsystem</summary>
    public SubsystemType Subsystem { get; init; }

    /// <summary>Current health status</summary>
    public HealthStatus Status { get; init; }

    /// <summary>Human-readable status message</summary>
    public string Message { get; init; } = string.Empty;

    /// <summary>Time taken to perform the check</summary>
    public TimeSpan CheckDuration { get; init; }

    /// <summary>When the check was performed</summary>
    public DateTime CheckedAt { get; init; } = DateTime.UtcNow;

    /// <summary>Additional diagnostic data</summary>
    public Dictionary<string, object>? Metadata { get; init; }

    /// <summary>Error details if unhealthy</summary>
    public string? ErrorDetails { get; init; }
}

/// <summary>
/// Comprehensive health report for the entire agent.
/// </summary>
public class AgentHealthReport
{
    /// <summary>Overall agent health status</summary>
    public HealthStatus OverallStatus { get; init; }

    /// <summary>Agent version</summary>
    public string Version { get; init; } = string.Empty;

    /// <summary>When the report was generated</summary>
    public DateTime GeneratedAt { get; init; } = DateTime.UtcNow;

    /// <summary>Agent uptime</summary>
    public TimeSpan Uptime { get; init; }

    /// <summary>Health results for each subsystem</summary>
    public List<SubsystemHealthResult> Subsystems { get; init; } = new();

    /// <summary>Summary of issues found</summary>
    public List<string> Issues { get; init; } = new();

    /// <summary>Overall recommendation</summary>
    public string? Recommendation { get; init; }
}

/// <summary>
/// A single metric data point.
/// </summary>
public class MetricDataPoint
{
    /// <summary>Unique identifier for this metric</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>Type of metric</summary>
    public MetricType Type { get; init; }

    /// <summary>Current value</summary>
    public double Value { get; init; }

    /// <summary>Unit of measurement (e.g., "ms", "records", "bytes")</summary>
    public string? Unit { get; init; }

    /// <summary>When the metric was recorded</summary>
    public DateTime RecordedAt { get; init; } = DateTime.UtcNow;

    /// <summary>Tags for filtering/grouping</summary>
    public Dictionary<string, string>? Tags { get; init; }
}

/// <summary>
/// Histogram data with distribution statistics.
/// </summary>
public class HistogramMetric
{
    /// <summary>Metric name</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>Number of samples</summary>
    public long Count { get; init; }

    /// <summary>Sum of all values</summary>
    public double Sum { get; init; }

    /// <summary>Minimum value</summary>
    public double Min { get; init; }

    /// <summary>Maximum value</summary>
    public double Max { get; init; }

    /// <summary>Average value</summary>
    public double Mean => Count > 0 ? Sum / Count : 0;

    /// <summary>50th percentile</summary>
    public double P50 { get; init; }

    /// <summary>90th percentile</summary>
    public double P90 { get; init; }

    /// <summary>99th percentile</summary>
    public double P99 { get; init; }

    /// <summary>Standard deviation</summary>
    public double StdDev { get; init; }
}

/// <summary>
/// Alert notification.
/// </summary>
public class MonitoringAlert
{
    /// <summary>Unique identifier</summary>
    public string Id { get; init; } = Guid.NewGuid().ToString("N")[..16];

    /// <summary>Alert severity level</summary>
    public AlertSeverity Severity { get; init; }

    /// <summary>Which subsystem raised the alert</summary>
    public SubsystemType Source { get; init; }

    /// <summary>Alert title/summary</summary>
    public string Title { get; init; } = string.Empty;

    /// <summary>Detailed message</summary>
    public string Message { get; init; } = string.Empty;

    /// <summary>When the alert was raised</summary>
    public DateTime RaisedAt { get; init; } = DateTime.UtcNow;

    /// <summary>Associated metric name if applicable</summary>
    public string? MetricName { get; init; }

    /// <summary>Threshold that was exceeded</summary>
    public double? Threshold { get; init; }

    /// <summary>Actual value that triggered alert</summary>
    public double? ActualValue { get; init; }

    /// <summary>Whether alert has been acknowledged</summary>
    public bool Acknowledged { get; set; }

    /// <summary>When alert was acknowledged</summary>
    public DateTime? AcknowledgedAt { get; set; }
}

/// <summary>
/// Diagnostic information for troubleshooting.
/// </summary>
public class DiagnosticInfo
{
    /// <summary>When diagnostics were collected</summary>
    public DateTime CollectedAt { get; init; } = DateTime.UtcNow;

    /// <summary>Agent version</summary>
    public string AgentVersion { get; init; } = string.Empty;

    /// <summary>Machine name</summary>
    public string MachineName { get; init; } = Environment.MachineName;

    /// <summary>Operating system version</summary>
    public string OsVersion { get; init; } = Environment.OSVersion.ToString();

    /// <summary>Process ID</summary>
    public int ProcessId { get; init; } = Environment.ProcessId;

    /// <summary>Working set memory in bytes</summary>
    public long WorkingSetBytes { get; init; }

    /// <summary>Number of threads</summary>
    public int ThreadCount { get; init; }

    /// <summary>Process start time</summary>
    public DateTime ProcessStartTime { get; init; }

    /// <summary>Current sync engine state</summary>
    public string? SyncEngineState { get; init; }

    /// <summary>Last successful sync time</summary>
    public DateTime? LastSuccessfulSync { get; init; }

    /// <summary>Consecutive error count</summary>
    public int ConsecutiveErrors { get; init; }

    /// <summary>Last error message</summary>
    public string? LastError { get; init; }

    /// <summary>Configuration summary (redacted)</summary>
    public Dictionary<string, string> ConfigurationSummary { get; init; } = new();

    /// <summary>Recent log entries (last N entries)</summary>
    public List<string> RecentLogs { get; init; } = new();
}

/// <summary>
/// Configuration for monitoring thresholds.
/// </summary>
public class MonitoringThresholds
{
    /// <summary>Maximum consecutive errors before critical alert</summary>
    public int MaxConsecutiveErrors { get; init; } = 5;

    /// <summary>Maximum sync duration in seconds before warning</summary>
    public int MaxSyncDurationSeconds { get; init; } = 300;

    /// <summary>Maximum API response time in ms before warning</summary>
    public int MaxApiResponseTimeMs { get; init; } = 5000;

    /// <summary>Maximum database query time in ms before warning</summary>
    public int MaxDbQueryTimeMs { get; init; } = 10000;

    /// <summary>Maximum memory usage in MB before warning</summary>
    public int MaxMemoryUsageMb { get; init; } = 500;

    /// <summary>Minimum disk space in MB before warning</summary>
    public int MinDiskSpaceMb { get; init; } = 100;

    /// <summary>Maximum time since last sync in minutes before warning</summary>
    public int MaxTimeSinceLastSyncMinutes { get; init; } = 10;
}
